export type FocusArea =
  'health' | 'calm' | 'family' | 'kids' | 'digital' | 'home' | 'learning' | 'work'

export const FOCUS_AREAS: {
  key: FocusArea
  emoji: string
  label: string
  hint: string
  family?: boolean
}[] = [
  { key: 'health', emoji: '💧', label: 'Body basics', hint: 'Water, walks, sleep — your way' },
  { key: 'calm', emoji: '🌿', label: 'Calm mind', hint: 'Quiet time, gratitude' },
  { key: 'family', emoji: '💛', label: 'Family time', hint: 'Meals, time together', family: true },
  {
    key: 'kids',
    emoji: '🧒',
    label: 'Kids routines',
    hint: 'Teeth, reading, school',
    family: true,
  },
  { key: 'digital', emoji: '📵', label: 'Less screen time', hint: 'Phone-free moments' },
  { key: 'home', emoji: '🏡', label: 'Home & chores', hint: 'Tidy, plan, prepare' },
  { key: 'learning', emoji: '📖', label: 'Learning', hint: 'Read, grow' },
  { key: 'work', emoji: '🎯', label: 'Work focus', hint: 'Priorities, deep work' },
]

export interface HabitTemplate {
  key: string
  area: FocusArea
  title: string
  emoji: string
  targetLabel?: string
  /** 0=Sun..6=Sat, empty = every day */
  days?: number[]
  /** assign to each child profile instead of the main profile */
  forKids?: boolean
  /** shared family habit (no single owner) */
  shared?: boolean
}

/** Habits to *track* — DayNest doesn't coach exercises, it helps you keep the habit. */
/**
 * Habits to *track*. DayNest doesn't coach exercise or give health advice: health items carry
 * no prescribed duration or schedule and are never pre-selected — people pick what already
 * suits them and set their own target.
 */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  { key: 'water', area: 'health', title: 'Drink water', emoji: '💧' },
  { key: 'walk', area: 'health', title: 'Go for a walk', emoji: '🚶' },
  { key: 'exercise', area: 'health', title: 'My exercise', emoji: '💪' },
  { key: 'yoga', area: 'health', title: 'My yoga', emoji: '🧘‍♀️' },
  { key: 'sleep', area: 'health', title: 'Bedtime on time', emoji: '😴' },
  { key: 'quiet', area: 'calm', title: 'Quiet time for me', emoji: '🌿' },
  { key: 'gratitude', area: 'calm', title: 'Note one good thing', emoji: '🙏' },
  { key: 'journal', area: 'calm', title: 'Journal', emoji: '📓' },
  {
    key: 'family-dinner',
    area: 'family',
    title: 'Family dinner together',
    emoji: '🍽️',
    shared: true,
  },
  {
    key: 'family-time',
    area: 'family',
    title: 'Screen-free family time',
    emoji: '🎲',
    shared: true,
  },
  { key: 'hug', area: 'family', title: 'Appreciate someone', emoji: '🤗' },
  { key: 'kid-read', area: 'kids', title: 'Reading time', emoji: '📚', forKids: true },
  { key: 'kid-teeth', area: 'kids', title: 'Brush teeth', emoji: '🦷', forKids: true },
  { key: 'kid-tidy', area: 'kids', title: 'Tidy toys', emoji: '🧸', forKids: true },
  {
    key: 'kid-homework',
    area: 'kids',
    title: 'Homework',
    emoji: '✏️',
    days: [1, 2, 3, 4, 5],
    forKids: true,
  },
  { key: 'phone-free-night', area: 'digital', title: 'No phone after 10 PM', emoji: '📵' },
  {
    key: 'phone-free-morning',
    area: 'digital',
    title: 'No phone first thing in the morning',
    emoji: '🌅',
  },
  { key: 'phones-meals', area: 'digital', title: 'Phone away during meals', emoji: '🍽️' },
  { key: 'tidy', area: 'home', title: 'Quick tidy', emoji: '🧹' },
  { key: 'plan-tomorrow', area: 'home', title: 'Plan tomorrow', emoji: '📝' },
  { key: 'read', area: 'learning', title: 'Read', emoji: '📖' },
  { key: 'learn', area: 'learning', title: 'Learn something new', emoji: '💡' },
  {
    key: 'top3',
    area: 'work',
    title: 'Pick my top 3 for the day',
    emoji: '🎯',
    days: [1, 2, 3, 4, 5],
  },
  {
    key: 'focus',
    area: 'work',
    title: 'Focus time, phone away',
    emoji: '🎧',
    days: [1, 2, 3, 4, 5],
  },
]
