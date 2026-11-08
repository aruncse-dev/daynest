import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

import App from './App'
import { db } from './db/db'

describe('App', () => {
  it('onboards and shows the dashboard', async () => {
    await db.delete()
    await db.open()
    render(<App />)
    expect(await screen.findByText(/Welcome to/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Robin')
    await userEvent.click(screen.getByRole('button', { name: 'Start fresh' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /Robin/ }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(screen.getByText("Today's priorities")).toBeInTheDocument()
    expect(screen.getByText('Daily habits')).toBeInTheDocument()

    // quick add a task
    await userEvent.click(screen.getByRole('button', { name: /Quick add/ }))
    await userEvent.type(screen.getByLabelText('Task title'), 'Water the garden{enter}')
    expect(await screen.findByText('Water the garden')).toBeInTheDocument()
    expect(await db.tasks.count()).toBe(1)
  })
})
