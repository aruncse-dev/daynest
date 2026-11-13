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

export const googleConfigured = () => !!CLIENT_ID

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

let token: { value: string; expiresAt: number } | null = null
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

/**
 * Get an access token. `interactive` must come from a tap (it may open Google's window);
 * otherwise it tries quietly and fails if Google needs the user.
 */
export async function getToken(interactive: boolean): Promise<string> {
  if (hasToken()) return token!.value
  if (!CLIENT_ID) throw new Error('Google sign-in is not set up for this app.')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) {
          reject(new Error(r.error_description || r.error || 'Google sign-in was cancelled.'))
          return
        }
        token = { value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }
        resolve(r.access_token)
      },
      error_callback: (e) =>
        reject(
          new Error(e.type === 'popup_closed' ? 'Google sign-in was closed.' : e.message || e.type),
        ),
    })
    client.requestAccessToken({ prompt: interactive ? '' : 'none' })
  })
}

export function signOutGoogle() {
  if (token) window.google?.accounts.oauth2.revoke(token.value)
  token = null
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const t = await getToken(false)
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (res.status === 401) token = null
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
