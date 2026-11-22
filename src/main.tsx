import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { StartupGate } from './components/layout/StartupGate'
import { openDb } from './db/open'
import './lib/install'
import { consumeRedirect } from './lib/cloud/google'
import { consumeInviteFromUrl } from './lib/cloud/invite'

// back from Google's sign-in page (iPhone): take the token out of the address before anything else
consumeRedirect()
// opened a family invite link: keep it for the join screen
consumeInviteFromUrl()

// start opening the database right away; StartupGate waits for it (and recovers if it hangs
// or fails, instead of leaving the launch screen up)
openDb().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StartupGate>
        <App />
      </StartupGate>
    </ErrorBoundary>
  </StrictMode>,
)
