import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { db, SCHEMA_VERSION } from '@/db/db'
import { clearAllData, setSetting } from '@/db/actions'
import { SETTING_ONBOARDED } from '@/db/keys'
import { exportToDownload, importBackup, validateBackup, type ValidationResult } from '@/lib/backup'
import {
  backupToFolder,
  chooseFolder,
  folderBackupSupported,
  forgetFolder,
  getFolderHandle,
  RETENTION_KEY,
} from '@/lib/folderBackup'
import { useMembers, usePrimaryProfile, useSetting } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  ConfirmButton,
  IconButton,
  Input,
  Segmented,
  Select,
  Sheet,
  Toggle,
} from '@/components/ui'
import { CloudCard } from '@/components/CloudCard'
import { useAppUpdate } from '@/lib/appUpdate'
import { Tour } from '@/components/Tour'
import { setPhoneFree } from '@/db/phoneFree'
import { DEFAULT_QUIET, QUIET_KEY, type QuietHours } from '@/lib/quietHours'
import { formatShort } from '@/lib/suggest'

/** One short page. Rarely-needed options sit inside "More" rows instead of extra tabs. */
export function Settings() {
  const me = usePrimaryProfile()
  const members = useMembers()
  const openSheet = useUI((s) => s.openSheet)
  const theme = useSetting<'light' | 'dark' | 'system'>('theme', 'system')
  const sound = useSetting('reminderSound', true)
  const navigate = useNavigate()
  const [tour, setTour] = useState(false)

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </IconButton>
        <h1 className="text-[24px] font-bold tracking-[-0.8px]">Settings</h1>
      </div>

      <Group>
        {me && (
          <Row onClick={() => openSheet({ type: 'profile', profile: me })}>
            <Avatar avatar={me.avatar} color={me.color} size={36} />
            <span className="flex-1 font-semibold">{me.name}</span>
            <ChevronRight size={18} className="text-muted" />
          </Row>
        )}
        <Row
          onClick={() => (members.length ? navigate('/family') : openSheet({ type: 'profile' }))}
        >
          <span className="flex-1">
            Family members
            <small className="block text-[11px] text-muted">
              {members.length
                ? members.map((m) => m.name).join(', ')
                : 'Add people you plan for. Kept only on this phone.'}
            </small>
          </span>
          {members.length ? (
            <ChevronRight size={18} className="text-muted" />
          ) : (
            <span className="text-sm font-bold text-sage-ink">+ Add</span>
          )}
        </Row>
      </Group>

      <CloudCard />

      <Group>
        <div className="px-3.5 py-3">
          <div className="mb-2 text-sm">Theme</div>
          <Segmented
            label="Theme"
            value={theme}
            onChange={(v) => setSetting('theme', v)}
            options={[
              { value: 'light', label: '☀️ Light' },
              { value: 'dark', label: '🌙 Dark' },
              { value: 'system', label: 'Auto' },
            ]}
          />
        </div>
        <Row>
          <span className="flex-1">Chime when a reminder appears</span>
          <Toggle
            checked={sound}
            onChange={(v) => setSetting('reminderSound', v)}
            label="Nudge chime"
          />
        </Row>
      </Group>

      <PhoneFreeGroup />

      <BackupGroup />

      <Group>
        <Row onClick={() => setTour(true)}>
          <span className="flex-1">▶️ Watch the 30-second tour</span>
          <ChevronRight size={18} className="text-muted" />
        </Row>
        <Row onClick={() => navigate('/setup')}>
          <span className="flex-1">🪄 Get suggestions again (setup)</span>
          <ChevronRight size={18} className="text-muted" />
        </Row>
      </Group>

      <details className="rounded-[18px] border border-line bg-surface px-3.5 py-3 text-sm">
        <summary className="cursor-pointer">🔒 Privacy & storage</summary>
        <ul className="mt-2 grid gap-1.5 text-xs text-muted">
          <li>• The app loads from the web, but what you enter is saved only on this phone.</li>
          <li>
            • No DayNest account or server database, no ads, no tracking. The optional family copy
            is encrypted on the phone and stored in your own Google Sheet.
          </li>
          <li>
            • Browser storage isn't encrypted. Anyone using this phone's browser can open DayNest.
          </li>
          <li>• Clearing browser data erases DayNest, so keep a backup.</li>
        </ul>
        <StorageLine />
      </details>

      <UpdateRow />

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] text-muted">
          DayNest {__APP_VERSION__} · data v{SCHEMA_VERSION}
          <br />
          build {__BUILD_ID__} ·{' '}
          {new Date(__BUILD_TIME__).toLocaleDateString([], { day: 'numeric', month: 'short' })}
        </span>
        <ConfirmButton
          className="!min-h-9 !px-3 !text-xs"
          confirmText="Erase everything?"
          onConfirm={async () => {
            await clearAllData()
            await setSetting(SETTING_ONBOARDED, false)
            toast('All data erased')
          }}
        >
          Erase all data
        </ConfirmButton>
      </div>

      {tour && <Tour onClose={() => setTour(false)} />}
    </div>
  )
}

/** Shown when this phone runs an older DayNest than the one deployed. */
function UpdateRow() {
  const { available, latest, apply } = useAppUpdate()
  if (!available) return null
  return (
    <section className="flex items-center gap-3 rounded-[18px] border border-amber-ink/30 bg-amber-soft px-3.5 py-3 text-sm">
      <RefreshCw size={18} className="shrink-0 text-amber-ink" />
      <span className="flex-1">
        <b>Update available</b>
        <small className="block text-[11px] text-muted">
          You have build {__BUILD_ID__}
          {latest ? `; the latest is ${latest}` : ''}. Updating keeps your data.
        </small>
      </span>
      <Button size="sm" onClick={() => apply?.()}>
        Update
      </Button>
    </section>
  )
}

/**
 * Phone-free nights: quiet hours + a "No phone after 10 PM" habit with a reminder 15 minutes
 * before. The habit and its reminder show up in Routines like any other.
 */
function PhoneFreeGroup() {
  const quiet = useSetting<QuietHours>(QUIET_KEY, DEFAULT_QUIET)
  const me = usePrimaryProfile()
  const update = (patch: Partial<QuietHours>) =>
    setPhoneFree({ ...quiet, ...patch }, me?.id ?? null)
  return (
    <Group>
      <Row>
        <span className="flex-1">
          🌙 Phone-free nights
          <small className="block text-[11px] text-muted">
            {quiet.enabled
              ? `Reminder at ${formatShort(shiftTime(quiet.start, -15))}, other reminders quiet until ${formatShort(quiet.end)}`
              : 'A habit + reminder to put the phone down at night'}
          </small>
        </span>
        <Toggle
          checked={quiet.enabled}
          onChange={(v) => update({ enabled: v, muteNudges: true })}
          label="Phone-free nights"
        />
      </Row>
      {quiet.enabled && (
        <div className="grid gap-2 px-3.5 py-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-muted">Phone down at</span>
              <Input
                type="time"
                value={quiet.start}
                onChange={(e) => e.target.value && update({ start: e.target.value })}
                className="!min-h-10"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted">Until</span>
              <Input
                type="time"
                value={quiet.end}
                onChange={(e) => e.target.value && update({ end: e.target.value })}
                className="!min-h-10"
              />
            </label>
          </div>
          <p className="text-muted">
            Important reminders still come through. A web app can't lock your phone. For extra help,
            turn on <b>Bedtime mode</b> (Android) or <b>Downtime</b> (iPhone) for the same hours.
          </p>
        </div>
      )}
    </Group>
  )
}

const shiftTime = (t: string, m: number) => {
  const [h, mm] = t.split(':').map(Number)
  const total = (((h * 60 + mm + m) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function Group({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft">
      {children}
    </section>
  )
}

function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const cls = 'flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-surface2`}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  )
}

function StorageLine() {
  const [info, setInfo] = useState<{ usage?: number; persisted?: boolean }>({})
  useEffect(() => {
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.()
        const persisted = await navigator.storage?.persisted?.()
        setInfo({ usage: est?.usage, persisted })
      } catch {
        /* unsupported */
      }
    })()
  }, [])
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>Using {info.usage === undefined ? '—' : `${(info.usage / 1e6).toFixed(1)} MB`}</span>
      {!info.persisted && navigator.storage?.persist && (
        <Button
          size="sm"
          variant="soft"
          onClick={async () => {
            const ok = await navigator.storage.persist()
            setInfo((i) => ({ ...i, persisted: ok }))
            toast(
              ok
                ? 'Your browser will keep DayNest data'
                : 'Browser declined. Installing the app usually helps',
            )
          }}
        >
          Ask browser to keep my data
        </Button>
      )}
    </div>
  )
}

function BackupGroup() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Extract<ValidationResult, { ok: true }> | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const retention = useSetting(RETENTION_KEY, 30)
  const last = useLiveQuery(
    () =>
      db.backupHistory
        .orderBy('createdAt')
        .reverse()
        .filter((h) => h.status === 'success')
        .first(),
    [],
  )
  const supported = folderBackupSupported()

  useEffect(() => {
    void getFolderHandle().then((h) => setFolderName(h?.name ?? null))
  }, [])

  const onFile = async (file: File) => {
    try {
      const result = validateBackup(await file.text())
      if (!result.ok) toast(result.error, { emoji: '⚠️' })
      else setPending(result)
    } catch {
      toast('Could not read that file', { emoji: '⚠️' })
    }
  }

  return (
    <Group>
      <div className="px-3.5 py-3">
        <div className="text-sm">Backup</div>
        <div className="text-[11px] text-muted">
          {last
            ? `Last backup ${new Date(last.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
            : 'No backup yet. Save one now and then.'}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              try {
                await exportToDownload()
                toast('Backup saved to your downloads', { emoji: '💾' })
              } catch {
                toast('Backup failed', { emoji: '⚠️' })
              }
            }}
          >
            Save backup
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            Restore from file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {supported && (
        <details className="px-3.5 py-3 text-sm">
          <summary className="cursor-pointer">Automatic daily backup to a folder</summary>
          <p className="mt-2 text-xs text-muted">
            {folderName
              ? `Saving one copy a day to “${folderName}” when you open DayNest.`
              : 'Pick a folder, for example a Google Drive folder on this device. DayNest saves one copy a day whenever you open it.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="soft"
              onClick={async () => {
                try {
                  const n = await chooseFolder()
                  if (n) {
                    setFolderName(n)
                    const r = await backupToFolder(true)
                    toast(r.message, { emoji: r.ok ? '📁' : '⚠️' })
                  }
                } catch {
                  /* cancelled */
                }
              }}
            >
              {folderName ? 'Change folder' : 'Choose folder'}
            </Button>
            {folderName && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await backupToFolder(true)
                    toast(r.message, { emoji: r.ok ? '✅' : '⚠️' })
                  }}
                >
                  Back up now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await forgetFolder()
                    setFolderName(null)
                  }}
                >
                  Stop
                </Button>
                <Select
                  className="!min-h-9 max-w-36 text-xs"
                  value={retention}
                  onChange={(e) => setSetting(RETENTION_KEY, Number(e.target.value))}
                  aria-label="How many copies to keep"
                >
                  {[7, 14, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      Keep {n} copies
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>
        </details>
      )}
      {pending && <ImportDialog pending={pending} onClose={() => setPending(null)} />}
    </Group>
  )
}

function ImportDialog({
  pending,
  onClose,
}: {
  pending: Extract<ValidationResult, { ok: true }>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const s = pending.summary
  const rows: [string, number][] = [
    ['Profiles', s.profiles],
    ['Tasks', s.tasks],
    ['Task completions', s.taskOccurrences],
    ['Habits', s.habits],
    ['Habit check-ins', s.habitEntries],
    ['Events', s.events],
    ['Goals', s.goals],
    ['Reminders', s.reminders],
    ['Wellness sessions', s.wellnessSessions],
  ]
  return (
    <Sheet
      title="Restore backup"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await importBackup(pending.backup, mode)
                await setSetting(SETTING_ONBOARDED, true)
                toast('Backup restored', { emoji: '✅' })
                onClose()
              } catch (e) {
                toast(
                  `Import failed — nothing was changed. ${e instanceof Error ? e.message : ''}`,
                  { emoji: '⚠️' },
                )
                setBusy(false)
              }
            }}
          >
            {mode === 'replace' ? 'Replace my data' : 'Merge into my data'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Exported {new Date(pending.backup.exportedAt).toLocaleString()} · app v
        {pending.backup.appVersion}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-surface2 p-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-muted">{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      {pending.warnings.map((w) => (
        <p key={w} className="text-xs text-amber-ink">
          ⚠️ {w}
        </p>
      ))}
      <Segmented
        label="Import mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'merge', label: 'Merge' },
          { value: 'replace', label: 'Replace all' },
        ]}
      />
      <p className="text-xs text-muted">
        {mode === 'merge'
          ? 'Adds records from the backup and updates matching ones. Nothing is deleted.'
          : 'Deletes everything currently in DayNest on this device, then restores the backup.'}{' '}
        The import runs as one transaction — if anything fails, your existing data is left
        untouched.
      </p>
    </Sheet>
  )
}
