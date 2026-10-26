// Pure rules for the free-case channel gate: who counts as a subscriber.
// Kept browser-safe (no server imports) so it can be unit tested directly.

export const REQUIRED_CHANNEL = "@BrainrotDroptgk"
export const REQUIRED_CHANNEL_URL = "https://t.me/BrainrotDroptgk"

/** Telegram statuses that mean the user is currently in the channel. */
export const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"])

/**
 * Decides whether a getChatMember result counts as subscribed.
 * "restricted" users only count while Telegram still reports them as members.
 */
export function isSubscribedMember(status: string | undefined | null, isMember?: boolean | null): boolean {
  const s = status ?? ""
  if (!MEMBER_STATUSES.has(s)) return false
  return s !== "restricted" || isMember === true
}
