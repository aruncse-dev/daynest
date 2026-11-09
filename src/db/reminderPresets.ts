import type { Reminder } from './types'
import type { FocusArea } from '@/lib/templates'

export type ReminderPreset = Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'enabled'> & {
  presetKey: string
  area: FocusArea
}

/**
 * Stand-alone nudges. Each one should suit anyone. Reminders for a specific habit, to-do or
 * event are set on that item instead.
 */
export const REMINDER_PRESETS: ReminderPreset[] = [
  {
    presetKey: 'water',
    area: 'health',
    title: 'Drink water',
    message: 'A glass of water keeps you going.',
    emoji: '💧',
    kind: 'interval',
    intervalMinutes: 120,
    startTime: '09:00',
    endTime: '20:00',
    days: [],
  },
  {
    presetKey: 'posture',
    area: 'health',
    title: 'Posture check',
    message: 'Sit or stand tall, relax your shoulders.',
    emoji: '🪑',
    kind: 'times',
    times: ['11:00', '15:00', '18:00'],
    days: [],
  },
  {
    presetKey: 'eyes',
    area: 'digital',
    title: 'Rest your eyes',
    message: 'Look away from the screen at something far away for a few seconds.',
    emoji: '👀',
    kind: 'interval',
    intervalMinutes: 120,
    startTime: '10:00',
    endTime: '20:00',
    days: [],
  },
  {
    presetKey: 'pause',
    area: 'calm',
    title: 'Take a pause',
    message: 'A moment just for you. Whatever feels good.',
    emoji: '⏸️',
    kind: 'times',
    times: ['11:30', '16:00'],
    days: [],
  },
  {
    presetKey: 'sunlight',
    area: 'health',
    title: 'Step outside',
    message: 'A little daylight and fresh air.',
    emoji: '☀️',
    kind: 'times',
    times: ['13:00'],
    days: [],
  },
]
