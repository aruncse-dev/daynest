/**
 * End-to-end encryption for the family copy in Google Sheets. Everything happens on the phone
 * with the browser's WebCrypto; the key never leaves the family's phones.
 *
 * - Family key code: 20 random characters (100 bits), e.g. `K7QM-2XPA-9DTR-W4NE-B3HF`.
 *   Crockford base32: no I, L, O or U, so it's easy to read out and type.
 * - From the code + a random salt (stored in the Sheet), PBKDF2-SHA256 derives two keys:
 *   AES-GCM 256 for record contents, HMAC-SHA256 for opaque row ids.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PBKDF2_ITERATIONS = 210_000
export const CHECK_TEXT = 'daynest-family-v1'

export interface FamilyKeys {
  enc: CryptoKey
  mac: CryptoKey
}

/** A new random family key code, grouped in fours. */
export function newKeyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]).join('')
  return chars.match(/.{4}/g)!.join('-')
}

/** Accepts the code however it's typed: any case, spaces or dashes, and O/I/L for 0/1/1. */
export function normalizeKeyCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== 20 || [...s].some((c) => !ALPHABET.includes(c))) return null
  return s.match(/.{4}/g)!.join('-')
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKeys(code: string, saltB64: string): Promise<FamilyKeys> {
  const normalized = normalizeKeyCode(code)
  if (!normalized) throw new Error('That key code is not valid.')
  const base = await crypto.subtle.importKey('raw', enc.encode(normalized), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS },
      base,
      512,
    ),
  )
  const [encKey, macKey] = await Promise.all([
    crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']),
    crypto.subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]),
  ])
  return { enc: encKey, mac: macKey }
}

/** AES-GCM with a fresh 12-byte nonce; output is base64(nonce ‖ ciphertext). */
export async function encryptJson(keys: FamilyKeys, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keys.enc,
      enc.encode(JSON.stringify(value)),
    ),
  )
  const out = new Uint8Array(12 + ct.length)
  out.set(iv)
  out.set(ct, 12)
  return toB64(out)
}

/** Throws if the data was changed or the key is wrong (GCM authenticates). */
export async function decryptJson<T>(keys: FamilyKeys, payload: string): Promise<T> {
  const bytes = fromB64(payload)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    keys.enc,
    bytes.slice(12),
  )
  return JSON.parse(dec.decode(pt)) as T
}

/** Opaque, stable row id for a record: nothing about the table or id shows in the Sheet. */
export async function rowKey(keys: FamilyKeys, table: string, id: string): Promise<string> {
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', keys.mac, enc.encode(`${table}:${id}`)),
  )
  return toB64(sig.slice(0, 18)).replace(/\+/g, '-').replace(/\//g, '_')
}

/** Encrypted known text stored in the Sheet: tells a wrong key code apart from a right one. */
export const makeCheck = (keys: FamilyKeys) => encryptJson(keys, CHECK_TEXT)
export async function keysMatch(keys: FamilyKeys, check: string): Promise<boolean> {
  try {
    return (await decryptJson<string>(keys, check)) === CHECK_TEXT
  } catch {
    return false
  }
}
