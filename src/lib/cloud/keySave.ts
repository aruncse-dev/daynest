/**
 * Keep the family key code where the person already keeps passwords.
 *
 * Chrome/Android: saved to Google Password Manager through the browser's credential API, and
 * offered back automatically on a new phone signed in to the same Google account.
 * Elsewhere (e.g. iPhone): falls back to copying; the key code field is marked as a password
 * field so iCloud Keychain can offer to save and fill it.
 */
const KEY_ID = 'DayNest family key'

interface PasswordCredentialLike {
  id: string
  password: string
}
type PasswordCredentialCtor = new (data: {
  id: string
  password: string
  name?: string
}) => Credential

const ctor = () =>
  (globalThis as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential

export const canSaveToPasswordManager = () => !!ctor() && !!navigator.credentials

export async function saveKeyCode(code: string): Promise<'saved' | 'copied' | 'failed'> {
  const C = ctor()
  if (C && navigator.credentials) {
    try {
      await navigator.credentials.store(new C({ id: KEY_ID, password: code, name: KEY_ID }))
      return 'saved'
    } catch {
      /* fall through to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(code)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** The key code from the password manager, if the browser offers it. */
export async function loadSavedKeyCode(): Promise<string | null> {
  if (!canSaveToPasswordManager()) return null
  try {
    const c = (await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    } as CredentialRequestOptions)) as unknown as PasswordCredentialLike | null
    return c && c.id === KEY_ID ? c.password : null
  } catch {
    return null
  }
}

export const KEY_FIELD_USERNAME = KEY_ID
