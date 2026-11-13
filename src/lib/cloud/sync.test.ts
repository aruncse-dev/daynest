// @vitest-environment node
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { DayNestDB } from '@/db/db'
import {
  decryptJson,
  deriveKeys,
  encryptJson,
  keysMatch,
  makeCheck,
  newKeyCode,
  newSalt,
  normalizeKeyCode,
  rowKey,
} from './crypto'
import { MemoryStore } from './store'
import { syncOnce } from './sync'

const now = () => new Date().toISOString()
const later = (ms: number) => new Date(Date.now() + ms).toISOString()

describe('family key code', () => {
  it('is 20 readable characters in groups of four, and forgiving to type', () => {
    const code = newKeyCode()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/)
    expect(normalizeKeyCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code)
    expect(normalizeKeyCode('k7qm 2xpa 9dtr w4ne b3hO')).toBe('K7QM-2XPA-9DTR-W4NE-B3H0')
    expect(normalizeKeyCode('too short')).toBeNull()
  })

  it('encrypts so only the same code + salt can read it, and detects tampering', async () => {
    const code = newKeyCode()
    const salt = newSalt()
    const keys = await deriveKeys(code, salt)
    const box = await encryptJson(keys, { title: 'Mia birthday' })
    expect(box).not.toContain('Mia')
    expect(await decryptJson(await deriveKeys(code, salt), box)).toEqual({ title: 'Mia birthday' })

    const check = await makeCheck(keys)
    expect(await keysMatch(keys, check)).toBe(true)
    expect(await keysMatch(await deriveKeys(newKeyCode(), salt), check)).toBe(false)

    const bytes = atob(box)
    const flipped = btoa(
      bytes.slice(0, 20) + String.fromCharCode(bytes.charCodeAt(20) ^ 1) + bytes.slice(21),
    )
    await expect(decryptJson(keys, flipped)).rejects.toThrow()
  })
})

describe('sync between two phones through one Sheet', () => {
  const dbs: DayNestDB[] = []
  const phone = async (name: string) => {
    const db = new DayNestDB(name)
    await db.open()
    dbs.push(db)
    return db
  }
  afterEach(async () => {
    for (const db of dbs.splice(0)) {
      db.close()
      await Dexie.delete(db.name)
    }
  })

  it('copies, updates, deletes and keeps phone-only fields on the phone', async () => {
    const keys = await deriveKeys(newKeyCode(), newSalt())
    const sheet = new MemoryStore()
    const a = await phone('phone-a')
    const b = await phone('phone-b')

    await a.tasks.put({
      id: 't1',
      title: 'Pay school fees',
      priority: 'normal',
      category: 'Home',
      status: 'open',
      profileIds: ['mia'],
      createdAt: now(),
      updatedAt: now(),
    })
    await a.reminders.put({
      id: 'r1',
      title: 'Drink water',
      message: 'Sip',
      emoji: '💧',
      kind: 'times',
      times: ['10:00'],
      days: [],
      enabled: true,
      lastFiredSlot: '2026-11-13T10:00:00.000Z',
      createdAt: now(),
      updatedAt: now(),
    })
    await a.settings.put({ key: 'theme', value: 'dark', updatedAt: now() }) // per phone
    await a.settings.put({ key: 'customEmojis', value: ['🦚'], updatedAt: now() }) // shared

    expect(await syncOnce(a, sheet, keys)).toEqual({ pulled: 0, pushed: 3, newer: 0 })
    // nothing readable in the Sheet
    expect(JSON.stringify(sheet.rows)).not.toMatch(/school|water|mia|tasks/i)

    await syncOnce(b, sheet, keys)
    expect((await b.tasks.get('t1'))?.title).toBe('Pay school fees')
    expect((await b.reminders.get('r1'))?.lastFiredSlot).toBeUndefined()
    expect(await b.settings.get('theme')).toBeUndefined()
    expect((await b.settings.get('customEmojis'))?.value).toEqual(['🦚'])

    // B edits later, A deletes the reminder: both changes meet
    await b.tasks.update('t1', { title: 'Pay school fees (term 2)', updatedAt: later(1000) })
    await a.reminders.delete('r1')
    await new Promise((r) => setTimeout(r, 20)) // tombstone is written after commit
    await syncOnce(b, sheet, keys)
    await syncOnce(a, sheet, keys)
    await syncOnce(b, sheet, keys)
    expect((await a.tasks.get('t1'))?.title).toBe('Pay school fees (term 2)')
    expect(await b.reminders.get('r1')).toBeUndefined()

    // nothing left to do once both agree
    expect(await syncOnce(a, sheet, keys)).toEqual({ pulled: 0, pushed: 0, newer: 0 })
  })

  it('a habit ticked on both phones the same day ends as one check-in', async () => {
    const keys = await deriveKeys(newKeyCode(), newSalt())
    const sheet = new MemoryStore()
    const a = await phone('phone-c')
    const b = await phone('phone-d')
    await a.habitEntries.put({
      id: 'ea',
      habitId: 'h1',
      localDate: '2026-11-13',
      completedAt: now(),
    })
    await b.habitEntries.put({
      id: 'eb',
      habitId: 'h1',
      localDate: '2026-11-13',
      completedAt: later(500),
    })
    await syncOnce(a, sheet, keys)
    await syncOnce(b, sheet, keys)
    await syncOnce(a, sheet, keys)
    await syncOnce(b, sheet, keys)
    expect(await a.habitEntries.count()).toBe(1)
    expect(await b.habitEntries.count()).toBe(1)
    expect((await a.habitEntries.toArray())[0].id).toBe((await b.habitEntries.toArray())[0].id)
  })

  it('a wrong key code reads nothing and changes nothing', async () => {
    const sheet = new MemoryStore()
    const a = await phone('phone-e')
    const b = await phone('phone-f')
    await a.goals.put({
      id: 'g1',
      title: 'Calm mornings',
      horizon: 'month',
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    })
    await syncOnce(a, sheet, await deriveKeys(newKeyCode(), newSalt()))
    const before = JSON.stringify(sheet.rows)
    const r = await syncOnce(b, sheet, await deriveKeys(newKeyCode(), newSalt()))
    expect(r.pulled).toBe(0)
    expect(await b.goals.count()).toBe(0)
    expect(JSON.stringify(sheet.rows.slice(0, 1))).toBe(
      JSON.stringify(JSON.parse(before).slice(0, 1)),
    )
  })

  it('upgrades entries from an older DayNest and leaves newer ones untouched', async () => {
    const keys = await deriveKeys(newKeyCode(), newSalt())
    const sheet = new MemoryStore()
    const t = now()
    // written by an older app: data v1, one person per to-do
    sheet.rows.push({
      key: await rowKey(keys, 'tasks', 'old'),
      updatedAt: t,
      deleted: false,
      payload: await encryptJson(keys, {
        t: 'tasks',
        id: 'old',
        s: 1,
        r: { id: 'old', title: 'Old to-do', profileId: 'mia', status: 'open', updatedAt: t },
      }),
    })
    // written by a future app (v99): a shape this phone doesn't know
    const futureKey = await rowKey(keys, 'tasks', 'future')
    const futurePayload = await encryptJson(keys, {
      t: 'tasks',
      id: 'future',
      s: 99,
      r: { id: 'future', title: 'From the future', people: { new: 'shape' }, updatedAt: t },
    })
    sheet.rows.push({ key: futureKey, updatedAt: t, deleted: false, payload: futurePayload })

    const a = await phone('phone-g')
    // this phone also has an (older) local copy of the future record and edits it later
    await a.tasks.put({
      id: 'future',
      title: 'Local stale copy',
      priority: 'normal',
      category: 'Home',
      status: 'open',
      createdAt: t,
      updatedAt: later(5000),
    })
    const r = await syncOnce(a, sheet, keys)

    expect((await a.tasks.get('old'))?.profileIds).toEqual(['mia'])
    expect((await a.tasks.get('old')) as unknown as { profileId?: string }).not.toHaveProperty(
      'profileId',
    )
    expect(r.newer).toBe(1)
    // the newer entry was neither imported nor overwritten
    expect((await a.tasks.get('future'))?.title).toBe('Local stale copy')
    expect(sheet.rows.find((x) => x.key === futureKey)?.payload).toBe(futurePayload)
  })
})
