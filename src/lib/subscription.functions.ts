import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { authTelegram } from "./tg-auth"

import { REQUIRED_CHANNEL, REQUIRED_CHANNEL_URL, isSubscribedMember } from "./subscription-rules"

export { REQUIRED_CHANNEL, REQUIRED_CHANNEL_URL }

/** Checks via Bot API getChatMember that the Telegram user is subscribed to the channel. The bot must be an admin of the channel. */
export const checkSubscription = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await authTelegram(data.initData)
    if (!u) return { ok: false as const, subscribed: false, error: "Открой приложение в Telegram" }
    const token = process.env["TELEGRAM_BOT_TOKEN"]
    if (!token) return { ok: false as const, subscribed: false, error: "Бот не настроен" }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: REQUIRED_CHANNEL, user_id: u.id }),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; result?: { status?: string; is_member?: boolean }; description?: string }
        | null
      if (!body?.ok) {
        console.error("getChatMember failed", res.status, body?.description)
        return { ok: false as const, subscribed: false, error: "Не удалось проверить подписку, попробуй позже" }
      }
      const status = body.result?.status ?? ""
      const subscribed = isSubscribedMember(status, body.result?.is_member)
      return { ok: true as const, subscribed, error: null }
    } catch (e) {
      console.error("getChatMember error", e)
      return { ok: false as const, subscribed: false, error: "Не удалось проверить подписку" }
    }
  })
