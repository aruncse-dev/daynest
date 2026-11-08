import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { saveHabit, saveTask, toggleHabit, toggleTask } from './actions'
import { loadSampleData } from './seed'
import { buildBackup, importBackup, validateBackup } from '@/lib/backup'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('tasks', () => {
  it('completing a recurring task only completes that occurrence', async () => {
    const t = await saveTask({
      title: 'Lay out clothes',
      priority: 'normal',
      category: 'Home',
      status: 'open',
      dueDate: '2026-11-01',
      recurrenceRule: { type: 'daily' },
    })
    await toggleTask(t, '2026-11-08')
    const occ = await db.taskOccurrences.toArray()
    expect(occ.map((o) => o.localDate)).toEqual(['2026-11-08'])
    expect((await db.tasks.get(t.id))!.status).toBe('open')
    await toggleTask(t, '2026-11-08') // reopen
    expect(await db.taskOccurrences.count()).toBe(0)
  })
  it('one-off tasks complete and reopen', async () => {
    const t = await saveTask({
      title: 'Pay bill',
      priority: 'high',
      category: 'Home',
      status: 'open',
      dueDate: '2026-11-08',
    })
    await toggleTask(t)
    expect((await db.tasks.get(t.id))!.status).toBe('done')
    await toggleTask((await db.tasks.get(t.id))!)
    expect((await db.tasks.get(t.id))!.status).toBe('open')
  })
})

describe('habits', () => {
  it('stores one entry per habit per date, and editing keeps history', async () => {
    const h = await saveHabit({ title: 'Walk', emoji: '🚶', scheduleDays: [], status: 'active' })
    await toggleHabit(h.id, '2026-11-07')
    await toggleHabit(h.id, '2026-11-08')
    await expect(
      db.habitEntries.add({ id: 'dupe', habitId: h.id, localDate: '2026-11-08', completedAt: '' }),
    ).rejects.toThrow()
    await saveHabit({ ...h, title: 'Evening walk', scheduleDays: [1, 3, 5] })
    const entries = await db.habitEntries.where('habitId').equals(h.id).toArray()
    expect(entries.map((e) => e.localDate).sort()).toEqual(['2026-11-07', '2026-11-08'])
  })
})

describe('backup validation', () => {
  it('rejects corrupt JSON', () => {
    const r = validateBackup('{"format": "daynest-backup", "tables": {')
    expect(r.ok).toBe(false)
  })
  it('rejects non-DayNest files and newer versions', () => {
    expect(validateBackup('{"hello":"world"}').ok).toBe(false)
    expect(
      validateBackup(
        JSON.stringify({
          format: 'daynest-backup',
          formatVersion: 99,
          schemaVersion: 1,
          tables: {},
        }),
      ).ok,
    ).toBe(false)
  })
  it('rejects an empty backup', () => {
    const r = validateBackup(
      JSON.stringify({
        format: 'daynest-backup',
        formatVersion: 1,
        schemaVersion: 1,
        tables: { tasks: [] },
      }),
    )
    expect(r.ok).toBe(false)
  })
  it('skips duplicate ids and duplicate habit check-ins with warnings', () => {
    const r = validateBackup(
      JSON.stringify({
        format: 'daynest-backup',
        formatVersion: 1,
        schemaVersion: 1,
        exportedAt: '',
        appVersion: 't',
        tables: {
          tasks: [
            { id: 'a', title: 'x' },
            { id: 'a', title: 'y' },
          ],
          habitEntries: [
            { id: '1', habitId: 'h', localDate: '2026-11-08' },
            { id: '2', habitId: 'h', localDate: '2026-11-08' },
          ],
        },
      }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.summary.tasks).toBe(1)
      expect(r.summary.habitEntries).toBe(1)
      expect(r.warnings.length).toBe(2)
    }
  })
  it('accepts older schema versions with a warning', () => {
    const r = validateBackup(
      JSON.stringify({
        format: 'daynest-backup',
        formatVersion: 1,
        schemaVersion: 0,
        tables: { tasks: [{ id: 'a' }] },
      }),
    )
    expect(r.ok && r.warnings.some((w) => w.includes('older'))).toBe(true)
  })
})

describe('export / import', () => {
  it('round-trips all records into a fresh database', async () => {
    await loadSampleData('Test')
    const before = await buildBackup()
    const text = JSON.stringify(before)
    await db.delete()
    await db.open()
    const r = validateBackup(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    await importBackup(r.backup, 'replace')
    const after = await buildBackup()
    for (const k of Object.keys(before.tables) as (keyof typeof before.tables)[]) {
      expect(after.tables[k]?.length, k).toBe(before.tables[k]?.length)
    }
  })
  it('merge keeps existing records and adds new ones', async () => {
    await saveTask({
      id: 'keep',
      title: 'Existing',
      priority: 'normal',
      category: 'Home',
      status: 'open',
    })
    const r = validateBackup(
      JSON.stringify({
        format: 'daynest-backup',
        formatVersion: 1,
        schemaVersion: 1,
        tables: {
          tasks: [
            {
              id: 'new',
              title: 'From backup',
              priority: 'normal',
              category: 'Home',
              status: 'open',
            },
          ],
        },
      }),
    )
    if (!r.ok) throw new Error('invalid')
    await importBackup(r.backup, 'merge')
    expect((await db.tasks.toArray()).map((t) => t.id).sort()).toEqual(['keep', 'new'])
  })
  it('an interrupted import leaves existing data untouched', async () => {
    await saveTask({
      id: 'keep',
      title: 'Existing',
      priority: 'normal',
      category: 'Home',
      status: 'open',
    })
    const r = validateBackup(
      JSON.stringify({
        format: 'daynest-backup',
        formatVersion: 1,
        schemaVersion: 1,
        tables: {
          tasks: [{ id: 'new', title: 'x' }],
          habitEntries: [{ id: 'e1', habitId: 'h', localDate: '2026-11-08' }],
        },
      }),
    )
    if (!r.ok) throw new Error('invalid')
    // Corrupt a later row so the write fails mid-transaction, after tables were cleared
    ;(r.backup.tables.habitEntries as Record<string, unknown>[])[0].id = { not: 'a valid key' }
    await expect(importBackup(r.backup, 'replace')).rejects.toBeTruthy()
    expect((await db.tasks.toArray()).map((t) => t.id)).toEqual(['keep'])
  })
})
