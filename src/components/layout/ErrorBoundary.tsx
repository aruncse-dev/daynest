import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Friendly fallback for unexpected errors (e.g. storage blocked, quota exceeded). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    const msg = this.state.error.message
    const storage = /quota|indexeddb|database|storage/i.test(msg + this.state.error.name)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-4xl">🍂</div>
          <h1 className="mt-3 text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            {storage
              ? 'DayNest could not access browser storage. Private browsing, a full disk, or blocked site data can cause this.'
              : 'An unexpected error occurred. Your saved data is safe in this browser.'}
          </p>
          <pre className="mt-3 overflow-auto rounded-xl bg-surface2 p-3 text-left text-[11px] text-muted">
            {msg}
          </pre>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-4 min-h-11 rounded-xl bg-sage px-5 font-bold text-white"
          >
            Reload DayNest
          </button>
        </div>
      </div>
    )
  }
}
