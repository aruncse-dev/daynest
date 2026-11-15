import { clearAllData, setSetting } from '@/db/actions'
import { db } from '@/db/db'
import { SETTING_ONBOARDED } from '@/db/keys'
import { signOutGoogle } from '@/lib/cloud/google'

/**
 * Start over on this phone: every item, person and setting, the Google link and sign-in,
 * any pending invite and the selected person. Leaves the theme. Never touches Google Drive:
 * an old family Sheet stays there (delete it in Drive if you like).
 */
export async function startOver() {
  signOutGoogle()
  await clearAllData()
  await db.backupHistory.clear()
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith('daynest.')) localStorage.removeItem(k)
  } catch {
    /* private mode */
  }
  await setSetting(SETTING_ONBOARDED, false)
}
