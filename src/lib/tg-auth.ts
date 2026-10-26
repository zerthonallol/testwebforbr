// Verifies Telegram WebApp initData (HMAC-SHA256, key = HMAC("WebAppData", botToken)).
export const OWNER_TG_ID = 8459031923

export async function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null
  params.delete("hash")
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")
  const enc = new TextEncoder()
  const k1 = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const secret = await crypto.subtle.sign("HMAC", k1, enc.encode(botToken))
  const k2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k2, enc.encode(dataCheck)))
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("")
  if (hex !== hash) return null
  const user = params.get("user")
  if (!user) return null
  const u = JSON.parse(user) as { id: number; first_name?: string; username?: string }
  return typeof u.id === "number" ? u : null
}

export async function authTelegram(initData: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"]
  if (!token) return null
  return verifyInitData(initData, token)
}

export function isOwner(id: number | undefined | null) {
  return id === OWNER_TG_ID
}

/** Sends a bot message to a Telegram chat. Never throws — returns false when it fails. */
export async function sendBotMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  const token = process.env["TELEGRAM_BOT_TOKEN"]
  if (!token) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    return Boolean(body?.ok)
  } catch {
    return false
  }
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
