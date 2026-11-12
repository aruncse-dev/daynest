// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createECDH, randomBytes } from 'node:crypto'
import { handleRequest, runCron, type Config } from './handler'
import { MemoryStore } from './store'
import { b64urlEncode } from './webpush'

const ORIGIN = 'https://daynest.example'
const NOW = Date.UTC(2026, 10, 9, 21, 0) // 21:00 UTC
const NOW_MIN = NOW / 60000

async function config(): Promise<Config> {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  )) as CryptoKeyPair
  return {
    allowedOrigin: ORIGIN,
    vapid: {
      publicKey: b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', publicKey))),
      privateKey: (await crypto.subtle.exportKey('jwk', privateKey)).d!,
      subject: ORIGIN,
    },
  }
}

function subscription() {
  const ua = createECDH('prime256v1')
  ua.generateKeys()
  return {
    endpoint: 'https://push.example.com/send/1',
    keys: { p256dh: b64urlEncode(ua.getPublicKey()), auth: b64urlEncode(randomBytes(16)) },
  }
}

const req = (method: string, body: unknown, origin = ORIGIN) =>
  new Request('https://push.daynest.example/schedule', {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('push worker', () => {
  it('saves a device with its slots and sends due pushes once', async () => {
    const store = new MemoryStore()
    const cfg = await config()
    const id = 'device-1234'
    const secret = 'x'.repeat(40)
    const res = await handleRequest(
      req('POST', {
        id,
        secret,
        subscription: subscription(),
        slots: [NOW_MIN, NOW_MIN + 30, NOW_MIN + 99999],
      }),
      store,
      cfg,
      NOW,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect([...store.slots.get(id)!]).toEqual([NOW_MIN, NOW_MIN + 30]) // beyond horizon dropped

    const calls: string[] = []
    const fakeFetch = (async (url: string) => {
      calls.push(url)
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    expect(await runCron(store, cfg, NOW, fakeFetch)).toMatchObject({ due: 1, sent: 1 })
    expect(await runCron(store, cfg, NOW + 60000, fakeFetch)).toMatchObject({ due: 0 })
    expect(calls).toHaveLength(1)
  })

  it('rejects other origins and wrong device secrets', async () => {
    const store = new MemoryStore()
    const cfg = await config()
    const body = {
      id: 'device-1234',
      secret: 'a'.repeat(40),
      subscription: subscription(),
      slots: [NOW_MIN + 5],
    }
    expect(
      (await handleRequest(req('POST', body, 'https://evil.example'), store, cfg, NOW)).status,
    ).toBe(403)
    expect((await handleRequest(req('POST', body), store, cfg, NOW)).status).toBe(200)
    expect(
      (await handleRequest(req('POST', { ...body, secret: 'b'.repeat(40) }), store, cfg, NOW))
        .status,
    ).toBe(403)
    expect(
      (await handleRequest(req('DELETE', { id: body.id, secret: 'b'.repeat(40) }), store, cfg, NOW))
        .status,
    ).toBe(403)
    expect(
      (await handleRequest(req('DELETE', { id: body.id, secret: body.secret }), store, cfg, NOW))
        .status,
    ).toBe(200)
    expect(store.devices.size).toBe(0)
  })

  it('validates input', async () => {
    const store = new MemoryStore()
    const cfg = await config()
    const bad = await handleRequest(
      req('POST', {
        id: 'device-1234',
        secret: 'a'.repeat(40),
        subscription: { endpoint: 'http://insecure', keys: {} },
        slots: [],
      }),
      store,
      cfg,
      NOW,
    )
    expect(bad.status).toBe(400)
    expect((await handleRequest(req('POST', 'not json'), store, cfg, NOW)).status).toBe(400)
  })

  it('forgets subscriptions the push service says are gone, and skips stale slots', async () => {
    const store = new MemoryStore()
    const cfg = await config()
    await handleRequest(
      req('POST', {
        id: 'device-1234',
        secret: 'a'.repeat(40),
        subscription: subscription(),
        slots: [NOW_MIN],
      }),
      store,
      cfg,
      NOW,
    )
    const gone = (async () => new Response(null, { status: 410 })) as unknown as typeof fetch
    expect(await runCron(store, cfg, NOW, gone)).toMatchObject({ removed: 1 })
    expect(store.devices.size).toBe(0)

    await handleRequest(
      req('POST', {
        id: 'device-5678',
        secret: 'a'.repeat(40),
        subscription: subscription(),
        slots: [NOW_MIN],
      }),
      store,
      cfg,
      NOW,
    )
    const ok = (async () => new Response(null, { status: 201 })) as unknown as typeof fetch
    // cron was down for 30 minutes: don't deliver a half-hour-old reminder
    expect(await runCron(store, cfg, NOW + 30 * 60000, ok)).toMatchObject({ due: 1, sent: 0 })
  })

  it('accepts any of several comma-separated origins', async () => {
    const store = new MemoryStore()
    const cfg = {
      ...(await config()),
      allowedOrigin: 'https://daynest.vercel.app, https://day.example.com/',
    }
    const body = {
      id: 'device-1234',
      secret: 'a'.repeat(40),
      subscription: subscription(),
      slots: [],
    }
    expect(
      (await handleRequest(req('POST', body, 'https://day.example.com'), store, cfg, NOW)).status,
    ).toBe(200)
    expect(
      (await handleRequest(req('POST', body, 'https://daynest.vercel.app'), store, cfg, NOW))
        .status,
    ).toBe(200)
    expect(
      (await handleRequest(req('POST', body, 'https://other.vercel.app'), store, cfg, NOW)).status,
    ).toBe(403)
  })

  it('sends one test push to a registered device, and only with its secret', async () => {
    const store = new MemoryStore()
    const cfg = { ...(await config()), testDelayMs: 0 }
    const secret = 'a'.repeat(40)
    await handleRequest(
      req('POST', { id: 'device-1234', secret, subscription: subscription(), slots: [] }),
      store,
      cfg,
      NOW,
    )
    const sent: Promise<unknown>[] = []
    const calls: string[] = []
    const fakeFetch = (async (url: string) => {
      calls.push(url)
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    const testReq = (body: unknown) =>
      new Request('https://push.daynest.example/test', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    expect(
      (
        await handleRequest(
          testReq({ id: 'device-1234', secret: 'b'.repeat(40) }),
          store,
          cfg,
          NOW,
          (w) => sent.push(w),
          fakeFetch,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await handleRequest(
          testReq({ id: 'device-9999', secret }),
          store,
          cfg,
          NOW,
          (w) => sent.push(w),
          fakeFetch,
        )
      ).status,
    ).toBe(404)
    const ok = await handleRequest(
      testReq({ id: 'device-1234', secret }),
      store,
      cfg,
      NOW,
      (w) => sent.push(w),
      fakeFetch,
    )
    expect(ok.status).toBe(202)
    await Promise.all(sent)
    expect(calls).toEqual(['https://push.example.com/send/1'])
  })
})
