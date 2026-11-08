import { beforeEach, describe, expect, it } from 'vitest'
import { suggest, type SetupAnswers } from './suggest'
import { db } from '@/db/db'
import { applySuggestions, ensureProfiles } from '@/db/setup'
import { HABIT_TEMPLATES } from './templates'

const base: SetupAnswers = {
  areas: ['health', 'family'],
  hasKids: false,
  wake: '06:30',
  phoneFreeAt: '22:00',
  worksWeekdays: true,
}

describe('setup suggestions', () => {
  it('always includes phone-free night items when a phone-free time is chosen', () => {
    const s = suggest(base)
    expect(s.find((x) => x.id === 'h:phone-free-night')?.title).toBe('No phone after 10 PM')
    expect(s.find((x) => x.id === 'p:phonefree')?.recommended).toBe(true)
    expect(
      s.find((x) => x.id === 'p:phonefree-soon')?.kind === 'nudge' &&
        (s.find((x) => x.id === 'p:phonefree-soon') as { preset: { times?: string[] } }).preset
          .times,
    ).toEqual(['21:45'])
  })
  it('skips phone-free items when not wanted', () => {
    expect(
      suggest({ ...base, phoneFreeAt: null }).some(
        (x) => x.id.includes('phone-free') || x.id.includes('phonefree'),
      ),
    ).toBe(false)
  })
  it('only suggests kids routines when there are kids', () => {
    expect(suggest({ ...base, areas: ['kids'] }).some((x) => x.area === 'kids')).toBe(false)
    expect(
      suggest({ ...base, areas: ['kids'], hasKids: true }).some((x) => x.id === 'p:kid-teeth'),
    ).toBe(true)
  })
  it('tunes nudge times to the household rhythm', () => {
    const s = suggest({ ...base, wake: '07:00', phoneFreeAt: '21:30', areas: ['health'] })
    const foot = s.find((x) => x.id === 'p:footwear')
    expect(foot?.kind === 'nudge' && foot.preset.times).toEqual(['07:30', '17:30'])
    const pf = s.find((x) => x.id === 'p:phonefree')
    expect(pf?.kind === 'nudge' && pf.preset.times).toEqual(['21:30'])
  })
  it('does not mutate shared templates', () => {
    suggest({ ...base, phoneFreeAt: '21:00' })
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
  it('creates items for each child, enables phone-free hours, and is idempotent', async () => {
    const answers = { ...base, areas: ['kids', 'health'] as SetupAnswers['areas'], hasKids: true }
    const ids = await ensureProfiles('Robin', 'R', [
      { name: 'Mia', avatar: '👧', color: '#eee', role: 'Child', kind: 'child' },
      { name: 'Leo', avatar: '👦', color: '#eee', role: 'Child', kind: 'child' },
    ])
    expect(ids.kidIds).toHaveLength(2)
    const picks = suggest(answers).filter((s) =>
      ['h:kid-read', 'p:kid-teeth', 'h:phone-free-night', 'p:phonefree'].includes(s.id),
    )
    await applySuggestions(picks, answers, ids)
    expect(await db.habits.where('profileId').anyOf(ids.kidIds).count()).toBe(2)
    expect((await db.settings.get('quietHours'))?.value).toMatchObject({
      enabled: true,
      start: '22:00',
      end: '06:30',
    })

    // second run: same profiles, no duplicates
    const again = await ensureProfiles('Robin', 'R', [
      { name: 'Mia', avatar: '👧', color: '#eee', role: 'Child', kind: 'child' },
    ])
    await applySuggestions(picks, answers, again)
    expect(await db.profiles.count()).toBe(3)
    expect(await db.habits.count()).toBe(3)
    expect(await db.reminders.count()).toBe(2)
  })
})
