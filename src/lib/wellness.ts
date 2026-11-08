/** Original, gentle motivation lines. Rotated by date so they feel fresh each day. */
export const MOTIVATION = [
  'Small steps every day add up to big changes.',
  'You don’t have to do everything today. Just the next kind thing.',
  'Progress, not perfection.',
  'Your pace is the right pace.',
  'Consistency beats intensity.',
  'Water, sunlight, movement, sleep — simple things, done often.',
  'Be the calm you want your home to feel.',
  'Tiny habits grow deep roots.',
  'Start where you are. Use what you have.',
  'Celebrate the little wins — they are the real ones.',
  'Today is a fresh page.',
  'Rest is part of the work.',
  'You showed up. That matters.',
  'Make it easy, make it small, make it daily.',
  'Kindness to yourself is a habit too.',
  'Strong body, calm mind, warm heart.',
  'Let today be lighter than yesterday.',
  'Your family notices your calm.',
  'Little by little, a little becomes a lot.',
  'Pause. Breathe. Choose what matters.',
  'A phone-down evening is a gift to your morning.',
  'Look up — the best moments are not on a screen.',
  'Laugh a little louder today.',
  'Good days are built, one small choice at a time.',
  'You are doing better than you think.',
  'Plant kindness, grow happiness.',
  'Every hug counts.',
  'Make room for joy.',
  'One good habit can change a whole family.',
  'Smile — it’s contagious.',
  'Today, choose people over pixels.',
]

/** Little family kindness ideas — one per day on the Today screen. */
export const KINDNESS_IDEAS = [
  'Leave a kind note somewhere unexpected 💌',
  'Ask everyone for their best moment of the day 🌟',
  'Have a 5-minute dance party in the kitchen 💃',
  'Call a grandparent just to say hi ☎️',
  'Cook something together tonight 🍳',
  'Give a specific compliment to each family member 🤗',
  'Take a short walk together after dinner 🌇',
  'Share one thing you’re grateful for at dinner 🙏',
  'Let the kids pick tonight’s story 📚',
  'Phones in a basket during dinner 🧺',
  'Draw a funny picture for someone ✏️',
  'Say “thank you” for something small 🌼',
  'Plan a mini weekend adventure together 🗺️',
  'Water the plants together and name one 🌱',
]

/** Cheerful one-liners shown on nudge cards. */
export const SMILE_LINES: Record<string, string[]> = {
  water: ['Hydration hero! 💪', 'Your cells say thank you 💧', 'Glug glug — you’ve got this!'],
  posture: ['Tall like a tree 🌳', 'Shoulders back, superstar ⭐', 'Chin up, champ!'],
  footwear: ['Happy feet, happy you 👟', 'Step into the day in style!'],
  kids: [
    'Little ones, big smiles 🧒',
    'Team family, go go go! 🎉',
    'Making memories, one routine at a time ✨',
  ],
  family: [
    'Family first, phones last 💛',
    'Hugs are free and unlimited 🤗',
    'You make home feel like home 🏡',
  ],
  night: ['The moon is on duty now 🌙', 'Dream big, sleep well ✨', 'Tomorrow-you says thanks 💤'],
  default: [
    'You’ve got this! 🌟',
    'Small step, big smile 😊',
    'Nice one — keep going 🌿',
    'Future you is cheering 🎉',
  ],
}

function seedOf(localDate: string) {
  return localDate.split('-').reduce((acc, part) => acc * 31 + Number(part), 7)
}

export function motivationFor(localDate: string, offset = 0): string {
  return MOTIVATION[(seedOf(localDate) + offset) % MOTIVATION.length]
}

export function kindnessFor(localDate: string): string {
  return KINDNESS_IDEAS[seedOf(localDate) % KINDNESS_IDEAS.length]
}

export function smileLine(key: string): string {
  const list = SMILE_LINES[key] ?? SMILE_LINES.default
  return list[Math.floor(Math.random() * list.length)]
}
