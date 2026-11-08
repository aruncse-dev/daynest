import { create } from 'zustand'
import type { CalendarEvent, Goal, Habit, Profile, Reminder, Task } from '@/db/types'
import type { LocalDate } from '@/lib/date'

/** Transient UI state only. IndexedDB (Dexie) is the source of truth for data. */
export type SheetState =
  | { type: 'task'; task?: Task; defaults?: Partial<Task> }
  | { type: 'quickAdd' }
  | { type: 'habit'; habit?: Habit }
  | { type: 'habitDetail'; habitId: string }
  | { type: 'event'; event?: CalendarEvent; date?: LocalDate }
  | { type: 'goal'; goal?: Goal }
  | { type: 'profile'; profile?: Profile }
  | { type: 'reminder'; reminder?: Reminder }
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
}

interface UIState {
  sheet: SheetState
  openSheet: (s: Exclude<SheetState, null>) => void
  closeSheet: () => void
  toasts: ToastItem[]
  toast: (message: string, opts?: Omit<ToastItem, 'id' | 'message'>) => void
  dismissToast: (id: number) => void
  profileFilter: string // 'all' | profile id
  setProfileFilter: (id: string) => void
  activeReminders: ActiveReminder[]
  pushReminder: (r: Reminder) => void
  dismissReminder: (id: string) => void
}

let toastSeq = 1

export const useUI = create<UIState>((set) => ({
  sheet: null,
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  toasts: [],
  toast: (message, opts) => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, ...opts }] }))
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      opts?.action ? 4500 : 2200,
    )
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  profileFilter: 'all',
  setProfileFilter: (profileFilter) => set({ profileFilter }),
  activeReminders: [],
  pushReminder: (reminder) =>
    set((s) => ({
      activeReminders: [
        ...s.activeReminders.filter((a) => a.reminder.id !== reminder.id),
        { reminder, firedAt: Date.now() },
      ].slice(-3),
    })),
  dismissReminder: (id) =>
    set((s) => ({ activeReminders: s.activeReminders.filter((a) => a.reminder.id !== id) })),
}))

export const toast = (message: string, opts?: Omit<ToastItem, 'id' | 'message'>) =>
  useUI.getState().toast(message, opts)
