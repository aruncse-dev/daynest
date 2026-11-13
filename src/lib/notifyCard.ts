/**
 * Rich notification picture: a small card drawn on this device (no server, no download),
 * shown as the notification's big image on Android/desktop Chrome. Returns null where
 * OffscreenCanvas isn't available, and the notification simply shows without a picture.
 */
export interface CardInput {
  emoji: string
  title: string
  /** e.g. "4:00 PM · Today 3 of 5 done" */
  line: string
  theme: 'day' | 'night' | 'important'
}

const THEMES = {
  day: { from: '#eaf3e6', to: '#cfe3d3', ink: '#1f2a22', soft: '#4d6b57', circle: '#ffffff' },
  important: {
    from: '#5b8d6d',
    to: '#2f5b43',
    ink: '#ffffff',
    soft: '#dcefe2',
    circle: '#ffffff33',
  },
  night: { from: '#2b3757', to: '#141c2e', ink: '#ffffff', soft: '#c3cbe3', circle: '#ffffff1f' },
}

const W = 720
const H = 360
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'

function fit(ctx: OffscreenCanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

export async function drawReminderCard(input: CardInput): Promise<string | null> {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null
    const canvas = new OffscreenCanvas(W, H)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const t = THEMES[input.theme]

    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, t.from)
    g.addColorStop(1, t.to)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // soft decorative circles
    ctx.fillStyle = input.theme === 'day' ? '#ffffff55' : '#ffffff10'
    ctx.beginPath()
    ctx.arc(W - 70, 40, 120, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(60, H + 10, 90, 0, Math.PI * 2)
    ctx.fill()
    if (input.theme === 'night') {
      ctx.fillStyle = '#ffffffaa'
      for (const [x, y, r] of [
        [520, 70, 2.5],
        [610, 150, 2],
        [450, 300, 2],
        [660, 260, 3],
        [380, 50, 1.8],
      ])
        ctx.fillRect(x - r / 2, y - r / 2, r, r)
    }

    // emoji in a circle
    ctx.fillStyle = t.circle
    ctx.beginPath()
    ctx.arc(150, H / 2, 92, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000' // colour emoji pick up the fill's transparency
    ctx.font = `104px ${EMOJI_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(input.emoji, 150, H / 2 + 6)

    // text
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const x = 280
    const max = W - x - 40
    ctx.fillStyle = t.soft
    ctx.font = `700 24px ${FONT}`
    ctx.fillText(input.theme === 'important' ? 'IMPORTANT · DAYNEST' : 'DAYNEST', x, 140)
    ctx.fillStyle = t.ink
    ctx.font = `800 46px ${FONT}`
    ctx.fillText(fit(ctx, input.title, max), x, 200)
    ctx.fillStyle = t.soft
    ctx.font = `600 26px ${FONT}`
    ctx.fillText(fit(ctx, input.line, max), x, 248)

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return `data:image/jpeg;base64,${btoa(bin)}`
  } catch {
    return null
  }
}

/** Opening this URL shows the reminder's full card inside DayNest. */
export const reminderUrl = (id: string) => `/?reminder=${encodeURIComponent(id)}`
