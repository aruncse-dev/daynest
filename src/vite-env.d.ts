/// <reference types="vite/client" />
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** URL of the DayNest push worker, e.g. https://daynest-push.you.workers.dev (optional) */
  readonly VITE_PUSH_URL?: string
  /** VAPID public key from `npm run push:keys` (optional) */
  readonly VITE_PUSH_PUBLIC_KEY?: string
}
