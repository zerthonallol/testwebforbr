import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { OWNER_TG_ID, authTelegram as auth, escapeHtml, sendBotMessage } from "./tg-auth"

export const loadPlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false, state: null as string | null }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("players").select("state").eq("tg_id", u.id).maybeSingle()
    return { ok: true, state: row?.state ? JSON.stringify(row.state) : null }
  })

export const savePlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), state: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false }
    if (JSON.stringify(data.state).length > 500_000) return { ok: false }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("players").upsert({
      tg_id: u.id,
      first_name: u.first_name ?? "",
      username: u.username ?? null,
      state: data.state as never,
      updated_at: new Date().toISOString(),
    })
    if (error) console.error("savePlayer", error.message)
    return { ok: !error }
  })

export const redeemPromo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), code: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) throw new Error("Открой приложение в Telegram")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: coins, error } = await supabaseAdmin.rpc("redeem_promo", { _code: data.code.trim(), _tg_id: u.id })
    if (error) throw new Error(error.message)
    return { coins: Number(coins) }
  })

/** Returns and marks as claimed everything the developer granted to this player. */
export const claimGrants = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return []
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: rows } = await supabaseAdmin
      .from("pending_grants")
      .update({ claimed_at: new Date().toISOString() })
      .eq("tg_id", u.id)
      .is("claimed_at", null)
      .select("id, kind, amount, case_id, brainrot_id")
    return (rows ?? []).map((r) => ({ id: r.id, kind: r.kind as "coins" | "case" | "brainrot", amount: Number(r.amount), caseId: r.case_id, brainrotId: r.brainrot_id }))
  })

export const reportDrop = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ initData: z.string().max(4096), brainrotId: z.string().max(80), source: z.enum(["Кейс", "Апгрейд", "Crash", "Dice"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return { ok: false }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    await supabaseAdmin.from("live_drops").insert({
      tg_id: u.id,
      user_name: u.username ? u.username : (u.first_name ?? "Игрок"),
      brainrot_id: data.brainrotId,
      source: data.source,
    })
    return { ok: true }
  })

export const getLiveDrops = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("live_drops").select("id, user_name, brainrot_id, source").order("created_at", { ascending: false }).limit(20)
  return (data ?? []).map((r) => ({ key: String(r.id), user: r.user_name, brainrotId: r.brainrot_id, source: r.source }))
})

/** Most valuable real drop in the last 24 hours (by brainrot coin price). */
export const getBestDrop24h = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { BRAINROT_BY_ID } = await import("@/data/brainrots")
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    .from("live_drops")
    .select("id, user_name, brainrot_id, source, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000)
  let best: { key: string; user: string; brainrotId: string; source: string; at: string; price: number } | null = null
  for (const r of data ?? []) {
    const price = BRAINROT_BY_ID[r.brainrot_id]?.price ?? 0
    if (price > 0 && (!best || price > best.price))
      best = { key: String(r.id), user: r.user_name, brainrotId: r.brainrot_id, source: r.source, at: r.created_at, price }
  }
  return best
})

/** Player sends a deposit/withdraw request; the owner gets a Telegram DM and sees it in the admin panel. */
export const submitRequest = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().max(4096),
        clientId: z.string().min(1).max(64),
        type: z.enum(["deposit", "withdraw"]),
        brainrotId: z.string().max(80),
        brainrotName: z.string().max(120),
        robloxNick: z.string().min(1).max(64),
        creditAs: z.enum(["coins", "brainrot"]).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) throw new Error("Открой приложение в Telegram")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const name = u.username ? `@${u.username}` : (u.first_name ?? "Игрок")
    const { error } = await supabaseAdmin.from("transfer_requests").upsert(
      {
        client_id: data.clientId,
        tg_id: u.id,
        user_name: name,
        type: data.type,
        brainrot_id: data.brainrotId,
        roblox_nick: data.robloxNick,
        credit_as: data.creditAs,
      },
      { onConflict: "tg_id,client_id", ignoreDuplicates: true },
    )
    if (error) throw new Error(error.message)
    const kind = data.type === "deposit" ? "📥 Новый ДЕПОЗИТ" : "📤 Новый ВЫВОД"
    const credit = data.type === "deposit" ? `\nЗачислить: ${data.creditAs === "coins" ? "монетами" : "брейнротом"}` : ""
    await sendBotMessage(
      OWNER_TG_ID,
      `${kind}\n\nИгрок: <b>${escapeHtml(name)}</b> (ID <code>${u.id}</code>)\nБрейнрот: <b>${escapeHtml(data.brainrotName)}</b>\nНик Roblox: <code>${escapeHtml(data.robloxNick)}</code>${credit}\n\nОткрой вкладку «Разраб» → «Заявки», чтобы принять, отклонить или ответить.`,
    )
    return { ok: true }
  })

/** Current status and admin replies for the player's own requests. */
export const myRequests = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await auth(data.initData)
    if (!u) return []
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: rows } = await supabaseAdmin
      .from("transfer_requests")
      .select("client_id, status, admin_reply")
      .eq("tg_id", u.id)
      .order("created_at", { ascending: false })
      .limit(100)
    return (rows ?? []).map((r) => ({ clientId: r.client_id, status: r.status as "pending" | "approved" | "rejected", reply: r.admin_reply }))
  })
