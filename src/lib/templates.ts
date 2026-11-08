/** Focus areas for the setup wizard. Everything here should suit anyone. */
export type FocusArea = 'health' | 'calm' | 'digital' | 'organised' | 'learning'

export const FOCUS_AREAS: { key: FocusArea; emoji: string; label: string; hint: string }[] = [
  { key: 'organised', emoji: '🗂️', label: 'Organised day', hint: 'Top 3, plan tomorrow' },
  { key: 'digital', emoji: '📵', label: 'Less screen time', hint: 'Phone-free moments' },
  { key: 'health', emoji: '💧', label: 'Body basics', hint: 'Water, walks, sleep — your way' },
  { key: 'calm', emoji: '🌿', label: 'Calm mind', hint: 'Quiet time, gratitude' },
  { key: 'learning', emoji: '📖', label: 'Learning', hint: 'Read, grow' },
]

export interface HabitTemplate {
  key: string
  area: FocusArea
  title: string
  emoji: string
  /** 0=Sun..6=Sat, empty = every day */
  days?: number[]
  /** sensible default reminder, relative to wake-up or phone-down time */
  remind?: { from: 'wake' | 'night'; minutes: number }
}

/**
 * Habits to *track*. DayNest doesn't coach exercise or give health advice: health items carry
 * no prescribed duration and are never pre-selected.
 */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    key: 'top3',
    area: 'organised',
    title: 'Pick my top 3 for the day',
    emoji: '🎯',
    remind: { from: 'wake', minutes: 45 },
  },
  {
    key: 'plan-tomorrow',
    area: 'organised',
    title: 'Plan tomorrow',
    emoji: '📝',
    remind: { from: 'night', minutes: -75 },
  },
  { key: 'tidy', area: 'organised', title: 'Quick tidy', emoji: '🧹' },
  { key: 'phone-free-night', area: 'digital', title: 'No phone after 10 PM', emoji: '📵' },
  {
    key: 'phone-free-morning',
    area: 'digital',
    title: 'No phone first thing in the morning',
    emoji: '🌅',
  },
  { key: 'phones-meals', area: 'digital', title: 'Phone away during meals', emoji: '🍽️' },
  { key: 'walk', area: 'health', title: 'Go for a walk', emoji: '🚶' },
  { key: 'exercise', area: 'health', title: 'My exercise', emoji: '💪' },
  { key: 'veg', area: 'health', title: 'Eat some fruit or veg', emoji: '🥗' },
  {
    key: 'sleep',
    area: 'health',
    title: 'Bedtime on time',
    emoji: '😴',
    remind: { from: 'night', minutes: -30 },
  },
  {
    key: 'quiet',
    area: 'calm',
    title: 'Quiet time for me',
    emoji: '🌿',
    remind: { from: 'night', minutes: -60 },
  },
  {
    key: 'gratitude',
    area: 'calm',
    title: 'Note one good thing',
    emoji: '🙏',
    remind: { from: 'night', minutes: -45 },
  },
  { key: 'read', area: 'learning', title: 'Read', emoji: '📖' },
  { key: 'learn', area: 'learning', title: 'Learn something new', emoji: '💡' },
]
