import { describe, expect, it } from 'vitest'
import { consumeRedirect, hasToken, takeResume } from './google'

const arrive = (hash: string, saved: object | null) => {
  if (saved) localStorage.setItem('daynest.oauth', JSON.stringify(saved))
  history.replaceState(null, '', `/#${hash}`)
}

describe('coming back from Google’s sign-in page', () => {
  it('ignores a token whose state does not match what this phone sent', () => {
    arrive('access_token=evil&expires_in=3600&state=other', {
      state: 'mine',
      next: 'turnOn',
      path: '/',
      at: Date.now(),
    })
    expect(consumeRedirect()).toBeNull()
    expect(hasToken()).toBe(false)
    expect(location.hash).toBe('') // never left in the address bar
  })

  it('takes the token, cleans the address and remembers what to carry on with', () => {
    arrive('access_token=tok&token_type=Bearer&expires_in=3599&state=s1', {
      state: 's1',
      next: 'turnOn',
      path: '/settings',
      at: Date.now(),
    })
    expect(consumeRedirect()).toBe('turnOn')
    expect(hasToken()).toBe(true)
    expect(location.hash).toBe('')
    expect(location.pathname).toBe('/settings')
    expect(takeResume()).toBe('turnOn')
    expect(takeResume()).toBeNull()
  })

  it('does nothing on a normal page load', () => {
    history.replaceState(null, '', '/plan#section')
    expect(consumeRedirect()).toBeNull()
    expect(location.hash).toBe('#section')
  })
})

describe('when Google sends the person back with a problem', () => {
  it('a refusal reopens the same screen with the reason, without signing in', async () => {
    const g = await import('./google')
    localStorage.setItem(
      'daynest.oauth',
      JSON.stringify({ state: 's2', next: 'turnOn', path: '/', at: Date.now() }),
    )
    history.replaceState(null, '', '/#error=access_denied&state=s2')
    expect(g.consumeRedirect()).toBeNull()
    expect(g.peekResume()).toBe('turnOn') // reopen to show it
    expect(g.takeRedirectError()).toBe('Google sign-in was cancelled.')
    g.takeResume()
  })

  it('a return this app did not ask for is never used, but explained', async () => {
    const g = await import('./google')
    localStorage.removeItem('daynest.oauth')
    history.replaceState(null, '', '/#access_token=x&expires_in=3600&state=zzz')
    expect(g.consumeRedirect()).toBeNull()
    expect(g.takeRedirectError()).toMatch(/different window/)
    expect(location.hash).toBe('')
  })
})
