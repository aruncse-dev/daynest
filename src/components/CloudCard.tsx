import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Copy, Eye, RefreshCw } from 'lucide-react'
import { localChanges } from '@/db/db'
import { useNow, useSetting } from '@/lib/hooks'
import { googleConfigured } from '@/lib/cloud/google'
import {
  CLOUD_CODE,
  CLOUD_ERROR,
  CLOUD_LAST,
  CLOUD_SHEET,
  syncCloud,
  turnOffCloud,
  turnOnCloud,
  unlockCloud,
} from '@/lib/cloud/cloud'
import { toast } from '@/store/ui'
import { Button, Field, Input, Sheet, Toggle, cx } from './ui'

// eslint-disable-next-line react-refresh/only-export-components -- small hook used with these components
export function useCloud() {
  const sheet = useSetting<string | null>(CLOUD_SHEET, null)
  const last = useSetting<string | null>(CLOUD_LAST, null)
  const error = useSetting<string | null>(CLOUD_ERROR, null)
  return { on: !!sheet, sheet, last, error }
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

export type StorageMode = 'device' | 'google'

/**
 * Where DayNest keeps the data: only this phone, or this phone + an encrypted copy in the
 * user's own Google Drive. Used in setup and in Settings.
 */
export function StorageChoice({
  value,
  onPick,
}: {
  value: StorageMode
  onPick: (v: StorageMode) => void
}) {
  const options: { v: StorageMode; icon: string; title: string; text: string; note?: string }[] = [
    {
      v: 'device',
      icon: '📱',
      title: 'Only on this phone',
      text: 'Private and works offline. No account. Keep a backup file now and then.',
    },
    {
      v: 'google',
      icon: '☁️',
      title: 'This phone + your Google Drive',
      text: 'An encrypted copy in your own Google Sheet: safe if the phone is lost or reset, and usable on more phones with your Google account.',
      note: "Sharing with family members' own phones: coming next",
    },
  ]
  return (
    <div role="radiogroup" aria-label="Where to keep your data" className="grid gap-2">
      {options.map((o) => {
        const on = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.v)}
            className={cx(
              'flex items-start gap-3 rounded-[16px] border p-3 text-left transition active:scale-[.99]',
              on ? 'border-sage bg-sage-soft ring-1 ring-sage' : 'border-line bg-surface',
            )}
          >
            <span className="text-2xl leading-none">{o.icon}</span>
            <span className="min-w-0 flex-1">
              <b className="block text-[14px]">{o.title}</b>
              <span className="block text-xs text-muted">{o.text}</span>
              {o.note && (
                <span className="mt-1 block text-[11px] font-semibold text-sage-ink">{o.note}</span>
              )}
            </span>
            <span
              aria-hidden
              className={cx(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2',
                on ? 'border-sage' : 'border-line',
              )}
            >
              {on && <span className="size-2.5 rounded-full bg-sage" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Settings: where the data lives. Google = the encrypted family copy in the user's own Sheet.
 * Hidden until the app has a Google sign-in ID.
 */
export function CloudCard() {
  const { on, last, error } = useCloud()
  const code = useSetting<string | null>(CLOUD_CODE, null)
  const [flow, setFlow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  if (!googleConfigured()) return null

  const pick = (v: StorageMode) => {
    if (v === 'google' && !on) setFlow(true)
    setConfirmOff(v === 'device' && on)
  }

  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        Where your data lives
      </h2>
      <StorageChoice value={on && !confirmOff ? 'google' : 'device'} onPick={pick} />

      {confirmOff && (
        <div className="mt-2 rounded-[16px] border border-amber-ink/30 bg-amber-soft p-3 text-sm">
          <b>Keep data only on this phone?</b>
          <p className="text-xs text-muted">
            This phone stops syncing. Your data stays here, and the Sheet stays in your Google Drive
            for your other phones.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmOff(false)}>
              Keep Google
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await turnOffCloud()
                setConfirmOff(false)
                toast('Now kept only on this phone', { emoji: '📱' })
              }}
            >
              <CloudOff size={14} /> Only this phone
            </Button>
          </div>
        </div>
      )}

      {on && (
        <div className="mt-2 overflow-hidden rounded-[18px] border border-line bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft">
          <div className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
            <Cloud size={18} className="shrink-0 text-sage-ink" />
            <span className="flex-1">
              Google Sheet sync
              <small className={cx('block text-[11px]', error ? 'text-amber-ink' : 'text-muted')}>
                {error ? `Not synced: ${error}` : `Synced ${ago(last)} · end-to-end encrypted`}
              </small>
            </span>
            <Button
              size="sm"
              variant="soft"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await syncCloud(true)
                  toast(
                    r?.pulled
                      ? `Synced · ${r.pulled} change${r.pulled > 1 ? 's' : ''} in`
                      : 'Synced',
                    { emoji: '☁️' },
                  )
                } catch (e) {
                  toast(errText(e), { emoji: '⚠️' })
                } finally {
                  setBusy(false)
                }
              }}
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Sync
            </Button>
          </div>
          <div className="px-3.5 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex-1">
                Family key code
                <small className="block text-[11px] text-muted">
                  Needed on a new phone. Keep it written down; nobody can reset it.
                </small>
              </span>
              <Button size="sm" variant="outline" onClick={() => setShow(!show)}>
                <Eye size={14} /> {show ? 'Hide' : 'Show'}
              </Button>
            </div>
            {show && code && <KeyCodeBox code={code} />}
          </div>
        </div>
      )}
      {/* stays mounted while the card switches to "on": it still has the key code to show */}
      {flow && <CloudFlow onClose={() => setFlow(false)} />}
    </section>
  )
}

function KeyCodeBox({ code }: { code: string }) {
  return (
    <div className="mt-2.5 rounded-xl bg-surface2 p-3 text-center">
      <code className="block select-all text-[18px] font-bold tracking-wider">{code}</code>
      <Button
        size="sm"
        variant="ghost"
        className="mt-1"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code)
            toast('Key code copied', { emoji: '📋' })
          } catch {
            toast('Long-press the code to copy it')
          }
        }}
      >
        <Copy size={14} /> Copy
      </Button>
    </div>
  )
}

/**
 * Turn on (new family copy) or open an existing one with its key code.
 * `restore`: from the welcome screen on a new phone, where replacing is the default.
 */
export function CloudFlow({ onClose, restore }: { onClose: () => void; restore?: boolean }) {
  const [step, setStep] = useState<'start' | 'created' | 'unlock'>('start')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [sheet, setSheet] = useState('')
  const [saved, setSaved] = useState(false)
  const [replace, setReplace] = useState(!!restore)

  const start = async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await turnOnCloud()
      if (r.kind === 'created') {
        setCode(r.code)
        setStep('created')
      } else {
        setSheet(r.sheet)
        setStep('unlock')
      }
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
      toast(`Family copy opened · ${r.pulled} item${r.pulled === 1 ? '' : 's'}`, { emoji: '☁️' })
      onClose()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={step === 'created' ? 'Your family key code' : 'Family copy'}
      onClose={onClose}
      footer={
        step === 'start' ? (
          <Button className="flex-1" onClick={start} disabled={busy}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </Button>
        ) : step === 'created' ? (
          <Button className="flex-1" onClick={onClose} disabled={!saved}>
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
        <div className="grid gap-2 text-sm">
          <p>
            {restore
              ? 'Sign in with the Google account that holds your family copy.'
              : 'DayNest keeps an encrypted copy in a Google Sheet in your own Drive.'}
          </p>
          <ul className="grid gap-1 text-xs text-muted">
            <li>🔒 Locked on the phone with a family key code. Google sees only gibberish.</li>
            <li>📄 DayNest can only see the files it creates, not the rest of your Drive.</li>
            <li>🚫 No DayNest server or account. Google handles sign-in and password reset.</li>
          </ul>
        </div>
      )}

      {step === 'created' && (
        <div className="grid gap-3 text-sm">
          <p>
            This code unlocks your family copy on a new phone. <b>Write it down</b> or save it
            somewhere safe. It's shown again in Settings while this phone is signed in.
          </p>
          <KeyCodeBox code={code} />
          <p className="text-xs text-amber-ink">
            Nobody can reset this code, DayNest included. If every phone is lost and the code too,
            the family copy can't be opened.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3">
            <span>I've saved the key code</span>
            <Toggle checked={saved} onChange={setSaved} label="I've saved the key code" />
          </label>
        </div>
      )}

      {step === 'unlock' && (
        <div className="grid gap-3 text-sm">
          <p>Found your family copy. Enter the family key code to unlock it.</p>
          <Field label="Family key code">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setErr(null)
              }}
              placeholder="K7QM-2XPA-9DTR-W4NE-B3HF"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3">
            <span>
              Replace this phone's data
              <small className="block text-[11px] text-muted">
                {replace
                  ? 'Best on a new phone: start from the family copy.'
                  : "Off: this phone's items are added to the family copy."}
              </small>
            </span>
            <Toggle checked={replace} onChange={setReplace} label="Replace this phone's data" />
          </label>
        </div>
      )}

      {err && <p className="rounded-xl bg-amber-soft p-3 text-xs text-amber-ink">{err}</p>}
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
        <RefreshCw size={18} className="animate-spin" />
      ) : error ? (
        <CloudOff size={18} />
      ) : (
        <Cloud size={18} />
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
