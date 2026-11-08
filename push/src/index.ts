import { handleRequest, runCron, type Config } from './handler'
import { D1Store } from './store'

export interface Env {
  DB: D1Database
  ALLOWED_ORIGIN: string // e.g. https://daynest.vercel.app
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string // set with: npx wrangler secret put VAPID_PRIVATE_KEY
  VAPID_SUBJECT?: string // defaults to ALLOWED_ORIGIN
}

const config = (env: Env): Config => ({
  allowedOrigin: env.ALLOWED_ORIGIN,
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || env.ALLOWED_ORIGIN,
  },
})

export default {
  fetch(req: Request, env: Env) {
    return handleRequest(req, new D1Store(env.DB), config(env))
  },
  scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCron(new D1Store(env.DB), config(env)))
  },
}
