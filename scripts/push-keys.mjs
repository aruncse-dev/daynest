// Generate a VAPID key pair for DayNest reminders (run once: npm run push:keys).
const b64url = (buf) => Buffer.from(buf).toString('base64url')
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pub = b64url(await crypto.subtle.exportKey('raw', publicKey))
const { d } = await crypto.subtle.exportKey('jwk', privateKey)
console.log(`
Public key  (safe to share — put in Vercel as VITE_PUSH_PUBLIC_KEY and in push/wrangler.toml):
${pub}

Private key (SECRET — only for: cd push && npx wrangler secret put VAPID_PRIVATE_KEY):
${d}
`)
