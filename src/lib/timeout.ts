/**
 * Time limits for things that can hang instead of failing.
 *
 * Right after a cold launch the phone's radio is often still waking up, so a request can wait
 * forever rather than error. Anything a lock (one sync at a time, one token renewal at a time)
 * or a spinner depends on needs a limit, or DayNest stays stuck until it is relaunched.
 */
export class TimeoutError extends Error {
  name = 'TimeoutError'
}

/** Rejects with a TimeoutError if `p` hasn't settled after `ms` (`p` itself carries on). */
export function withTimeout<T>(p: Promise<T>, ms: number, message = 'Timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(message)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

/**
 * fetch() that gives up after `ms`. The limit also covers reading the body: the timer is left
 * running, and aborting a request that has already finished does nothing.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  ms = 20_000,
  message = 'No answer in time. Check your connection.',
): Promise<Response> {
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(input, { ...init, signal: ctrl.signal })
  } catch (e) {
    throw ctrl.signal.aborted ? new TimeoutError(message) : e
  }
}
