/**
 * Long Google sign-in for DayNest, without a database.
 *
 * Google only gives browser apps 1-hour tokens. A long-lived "refresh token" needs the app's
 * client secret, which must never be in the app's code. This tiny function holds the secret
 * (Vercel env GOOGLE_CLIENT_SECRET) and does two things only:
 *   POST { code, verifier, redirectUri } → access token + refresh token (one-time sign-in)
 *   POST { refreshToken }                → a fresh 1-hour access token
 *   GET                                  → { enabled } (is the secret set?)
 * It stores nothing and logs nothing. The refresh token stays on the person's phone, and it
 * only allows DayNest's own Drive files (drive.file).
 */
export const config = { runtime: 'edge' }

const ALLOWED_ORIGINS = ['https://daynestapp.vercel.app']
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface Env {
  clientId?: string
  secret?: string
  /** extra allowed origins, comma-separated (e.g. a preview domain) */
  origins?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export async function handle(req: Request, env: Env, f: typeof fetch = fetch): Promise<Response> {
  const allowed = [...ALLOWED_ORIGINS, ...(env.origins ?? '').split(',').filter(Boolean)]
  const origin = req.headers.get('origin')
  if (origin && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403)

  const enabled = !!env.clientId && !!env.secret
  if (req.method === 'GET') return json({ enabled })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!enabled) return json({ error: 'long sign-in not set up' }, 501)

  let body: { code?: string; verifier?: string; redirectUri?: string; refreshToken?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad request' }, 400)
  }

  const form = new URLSearchParams({ client_id: env.clientId!, client_secret: env.secret! })
  if (body.refreshToken) {
    form.set('grant_type', 'refresh_token')
    form.set('refresh_token', body.refreshToken)
  } else if (body.code && body.verifier && body.redirectUri) {
    if (!allowed.some((o) => body.redirectUri!.startsWith(`${o}/`)))
      return json({ error: 'redirect not allowed' }, 400)
    form.set('grant_type', 'authorization_code')
    form.set('code', body.code)
    form.set('code_verifier', body.verifier)
    form.set('redirect_uri', body.redirectUri)
  } else return json({ error: 'bad request' }, 400)

  const r = await f(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const t = (await r.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    error?: string
  }
  // invalid_grant = the long sign-in was revoked/expired: the phone signs in again once
  if (!r.ok || !t.access_token)
    return json({ error: t.error ?? 'google error' }, r.status === 400 ? 400 : 502)
  return json({
    accessToken: t.access_token,
    expiresIn: t.expires_in ?? 3600,
    refreshToken: t.refresh_token,
  })
}

declare const process: { env: Record<string, string | undefined> }

export default function handler(req: Request) {
  return handle(req, {
    clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    origins: process.env.ALLOWED_ORIGINS,
  })
}
