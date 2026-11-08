/** Tiny synthesised chime — no audio files, works offline. */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function chime(kind: 'bell' | 'soft' | 'tick' = 'bell') {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  const notes = kind === 'bell' ? [528, 792, 1056] : kind === 'soft' ? [396, 594] : [880]
  const length = kind === 'tick' ? 0.15 : 2.6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const vol = (kind === 'tick' ? 0.05 : 0.12) / (i + 1)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length)
    osc.connect(gain).connect(ac.destination)
    osc.start(now)
    osc.stop(now + length + 0.05)
  })
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}
