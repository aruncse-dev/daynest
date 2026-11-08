/**
 * Minimal, dependency-free Web Push sender for Cloudflare Workers (also runs in Node ≥ 20).
 * - Payload encryption: RFC 8291 (aes128gcm)
 * - Sender identity: RFC 8292 (VAPID, ES256 JWT)
 * Works with every browser push service (Chrome/FCM, Firefox, Safari/Apple).
 */

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface VapidKeys {
  publicKey: string // base64url, 65-byte uncompressed P-256 point
  privateKey: string // base64url, 32-byte private scalar "d"
  subject: string // https://… or mailto:…
}

const enc = new TextEncoder()
/** Byte arrays backed by a plain ArrayBuffer (what Web Crypto and fetch accept). */
type Bytes = Uint8Array<ArrayBuffer>
const utf8 = (text: string): Bytes => new Uint8Array(enc.encode(text))

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(str: string): Bytes {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/** RFC 8291 aes128gcm encryption of `payload` for one subscription. */
export async function encryptPayload(
  sub: PushSubscriptionJSON,
  payload: Uint8Array,
  salt: Bytes = crypto.getRandomValues(new Uint8Array(16)),
): Promise<Bytes> {
  const uaPublic = b64urlDecode(sub.keys.p256dh)
  const authSecret = b64urlDecode(sub.keys.auth)
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const asKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey))
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256),
  )

  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  const plaintext = concat(payload, new Uint8Array([2])) // 0x02 = last record, no padding
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext),
  )

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** RFC 8292 VAPID Authorization header value for the push service that owns `endpoint`. */
export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const pub = b64urlDecode(keys.publicKey)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: keys.privateKey,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    utf8(
      JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: keys.subject }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(unsigned)),
  )
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${keys.publicKey}`
}

/** Send one encrypted push. Returns the push service's HTTP status. */
export async function sendPush(
  sub: PushSubscriptionJSON,
  data: unknown,
  keys: VapidKeys,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const body = await encryptPayload(sub, utf8(JSON.stringify(data)))
  const res = await fetchImpl(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '600', // a reminder older than 10 minutes isn't useful
      Urgency: 'high',
    },
    body,
  })
  return res.status
}
