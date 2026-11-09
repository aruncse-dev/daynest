import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { getSetting, saveReminder, setSetting, saveHabit } from './actions'
import { canCompleteFromReminder, completeLinked } from './links'
import { migratePhoneFree, phoneFreeHabit, setPhoneFree } from './phoneFree'
import { QUIET_KEY } from '@/lib/quietHours'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const on = { enabled: true, start: '22:00', end: '06:30', muteNudges: true }

describe('phone-free nights (a habit + reminder + quiet hours)', () => {
  it('turning on creates the habit and an important reminder 15 minutes before', async () => {
    await setPhoneFree(on, null)
    const h = await phoneFreeHabit()
    expect(h?.title).toBe('No phone after 10 PM')
    const r = await db.reminders.filter((x) => x.link?.id === h!.id).first()
    expect(r?.times).toEqual(['21:45'])
    expect(r?.priority).toBe('high')
    expect(canCompleteFromReminder(r!)).toBe(false) // a heads-up; the habit is ticked in the morning
    expect(await completeLinked(r!, '2026-11-09')).toBe(false)
    expect(await getSetting(QUIET_KEY, null as unknown)).toMatchObject(on)
  })

  it('changing the time moves the reminder and renames the habit', async () => {
    await setPhoneFree(on, null)
    await setPhoneFree({ ...on, start: '21:30' }, null)
    const h = await phoneFreeHabit()
    expect(h?.title).toBe('No phone after 9:30 PM')
    expect(await db.habits.count()).toBe(1)
    expect((await db.reminders.toArray()).map((r) => r.times)).toEqual([['21:15']])
  })

  it('turning off pauses the habit (history kept) and removes its reminder', async () => {
    await setPhoneFree(on, null)
    await setPhoneFree({ ...on, enabled: false }, null)
    expect((await phoneFreeHabit())?.status).toBe('paused')
    expect(await db.reminders.count()).toBe(0)
  })

  it('upgrades data from the older design once', async () => {
    await setSetting(QUIET_KEY, on)
    await saveHabit({
      title: 'No phone after 10 PM',
      emoji: '📵',
      scheduleDays: [],
      status: 'active',
      templateKey: 'phone-free-night',
    })
    for (const presetKey of ['phonefree', 'phonefree-soon'])
      await saveReminder({
        title: presetKey,
        message: 'x',
        emoji: '🌙',
        kind: 'times',
        times: ['22:00'],
        days: [],
        enabled: true,
        presetKey,
      })
    await saveReminder({
      title: 'Drink water',
      message: 'x',
      emoji: '💧',
      kind: 'times',
      times: ['10:00'],
      days: [],
      enabled: true,
      presetKey: 'water',
    })
    await migratePhoneFree()
    await migratePhoneFree() // second run does nothing
    const rs = await db.reminders.toArray()
    expect(rs.map((r) => r.title).sort()).toEqual(['Drink water', 'No phone after 10 PM'])
    expect(rs.find((r) => r.link)?.times).toEqual(['21:45'])
  })
})
