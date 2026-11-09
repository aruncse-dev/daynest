import { db } from './db'
import { uuid } from '@/lib/id'
import { addLocalDays, nowIso, todayLocal, weekdayOf } from '@/lib/date'
import { DEFAULT_QUIET, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import type { SetupAnswers, Suggestion } from '@/lib/suggest'
import { getSetting, setSetting } from './actions'
import { syncHabitReminder, syncPhoneFreeReminder, syncTaskReminder } from './links'
import type { Habit, Task } from './types'
import { ROLES, type FamilyRole } from '@/lib/family'

/** Create or rename the one profile on this phone. Returns its id. */
export async function ensureProfile(name: string, avatar: string) {
  const now = nowIso()
  const me = (await db.profiles.filter((p) => !p.archivedAt).toArray()).find((p) => p.isPrimary)
  if (!me) {
    const id = uuid()
    await db.profiles.add({
      id,
      name: name.trim() || 'Me',
      avatar: avatar || (name.trim()[0] ?? 'M').toUpperCase(),
      color: '#dce9dc',
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }
  if (name.trim() && (name.trim() !== me.name || (avatar && avatar !== me.avatar)))
    await db.profiles.update(me.id, {
      name: name.trim(),
      avatar: avatar || me.avatar,
      updatedAt: now,
    })
  return me.id
}

/** Create the chosen suggestions. Idempotent: re-running the wizard won't duplicate items. */
export async function applySuggestions(chosen: Suggestion[], answers: SetupAnswers, meId: string) {
  const now = nowIso()
  const today = todayLocal()
  const habits = await db.habits.toArray()
  const reminders = await db.reminders.toArray()
  const tasks = await db.tasks.toArray()
  let created = 0

  for (const s of chosen) {
    if (s.kind === 'habit') {
      if (habits.some((h) => h.templateKey === s.template.key && h.status !== 'archived')) continue
      const habit: Habit = {
        id: uuid(),
        title: s.title,
        emoji: s.emoji,
        scheduleDays: s.template.days ?? [],
        profileId: meId,
        templateKey: s.template.key,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      await db.habits.add(habit)
      if (s.template.key === 'phone-free-night' && answers.phoneFreeAt)
        await syncPhoneFreeReminder(habit, answers.phoneFreeAt)
      else if (s.remindAt) await syncHabitReminder(habit, [s.remindAt])
      created++
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
      const task: Task = {
        id: uuid(),
        title: s.title,
        priority: 'normal',
        category: 'Personal',
        profileId: meId,
        dueDate: start,
        dueTime: s.time ?? null,
        recurrenceRule: s.rule,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      }
      await db.tasks.add(task)
      if (s.remindAt) await syncTaskReminder(task, 0)
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

/** Add family members from the setup wizard (skips empty names and names that already exist). */
export async function addMembers(drafts: { name: string; role: FamilyRole }[]) {
  const existing = await db.profiles.filter((p) => !p.archivedAt).toArray()
  let order = 1
  for (const d of drafts) {
    const name = d.name.trim()
    if (!name || existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) continue
    const r = ROLES.find((x) => x.value === d.role)!
    // stagger createdAt so members keep the order they were entered in
    const at = new Date(Date.now() + order++).toISOString()
    await db.profiles.add({
      id: uuid(),
      name,
      avatar: r.avatar,
      color: r.color,
      role: d.role,
      createdAt: at,
      updatedAt: at,
    })
  }
}
