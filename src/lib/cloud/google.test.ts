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
