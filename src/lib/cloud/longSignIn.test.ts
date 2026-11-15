// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handle } from '../../../api/google-token'

const env = { clientId: 'cid', secret: 'shh' }
const post = (body: unknown, origin = 'https://daynestapp.vercel.app') =>
  new Request('https://daynestapp.vercel.app/api/google-token', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const google = (reply: unknown, status = 200) =>
  vi.fn(async (_u: unknown, _init?: RequestInit) => new Response(JSON.stringify(reply), { status }))

describe('long Google sign-in function', () => {
  it('says whether it is set up', async () => {
    const r = await handle(new Request('https://x/api/google-token'), env)
    expect(await r.json()).toEqual({ enabled: true })
    const off = await handle(new Request('https://x/api/google-token'), { clientId: 'cid' })
    expect(await off.json()).toEqual({ enabled: false, missing: ['GOOGLE_CLIENT_SECRET'] })
  })

  it('swaps a one-time code for tokens, sending the secret only to Google', async () => {
    const f = google({ access_token: 'at', expires_in: 3599, refresh_token: 'rt' })
    const r = await handle(
      post({ code: 'c1', verifier: 'v1', redirectUri: 'https://daynestapp.vercel.app/' }),
      env,
      f as unknown as typeof fetch,
    )
    expect(await r.json()).toEqual({ accessToken: 'at', expiresIn: 3599, refreshToken: 'rt' })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const sent = new URLSearchParams(String(init!.body))
    expect(sent.get('grant_type')).toBe('authorization_code')
    expect(sent.get('client_secret')).toBe('shh')
    expect(sent.get('code_verifier')).toBe('v1')
  })

  it('renews with a refresh token', async () => {
    const f = google({ access_token: 'at2', expires_in: 3599 })
    const r = await handle(post({ refreshToken: 'rt' }), env, f as unknown as typeof fetch)
    expect(await r.json()).toEqual({ accessToken: 'at2', expiresIn: 3599 })
    expect(new URLSearchParams(String(f.mock.calls[0][1]!.body)).get('grant_type')).toBe(
      'refresh_token',
    )
  })

  it('refuses other websites and other redirect addresses', async () => {
    const f = google({})
    expect(
      (
        await handle(
          post({ refreshToken: 'rt' }, 'https://evil.example'),
          env,
          f as unknown as typeof fetch,
        )
      ).status,
    ).toBe(403)
    const bad = await handle(
      post({ code: 'c', verifier: 'v', redirectUri: 'https://evil.example/' }),
      env,
      f as unknown as typeof fetch,
    )
    expect(bad.status).toBe(400)
    expect(f).not.toHaveBeenCalled()
  })

  it('passes on a revoked sign-in so the phone can sign in again', async () => {
    const f = google({ error: 'invalid_grant' }, 400)
    const r = await handle(post({ refreshToken: 'old' }), env, f as unknown as typeof fetch)
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ error: 'invalid_grant' })
  })
})
