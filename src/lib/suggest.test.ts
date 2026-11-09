import { beforeEach, describe, expect, it } from 'vitest'
import { suggest, type SetupAnswers } from './suggest'
import { db } from '@/db/db'
import { applySuggestions, ensureProfile } from '@/db/setup'
import { REMINDER_PRESETS } from '@/db/reminderPresets'
import { HABIT_TEMPLATES } from './templates'

const base: SetupAnswers = { areas: ['organised', 'health'], wake: '06:30', phoneFreeAt: '22:00' }

describe('setup suggestions', () => {
  it('pre-ticks the phone-free habit, with a reminder 15 minutes before phone-down time', () => {
    const s = suggest(base)
    const h = s.find((x) => x.id === 'h:phone-free-night')
    expect(h?.title).toBe('No phone after 10 PM')
    expect(h?.recommended).toBe(true)
    expect(h?.kind === 'habit' && h.remindAt).toBe('21:45')
    expect(s.some((x) => x.id.startsWith('p:phonefree'))).toBe(false)
  })
  it('never pre-ticks health or calm items', () => {
    const s = suggest({ ...base, areas: ['health', 'calm'] })
    expect(
      s.filter((x) => x.area === 'health' || x.area === 'calm').some((x) => x.recommended),
    ).toBe(false)
  })
  it('skips phone-free items when not wanted', () => {
    expect(
      suggest({ ...base, phoneFreeAt: null }).some(
        (x) => x.id.includes('phone-free') || x.id.includes('phonefree'),
      ),
    ).toBe(false)
  })
  it('gives habits reminder times tuned to the daily rhythm', () => {
    const s = suggest({ ...base, wake: '07:00', phoneFreeAt: '21:30' })
    const plan = s.find((x) => x.id === 'h:plan-tomorrow')
    expect(plan?.kind === 'habit' && plan.remindAt).toBe('20:15')
    const top3 = s.find((x) => x.id === 'h:top3')
    expect(top3?.kind === 'habit' && top3.remindAt).toBe('07:45')
  })
  it('ignores old focus areas from earlier versions', () => {
    expect(() =>
      suggest({ ...base, areas: ['family', 'kids'] as unknown as SetupAnswers['areas'] }),
    ).not.toThrow()
  })
  it('only offers reminders that suit anyone', () => {
    const keys = REMINDER_PRESETS.map((p) => p.presetKey)
    expect(keys).not.toContain('footwear')
    expect(keys).not.toContain('kid-teeth')
    expect(HABIT_TEMPLATES.find((t) => t.key === 'phone-free-night')?.title).toBe(
      'No phone after 10 PM',
    )
  })
})

describe('applying suggestions', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })
  it('creates habits with linked reminders, enables phone-free hours, and is idempotent', async () => {
    const meId = await ensureProfile('Robin', 'R')
    const picks = suggest(base).filter((s) =>
      ['h:plan-tomorrow', 'h:phone-free-night', 'p:phonefree'].includes(s.id),
    )
    await applySuggestions(picks, base, meId)
    const plan = await db.habits.filter((h) => h.templateKey === 'plan-tomorrow').first()
    const linked = await db.reminders.filter((r) => r.link?.id === plan!.id).first()
    expect(linked?.times).toEqual(['20:45'])
    expect((await db.settings.get('quietHours'))?.value).toMatchObject({
      enabled: true,
      start: '22:00',
      end: '06:30',
    })

    await applySuggestions(picks, base, await ensureProfile('Robin', 'R'))
    expect(await db.profiles.count()).toBe(1)
    expect(await db.habits.count()).toBe(2)
    expect(await db.reminders.count()).toBe(2)
  })
})
