import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
    await userEvent.click(await screen.findByRole('button', { name: /Phone mode/ }))
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Robin')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    // optional family step: add a child
    await userEvent.click(screen.getByRole('button', { name: /\+ Child/ }))
    await userEvent.type(screen.getByLabelText('Child name'), 'Mia')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: /Body basics/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' })) // rhythm defaults
    expect(screen.getByText("Here's what we suggest")).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /No phone after 10 PM/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('checkbox', { name: /Go for a walk/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await userEvent.click(screen.getByRole('button', { name: /Create \d+ items/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Let's go/ }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /Robin/ }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(await db.profiles.count()).toBe(2)
    expect((await db.profiles.filter((p) => p.name === 'Mia').first())?.role).toBe('child')
    expect(await db.habits.filter((h) => h.templateKey === 'phone-free-night').count()).toBe(1)
    // health habits are never pre-ticked
    expect(
      await db.habits.filter((h) => ['walk', 'exercise'].includes(h.templateKey ?? '')).count(),
    ).toBe(0)
    // "Plan tomorrow" habit comes with its own reminder
    const plan = await db.habits.filter((h) => h.templateKey === 'plan-tomorrow').first()
    expect(await db.reminders.filter((r) => r.link?.id === plan?.id).count()).toBe(1)
    expect(screen.getByRole('link', { name: /Family/ })).toBeInTheDocument()

    // quick add a to-do from Today
    await userEvent.click(screen.getByRole('button', { name: 'Quick add task' }))
    await userEvent.type(screen.getByLabelText('Task title'), 'Water the garden{enter}')
    expect(await screen.findByText('Water the garden')).toBeInTheDocument()
    // added under Everyone: not tied to anyone
    expect(
      (await db.tasks.filter((t) => t.title === 'Water the garden').first())?.profileIds,
    ).toEqual([])

    // Family tab: pick Mia in the people bar, then a role-based idea opens a prefilled habit
    await userEvent.click(screen.getByRole('link', { name: /Family/ }))
    await screen.findByRole('heading', { level: 1, name: 'Family' })
    await userEvent.click(await screen.findByRole('button', { name: 'Mia' }))
    await userEvent.click(await screen.findByRole('button', { name: /Reading time/ }))
    expect(screen.getByLabelText('Reminder time 1')).toHaveValue('19:30')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const mia = await db.profiles.filter((p) => p.name === 'Mia').first()
    await waitFor(async () => {
      const habit = await db.habits
        .filter((h) => h.profileId === mia?.id && h.title === 'Reading time')
        .first()
      expect(habit).toBeTruthy()
      const r = await db.reminders.filter((x) => x.link?.id === habit!.id).first()
      expect(r?.title).toBe('Mia: Reading time')
      expect(r?.times).toEqual(['19:30'])
    })

    // a to-do for several people: starts with Mia (her page), add Me too
    await userEvent.click(screen.getByRole('button', { name: '+ To-do' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. Call the bank'), 'Swimming kit')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Me' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const me = await db.profiles.filter((p) => !!p.isPrimary).first()
    await waitFor(async () => {
      const t = await db.tasks.filter((x) => x.title === 'Swimming kit').first()
      expect(t?.profileIds?.sort()).toEqual([mia!.id, me!.id].sort())
    })
  })
})

describe('Tour', () => {
  it('auto-plays example scenes without saving anything', async () => {
    await db.delete()
    await db.open()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /30-second tour/ }))
    expect(screen.getByRole('dialog', { name: 'DayNest tour' })).toBeInTheDocument()
    expect(screen.getByText('Your day in one list')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Habits you choose')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close tour' }))
    expect(await db.tasks.count()).toBe(0)
    expect(await db.habits.count()).toBe(0)
  })
})
