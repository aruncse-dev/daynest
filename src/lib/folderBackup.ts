/**
 * Optional folder backup using the File System Access API (Chromium desktop/Android).
 * Writes only happen while the app is open and permission is granted —
 * there are no silent background writes when the browser is closed.
 */
import { db } from '@/db/db'
import { getSetting, setSetting } from '@/db/actions'
import { todayLocal } from './date'
import { backupFilename, buildBackup, recordBackup } from './backup'

export const HANDLE_KEY = 'backupFolderHandle'
export const RETENTION_KEY = 'backupRetention'
export const LAST_SNAPSHOT_KEY = 'lastSnapshotDate'

type PermState = 'granted' | 'denied' | 'prompt'
interface PermHandle {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermState>
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermState>
}
type DirHandle = FileSystemDirectoryHandle &
  PermHandle & {
    values(): AsyncIterable<FileSystemHandle>
  }

export function folderBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function getFolderHandle(): Promise<DirHandle | null> {
  const row = await db.settings.get(HANDLE_KEY)
  return (row?.value as DirHandle | undefined) ?? null
}

/** Must be called from a user gesture. */
export async function chooseFolder(): Promise<string | null> {
  if (!folderBackupSupported()) return null
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> })
    .showDirectoryPicker
  const handle = await picker({ id: 'daynest-backups', mode: 'readwrite', startIn: 'documents' })
  await setSetting(HANDLE_KEY, handle)
  return handle.name
}

export async function forgetFolder() {
  await db.settings.delete(HANDLE_KEY)
}

export async function folderPermission(handle: DirHandle, request = false): Promise<PermState> {
  if (!handle.queryPermission) return 'granted'
  let state = await handle.queryPermission({ mode: 'readwrite' })
  if (state !== 'granted' && request && handle.requestPermission)
    state = await handle.requestPermission({ mode: 'readwrite' })
  return state
}

async function prune(handle: DirHandle, keep: number) {
  const names: string[] = []
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && /^daynest-backup-\d{4}-\d{2}-\d{2}.*\.json$/.test(entry.name))
      names.push(entry.name)
  }
  names.sort()
  // never delete the only (or newest) valid backup
  const removable = names.slice(0, Math.max(0, names.length - Math.max(1, keep)))
  for (const n of removable) await handle.removeEntry(n)
}

/** Write a snapshot now. `interactive` may prompt for permission (needs a user gesture). */
export async function backupToFolder(
  interactive: boolean,
): Promise<{ ok: boolean; message: string }> {
  const handle = await getFolderHandle()
  if (!handle) return { ok: false, message: 'No backup folder chosen.' }
  const filename = backupFilename()
  try {
    const perm = await folderPermission(handle, interactive)
    if (perm !== 'granted') {
      await recordBackup({
        filename,
        destination: 'folder',
        status: 'error',
        errorMessage: 'Folder permission needed',
      })
      return {
        ok: false,
        message: 'Permission to the backup folder is needed. Tap “Back up now” to grant it.',
      }
    }
    const backup = await buildBackup()
    const file = await handle.getFileHandle(filename, { create: true })
    const writable = await file.createWritable()
    await writable.write(JSON.stringify(backup, null, 2))
    await writable.close()
    await setSetting(LAST_SNAPSHOT_KEY, todayLocal())
    await prune(handle, await getSetting(RETENTION_KEY, 30))
    await recordBackup({ filename, destination: 'folder', status: 'success' })
    return { ok: true, message: `Saved ${filename} to “${handle.name}”.` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await recordBackup({ filename, destination: 'folder', status: 'error', errorMessage: msg })
    return { ok: false, message: `Backup failed: ${msg}` }
  }
}

/** On launch: at most one snapshot per local date, only if permission is still granted. */
export async function maybeDailySnapshot() {
  if (!folderBackupSupported()) return
  const handle = await getFolderHandle()
  if (!handle) return
  if ((await getSetting<string | null>(LAST_SNAPSHOT_KEY, null)) === todayLocal()) return
  if ((await folderPermission(handle, false)) !== 'granted') return
  await backupToFolder(false)
}
