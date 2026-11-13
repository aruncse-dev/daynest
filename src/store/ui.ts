import { create } from 'zustand'
import type { CalendarEvent, Habit, Profile, Reminder, Task } from '@/db/types'
import type { LocalDate } from '@/lib/date'

/** Transient UI state only. IndexedDB (Dexie) is the source of truth for data. */
export type SheetState =
  | { type: 'task'; task?: Task; defaults?: Partial<Task>; remindBefore?: number }
  | { type: 'quickAdd' }
  | { type: 'habit'; habit?: Habit; defaults?: Partial<Habit>; remindTimes?: string[] }
  | { type: 'habitDetail'; habitId: string }
  | {
      type: 'event'
      event?: CalendarEvent
      date?: LocalDate
      defaults?: Partial<CalendarEvent>
      remindBefore?: number
    }
  | { type: 'profile'; profile?: Profile; role?: string }
  | { type: 'reminder'; reminder?: Reminder }
  | { type: 'addNudge' }
  | null

export interface ToastItem {
  id: number
  message: string
  emoji?: string
  action?: { label: string; run: () => void }
}

export interface ActiveReminder {
  reminder: Reminder
  firedAt: number
  /** opened from a notification: always shown as the big card */
  full?: boolean
}

interface UIState {
  sheet: SheetState
  openSheet: (s: Exclude<SheetState, null>) => void
  closeSheet: () => void
  toasts: ToastItem[]
  toast: (message: string, opts?: Omit<ToastItem, 'id' | 'message'>) => void
  dismissToast: (id: number) => void
  /** 'all' (Everyone) or a profile id. Read through `usePerson()`, which checks it still exists. */
  profileFilter: string
  setProfileFilter: (id: string) => void
  activeReminders: ActiveReminder[]
  pushReminder: (r: Reminder, full?: boolean) => void
  dismissReminder: (id: string) => void
}

let toastSeq = 1

const PERSON_KEY = 'daynest.person'
function readPerson(): string {
  try {
    return localStorage.getItem(PERSON_KEY) || 'all'
  } catch {
    return 'all'
  }
}

export const useUI = create<UIState>((set) => ({
  sheet: null,
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  toasts: [],
  toast: (message, opts) => {
    const id = toastSeq++
    // one at a time: a new toast replaces the previous one
    set({ toasts: [{ id, message, ...opts }] })
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      opts?.action ? 4000 : 1800,
    )
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  // which person the tabs show; remembered on this device as a convenience only
  profileFilter: readPerson(),
  setProfileFilter: (profileFilter) => {
    try {
      localStorage.setItem(PERSON_KEY, profileFilter)
    } catch {
      /* private mode: just don't remember */
    }
    set({ profileFilter })
  },
  activeReminders: [],
  pushReminder: (reminder, full) =>
    set((s) => ({
      activeReminders: [
        ...s.activeReminders.filter((a) => a.reminder.id !== reminder.id),
        { reminder, firedAt: Date.now(), full },
      ].slice(-3),
    })),
  dismissReminder: (id) =>
    set((s) => ({ activeReminders: s.activeReminders.filter((a) => a.reminder.id !== id) })),
}))

export const toast = (message: string, opts?: Omit<ToastItem, 'id' | 'message'>) =>
  useUI.getState().toast(message, opts)
