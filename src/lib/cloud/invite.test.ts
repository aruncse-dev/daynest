import { describe, expect, it } from 'vitest'
import { clearInvite, consumeInviteFromUrl, inviteLink, parseInvite, pendingInvite } from './invite'

const FILE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const CODE = 'K7QM-2XPA-9DTR-W4NE-B3HF'

describe('family invite links', () => {
  it('round-trips through a link, with the details only after #', () => {
    const link = inviteLink(
      { f: FILE, k: CODE, p: 'priya', n: 'Arun' },
      'https://daynestapp.vercel.app',
    )
    expect(link.startsWith('https://daynestapp.vercel.app/join#')).toBe(true)
    expect(link.split('#')[0]).not.toContain(CODE) // never sent to any server
    expect(parseInvite(link)).toEqual({ f: FILE, k: CODE, p: 'priya', n: 'Arun' })
  })

  it('rejects links that are not DayNest invites', () => {
    expect(parseInvite('https://example.com')).toBeNull()
    expect(parseInvite(`https://daynestapp.vercel.app/join#f=${FILE}&k=short`)).toBeNull()
    expect(parseInvite(`https://daynestapp.vercel.app/join#f=bad id&k=${CODE}`)).toBeNull()
  })

  it('an opened invite link is kept for the join screen and the address cleaned', () => {
    clearInvite()
    history.replaceState(null, '', `/join#v=1&f=${FILE}&k=${CODE}&p=priya&n=Arun`)
    expect(consumeInviteFromUrl()).toBe(true)
    expect(location.pathname).toBe('/')
    expect(location.hash).toBe('')
    expect(pendingInvite()).toMatchObject({ f: FILE, k: CODE, p: 'priya', n: 'Arun' })
    clearInvite()
    expect(pendingInvite()).toBeNull()
  })
})
