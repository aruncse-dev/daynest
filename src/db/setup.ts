import { db } from './db'
import { uuid } from '@/lib/id'
import { addLocalDays, nowIso, todayLocal, weekdayOf } from '@/lib/date'
import { DEFAULT_QUIET, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import type { SetupAnswers, Suggestion } from '@/lib/suggest'
import { getSetting, setSetting } from './actions'

export interface MemberDraft {
  name: string
  avatar: string
  color: string
  role: string
  kind: 'partner' | 'child' | 'other'
}

/** Create profiles (skipping names that already exist). Returns ids of the main profile and children. */
export async function ensureProfiles(myName: string, myAvatar: string, members: MemberDraft[]) {
  const now = nowIso()
  const existing = await db.profiles.filter((p) => !p.archivedAt).toArray()
  let me = existing.find((p) => p.isPrimary)
  if (!me) {
    me = {
      id: uuid(),
      name: myName.trim() || 'Me',
      avatar: myAvatar || (myName.trim()[0] ?? 'M').toUpperCase(),
      color: '#dce9dc',
      role: 'Personal',
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    }
    await db.profiles.add(me)
  } else if (myName.trim() && myName.trim() !== me.name) {
    await db.profiles.update(me.id, {
      name: myName.trim(),
      avatar: myAvatar || me.avatar,
      updatedAt: now,
    })
  }
  const kidIds = existing.filter((p) => p.role === 'Child').map((p) => p.id)
  let order = 1
  for (const m of members) {
    // stagger createdAt so profiles keep the order they were entered in
    const createdAt = new Date(Date.now() + order++).toISOString()
    if (
      !m.name.trim() ||
      existing.some((p) => p.name.toLowerCase() === m.name.trim().toLowerCase())
    )
      continue
    const id = uuid()
    await db.profiles.add({
      id,
      name: m.name.trim(),
      avatar: m.avatar,
      color: m.color,
      role: m.role,
      createdAt,
      updatedAt: createdAt,
    })
    if (m.kind === 'child') kidIds.push(id)
  }
  return { meId: me.id, kidIds }
}

/** Create the chosen suggestions. Idempotent: re-running the wizard won't duplicate items. */
export async function applySuggestions(
  chosen: Suggestion[],
  answers: SetupAnswers,
  ids: { meId: string; kidIds: string[] },
) {
  const now = nowIso()
  const today = todayLocal()
  const habits = await db.habits.toArray()
  const reminders = await db.reminders.toArray()
  const tasks = await db.tasks.toArray()
  let created = 0

  for (const s of chosen) {
    if (s.kind === 'habit') {
      const t = s.template
      const owners = t.forKids ? ids.kidIds : [t.shared ? null : ids.meId]
      for (const profileId of owners) {
        if (
          habits.some(
            (h) =>
              h.templateKey === t.key &&
              (h.profileId ?? null) === profileId &&
              h.status !== 'archived',
          )
        )
          continue
        await db.habits.add({
          id: uuid(),
          title: s.title,
          emoji: t.emoji,
          targetLabel: t.targetLabel,
          scheduleDays: t.days ?? [],
          profileId,
          templateKey: t.key,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        created++
      }
    } else if (s.kind === 'nudge') {
      const { area: _area, ...preset } = s.preset
      const existing = reminders.find((r) => r.presetKey === preset.presetKey)
      // lastFiredSlot = now: don't immediately fire a slot that was already due
      if (existing)
        await db.reminders.update(existing.id, {
          ...preset,
          enabled: true,
          lastFiredSlot: now,
          updatedAt: now,
        })
      else
        await db.reminders.add({
          ...preset,
          id: uuid(),
          enabled: true,
          lastFiredSlot: now,
          createdAt: now,
          updatedAt: now,
        })
      created++
    } else {
      if (tasks.some((t) => t.title === s.title && t.recurrenceRule)) continue
      let start = today
      while (weekdayOf(start) !== s.weekday) start = addLocalDays(start, 1)
      await db.tasks.add({
        id: uuid(),
        title: s.title,
        priority: 'normal',
        category: s.area === 'family' ? 'Family' : 'Home',
        profileId: s.area === 'family' ? null : ids.meId,
        dueDate: start,
        dueTime: s.time ?? null,
        recurrenceRule: s.rule,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      })
      created++
    }
  }

  if (answers.phoneFreeAt) {
    const q = await getSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
    await setSetting(QUIET_KEY, {
      ...q,
      enabled: true,
      start: answers.phoneFreeAt,
      end: answers.wake,
    })
  }
  await setSetting('setupAnswers', answers)
  return created
}
