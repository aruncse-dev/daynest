import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Fn = (url: string, init?: RequestInit) => Promise<Response>
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function load(fetchImpl: Fn) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cid')
  vi.resetModules()
  return import('./google')
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('long Google sign-in', () => {
  it('swaps the one-time code once, then stays signed in', async () => {
    localStorage.setItem(
      'daynest.oauth',
      JSON.stringify({
        state: 's',
        next: 'turnOn',
        path: '/settings',
        at: Date.now(),
        verifier: 'v',
      }),
    )
    history.replaceState(null, '', '/?state=s&code=one-time&scope=x')
    const g = await load(async (url, init) => {
      if (url === '/api/google-token') {
        const b = JSON.parse(String(init!.body))
        expect(b).toEqual({ code: 'one-time', verifier: 'v', redirectUri: `${location.origin}/` })
        expect(init!.referrerPolicy).toBe('same-origin')
        return reply({ accessToken: 'at', expiresIn: 3599, refreshToken: 'rt' })
      }
      return reply({})
    })
    expect(g.consumeRedirect()).toBe('turnOn')
    expect(location.search).toBe('') // the code never stays in the address
    expect(location.pathname).toBe('/settings')
    expect(await g.getToken(true, 'turnOn')).toBe('at')
    expect(localStorage.getItem('daynest.grefresh')).toBe('rt')
    expect(g.hasToken()).toBe(true)
  })

  it('still carries on if the app reloads right after coming back', async () => {
    localStorage.setItem(
      'daynest.oauth',
      JSON.stringify({ state: 's', next: 'join', path: '/', at: Date.now(), verifier: 'v' }),
    )
    history.replaceState(null, '', '/?state=s&code=c')
    const g = await load(async () =>
      reply({ accessToken: 'at', expiresIn: 3599, refreshToken: 'rt' }),
    )
    expect(g.consumeRedirect()).toBe('join')
    await g.getToken(false)
    const again = await load(async () => reply({}))
    expect(again.peekResume()).toBe('join')
    expect(again.takeResume()).toBe('join')
    expect((await load(async () => reply({}))).peekResume()).toBeNull()
  })

  it('joining picks the Google account again instead of reusing this phone’s sign-in', async () => {
    localStorage.setItem(
      'daynest.gtoken',
      JSON.stringify({ value: 'someone-else', expiresAt: Date.now() + 3e6 }),
    )
    localStorage.setItem('daynest.grefresh', 'rt-someone-else')
    localStorage.setItem('daynest.glong', '1')
    localStorage.setItem('daynest.gaccount', 'someone@example.com')
    const assign = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      assign,
      origin: location.origin,
      pathname: '/',
      search: '',
    })
    const g = await load(async () => reply({}))
    void g.getToken(true, 'join', true)
    await vi.waitFor(() => expect(assign).toHaveBeenCalled())
    const u = new URL(assign.mock.calls[0][0] as string)
    expect(u.searchParams.get('prompt')).toBe('select_account consent')
    expect(u.searchParams.get('login_hint')).toBeNull()
    expect(localStorage.getItem('daynest.grefresh')).toBeNull()
  })

  it('renews the hour token quietly with the long sign-in (no tap, no Google page)', async () => {
    localStorage.setItem('daynest.grefresh', 'rt')
    const g = await load(async (url, init) => {
      expect(url).toBe('/api/google-token')
      expect(JSON.parse(String(init!.body))).toEqual({ refreshToken: 'rt' })
      return reply({ accessToken: 'fresh', expiresIn: 3599 })
    })
    expect(g.hasToken()).toBe(true) // counts as connected: no amber Sync pill
    expect(await g.getToken(false)).toBe('fresh')
  })

  it('a revoked long sign-in is forgotten, and a quiet sync just waits for a tap', async () => {
    localStorage.setItem('daynest.grefresh', 'revoked')
    const g = await load(async () => reply({ error: 'invalid_grant' }, 400))
    await expect(g.getToken(false)).rejects.toThrow('Tap to sync')
    expect(localStorage.getItem('daynest.grefresh')).toBeNull()
    expect(g.hasToken()).toBe(false)
  })

  it('a code that does not match this phone’s request is never swapped', async () => {
    localStorage.setItem(
      'daynest.oauth',
      JSON.stringify({ state: 'mine', next: 'turnOn', path: '/', at: Date.now(), verifier: 'v' }),
    )
    history.replaceState(null, '', '/?state=other&code=stolen')
    const f = vi.fn(async () => reply({}))
    const g = await load(f)
    expect(g.consumeRedirect()).toBeNull()
    expect(g.takeRedirectError()).toMatch(/different window/)
    expect(f).not.toHaveBeenCalled()
    expect(location.search).toBe('')
  })

  it('signing out revokes the long sign-in', async () => {
    localStorage.setItem('daynest.grefresh', 'rt')
    const f = vi.fn(async () => reply({}))
    const g = await load(f)
    g.signOutGoogle()
    expect(f).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', expect.anything())
    expect(localStorage.getItem('daynest.grefresh')).toBeNull()
  })
})
