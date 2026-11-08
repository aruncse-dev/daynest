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
  it('runs the setup wizard and lands on Today', async () => {
    await db.delete()
    await db.open()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Set up my nest/ }))
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Robin')
    await userEvent.click(screen.getByRole('switch', { name: 'I also plan for my family' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    // family: add a child
    await userEvent.click(screen.getByRole('button', { name: /Add a family member/ }))
    await userEvent.type(screen.getByLabelText('Member 1 name'), 'Mia')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: /Kids routines/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' })) // rhythm defaults
    expect(screen.getByText("Here's what we suggest")).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /No phone after 10 PM/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: /Create \d+ items/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Let's go/ }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /Robin/ }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(await db.profiles.count()).toBe(2)
    expect(await db.habits.filter((h) => h.templateKey === 'phone-free-night').count()).toBe(1)
    expect((await db.settings.get('familyMode'))?.value).toBe(true)
    // health habits are never pre-ticked
    expect(
      await db.habits
        .filter((h) => ['walk', 'exercise', 'yoga'].includes(h.templateKey ?? ''))
        .count(),
    ).toBe(0)

    // quick add a to-do from Today
    await userEvent.click(screen.getByRole('button', { name: 'Quick add task' }))
    await userEvent.type(screen.getByLabelText('Task title'), 'Water the garden{enter}')
    expect(await screen.findByText('Water the garden')).toBeInTheDocument()
  })
})

describe('Tour', () => {
  it('auto-plays example scenes without saving anything', async () => {
    await db.delete()
    await db.open()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Watch a 30-second tour/ }))
    expect(screen.getByRole('dialog', { name: 'DayNest tour' })).toBeInTheDocument()
    expect(screen.getByText('Your day in one list')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Habits you choose')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close tour' }))
    expect(await db.tasks.count()).toBe(0)
    expect(await db.habits.count()).toBe(0)
  })
})
