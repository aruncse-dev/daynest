import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { db } from './db/db'
import './lib/install'
import { consumeRedirect } from './lib/cloud/google'
import { consumeInviteFromUrl } from './lib/cloud/invite'

// back from Google's sign-in page (iPhone): take the token out of the address before anything else
consumeRedirect()
// opened a family invite link: keep it for the join screen
consumeInviteFromUrl()

db.open().catch((err: unknown) => {
  console.error('Failed to open DayNest database', err)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
