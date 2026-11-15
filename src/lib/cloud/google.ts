/**
 * Google sign-in and Sheets access, straight from the phone: no DayNest server.
 *
 * Scope `drive.file`: DayNest can only see files it created (or that someone picks for it),
 * never the rest of the user's Drive. Access tokens live in memory for about an hour.
 */
import type { CloudMeta, CloudRow, CloudStore } from './store'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const SHEET_NAME = 'DayNest family (encrypted)'
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined
/** Google Cloud project number (the Picker calls it the app id). */
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined

export const googleConfigured = () => !!CLIENT_ID
/**
 * Family members on their own phones with their own Google accounts (invite → QR → join).
 * On by default; set VITE_FAMILY_SHARING=off to hide it. Needs the Picker's API key and
 * project number.
 */
const FAMILY_SHARING = import.meta.env.VITE_FAMILY_SHARING !== 'off'
export const familyConfigured = () => FAMILY_SHARING && !!CLIENT_ID && !!API_KEY && !!APP_ID

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(c: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }): TokenClient
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

type Token = { value: string; expiresAt: number }
const TOKEN_KEY = 'daynest.gtoken'

/**
 * Google's access token lasts about an hour (no server = no longer-lived sign-in). It's kept
 * on this phone for that hour so reopening the app doesn't disconnect; it only allows
 * DayNest's own files (`drive.file`) and is dropped when it expires or on sign-out.
 */
let token: Token | null = (() => {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null
    return t && t.expiresAt > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
})()

function setToken(t: Token | null) {
  token = t
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode: memory only */
  }
}
let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisLoading = null
      reject(new Error('Could not reach Google. Check your connection.'))
    }
    document.head.appendChild(s)
  })
  return gisLoading
}

export const hasToken = () => !!token && token.expiresAt > Date.now() + 60_000

/* ---------- Redirect sign-in (iPhone/iPad, or when a popup is blocked) ---------- */

/** What to carry on with after Google sends the person back. */
export type ResumeAction = 'turnOn' | 'sync' | 'join'
const REDIRECT_KEY = 'daynest.oauth'
let resumeAction: ResumeAction | null = null
let redirectError: string | null = null

/** iPhone/iPad (incl. the Home Screen app): Google's popup is blocked or can't report back. */
export function redirectSignInNeeded(): boolean {
  if (typeof navigator === 'undefined') return false
  const iPadOS = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadOS
}

let leaving: Promise<never> | null = null

function redirectSignIn(next: ResumeAction): Promise<never> {
  // already on the way to Google: don't start a second trip
  if (leaving) return leaving
  const state = crypto.randomUUID()
  try {
    localStorage.setItem(
      REDIRECT_KEY,
      JSON.stringify({ state, next, path: location.pathname + location.search, at: Date.now() }),
    )
  } catch {
    /* private mode: the token still arrives, we just can't resume automatically */
  }
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.search = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: `${location.origin}/`,
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  }).toString()
  location.assign(u.toString())
  leaving = new Promise<never>(() => undefined) // the page is leaving
  return leaving
}

/**
 * Call once at start-up: picks up the token Google put in the address (#access_token=…),
 * removes it from the address bar, and remembers what to carry on with.
 */
export function consumeRedirect(): ResumeAction | null {
  const hash = location.hash.slice(1)
  if (!/(^|&)(access_token|error)=/.test(hash)) return null
  const p = new URLSearchParams(hash)
  let saved: { state: string; next: ResumeAction; path: string; at: number } | null = null
  try {
    saved = JSON.parse(localStorage.getItem(REDIRECT_KEY) ?? 'null')
    localStorage.removeItem(REDIRECT_KEY)
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', saved?.path ?? location.pathname + location.search)
  if (!saved || p.get('state') !== saved.state || Date.now() - saved.at > 15 * 60_000) return null
  const access = p.get('access_token')
  if (access) {
    setToken({ value: access, expiresAt: Date.now() + Number(p.get('expires_in') ?? 3600) * 1000 })
    resumeAction = saved.next
    return saved.next
  }
  redirectError =
    p.get('error') === 'access_denied' ? 'Google sign-in was cancelled.' : p.get('error')
  return null
}

/** The action to resume after a redirect, without using it up. */
export const peekResume = () => resumeAction
/** Take (and clear) the action to resume after a redirect. */
export function takeResume() {
  const a = resumeAction
  resumeAction = null
  return a
}
export function takeRedirectError() {
  const e = redirectError
  redirectError = null
  return e
}

/* ---------- Popup sign-in (Android, desktop) ---------- */

let pending: Promise<string> | null = null

/** Load Google's script ahead of time so a tap can open the popup straight away. */
export function prepareGoogle() {
  if (CLIENT_ID && !redirectSignInNeeded()) void loadGis().catch(() => undefined)
}

/**
 * Get an access token. `interactive` must come from a tap: call it first thing in the tap
 * handler (before any await), so browsers allow Google's popup. On iPhone/iPad it goes to
 * Google's page and comes back (`next` says what to carry on with).
 */
export function getToken(interactive: boolean, next: ResumeAction = 'sync'): Promise<string> {
  if (hasToken()) return Promise.resolve(token!.value)
  if (!CLIENT_ID) return Promise.reject(new Error('Google sign-in is not set up'))
  if (redirectSignInNeeded())
    return interactive ? redirectSignIn(next) : Promise.reject(new Error('Tap to sync'))
  if (pending) return pending
  if (!window.google?.accounts?.oauth2) return loadGis().then(() => getToken(interactive, next))
  pending = new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) {
          reject(new Error(r.error_description || r.error || 'Google sign-in was cancelled.'))
          return
        }
        setToken({ value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 })
        resolve(r.access_token)
      },
      error_callback: (e) => {
        // blocked popup: go to Google's page instead
        if (interactive && e.type === 'popup_failed_to_open') {
          void redirectSignIn(next)
          return
        }
        reject(
          new Error(e.type === 'popup_closed' ? 'Google sign-in was closed.' : e.message || e.type),
        )
      },
    })
    client.requestAccessToken({ prompt: interactive ? '' : 'none' })
  }).finally(() => {
    pending = null
  })
  return pending
}

export function signOutGoogle() {
  if (token) window.google?.accounts.oauth2.revoke(token.value)
  setToken(null)
}

/** The linked family Sheet can't be opened (deleted, or a different Google project now). */
export const NOT_REACHABLE = 'Family copy not reachable'

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const t = await getToken(false)
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (res.status === 401) setToken(null)
  // the file is gone, or this Google setup (project) can't open it any more
  if (res.status === 404 && /spreadsheets\//.test(url)) throw new Error(NOT_REACHABLE)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Google returned ${res.status}`)
  }
  return (await res.json()) as T
}

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'

/** The family Sheet this Google account already has from DayNest, if any. */
export async function findFamilySheet(): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${SHEET_NAME}' and mimeType='${SHEET_MIME}' and trashed=false`,
  )
  const r = await api<{ files: { id: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id)&pageSize=1`,
  )
  return r.files[0]?.id ?? null
}

/** Rename a file DayNest created (e.g. set an old family copy aside). Nothing is deleted. */
export async function renameFile(id: string, name: string) {
  await api(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function createFamilySheet(): Promise<string> {
  const r = await api<{ spreadsheetId: string }>(SHEETS, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: SHEET_NAME },
      sheets: [{ properties: { title: 'data' } }, { properties: { title: 'meta' } }],
    }),
  })
  await api(`${SHEETS}/${r.spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [
        {
          range: 'data!A1:D1',
          values: [['key', 'updatedAt', 'deleted', 'payload (encrypted on the phone)']],
        },
      ],
    }),
  })
  return r.spreadsheetId
}

/** The family Sheet as a CloudStore. */
export class GoogleSheetStore implements CloudStore {
  constructor(private id: string) {}

  async readAll() {
    const r = await api<{ valueRanges: { values?: string[][] }[] }>(
      `${SHEETS}/${this.id}/values:batchGet?ranges=data!A2:D&ranges=meta!A1:B10&valueRenderOption=UNFORMATTED_VALUE`,
    )
    const rows: CloudRow[] = (r.valueRanges[0]?.values ?? [])
      .map((v, i) => ({
        key: String(v[0] ?? ''),
        updatedAt: String(v[1] ?? ''),
        deleted: String(v[2]) === '1' || String(v[2]).toUpperCase() === 'TRUE',
        payload: String(v[3] ?? ''),
        row: i + 2,
      }))
      .filter((x) => x.key)
    const kv = Object.fromEntries((r.valueRanges[1]?.values ?? []).map((v) => [v[0], v[1]]))
    const meta: CloudMeta | null = kv.salt
      ? { v: Number(kv.v ?? 1), salt: kv.salt, check: kv.check, createdAt: kv.createdAt ?? '' }
      : null
    return { rows, meta }
  }

  async writeMeta(m: CloudMeta) {
    await api(`${SHEETS}/${this.id}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          {
            range: 'meta!A1:B4',
            values: [
              ['v', String(m.v)],
              ['salt', m.salt],
              ['check', m.check],
              ['createdAt', m.createdAt],
            ],
          },
        ],
      }),
    })
  }

  async upsert(rows: CloudRow[]) {
    const line = (r: CloudRow) => [r.key, r.updatedAt, r.deleted ? '1' : '0', r.payload]
    const updates = rows.filter((r) => r.row)
    const appends = rows.filter((r) => !r.row)
    if (updates.length)
      await api(`${SHEETS}/${this.id}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates.map((r) => ({ range: `data!A${r.row}:D${r.row}`, values: [line(r)] })),
        }),
      })
    if (appends.length)
      await api(
        `${SHEETS}/${this.id}/values/data!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: appends.map(line) }) },
      )
  }
}

/* ---------- Family sharing (owner side) ---------- */

export interface Share {
  id: string
  email: string
  name?: string
  role: string
}

/** Share the family file with someone's own Google account (they can read and write it). */
export async function shareFile(fileId: string, email: string) {
  const q = new URLSearchParams({
    sendNotificationEmail: 'true',
    emailMessage: 'You were invited to a DayNest family. Open the invite link you were sent.',
  })
  await api(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?${q}`, {
    method: 'POST',
    body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email.trim() }),
  })
}

/** People the family file is shared with (not the owner). */
export async function listShares(fileId: string): Promise<Share[]> {
  const r = await api<{
    permissions?: { id: string; emailAddress?: string; displayName?: string; role: string }[]
  }>(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,displayName,role)`,
  )
  return (r.permissions ?? [])
    .filter((p) => p.role !== 'owner' && p.emailAddress)
    .map((p) => ({ id: p.id, email: p.emailAddress!, name: p.displayName, role: p.role }))
}

export async function unshare(fileId: string, permissionId: string) {
  const t = await getToken(false)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } },
  )
  if (!res.ok && res.status !== 404) throw new Error(`Google returned ${res.status}`)
}

/* ---------- Family sharing (joining side): Google's file chooser ---------- */

/** The small part of Google's Picker that DayNest uses. */
interface PickerBuilder {
  addView(v: unknown): PickerBuilder
  setOAuthToken(t: string): PickerBuilder
  setDeveloperKey(k: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setTitle(t: string): PickerBuilder
  setCallback(cb: (d: { action: string; docs?: { id: string }[] }) => void): PickerBuilder
  build(): { setVisible(v: boolean): void }
}
interface PickerApi {
  PickerBuilder: new () => PickerBuilder
  DocsView: new (viewId?: string) => {
    setFileIds(ids: string): unknown
    setMode(m: string): unknown
  }
  ViewId: { SPREADSHEETS: string }
  DocsViewMode: { LIST: string }
  Action: { PICKED: string; CANCEL: string }
}
declare global {
  interface Window {
    gapi?: { load(name: string, cb: () => void): void }
  }
}

let pickerLoading: Promise<PickerApi> | null = null
function loadPicker(): Promise<PickerApi> {
  const ready = () => (window.google as unknown as { picker?: PickerApi })?.picker
  if (ready()) return Promise.resolve(ready()!)
  pickerLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://apis.google.com/js/api.js'
    s.async = true
    s.onload = () => window.gapi!.load('picker', () => resolve(ready()!))
    s.onerror = () => {
      pickerLoading = null
      reject(new Error('Could not reach Google. Check your connection.'))
    }
    document.head.appendChild(s)
  })
  return pickerLoading
}

/**
 * Let the person pick the family file someone shared with them (Google only lets DayNest open
 * it after this one tap). Shows just that file. Resolves with the picked file id, or null.
 */
export async function pickSharedFile(fileId: string): Promise<string | null> {
  if (!API_KEY || !APP_ID) throw new Error('Joining a family is not set up yet')
  const t = await getToken(false)
  const picker = await loadPicker()
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
    view.setFileIds(fileId)
    view.setMode(picker.DocsViewMode.LIST)
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(t)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setTitle('Tap the DayNest family file')
      .setCallback((d) => {
        if (d.action === picker.Action.PICKED) resolve(d.docs?.[0]?.id ?? null)
        else if (d.action === picker.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}
