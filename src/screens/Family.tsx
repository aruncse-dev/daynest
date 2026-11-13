import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Pencil } from 'lucide-react'
import { db } from '@/db/db'
import type { CalendarEvent, Profile } from '@/db/types'
import { addLocalDays, todayLocal, type LocalDate } from '@/lib/date'
import { eventsBetween } from '@/lib/events'
import { ROLES, ideasFor, roleLabel, roleOf, type FamilyIdea } from '@/lib/family'
import { usePerson, useProfiles, useToday } from '@/lib/hooks'
import { displayName, eventEmoji, isFor, isImportantDate, ownersOf } from '@/lib/people'
import { usePeopleDay } from '@/lib/queries'
import { statDone, statRatio, statTotal } from '@/lib/dayStats'
import { useUI } from '@/store/ui'
import { Avatar, Button, LinkButton, Panel, Ring } from '@/components/ui'
import { EventRow } from '@/components/rows'
import { PersonBar } from '@/components/PersonBar'

/**
 * One person looks after the whole family on this phone. Everyone = an overview of all;
 * pick a person (you included) for their page: important dates, ideas, quick add.
 * Nothing is shared or synced.
 */
export function Family() {
  const profiles = useProfiles()
  const { person } = usePerson()
  const selected = profiles?.find((p) => p.id === person)
  return (
    <div className="grid gap-3">
      <h1 className="text-[24px] font-bold tracking-[-0.8px]">Family</h1>
      <PersonBar always />
      {selected ? <PersonPage profile={selected} /> : <Overview />}
      <p className="px-1 text-center text-[11px] text-muted">
        Everyone here lives only on this phone. Nothing is shared or synced.
      </p>
    </div>
  )
}

/** Next date each important event comes round (birthdays every year), soonest first. */
function useImportantDates(person: string, days = 366) {
  const today = useToday()
  return useLiveQuery(async () => {
    const events = (await db.events.toArray()).filter((e) => isImportantDate(e) && isFor(e, person))
    const seen = new Set<string>()
    return eventsBetween(events, today, addLocalDays(today, days)).filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }, [person, today, days])
}

/* ---------------- Everyone ---------------- */

function Overview() {
  const today = useToday()
  const profiles = useProfiles() ?? []
  const { setPerson } = usePerson()
  const openSheet = useUI((s) => s.openSheet)
  const day = usePeopleDay(
    today,
    today,
    profiles.map((p) => p.id),
  )
  const dates = useImportantDates('all', 60)
  const members = profiles.filter((p) => !p.isPrimary)

  return (
    <>
      {members.length === 0 && (
        <Panel>
          <div className="text-center">
            <div className="text-3xl">🏡</div>
            <div className="mt-1 text-sm font-bold">Look after everyone in one place</div>
            <p className="mx-auto max-w-xs text-xs text-muted">
              Add your spouse, children or parents. Then pick who each to-do, habit or date is for,
              and switch between people at the top of every tab.
            </p>
          </div>
        </Panel>
      )}

      <div className="grid gap-2">
        {profiles.map((p) => {
          const s = day?.[p.id]
          const ratio = s ? statRatio(s) : null
          const next = dates?.find((e) => ownersOf(e).includes(p.id))
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPerson(p.id)}
              className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-left transition active:scale-[.99]"
            >
              <Avatar avatar={p.avatar} color={p.color} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{displayName(p)}</span>
                <span className="block truncate text-xs text-muted">
                  {p.isPrimary ? 'You' : roleLabel(p)} ·{' '}
                  {s && statTotal(s) ? `${statDone(s)} of ${statTotal(s)} today` : 'nothing today'}
                </span>
                {next && (
                  <span className="block truncate text-[11px] font-semibold text-amber-ink">
                    {eventEmoji(next)} {next.title} · {whenText(next.occursOn, today)}
                  </span>
                )}
              </span>
              {ratio != null && <Ring value={ratio} size={34} stroke={4} />}
              <ChevronRight size={18} className="text-muted" />
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Add a family member">
        {ROLES.filter((r) => r.value !== 'other').map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => openSheet({ type: 'profile', role: r.value })}
            className="grid justify-items-center gap-1 rounded-[16px] border border-dashed border-sage-line bg-surface/70 px-2 py-3 text-xs font-semibold text-sage-ink transition active:scale-95"
          >
            <span className="text-2xl">{r.avatar}</span>+{' '}
            {r.value === 'spouse' ? 'Spouse' : r.label}
          </button>
        ))}
      </div>
      <LinkButton
        className="justify-self-center"
        onClick={() => openSheet({ type: 'profile', role: 'other' })}
      >
        + Someone else
      </LinkButton>

      {!!dates?.length && (
        <Panel>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Important dates · next 2 months
          </div>
          <div className="grid gap-2.5">
            {dates.slice(0, 5).map((e) => (
              <EventRow key={e.id} event={e} date={e.occursOn} countdown />
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}

function whenText(date: LocalDate, today: LocalDate) {
  if (date === today) return 'today'
  if (date === addLocalDays(today, 1)) return 'tomorrow'
  const days = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000,
  )
  return `in ${days} days`
}

/* ---------------- One person ---------------- */

const DATE_KINDS: { type: CalendarEvent['type']; label: string; emoji: string }[] = [
  { type: 'birthday', label: 'Birthday', emoji: '🎂' },
  { type: 'anniversary', label: 'Anniversary', emoji: '💍' },
  { type: 'important', label: 'Other date', emoji: '⭐' },
]

function PersonPage({ profile }: { profile: Profile }) {
  const today = useToday()
  const navigate = useNavigate()
  const openSheet = useUI((s) => s.openSheet)
  const day = usePeopleDay(today, today, [profile.id])?.[profile.id]
  const dates = useImportantDates(profile.id)
  const existing = useLiveQuery(async () => {
    const [hs, ts, evs] = await Promise.all([
      db.habits.where('profileId').equals(profile.id).toArray(),
      db.tasks.where('profileIds').equals(profile.id).toArray(),
      db.events.where('profileIds').equals(profile.id).toArray(),
    ])
    return new Set(
      [...hs, ...ts, ...evs]
        .filter((x) => !('status' in x) || x.status !== 'archived')
        .map((x) => x.title),
    )
  }, [profile.id])
  const ideas = ideasFor(profile).filter((i) => !existing?.has(i.title))
  const name = displayName(profile)
  const ids = [profile.id]

  const addDate = (kind: (typeof DATE_KINDS)[number]) =>
    openSheet({
      type: 'event',
      date: today,
      defaults: {
        title:
          kind.type === 'important'
            ? ''
            : kind.type === 'anniversary'
              ? profile.isPrimary || roleOf(profile) === 'spouse'
                ? 'Our anniversary'
                : `${profile.name}'s anniversary`
              : profile.isPrimary
                ? 'My birthday'
                : `${profile.name}'s birthday`,
        type: kind.type,
        repeatYearly: kind.type !== 'important',
        profileIds: ids,
      },
      remindBefore: -1,
    })

  const startIdea = (idea: FamilyIdea) => {
    if (idea.kind === 'habit') {
      openSheet({
        type: 'habit',
        defaults: {
          title: idea.title,
          emoji: idea.emoji,
          scheduleDays: idea.days ?? [],
          profileId: profile.id,
        },
        remindTimes: idea.remind,
      })
    } else if (idea.kind === 'task') {
      openSheet({
        type: 'task',
        defaults: {
          title: idea.title,
          dueDate: todayLocal(),
          dueTime: idea.time,
          recurrenceRule: idea.rule,
          profileIds: ids,
        },
        remindBefore: idea.before,
      })
    } else {
      openSheet({
        type: 'event',
        date: addLocalDays(todayLocal(), 1),
        defaults: {
          title: idea.title,
          type: idea.type,
          emoji: idea.emoji,
          repeatYearly: idea.yearly,
          profileIds: ids,
        },
        remindBefore: idea.before,
      })
    }
  }

  const ratio = day ? statRatio(day) : null
  return (
    <>
      <Panel>
        <div className="flex items-center gap-3">
          <Avatar avatar={profile.avatar} color={profile.color} size={56} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{profile.name}</div>
            <div className="text-xs text-muted">
              {profile.isPrimary ? 'You' : roleLabel(profile)}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openSheet({ type: 'profile', profile })}
          >
            <Pencil size={13} /> Edit
          </Button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 flex w-full items-center gap-3 rounded-xl bg-surface2 px-3 py-2 text-left"
        >
          {ratio != null && <Ring value={ratio} size={30} stroke={4} />}
          <span className="flex-1 text-[13px]">
            {day && statTotal(day) ? (
              <>
                <b>
                  {statDone(day)} of {statTotal(day)}
                </b>{' '}
                done today
              </>
            ) : (
              'Nothing planned today'
            )}
          </span>
          <span className="text-xs font-bold text-sage-ink">
            Open {name === 'Me' ? 'my' : 'their'} day ›
          </span>
        </button>
      </Panel>

      <Panel>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Important dates
        </div>
        {dates && dates.length > 0 ? (
          <div className="mb-3 grid gap-2.5">
            {dates.map((e) => (
              <EventRow key={e.id} event={e} date={e.occursOn} hideOwner={profile.id} countdown />
            ))}
          </div>
        ) : (
          <p className="mb-2.5 text-xs text-muted">
            Birthdays, anniversaries, renewals… DayNest reminds you on the morning of the day.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {DATE_KINDS.map((k) => (
            <button
              key={k.type}
              type="button"
              onClick={() => addDate(k)}
              className="min-h-9 rounded-full border border-line bg-surface px-3 text-xs font-semibold transition hover:border-sage active:scale-95"
            >
              {k.emoji} {k.label} <span className="text-sage-ink">+</span>
            </button>
          ))}
        </div>
      </Panel>

      {ideas.length > 0 && (
        <Panel>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Ideas for {profile.isPrimary ? 'you' : profile.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((i) => (
              <button
                key={i.key}
                type="button"
                onClick={() => startIdea(i)}
                className="min-h-9 rounded-full border border-line bg-surface px-3 text-xs font-semibold transition hover:border-sage active:scale-95"
              >
                {i.emoji} {i.title} <span className="text-sage-ink">+</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="soft"
          size="sm"
          onClick={() => openSheet({ type: 'task', defaults: { profileIds: ids } })}
        >
          + To-do
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => openSheet({ type: 'habit', defaults: { profileId: profile.id } })}
        >
          + Habit
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => openSheet({ type: 'event', date: today, defaults: { profileIds: ids } })}
        >
          + Event
        </Button>
      </div>
    </>
  )
}
