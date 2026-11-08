import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FolderOpen, HardDrive, Pencil, ShieldCheck, Upload } from 'lucide-react'
import { db, SCHEMA_VERSION } from '@/db/db'
import { clearAllData, setSetting } from '@/db/actions'
import { loadSampleData, SETTING_ONBOARDED, SETTING_SAMPLE } from '@/db/seed'
import { exportToDownload, importBackup, validateBackup, type ValidationResult } from '@/lib/backup'
import {
  backupToFolder,
  chooseFolder,
  folderBackupSupported,
  forgetFolder,
  getFolderHandle,
  RETENTION_KEY,
} from '@/lib/folderBackup'
import { usePrimaryProfile, useSetting } from '@/lib/hooks'
import { toast, useUI } from '@/store/ui'
import {
  Avatar,
  Button,
  ConfirmButton,
  IconButton,
  PageHeader,
  Panel,
  PanelHead,
  Segmented,
  Select,
  Sheet,
  Tag,
} from '@/components/ui'

export function Settings() {
  const me = usePrimaryProfile()
  const openSheet = useUI((s) => s.openSheet)
  const theme = useSetting<'light' | 'dark' | 'system'>('theme', 'system')
  const sample = useSetting(SETTING_SAMPLE, false)
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your DayNest" sub="Everything stays on this device." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <Panel>
            <PanelHead title="Profile" />
            {me && (
              <div className="flex items-center gap-3">
                <Avatar avatar={me.avatar} color={me.color} size={46} />
                <div className="flex-1">
                  <div className="font-bold">{me.name}</div>
                  <div className="text-xs text-muted">Main profile on this device</div>
                </div>
                <IconButton
                  label="Edit profile"
                  onClick={() => openSheet({ type: 'profile', profile: me })}
                >
                  <Pencil size={15} />
                </IconButton>
              </div>
            )}
            <Button variant="soft" size="sm" className="mt-3" onClick={() => navigate('/family')}>
              Manage family profiles
            </Button>
          </Panel>

          <Panel>
            <PanelHead title="Appearance" />
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
          </Panel>

          <BackupPanel />
        </div>

        <div className="grid gap-4">
          <StoragePanel />
          <Panel>
            <PanelHead title="Sample data" sub="Fictional data to explore the app" />
            {sample && (
              <p className="mb-3 rounded-xl bg-amber-soft px-3 py-2 text-xs text-amber-ink">
                You are viewing sample data. Reset it before entering your own.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <ConfirmButton
                confirmText="Replace all data with samples?"
                onConfirm={async () => {
                  await loadSampleData(me?.name?.replace(' (sample)', '') || 'Alex')
                  toast('Sample data loaded', { emoji: '🧺' })
                }}
              >
                Load sample data
              </ConfirmButton>
              <ConfirmButton
                confirmText="Erase everything?"
                onConfirm={async () => {
                  await clearAllData()
                  await setSetting(SETTING_ONBOARDED, false)
                  toast('All data cleared')
                }}
              >
                {sample ? 'Reset sample data' : 'Erase all data'}
              </ConfirmButton>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Erasing returns you to the welcome screen. Export a backup first if you want to keep
              anything.
            </p>
          </Panel>

          <Panel>
            <PanelHead
              title="Privacy"
              action={<ShieldCheck size={18} className="text-sage-ink" />}
            />
            <ul className="grid gap-1.5 text-xs text-muted">
              <li>• No account, no server, no analytics, no trackers.</li>
              <li>
                • Your data lives in this browser's storage (IndexedDB) and is never sent anywhere.
              </li>
              <li>
                • Browser storage is not encrypted. Anyone using this device profile can open
                DayNest.
              </li>
              <li>• Profiles are not synced between devices — use export/import to move data.</li>
            </ul>
          </Panel>

          <Panel>
            <PanelHead title="About" />
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-muted">App version</dt>
              <dd className="text-right font-semibold">{__APP_VERSION__}</dd>
              <dt className="text-muted">Database schema</dt>
              <dd className="text-right font-semibold">v{SCHEMA_VERSION}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted">
              DayNest — plan your day, build better habits, keep your family organised. 🌿
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function StoragePanel() {
  const [info, setInfo] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const refresh = async () => {
    try {
      const est = await navigator.storage?.estimate?.()
      const persisted = await navigator.storage?.persisted?.()
      setInfo({ usage: est?.usage, quota: est?.quota, persisted })
    } catch {
      /* unsupported */
    }
  }
  useEffect(() => {
    void refresh()
  }, [])
  const mb = (n?: number) =>
    n === undefined ? '—' : n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${(n / 1e6).toFixed(1)} MB`
  return (
    <Panel>
      <PanelHead title="Storage" action={<HardDrive size={18} className="text-muted" />} />
      <div className="text-xs text-muted">
        Using {mb(info.usage)} of {mb(info.quota)} available.{' '}
        {info.persisted ? (
          <Tag tone="sage">Protected storage</Tag>
        ) : (
          <Tag tone="amber">Best-effort storage</Tag>
        )}
      </div>
      {!info.persisted && navigator.storage?.persist && (
        <Button
          size="sm"
          variant="soft"
          className="mt-3"
          onClick={async () => {
            const ok = await navigator.storage.persist()
            toast(
              ok
                ? 'Storage protected from automatic clean-up'
                : 'Browser declined — installing the app usually helps',
            )
            void refresh()
          }}
        >
          Ask browser to keep my data
        </Button>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Browsers can clear site data (e.g. when storage is low or you clear history). Regular
        backups are essential.
      </p>
    </Panel>
  )
}

function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Extract<ValidationResult, { ok: true }> | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const retention = useSetting(RETENTION_KEY, 30)
  const history = useLiveQuery(
    () => db.backupHistory.orderBy('createdAt').reverse().limit(5).toArray(),
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

  const last = history?.find((h) => h.status === 'success')

  return (
    <Panel>
      <PanelHead title="Backup & restore" sub="Keep a copy of your data somewhere safe" />
      <div className="mb-3 rounded-xl bg-surface2 px-3 py-2 text-xs">
        {last ? (
          <>
            Last backup: <b>{new Date(last.createdAt).toLocaleString()}</b> ·{' '}
            {last.destination === 'folder' ? 'folder' : 'download'}
          </>
        ) : (
          <span className="text-amber-ink">No backup yet — export one now.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const name = await exportToDownload()
              toast(`Exported ${name}`, { emoji: '📦' })
            } catch {
              toast('Export failed', { emoji: '⚠️' })
            } finally {
              setBusy(false)
            }
          }}
        >
          <Download size={16} /> Export JSON
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Import…
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

      <div className="mt-5 border-t border-line-soft pt-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <FolderOpen size={16} /> Folder backup
        </h3>
        {!supported ? (
          <p className="text-xs text-muted">
            Your browser doesn't support saving to a folder. Use “Export JSON” — it works
            everywhere.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">
              {folderName ? (
                <>
                  Saving daily snapshots to <b>“{folderName}”</b> when you open DayNest (one per
                  day).
                </>
              ) : (
                'Pick a folder (e.g. a synced cloud drive folder) for automatic daily snapshots while the app is open.'
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
                    /* user cancelled */
                  }
                }}
              >
                {folderName ? 'Change folder' : 'Choose folder'}
              </Button>
              {folderName && (
                <>
                  <Button
                    size="sm"
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
                </>
              )}
            </div>
            {folderName && (
              <label className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                Keep the latest
                <Select
                  className="max-w-32"
                  value={retention}
                  onChange={(e) => setSetting(RETENTION_KEY, Number(e.target.value))}
                >
                  {[7, 14, 30, 60, 90].map((n) => (
                    <option key={n} value={n}>
                      {n} snapshots
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </>
        )}
      </div>

      {!!history?.length && (
        <details className="mt-4 text-xs text-muted">
          <summary className="cursor-pointer font-semibold">Recent backup activity</summary>
          <ul className="mt-2 grid gap-1">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-2">
                <span className="truncate">{h.filename}</span>
                <span className={h.status === 'success' ? 'text-sage-ink' : 'text-rose-ink'}>
                  {h.status === 'success' ? '✓' : (h.errorMessage ?? 'failed')}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {pending && <ImportDialog pending={pending} onClose={() => setPending(null)} />}
    </Panel>
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
