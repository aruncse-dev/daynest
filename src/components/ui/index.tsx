import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Check as CheckIcon, X } from 'lucide-react'

// eslint-disable-next-line react-refresh/only-export-components
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/* ---------- Layout ---------- */
export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx('rounded-[18px] border border-line bg-surface p-3.5 shadow-soft', className)}
      {...rest}
    >
      {children}
    </section>
  )
}

export function PanelHead({
  title,
  sub,
  action,
}: {
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 text-[clamp(26px,5vw,34px)] font-bold leading-tight tracking-[-1.2px]">
          {title}
        </h1>
        {sub && <div className="mt-1.5 text-sm text-muted">{sub}</div>}
      </div>
      {action}
    </header>
  )
}

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md'
}
export function Button({ variant = 'primary', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[.97] disabled:opacity-50',
        size === 'sm' ? 'min-h-9 px-3 text-xs' : 'px-4 text-sm',
        variant === 'primary' &&
          'bg-sage text-white shadow-[0_6px_16px_#47765b33] hover:brightness-105',
        variant === 'soft' && 'bg-sage-soft text-sage-ink hover:brightness-[.98]',
        variant === 'outline' && 'border border-line bg-surface text-ink hover:bg-surface2',
        variant === 'ghost' && 'text-sage-ink hover:bg-sage-soft',
        variant === 'danger' && 'bg-rose-soft text-rose-ink hover:brightness-95',
        className,
      )}
      {...rest}
    />
  )
}

export function LinkButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'shrink-0 rounded-lg px-1.5 py-1 text-xs font-bold text-sage-ink hover:bg-sage-soft',
        className,
      )}
      {...rest}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'grid size-10 shrink-0 place-items-center rounded-[13px] border border-line bg-surface text-ink transition hover:bg-surface2 active:scale-95',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------- Data display ---------- */
export function Avatar({
  avatar,
  color,
  size = 34,
  className,
}: {
  avatar: string
  color?: string
  size?: number
  className?: string
}) {
  return (
    <div
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-semibold text-[#3a3a32]',
        className,
      )}
      style={{ width: size, height: size, background: color ?? '#e9dfd0', fontSize: size * 0.44 }}
      aria-hidden
    >
      {avatar}
    </div>
  )
}

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition active:scale-95',
        active
          ? 'border-sage bg-sage text-white'
          : 'border-line bg-surface text-muted hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Tag({
  children,
  tone = 'rose',
}: {
  children: ReactNode
  tone?: 'rose' | 'amber' | 'sage' | 'muted'
}) {
  return (
    <span
      className={cx(
        'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold',
        tone === 'rose' && 'bg-rose-soft text-rose-ink',
        tone === 'amber' && 'bg-amber-soft text-amber-ink',
        tone === 'sage' && 'bg-sage-soft text-sage-ink',
        tone === 'muted' && 'bg-surface2 text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={cx('h-1.5 overflow-hidden rounded-full bg-surface2', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i
        className="block h-full rounded-full bg-gradient-to-r from-[#6d9878] to-sage transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function Ring({
  value,
  size = 56,
  stroke = 6,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--green)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .7s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-bold">{children}</div>
    </div>
  )
}

export function EmptyState({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="grid justify-items-center gap-1.5 px-4 py-7 text-center animate-fade">
      <div className="text-3xl">{emoji}</div>
      <div className="text-sm font-bold">{title}</div>
      {text && <div className="max-w-xs text-xs text-muted">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-xl bg-surface2" />
      ))}
    </div>
  )
}

/* ---------- Check controls with a little celebration ---------- */
function Sparks() {
  const colors = ['#6d9878', '#f2c46b', '#e9a995', '#9cc8aa', '#8fb7d0', '#c7b8ea']
  return (
    <>
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 2
        return (
          <span
            key={i}
            className="spark"
            style={{
              background: c,
              ['--dx' as string]: `${Math.cos(a) * 18}px`,
              ['--dy' as string]: `${Math.sin(a) * 18}px`,
            }}
          />
        )
      })}
    </>
  )
}

export function CheckBox({
  checked,
  onChange,
  label,
  size = 'md',
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  size?: 'md' | 'lg'
  disabled?: boolean
}) {
  const [burst, setBurst] = useState(0)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!checked) setBurst((b) => b + 1)
        onChange()
      }}
      className="relative grid size-11 shrink-0 place-items-center -m-2.5 disabled:opacity-40"
    >
      <span
        key={burst}
        className={cx(
          'grid place-items-center border-[1.5px] text-white transition-colors',
          size === 'lg' ? 'size-7 rounded-[9px]' : 'size-[22px] rounded-[7px]',
          checked
            ? 'animate-pop border-sage bg-sage'
            : 'border-[#cbd4c9] bg-surface dark:border-[#4a5a4f]',
        )}
      >
        {checked && <CheckIcon size={size === 'lg' ? 16 : 14} strokeWidth={3} />}
      </span>
      {burst > 0 && checked && <Sparks key={`s${burst}`} />}
    </button>
  )
}

/* ---------- Forms ---------- */
/**
 * A labelled form row. Use `group` when the row holds several buttons (chips, icon pickers,
 * time lists): a <label> must only wrap a single control.
 */
export function Field({
  label,
  hint,
  children,
  group,
}: {
  label: string
  hint?: string
  children: ReactNode
  group?: boolean
}) {
  const inner = (
    <>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </>
  )
  return group ? (
    <div role="group" aria-label={label} className="grid gap-1.5">
      {inner}
    </div>
  ) : (
    <label className="grid gap-1.5">{inner}</label>
  )
}

const inputCls =
  'w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-sage focus:ring-2 focus:ring-sage/20'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, 'py-2.5', props.className)} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, 'appearance-auto', props.className)} />
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-2xl bg-surface2 p-1 no-scrollbar"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 flex-1 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DayPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (days: number[]) => void
}) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return (
    <div className="flex gap-1.5">
      {order.map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={full[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cx(
              'grid size-10 place-items-center rounded-xl text-xs font-bold transition active:scale-95',
              on ? 'bg-sage text-white' : 'border border-line bg-surface text-muted',
            )}
          >
            {names[d]}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        checked ? 'bg-sage' : 'bg-[#d3dad1] dark:bg-[#3a4a3f]',
      )}
    >
      <span
        className={cx(
          'absolute top-1 size-5 rounded-full bg-white shadow transition-[left]',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}

/* ---------- Bottom sheet / dialog ---------- */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const first = el?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([data-close])',
    )
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const items = [
          ...el.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]'),
        ].filter((x) => !x.hasAttribute('disabled'))
        if (!items.length) return
        const f = items[0]
        const l = items[items.length - 1]
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault()
          l.focus()
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault()
          f.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])

  // Portal to <body>: animated ancestors (transform) would otherwise trap `position: fixed`.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#18221c66] p-0 backdrop-blur-[2px] animate-fade sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-[480px] flex-col rounded-t-[24px] bg-surface shadow-2xl animate-sheet sm:rounded-[24px]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button
            data-close
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface2"
          >
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto px-5 pb-4 pt-1">{children}</div>
        {footer && (
          <div className="flex gap-2 border-t border-line-soft px-5 pb-safe pt-3 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmButton({
  onConfirm,
  children,
  confirmText = 'Tap again to confirm',
  className,
}: {
  onConfirm: () => void
  children: ReactNode
  confirmText?: string
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      variant="danger"
      className={className}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmText : children}
    </Button>
  )
}
