import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { setSetting } from '@/db/actions'
import { db } from '@/db/db'
import type { Profile } from '@/db/types'
import { nowIso } from '@/lib/date'
import { useMembers, useProfiles, useSetting } from '@/lib/hooks'
import { ASK_WHO_KEY, ME_KEY, RING_KEY, type RingFor } from '@/lib/me'
import {
  CLOUD_SHEET,
  familyShares,
  inviteToFamily,
  joinFamily,
  PICK_NEEDED,
  removeFromFamily,
} from '@/lib/cloud/cloud'
import {
  getToken,
  peekResume,
  prepareGoogle,
  isIOSDevice,
  takeRedirectError,
  takeResume,
  type Share,
} from '@/lib/cloud/google'
import { isStandalone } from '@/lib/install'
import { inviteLink, parseInvite, pendingInvite, type Invite } from '@/lib/cloud/invite'
import { displayName } from '@/lib/people'
import { toast } from '@/store/ui'
import { useCloud } from './CloudCard'
import {
  IconCopy,
  IconFile,
  IconInvite,
  IconLaptop,
  IconLock,
  IconMail,
  IconPhone,
  IconRemovePerson,
  IconShare,
  IconWarning,
} from './icons'
import { Avatar, Button, Field, Input, Segmented, Sheet, Toggle, cx } from './ui'

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Line({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="inline-flex items-center gap-2 text-[13.5px]">
      <span aria-hidden className="text-[19px] text-sage-ink">
        {icon}
      </span>
      {text}
    </li>
  )
}

/** The invite as a QR code (scan with the phone camera) plus copy / share. */
export function InviteQR({ link }: { link: string }) {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(link)
    qr.make()
    return qr.createDataURL(6, 2)
  }, [link])
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl bg-surface2 p-3">
      <img src={src} alt="Family invite QR code" className="size-52 rounded-xl bg-white p-1" />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              toast('Invite link copied', { emoji: '📋' })
            } catch {
              toast('Long-press the QR to share it')
            }
          }}
        >
          <IconCopy className="text-[16px]" /> Copy link
        </Button>
        {'share' in navigator && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void navigator
                .share({ title: 'Join our DayNest family', url: link })
                .catch(() => undefined)
            }
          >
            <IconShare className="text-[16px]" /> Share
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Settings → Family sharing (owner): who has access, invite someone with their own Google
 * email (QR), and whose reminders ring on this phone.
 */
export function FamilySharingSheet({
  onClose,
  person,
}: {
  onClose: () => void
  /** opened from someone's page: go straight to inviting them */
  person?: Profile
}) {
  const { on } = useCloud()
  const members = useMembers()
  const ring = useSetting<RingFor>(RING_KEY, 'all')
  const [shares, setShares] = useState<Share[] | null>(null)
  const [inviting, setInviting] = useState(!!person)
  const [who, setWho] = useState<string | null>(person?.id ?? null)
  const [email, setEmail] = useState(person?.email ?? '')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!on) return
    void familyShares()
      .then(setShares)
      .catch(() => setShares([]))
  }, [on, link])

  const invite = async () => {
    void getToken(true).catch(() => undefined) // from the tap
    setBusy(true)
    setErr(null)
    try {
      setLink(await inviteToFamily(who!, email))
      // remember their email so the invite can be shown again without typing
      await db.profiles.update(who!, { email: email.trim(), updatedAt: nowIso() })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={person ? `Invite ${person.name}` : 'Family sharing'} onClose={onClose}>
      {!on ? (
        <div className="grid gap-3">
          <ul className="grid gap-2">
            <Line icon={<IconInvite />} text="To invite: switch Mode to Google" />
            <Line icon={<IconMail />} text="Got an invite? Join below" />
          </ul>
          <Button variant="soft" onClick={() => setJoining(true)}>
            Join a family
          </Button>
        </div>
      ) : link ? (
        <div className="grid gap-3">
          <InviteQR link={link} />
          <ul className="grid gap-2">
            <Line icon={<IconPhone />} text="They scan it with the phone camera" />
            <Line icon={<IconLock />} text="Works only for the email you shared with" />
          </ul>
          <Button variant="outline" onClick={() => (setLink(null), setInviting(false))}>
            Done
          </Button>
        </div>
      ) : inviting ? (
        <div className="grid gap-3">
          {!person && (
            <Field group label="Who is joining?">
              <div className="flex flex-wrap gap-1.5">
                {members.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={who === p.id}
                    onClick={() => setWho(p.id)}
                    className={cx(
                      'inline-flex min-h-10 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold',
                      who === p.id
                        ? 'border-sage bg-sage-soft'
                        : 'border-line bg-surface text-muted',
                    )}
                  >
                    <Avatar avatar={p.avatar} color={p.color} size={28} />
                    {displayName(p)}
                  </button>
                ))}
              </div>
              {!members.length && (
                <span className="text-xs text-muted">Add them in the Family tab first</span>
              )}
            </Field>
          )}
          <Field label="Their Google email">
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button onClick={invite} disabled={busy || !who || !email.includes('@')}>
            {busy ? 'Sharing…' : 'Share & show QR'}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-[16px] border border-line">
            {shares === null ? (
              <p className="p-3 text-xs text-muted">Loading…</p>
            ) : shares.length === 0 ? (
              <p className="p-3 text-xs text-muted">Only you so far</p>
            ) : (
              shares.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-0"
                >
                  <IconMail className="shrink-0 text-lg text-sage-ink" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{s.name ?? s.email}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${s.email}`}
                    onClick={async () => {
                      try {
                        await removeFromFamily(s.id)
                        setShares((l) => l?.filter((x) => x.id !== s.id) ?? null)
                        toast('Removed', { emoji: '👋' })
                      } catch (e) {
                        toast(errText(e), { emoji: '⚠️' })
                      }
                    }}
                    className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"
                  >
                    <IconRemovePerson className="text-lg" />
                  </button>
                </div>
              ))
            )}
          </div>
          <Button onClick={() => setInviting(true)}>
            <IconInvite className="text-lg" /> Invite someone
          </Button>
        </div>
      )}

      {!person && (
        <Field group label="Reminders on this phone">
          <Segmented
            label="Reminders on this phone"
            value={ring}
            onChange={(v) => setSetting(RING_KEY, v)}
            options={[
              { value: 'all', label: 'Everyone’s' },
              { value: 'mine', label: 'Mine + shared' },
            ]}
          />
        </Field>
      )}
      {err && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-soft p-3 text-xs text-amber-ink">
          <IconWarning className="text-base" /> {err}
        </p>
      )}
      {joining && <JoinFlow hasData onClose={() => setJoining(false)} />}
    </Sheet>
  )
}

/**
 * Join a family on this phone: from an opened invite link/QR, or a pasted link.
 * Sign in with your own Google account → tap the shared file once → done.
 */
export function JoinFlow({
  onClose,
  hasData,
}: {
  onClose: () => void
  /** this phone already has its own data (then offer to keep it) */
  hasData?: boolean
}) {
  const [invite, setInvite] = useState<Invite | null>(() => pendingInvite())
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(true)
  // one family per phone for now: joining a different family replaces it, never mixes the two
  const linked = useSetting<string | null>(CLOUD_SHEET, null)
  const otherFamily = !!linked && !!invite && linked !== invite.f
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const join = async (inv = invite) => {
    if (!inv) return
    void getToken(true, 'join').catch(() => undefined) // from the tap
    setBusy(true)
    setErr(null)
    try {
      const r = await joinFamily(inv, replace || (!!linked && linked !== inv.f))
      toast(`Joined · ${r.pulled} item${r.pulled === 1 ? '' : 's'}`, { emoji: '👪' })
      onClose()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    prepareGoogle()
    // back from Google's page (iPhone): carry on without another tap
    const e = takeRedirectError()
    if (e) {
      setErr(e)
      takeResume()
      return
    }
    if (takeResume() === 'join') void join()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  return (
    <Sheet
      title={invite ? (invite.n ? `Join ${invite.n}’s family` : 'Join a family') : 'Join a family'}
      onClose={onClose}
      footer={
        invite ? (
          <Button className="flex-1" onClick={() => void join()} disabled={busy}>
            {busy ? 'Joining…' : 'Continue with Google'}
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!text.trim()}
            onClick={() => {
              const inv = parseInvite(text)
              if (inv) setInvite(inv)
              else setErr('That isn’t a DayNest invite link')
            }}
          >
            Next
          </Button>
        )
      }
    >
      {invite ? (
        <div className="grid gap-3">
          <ul className="grid gap-2">
            <Line icon={<IconLock />} text="Sign in with your own Google account" />
            <Line icon={<IconFile />} text="Tap the DayNest family file once" />
            <Line icon={<IconPhone />} text="This phone becomes yours in the family" />
          </ul>
          {/* iPhone: Safari and the Home Screen app keep separate data */}
          {isIOSDevice() && !isStandalone() && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-soft p-3 text-xs text-amber-ink">
              <span className="flex-1">
                Use DayNest from your Home Screen? Join there: copy, open it, paste.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink(invite))
                    toast('Invite link copied', { emoji: '📋' })
                  } catch {
                    toast('Copy the link from the message you got')
                  }
                }}
              >
                <IconCopy className="text-[16px]" /> Copy
              </Button>
            </div>
          )}
          {otherFamily && (
            <p className="flex items-center gap-1.5 rounded-xl bg-amber-soft p-3 text-xs text-amber-ink">
              <IconWarning className="shrink-0 text-base" /> This phone is already in a family.
              Joining replaces it here (the other family keeps its copy).
            </p>
          )}
          {hasData && !otherFamily && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3 text-sm">
              <span>
                Replace this phone’s data
                <small className="block text-[11px] text-muted">Off: add mine to the family</small>
              </span>
              <Toggle checked={replace} onChange={setReplace} label="Replace this phone's data" />
            </label>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <ul className="grid gap-2">
            <Line icon={<IconPhone />} text="Scan the invite QR with your camera" />
            <Line icon={<IconCopy />} text="Or paste the invite link here" />
          </ul>
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setErr(null)
            }}
            placeholder="https://daynestapp.vercel.app/join#…"
            autoComplete="off"
          />
        </div>
      )}
      {err && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-soft p-3 text-xs text-amber-ink">
          <IconWarning className="text-base" /> {err}
        </p>
      )}
      {/* iPhone blocks the cookies Google's file chooser needs: do that one step elsewhere */}
      {err === PICK_NEEDED && isIOSDevice() && (
        <ul className="grid gap-2 rounded-xl bg-surface2 p-3 text-xs">
          <li className="font-semibold">Chooser blank or a cookie error?</li>
          <Line icon={<IconLaptop />} text="Open the invite on a computer, sign in, tap the file" />
          <Line icon={<IconPhone />} text="Back here: Continue with Google (no chooser now)" />
        </ul>
      )}
    </Sheet>
  )
}

/** After an invite link was opened on a phone already set up (or back from Google): offer to join. */
export function InviteHost() {
  const [open, setOpen] = useState(() => !!pendingInvite() || peekResume() === 'join')
  if (!open) return null
  return <JoinFlow hasData onClose={() => setOpen(false)} />
}

/** Once, after restoring a family copy here: "Who are you?" — tap your own picture. */
export function WhoAreYou() {
  const ask = useSetting(ASK_WHO_KEY, false)
  const profiles = useProfiles()
  if (!ask || !profiles || profiles.length < 2) return null
  const choose = async (id: string) => {
    await setSetting(ME_KEY, id)
    await setSetting(ASK_WHO_KEY, false)
    toast('Done: this phone is yours', { emoji: '👋' })
  }
  return (
    <Sheet title="Who are you?" onClose={() => void setSetting(ASK_WHO_KEY, false)}>
      <p className="text-sm text-muted">Tap your picture: this phone becomes yours.</p>
      <div className="grid grid-cols-3 gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => void choose(p.id)}
            className="grid justify-items-center gap-1.5 rounded-2xl border border-line bg-surface p-3 text-sm font-semibold transition active:scale-95"
          >
            <Avatar avatar={p.avatar} color={p.color} size={48} />
            <span className="max-w-full truncate">{p.name}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
