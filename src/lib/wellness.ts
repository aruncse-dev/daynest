import type { WellnessKind } from '@/db/types'

export interface BreathPattern {
  id: string
  title: string
  subtitle: string
  /** seconds for inhale, hold, exhale, hold */
  phases: [number, number, number, number]
  rounds: number
}

export const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: 'calm',
    title: 'Calm breath',
    subtitle: 'Inhale 4 · exhale 6',
    phases: [4, 0, 6, 0],
    rounds: 10,
  },
  {
    id: 'box',
    title: 'Box breathing',
    subtitle: '4 · 4 · 4 · 4 to steady focus',
    phases: [4, 4, 4, 4],
    rounds: 8,
  },
  {
    id: 'sleep',
    title: '4-7-8 wind-down',
    subtitle: 'A slow pattern for bedtime',
    phases: [4, 7, 8, 0],
    rounds: 6,
  },
]

export interface Step {
  name: string
  cue: string
  emoji: string
  seconds: number
  rest?: boolean
}

export interface Routine {
  id: string
  kind: Extract<WellnessKind, 'yoga' | 'exercise'>
  title: string
  subtitle: string
  emoji: string
  level: 'Gentle' | 'Easy' | 'Moderate'
  steps: Step[]
}

const rest = (seconds = 10): Step => ({
  name: 'Rest',
  cue: 'Breathe easy. Get ready for the next one.',
  emoji: '🌿',
  seconds,
  rest: true,
})

export const ROUTINES: Routine[] = [
  {
    id: 'yoga-morning',
    kind: 'yoga',
    title: 'Morning wake-up flow',
    subtitle: 'Loosen the spine and open the day',
    emoji: '🌅',
    level: 'Gentle',
    steps: [
      {
        name: 'Mountain pose',
        cue: 'Stand tall, feet grounded, shoulders soft. Breathe slowly.',
        emoji: '🧍',
        seconds: 30,
      },
      {
        name: 'Side stretch',
        cue: 'Reach both arms up and lean gently to one side, then the other.',
        emoji: '🙆',
        seconds: 40,
      },
      {
        name: 'Forward fold',
        cue: 'Hinge at the hips, knees soft. Let your head hang heavy.',
        emoji: '🙇',
        seconds: 40,
      },
      {
        name: 'Cat–cow',
        cue: 'On hands and knees, round then arch your back with the breath.',
        emoji: '🐈',
        seconds: 45,
      },
      {
        name: 'Downward dog',
        cue: 'Lift hips up and back. Pedal the feet slowly.',
        emoji: '🐕',
        seconds: 40,
      },
      {
        name: 'Cobra',
        cue: 'Lying on your belly, press lightly into the hands and lift the chest.',
        emoji: '🐍',
        seconds: 30,
      },
      {
        name: "Child's pose",
        cue: 'Knees wide, sit back toward heels, forehead down. Rest.',
        emoji: '🧎',
        seconds: 45,
      },
      {
        name: 'Seated breath',
        cue: 'Sit comfortably. Notice three slow breaths. Set an intention.',
        emoji: '🧘',
        seconds: 30,
      },
    ],
  },
  {
    id: 'yoga-desk',
    kind: 'yoga',
    title: 'Desk reset',
    subtitle: 'Neck, shoulders and posture in 4 minutes',
    emoji: '💻',
    level: 'Gentle',
    steps: [
      {
        name: 'Sit tall',
        cue: 'Feet flat, crown of the head lifting. Shoulders down and back.',
        emoji: '🪑',
        seconds: 20,
      },
      {
        name: 'Neck release',
        cue: 'Ear toward shoulder, hold, then switch sides. No forcing.',
        emoji: '🙂',
        seconds: 40,
      },
      {
        name: 'Shoulder rolls',
        cue: 'Big slow circles backward, then forward.',
        emoji: '🔄',
        seconds: 30,
      },
      {
        name: 'Seated twist',
        cue: 'Hand to opposite knee, rotate gently from the ribs. Switch.',
        emoji: '🌀',
        seconds: 40,
      },
      {
        name: 'Chest opener',
        cue: 'Clasp hands behind you, lift the chest, look slightly up.',
        emoji: '🫁',
        seconds: 30,
      },
      {
        name: 'Wrist & finger stretch',
        cue: 'Extend an arm, gently draw fingers back. Switch.',
        emoji: '✋',
        seconds: 30,
      },
      {
        name: 'Eye rest',
        cue: 'Look at something far away. Blink slowly a few times.',
        emoji: '👀',
        seconds: 20,
      },
      {
        name: 'Posture check',
        cue: 'Stack ears over shoulders over hips. Breathe and smile.',
        emoji: '✨',
        seconds: 20,
      },
    ],
  },
  {
    id: 'yoga-evening',
    kind: 'yoga',
    title: 'Evening wind-down',
    subtitle: 'Slow stretches to let the day go',
    emoji: '🌙',
    level: 'Gentle',
    steps: [
      {
        name: 'Seated forward fold',
        cue: 'Legs long, fold forward softly. Breathe into the back.',
        emoji: '🙇',
        seconds: 45,
      },
      {
        name: 'Butterfly',
        cue: 'Soles of the feet together, knees wide. Sit tall.',
        emoji: '🦋',
        seconds: 45,
      },
      {
        name: 'Supine twist',
        cue: 'Lying down, drop both knees to one side. Switch halfway.',
        emoji: '🌀',
        seconds: 60,
      },
      {
        name: 'Legs up the wall',
        cue: 'Rest your legs up a wall or on a chair. Let go.',
        emoji: '🦵',
        seconds: 60,
      },
      {
        name: 'Resting pose',
        cue: 'Lie flat, palms up. Feel the body getting heavy.',
        emoji: '😌',
        seconds: 60,
      },
    ],
  },
  {
    id: 'ex-energiser',
    kind: 'exercise',
    title: '5-minute energiser',
    subtitle: 'Quick bodyweight moves, no equipment',
    emoji: '⚡',
    level: 'Easy',
    steps: [
      {
        name: 'March on the spot',
        cue: 'Lift the knees, swing the arms. Warm up.',
        emoji: '🚶',
        seconds: 30,
      },
      {
        name: 'Jumping jacks',
        cue: 'Or step-jacks for low impact. Keep a steady rhythm.',
        emoji: '🤸',
        seconds: 30,
      },
      rest(),
      {
        name: 'Squats',
        cue: 'Sit back like into a chair, chest up, knees over toes.',
        emoji: '🏋️',
        seconds: 30,
      },
      rest(),
      {
        name: 'Wall or knee push-ups',
        cue: 'Body in one line. Lower slowly, push away.',
        emoji: '💪',
        seconds: 30,
      },
      rest(),
      {
        name: 'Standing knee-to-elbow',
        cue: 'Bring opposite knee and elbow together. Alternate.',
        emoji: '🔁',
        seconds: 30,
      },
      rest(),
      {
        name: 'Plank',
        cue: 'On forearms or hands. Breathe, hold strong and steady.',
        emoji: '🧱',
        seconds: 25,
      },
      {
        name: 'Cool-down stretch',
        cue: 'Reach up tall, then fold down. Shake it out.',
        emoji: '🌿',
        seconds: 30,
      },
    ],
  },
  {
    id: 'ex-family',
    kind: 'exercise',
    title: 'Family move break',
    subtitle: 'Playful moves to do together',
    emoji: '👨‍👩‍👧',
    level: 'Easy',
    steps: [
      {
        name: 'Animal walk: bear',
        cue: 'Hands and feet on the floor, walk like a bear!',
        emoji: '🐻',
        seconds: 30,
      },
      { name: 'Frog jumps', cue: 'Squat low and hop forward. Ribbit!', emoji: '🐸', seconds: 30 },
      rest(15),
      {
        name: 'Flamingo balance',
        cue: 'Stand on one leg. Who can hold the longest? Switch.',
        emoji: '🦩',
        seconds: 40,
      },
      {
        name: 'Star jumps',
        cue: 'Jump and spread arms and legs wide like a star.',
        emoji: '⭐',
        seconds: 30,
      },
      rest(15),
      {
        name: 'Tree pose',
        cue: 'Foot on calf or ankle, hands together. Grow tall.',
        emoji: '🌳',
        seconds: 40,
      },
      {
        name: 'Big hug & breathe',
        cue: 'Three deep breaths together. Well done, team!',
        emoji: '🤗',
        seconds: 20,
      },
    ],
  },
  {
    id: 'ex-strength',
    kind: 'exercise',
    title: '10-minute strength',
    subtitle: 'Two rounds of simple strength moves',
    emoji: '🔥',
    level: 'Moderate',
    steps: [
      ...[1, 2].flatMap((round) => [
        {
          name: `Squats · round ${round}`,
          cue: 'Controlled down, strong up.',
          emoji: '🏋️',
          seconds: 45,
        },
        rest(15),
        {
          name: `Push-ups · round ${round}`,
          cue: 'Knees down is perfectly fine.',
          emoji: '💪',
          seconds: 40,
        },
        rest(15),
        {
          name: `Lunges · round ${round}`,
          cue: 'Step back, lower gently, alternate legs.',
          emoji: '🦵',
          seconds: 45,
        },
        rest(15),
        {
          name: `Glute bridge · round ${round}`,
          cue: 'Lying down, press through heels, lift hips.',
          emoji: '🌉',
          seconds: 40,
        },
        rest(15),
        {
          name: `Plank · round ${round}`,
          cue: 'Long body, steady breath.',
          emoji: '🧱',
          seconds: 30,
        },
        rest(20),
      ]),
    ],
  },
]

export const MEDITATION_LENGTHS = [3, 5, 10, 15, 20]

export const MEDITATION_GUIDES = [
  {
    id: 'breath',
    title: 'Breath awareness',
    cue: 'Rest attention on the breath. When the mind wanders, gently come back.',
  },
  {
    id: 'body',
    title: 'Body scan',
    cue: 'Move attention slowly from the toes to the crown, softening each area.',
  },
  {
    id: 'kind',
    title: 'Kindness',
    cue: 'Silently wish: may I be well, may my family be well, may everyone be well.',
  },
  {
    id: 'gratitude',
    title: 'Gratitude',
    cue: 'Bring to mind three small things from today you are thankful for.',
  },
]

export function routineSeconds(r: Routine): number {
  return r.steps.reduce((sum, s) => sum + s.seconds, 0)
}

/** Original, gentle motivation lines. Rotated by date so they feel fresh each day. */
export const MOTIVATION = [
  'Small steps every day add up to big changes.',
  'You don’t have to do everything today. Just the next kind thing.',
  'Breathe in calm, breathe out hurry.',
  'Progress, not perfection.',
  'A rested mind makes better choices.',
  'Move a little, smile a little, rest a little.',
  'Your pace is the right pace.',
  'Consistency beats intensity.',
  'Water, sunlight, movement, sleep — simple things, done often.',
  'Every stretch is a thank-you to your body.',
  'Five quiet minutes can reset a whole day.',
  'Be the calm you want your home to feel.',
  'Done is better than perfect. Gentle is better than harsh.',
  'Tiny habits grow deep roots.',
  'Start where you are. Use what you have.',
  'Celebrate the little wins — they are the real ones.',
  'Stand tall, breathe deep, carry on softly.',
  'Today is a fresh page.',
  'Rest is part of the work.',
  'You showed up. That matters.',
  'Make it easy, make it small, make it daily.',
  'Kindness to yourself is a habit too.',
  'One good breath is a great place to begin.',
  'Strong body, calm mind, warm heart.',
  'The best time to stretch is now.',
  'Let today be lighter than yesterday.',
  'Slow is smooth, smooth is steady.',
  'Your family notices your calm.',
  'Little by little, a little becomes a lot.',
  'Pause. Breathe. Choose what matters.',
  'Nourish the body, quiet the mind.',
]

export function motivationFor(localDate: string, offset = 0): string {
  const n = localDate.split('-').reduce((acc, part) => acc * 31 + Number(part), 7)
  return MOTIVATION[(n + offset) % MOTIVATION.length]
}
