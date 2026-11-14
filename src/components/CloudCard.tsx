import { useEffect, useState, type ReactNode } from 'react'
import {
  IconBackup,
  IconCloud,
  IconCloudDone,
  IconCloudOff,
  IconCopy,
  IconDevices,
  IconFile,
  IconHide,
  IconKey,
  IconLock,
  IconNoServer,
  IconPassword,
  IconPhone,
  IconRestore,
  IconShow,
  IconSync,
  IconWarning,
} from './icons'
import { localChanges } from '@/db/db'
import { useNow, useSetting } from '@/lib/hooks'
import { googleConfigured } from '@/lib/cloud/google'
import {
  CLOUD_CODE,
  CLOUD_ERROR,
  CLOUD_LAST,
  CLOUD_PAUSED,
  CLOUD_SHEET,
  pauseCloud,
  startFresh,
  resumeCloud,
  syncCloud,
  turnOnCloud,
  unlockCloud,
} from '@/lib/cloud/cloud'
import { toast } from '@/store/ui'
import { Button, Field, Input, Segmented, Sheet, Toggle, cx } from './ui'
import {
  canSaveToPasswordManager,
  KEY_FIELD_USERNAME,
  loadSavedKeyCode,
  saveKeyCode,
} from '@/lib/cloud/keySave'

// eslint-disable-next-line react-refresh/only-export-components -- small hook used with these components
export function useCloud() {
  const sheet = useSetting<string | null>(CLOUD_SHEET, null)
  const paused = useSetting(CLOUD_PAUSED, false)
  const last = useSetting<string | null>(CLOUD_LAST, null)
  const error = useSetting<string | null>(CLOUD_ERROR, null)
  /** linked = this phone knows the Sheet + key code; on = linked and not paused */
  return { on: !!sheet && !paused, linked: !!sheet, paused, sheet, last, error }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function ago(iso: string | null) {
  if (!iso) return 'not yet'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24
    ? `${h} h ago`
    : new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/** Short icon points instead of sentences. */
type Point = [icon: ReactNode, text: string]

/** Short icon points instead of sentences. */
function Points({ items, column }: { items: Point[]; column?: boolean }) {
  return (
    <ul
      className={cx(
        'text-[11.5px] text-muted',
        column ? 'grid gap-2 text-[13.5px] text-ink' : 'flex flex-wrap gap-x-3 gap-y-0.5',
      )}
    >
      {items.map(([icon, text]) => (
        <li key={text} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cx('leading-none text-sage-ink', column ? 'text-[19px]' : 'text-[14px]')}
          >
            {icon}
          </span>
          {text}
        </li>
      ))}
    </ul>
  )
}

export type Mode = 'phone' | 'google'

/** 📱 Phone | ☁️ Google. Phone = only on this phone. Google = + encrypted copy in your Drive. */
export function ModeSwitch({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <Segmented
      label="Mode"
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'phone',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <IconPhone className="text-[17px]" /> Phone
            </span>
          ),
        },
        {
          value: 'google',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <IconCloud className="text-[17px]" /> Google
            </span>
          ),
        },
      ]}
    />
  )
}

/**
 * Settings: one toggle. Off = only this phone. Switching off only pauses (link + key code
 * kept), so switching back on is instant. Hidden until the app has a Google sign-in ID.
 */
export function CloudCard() {
  const { on, linked, last, error } = useCloud()
  const code = useSetting<string | null>(CLOUD_CODE, null)
  const [flow, setFlow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  if (!googleConfigured()) return null

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast(ok, { emoji: '☁️' })
    } catch (e) {
      toast(errText(e), { emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  const toggle = (v: boolean) => {
    if (!v) {
      void pauseCloud()
      toast('Only on this phone now', { emoji: '📱' })
    } else if (linked) void run(resumeCloud, 'Back on · synced')
    else setFlow(true)
  }

  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft">
      <div className="grid gap-2 px-3.5 py-3">
        <div className="flex items-center justify-between">
          <b className="text-[14px]">Mode</b>
          {busy && !on && <IconSync className="animate-spin text-lg text-sage-ink" />}
        </div>
        <ModeSwitch value={on ? 'google' : 'phone'} onChange={(m) => toggle(m === 'google')} />
        <Points
          items={
            on
              ? [
                  [<IconLock />, 'Encrypted'],
                  [<IconDevices />, 'More phones'],
                  [<IconRestore />, 'Restore anytime'],
                ]
              : [
                  [<IconPhone />, 'Only on this phone'],
                  [<IconBackup />, 'Keep a backup file'],
                ]
          }
        />
      </div>
      {on && (
        <div className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
          <span
            className={cx(
              'inline-flex flex-1 items-center gap-1.5',
              error ? 'text-amber-ink' : 'text-muted',
            )}
          >
            {error ? (
              <IconWarning className="shrink-0 text-[17px]" />
            ) : (
              <IconCloudDone className="shrink-0 text-[17px] text-sage-ink" />
            )}
            {error ?? `Synced ${ago(last)}`}
          </span>
          <button
            type="button"
            aria-label="Sync now"
            disabled={busy}
            onClick={() => void run(() => syncCloud(true))}
            className="grid size-9 place-items-center rounded-lg text-sage-ink hover:bg-surface2"
          >
            <IconSync className={cx('text-[19px]', busy && 'animate-spin')} />
          </button>
        </div>
      )}
      {on && (
        <div className="px-3.5 py-2 text-[13px]">
          <div className="flex items-center gap-3">
            <span className="inline-flex flex-1 items-center gap-1.5">
              <IconKey className="text-[17px] text-sage-ink" /> Key code
            </span>
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-sage-ink"
            >
              {show ? <IconHide className="text-[17px]" /> : <IconShow className="text-[17px]" />}{' '}
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {show && code && <KeyCodeBox code={code} />}
        </div>
      )}
      {/* stays mounted while the card switches to "on": it still has the key code to show */}
      {flow && <CloudFlow onClose={() => setFlow(false)} />}
    </section>
  )
}

function KeyCodeBox({ code }: { code: string }) {
  return (
    <div className="mt-2 rounded-xl bg-surface2 p-3 text-center">
      <code className="block select-all text-[18px] font-bold tracking-wider">{code}</code>
      <div className="mt-2 flex justify-center gap-2">
        {canSaveToPasswordManager() && (
          <Button
            size="sm"
            onClick={async () => {
              const r = await saveKeyCode(code)
              toast(
                r === 'saved'
                  ? 'Saved to passwords'
                  : r === 'copied'
                    ? 'Copied'
                    : 'Long-press to copy',
                {
                  emoji: r === 'saved' ? '🔐' : '📋',
                },
              )
            }}
          >
            <IconPassword className="text-[17px]" /> Save to passwords
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code)
              toast('Copied', { emoji: '📋' })
            } catch {
              toast('Long-press to copy')
            }
          }}
        >
          <IconCopy className="text-[16px]" /> Copy
        </Button>
      </div>
    </div>
  )
}

/**
 * Sign in → new key code (first time) or enter key code (Sheet already exists).
 * `restore`: from the welcome screen on a new phone (replaces this phone's data by default).
 */
export function CloudFlow({
  onClose,
  onDone,
  restore,
}: {
  onClose: () => void
  /** after success: 'created' (new Sheet), 'unlocked' (existing Sheet) or 'resumed' */
  onDone?: (kind: 'created' | 'unlocked' | 'resumed') => void
  restore?: boolean
}) {
  const [step, setStep] = useState<'start' | 'created' | 'unlock'>('start')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [sheet, setSheet] = useState('')
  const [replace, setReplace] = useState(!!restore)
  const [confirmFresh, setConfirmFresh] = useState(false)

  const start = async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await turnOnCloud()
      if (r.kind === 'resumed') {
        toast('Back on · synced', { emoji: '☁️' })
        onDone?.('resumed')
        onClose()
      } else if (r.kind === 'created') {
        setCode(r.code)
        setStep('created')
      } else {
        setSheet(r.sheet)
        setStep('unlock')
        // a new phone: the password manager may already have the key code
        const saved = await loadSavedKeyCode()
        if (saved) setCode(saved)
      }
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const fresh = async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await startFresh(sheet)
      setCode(r.code)
      setStep('created')
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const unlock = async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await unlockCloud(sheet, code, replace)
      toast(`Synced · ${r.pulled} item${r.pulled === 1 ? '' : 's'}`, { emoji: '☁️' })
      onDone?.('unlocked')
      onClose()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={
        step === 'created'
          ? 'Your key code'
          : step === 'unlock'
            ? 'Enter your key code'
            : 'Google Drive backup'
      }
      onClose={onClose}
      footer={
        step === 'start' ? (
          <Button className="flex-1" onClick={start} disabled={busy}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </Button>
        ) : step === 'created' ? (
          <Button
            className="flex-1"
            onClick={() => {
              onDone?.('created')
              onClose()
            }}
          >
            Done
          </Button>
        ) : (
          <Button className="flex-1" onClick={unlock} disabled={busy || code.trim().length < 20}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        )
      }
    >
      {step === 'start' && (
        <Points
          column
          items={[
            [<IconLock />, 'Encrypted on your phone'],
            [<IconFile />, 'Only DayNest’s own file'],
            [<IconNoServer />, 'No DayNest server'],
          ]}
        />
      )}

      {step === 'created' && (
        <div className="grid gap-3">
          <KeyCodeBox code={code} />
          <Points
            column
            items={[
              [<IconKey />, 'Needed on a new phone'],
              [<IconShow />, 'Also in Settings → Mode'],
              [<IconWarning />, 'Can’t be reset'],
            ]}
          />
        </div>
      )}

      {step === 'unlock' && (
        <div className="grid gap-3 text-sm">
          <Points
            items={[
              [<IconCloudDone />, 'This Google account already has a DayNest copy'],
              [<IconKey />, 'Enter the key code from when it was made'],
            ]}
          />
          {/* username + password fields so phone password managers can fill the key code */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={KEY_FIELD_USERNAME}
            readOnly
            hidden
          />
          <Field label="Key code">
            <Input
              type="text"
              name="password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setErr(null)
              }}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="current-password"
              spellCheck={false}
            />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3">
            <span>
              Replace this phone’s data
              <small className="block text-[11px] text-muted">New phone? Keep on</small>
            </span>
            <Toggle checked={replace} onChange={setReplace} label="Replace this phone's data" />
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3">
            <span className="flex-1">
              <b className="block text-[13.5px]">New user or lost the code?</b>
              <small className="text-[11px] text-muted">Old copy stays in Drive, renamed</small>
            </span>
            {confirmFresh ? (
              <Button size="sm" onClick={fresh} disabled={busy}>
                Yes, start fresh
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmFresh(true)}>
                Start fresh
              </Button>
            )}
          </div>
        </div>
      )}

      {err && <p className="rounded-xl bg-amber-soft p-3 text-xs text-amber-ink">⚠️ {err}</p>}
    </Sheet>
  )
}

/** Header: shows the family copy's state; tap to sync (Google may ask once an hour). */
export function CloudSyncButton() {
  const { on, error, last } = useCloud()
  const [busy, setBusy] = useState(false)
  const now = useNow()
  if (!on) return null
  const stale = !last || now.getTime() - new Date(last).getTime() > 60 * 60_000
  return (
    <button
      type="button"
      aria-label={
        busy ? 'Syncing' : error || stale ? 'Tap to sync family copy' : 'Family copy synced'
      }
      title={error ?? (last ? `Synced ${ago(last)}` : 'Not synced yet')}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await syncCloud(true)
        } catch (e) {
          toast(errText(e), { emoji: '⚠️' })
        } finally {
          setBusy(false)
        }
      }}
      className={cx(
        'grid size-10 place-items-center rounded-full transition',
        error || stale ? 'bg-amber-soft text-amber-ink' : 'text-sage-ink hover:bg-surface2',
      )}
    >
      {busy ? (
        <IconSync className="animate-spin text-[20px]" />
      ) : error ? (
        <IconCloudOff className="text-[20px]" />
      ) : (
        <IconCloudDone className="text-[20px]" />
      )}
    </button>
  )
}

/** Syncs quietly while Google's sign-in is still fresh: after edits, every few minutes, on return. */
export function CloudRunner() {
  const { on } = useCloud()
  useEffect(() => {
    if (!on) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => void syncCloud(false).catch(() => undefined)
    run()
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(run, 8_000)
    }
    const onVisible = () => document.visibilityState === 'visible' && run()
    localChanges.addEventListener('change', soon)
    document.addEventListener('visibilitychange', onVisible)
    const every = setInterval(run, 5 * 60_000)
    return () => {
      clearTimeout(timer)
      clearInterval(every)
      localChanges.removeEventListener('change', soon)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [on])
  return null
}
