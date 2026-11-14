import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { getSetting, setSetting } from '@/db/actions'
import { CLOUD_CODE, CLOUD_PAUSED, CLOUD_SHEET, pauseCloud, syncCloud, turnOffCloud } from './cloud'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('switching the Google copy off and on', () => {
  it('off only pauses: the link and key code stay, and nothing syncs', async () => {
    await setSetting(CLOUD_SHEET, 'S1')
    await setSetting(CLOUD_CODE, 'K7QM-2XPA-9DTR-W4NE-B3HF')
    await pauseCloud()
    expect(await getSetting(CLOUD_PAUSED, false)).toBe(true)
    expect(await getSetting(CLOUD_SHEET, null)).toBe('S1')
    expect(await getSetting(CLOUD_CODE, null)).toBe('K7QM-2XPA-9DTR-W4NE-B3HF')
    // even from a tap, a paused phone doesn't sync (or open Google)
    expect(await syncCloud(true)).toBeNull()
  })

  it('forgetting removes the link, key code and pause from this phone', async () => {
    await setSetting(CLOUD_SHEET, 'S1')
    await setSetting(CLOUD_CODE, 'K7QM-2XPA-9DTR-W4NE-B3HF')
    await pauseCloud()
    await turnOffCloud()
    expect(await getSetting(CLOUD_SHEET, null)).toBeNull()
    expect(await getSetting(CLOUD_CODE, null)).toBeNull()
    expect(await getSetting(CLOUD_PAUSED, false)).toBe(false)
  })
})
