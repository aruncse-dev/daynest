import { useMemo } from 'react'

/** Soft drifting green blobs + a few slow floating leaves. Purely decorative. */
export function AnimatedBackground({
  leaves = 6,
  intense = false,
}: {
  leaves?: number
  intense?: boolean
}) {
  const leafs = useMemo(
    () =>
      Array.from({ length: leaves }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        duration: `${28 + ((i * 7) % 18)}s`,
        delay: `${-((i * 9) % 30)}s`,
        size: 12 + ((i * 5) % 10),
        glyph: ['🍃', '🌿', '🍀', '✿'][i % 4],
      })),
    [leaves],
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="blob"
        style={{
          width: '55vmax',
          height: '55vmax',
          left: '-18vmax',
          top: '-20vmax',
          background: 'var(--blob1)',
          opacity: intense ? 1 : 0.8,
        }}
      />
      <div
        className="blob"
        style={{
          width: '45vmax',
          height: '45vmax',
          right: '-15vmax',
          top: '20vh',
          background: 'var(--blob2)',
          animationDelay: '-8s',
          opacity: intense ? 1 : 0.7,
        }}
      />
      <div
        className="blob"
        style={{
          width: '50vmax',
          height: '50vmax',
          left: '20vw',
          bottom: '-30vmax',
          background: 'var(--blob3)',
          animationDelay: '-16s',
          opacity: intense ? 1 : 0.7,
        }}
      />
      {leafs.map((l, i) => (
        <span
          key={i}
          className="leaf"
          style={{
            left: l.left,
            animationDuration: l.duration,
            animationDelay: l.delay,
            fontSize: l.size,
            opacity: 0.4,
          }}
        >
          {l.glyph}
        </span>
      ))}
    </div>
  )
}
