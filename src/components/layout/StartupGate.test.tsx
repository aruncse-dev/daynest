import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

// The database open is what can hang on a cold launch: control it from the test.
const open = vi.hoisted(() => ({
  openDb: vi.fn<() => Promise<void>>(),
  reopenDb: vi.fn<() => Promise<void>>(),
}))
vi.mock('@/db/open', () => ({ ...open, openBlocked: () => false }))

import { StartupGate } from './StartupGate'
import { useStartup } from './startup'

const never = () => new Promise<void>(() => undefined)

describe('StartupGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    open.openDb.mockReset()
    open.reopenDb.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('shows the app once the database opens', async () => {
    open.openDb.mockResolvedValue()
    render(<StartupGate>app</StartupGate>)
    expect(screen.getByAltText('Loading DayNest')).toBeInTheDocument()
    await act(async () => undefined)
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('retries a stuck open once, then offers Try again instead of staying on the launch screen', async () => {
    open.openDb.mockImplementation(never)
    open.reopenDb.mockImplementation(never)
    render(<StartupGate>app</StartupGate>)

    await act(async () => vi.advanceTimersByTime(2_500))
    expect(open.reopenDb).toHaveBeenCalledTimes(1) // the quiet automatic retry
    expect(screen.queryByText('Still opening…')).not.toBeInTheDocument()

    await act(async () => vi.advanceTimersByTime(2_500))
    expect(screen.getByText('Still opening…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()

    open.reopenDb.mockResolvedValue()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })))
    expect(open.reopenDb).toHaveBeenCalledTimes(2)
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('says so when the database cannot be opened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    open.openDb.mockRejectedValue(new Error('storage blocked'))
    render(<StartupGate>app</StartupGate>)
    await act(async () => undefined)
    expect(screen.getByText('Couldn’t open DayNest')).toBeInTheDocument()
    expect(screen.getByText(/storage blocked/)).toBeInTheDocument()
  })

  it('lets the app start over (re-open, then mount afresh)', async () => {
    open.openDb.mockResolvedValue()
    open.reopenDb.mockResolvedValue()
    function Child() {
      const { restart } = useStartup()
      return <button onClick={restart}>restart</button>
    }
    render(
      <StartupGate>
        <Child />
      </StartupGate>,
    )
    await act(async () => undefined)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'restart' })))
    expect(open.reopenDb).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'restart' })).toBeInTheDocument()
  })
})
