export type FocusArea =
  'health' | 'calm' | 'family' | 'kids' | 'digital' | 'home' | 'learning' | 'work'

export const FOCUS_AREAS: { key: FocusArea; emoji: string; label: string; hint: string }[] = [
  { key: 'health', emoji: '💪', label: 'Health & energy', hint: 'Move, hydrate, sleep' },
  { key: 'calm', emoji: '🧘', label: 'Calm mind', hint: 'Meditate, gratitude' },
  { key: 'family', emoji: '💛', label: 'Family time', hint: 'Meals, hugs, outings' },
  { key: 'kids', emoji: '🧒', label: 'Kids routines', hint: 'Teeth, reading, school' },
  { key: 'digital', emoji: '📵', label: 'Digital wellbeing', hint: 'Less screen, more life' },
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

const WEEKDAYS = [1, 2, 3, 4, 5]

/** Habits to *track* — DayNest doesn't coach exercises, it helps you keep the habit. */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  { key: 'walk', area: 'health', title: 'Morning walk', emoji: '🚶', targetLabel: '20 minutes' },
  { key: 'yoga', area: 'health', title: 'Yoga', emoji: '🧘‍♀️', targetLabel: '15 minutes' },
  {
    key: 'exercise',
    area: 'health',
    title: 'Exercise',
    emoji: '💪',
    targetLabel: '20 minutes',
    days: [1, 3, 5],
  },
  {
    key: 'water',
    area: 'health',
    title: 'Drink enough water',
    emoji: '💧',
    targetLabel: '8 glasses',
  },
  {
    key: 'veggies',
    area: 'health',
    title: 'Fruit & veggies',
    emoji: '🥗',
    targetLabel: '5 portions',
  },
  { key: 'sleep', area: 'health', title: 'In bed by 10:30', emoji: '😴' },
  { key: 'meditate', area: 'calm', title: 'Meditate', emoji: '🧘', targetLabel: '5 minutes' },
  { key: 'gratitude', area: 'calm', title: 'Gratitude', emoji: '🙏', targetLabel: '3 good things' },
  { key: 'journal', area: 'calm', title: 'Journal', emoji: '📓', targetLabel: '5 minutes' },
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
    targetLabel: '30 minutes',
    shared: true,
  },
  { key: 'hug', area: 'family', title: 'Hug & appreciate someone', emoji: '🤗' },
  {
    key: 'outing',
    area: 'family',
    title: 'Family outing',
    emoji: '🌳',
    days: [0, 6],
    shared: true,
  },
  {
    key: 'kid-read',
    area: 'kids',
    title: 'Reading time',
    emoji: '📚',
    targetLabel: '15 minutes',
    forKids: true,
  },
  { key: 'kid-teeth', area: 'kids', title: 'Brush teeth twice', emoji: '🦷', forKids: true },
  { key: 'kid-tidy', area: 'kids', title: 'Tidy toys', emoji: '🧸', forKids: true },
  {
    key: 'kid-homework',
    area: 'kids',
    title: 'Homework',
    emoji: '✏️',
    days: WEEKDAYS,
    forKids: true,
  },
  {
    key: 'kid-play',
    area: 'kids',
    title: 'Outdoor play',
    emoji: '⚽',
    targetLabel: '30 minutes',
    forKids: true,
  },
  { key: 'phone-free-night', area: 'digital', title: 'No phone after 10 PM', emoji: '📵' },
  { key: 'phone-free-morning', area: 'digital', title: 'No phone for first 30 min', emoji: '🌅' },
  {
    key: 'phones-dinner',
    area: 'digital',
    title: 'Phones away at dinner',
    emoji: '🧺',
    shared: true,
  },
  { key: 'tidy', area: 'home', title: '10-minute tidy', emoji: '🧹' },
  { key: 'plan-tomorrow', area: 'home', title: 'Plan tomorrow', emoji: '📝' },
  { key: 'read', area: 'learning', title: 'Read', emoji: '📖', targetLabel: '10 pages' },
  {
    key: 'learn',
    area: 'learning',
    title: 'Learn something new',
    emoji: '💡',
    targetLabel: '15 minutes',
  },
  { key: 'top3', area: 'work', title: 'Pick top 3 priorities', emoji: '🎯', days: WEEKDAYS },
  {
    key: 'focus',
    area: 'work',
    title: 'Focus block, phone away',
    emoji: '🎧',
    targetLabel: '60 minutes',
    days: WEEKDAYS,
  },
]
