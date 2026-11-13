import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('latest-version check', () => {
  beforeEach(() => vi.resetModules())

  it('flags an update only when the deployed build differs from this one', async () => {
    vi.stubGlobal('__BUILD_ID__', 'aaaaaaa')
    const { checkLatest, useAppUpdate } = await import('./appUpdate')
    const reply = (build: string) =>
      vi.fn(async () => new Response(JSON.stringify({ version: '0.2.0', build })))

    expect(await checkLatest(reply('aaaaaaa') as unknown as typeof fetch)).toBe(false)
    expect(useAppUpdate.getState().available).toBe(false)

    expect(await checkLatest(reply('bbbbbbb') as unknown as typeof fetch)).toBe(true)
    expect(useAppUpdate.getState()).toMatchObject({ available: true, latest: '0.2.0 · bbbbbbb' })
    vi.unstubAllGlobals()
  })

  it('stays quiet offline', async () => {
    vi.stubGlobal('__BUILD_ID__', 'aaaaaaa')
    const { checkLatest, useAppUpdate } = await import('./appUpdate')
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await checkLatest(offline as unknown as typeof fetch)).toBe(false)
    expect(useAppUpdate.getState().available).toBe(false)
    vi.unstubAllGlobals()
  })
})
