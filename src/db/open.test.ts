import { describe, expect, it } from 'vitest'
import { db } from './db'
import { openDb, reopenDb } from './open'

describe('openDb / reopenDb', () => {
  it('cancels an open that is under way and opens afresh', async () => {
    db.close()
    const first = openDb()
    expect(openDb()).toBe(first) // joins the open under way
    await reopenDb()
    expect(db.isOpen()).toBe(true)
    // the cancelled open settles (rejects) instead of hanging
    await expect(first).rejects.toMatchObject({ name: 'DatabaseClosedError' })
    await db.settings.put({ key: 'probe', value: 1, updatedAt: '' })
    expect((await db.settings.get('probe'))?.value).toBe(1)
  })

  it('closes and reopens an open database (Try again from the app)', async () => {
    await openDb()
    await reopenDb()
    expect(db.isOpen()).toBe(true)
    expect(await db.settings.count()).toBeGreaterThanOrEqual(0)
  })
})
