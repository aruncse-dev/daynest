// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createECDH, createPublicKey, verify, randomBytes } from 'node:crypto'
// independent reference implementation of RFC 8188/8291 used to prove we interoperate
import ece from 'http_ece'
import { b64urlDecode, b64urlEncode, encryptPayload, sendPush, vapidAuthorization } from './webpush'

async function vapidKeys() {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  )) as CryptoKeyPair
  const pub = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)))
  const { d } = await crypto.subtle.exportKey('jwk', privateKey)
  return { publicKey: pub, privateKey: d!, subject: 'https://daynest.example' }
}

/** A fake browser subscription: its private key lets us decrypt like the browser would. */
function fakeBrowser() {
  const ua = createECDH('prime256v1')
  ua.generateKeys()
  const auth = randomBytes(16)
  return {
    ua,
    auth,
    sub: {
      endpoint: 'https://push.example.com/send/abc',
      keys: { p256dh: b64urlEncode(ua.getPublicKey()), auth: b64urlEncode(auth) },
    },
  }
}

describe('web push', () => {
  it('encrypts payloads that a standard aes128gcm decoder can read', async () => {
    const { ua, auth, sub } = fakeBrowser()
    const body = await encryptPayload(sub, new TextEncoder().encode('{"at":123}'))
    const plain = ece.decrypt(Buffer.from(body), {
      version: 'aes128gcm',
      privateKey: ua,
      authSecret: auth,
    })
    expect(plain.toString()).toBe('{"at":123}')
  })

  it('builds a valid VAPID ES256 JWT for the push service origin', async () => {
    const keys = await vapidKeys()
    const header = await vapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/xyz',
      keys,
      1_800_000_000,
    )
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!
    expect(k).toBe(keys.publicKey)
    const [h, c, sig] = t.split('.')
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString())
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_800_000_000 + 43200,
      sub: 'https://daynest.example',
    })
    const pub = b64urlDecode(keys.publicKey)
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: b64urlEncode(pub.slice(1, 33)),
      y: b64urlEncode(pub.slice(33)),
    }
    const ok = verify(
      'sha256',
      Buffer.from(`${h}.${c}`),
      { key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig, 'base64url'),
    )
    expect(ok).toBe(true)
  })

  it('sends with the headers push services require', async () => {
    const keys = await vapidKeys()
    const { ua, auth, sub } = fakeBrowser()
    let seen: { url: string; init: RequestInit } | null = null
    const status = await sendPush(sub, { at: 42 }, keys, (async (
      url: string,
      init: RequestInit,
    ) => {
      seen = { url, init }
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch)
    expect(status).toBe(201)
    const h = seen!.init.headers as Record<string, string>
    expect(seen!.url).toBe(sub.endpoint)
    expect(h['Content-Encoding']).toBe('aes128gcm')
    expect(h.TTL).toBe('600')
    expect(h.Authorization).toMatch(/^vapid t=.+, k=/)
    const plain = ece.decrypt(Buffer.from(seen!.init.body as Uint8Array), {
      version: 'aes128gcm',
      privateKey: ua,
      authSecret: auth,
    })
    expect(JSON.parse(plain.toString())).toEqual({ at: 42 })
  })
})
