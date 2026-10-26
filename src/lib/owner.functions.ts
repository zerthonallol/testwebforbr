import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authTelegram, escapeHtml, isOwner, sendBotMessage } from "./tg-auth"
import type { CaseOverride } from "@/data/cases"

export interface PublicSettings {
  priceOverrides: Record<string, number>
  caseOverrides: Record<string, CaseOverride>
  announcement: string | null
  announcementId: string | null
  announcementBy: number | null
}

export const getSettings = createServerFn({ method: "GET" }).handler(async (): Promise<PublicSettings> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle()
  return {
    priceOverrides: (data?.price_overrides as Record<string, number> | null) ?? {},
    caseOverrides: (data?.case_overrides as Record<string, CaseOverride> | null) ?? {},
    announcement: data?.announcement ?? null,
    announcementId: data?.announcement_id ?? null,
    announcementBy: data?.announcement_by ?? null,
  }
})

async function requireOwner(initData: string) {
  const u = await authTelegram(initData)
  if (!u || !isOwner(u.id)) throw new Error("Нет доступа")
  return u
}

export const ownerSetPrice = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ initData: z.string().max(4096), id: z.string().max(80), price: z.number().int().min(1).max(100_000_000).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("app_settings").select("price_overrides").eq("id", 1).maybeSingle()
    const map = { ...((row?.price_overrides as Record<string, number> | null) ?? {}) }
    if (data.price === null) delete map[data.id]
    else map[data.id] = data.price
    const { error } = await supabaseAdmin.from("app_settings").upsert({ id: 1, price_overrides: map, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    return { ok: true, priceOverrides: map }
  })

export const ownerAnnounce = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), text: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const text = data.text?.trim() || null
    const { error } = await supabaseAdmin.from("app_settings").upsert({
      id: 1,
      announcement: text,
      announcement_id: text ? crypto.randomUUID() : null,
      announcement_by: text ? u.id : null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getMaintenance = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const { data } = await supabaseAdmin.from("app_settings").select("maintenance, maintenance_text").eq("id", 1).maybeSingle()
  return { on: Boolean(data?.maintenance), text: data?.maintenance_text ?? null }
})

export const ownerSetMaintenance = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), on: z.boolean(), text: z.string().max(300).nullable() }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ maintenance: data.on, maintenance_text: data.text?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", 1)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Finds a player by Telegram id (digits) or @username. */
async function findPlayer(target: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  const t = target.trim().replace(/^@/, "")
  if (/^\d+$/.test(t)) {
    const { data } = await supabaseAdmin.from("players").select("tg_id, username, first_name").eq("tg_id", Number(t)).maybeSingle()
    return data ?? { tg_id: Number(t), username: null, first_name: "" }
  }
  const { data } = await supabaseAdmin.from("players").select("tg_id, username, first_name").ilike("username", t.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle()
  return data
}

export const ownerGrant = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().max(4096),
        target: z.string().min(1).max(64),
        kind: z.enum(["coins", "case", "brainrot"]),
        amount: z.number().int().min(1).max(1_000_000_000_000),
        caseId: z.string().max(80).nullable(),
        brainrotId: z.string().max(80).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const p = await findPlayer(data.target)
    if (!p) throw new Error("Игрок не найден — он должен хоть раз зайти в приложение")
    if (data.kind === "case" && !data.caseId) throw new Error("Выбери кейс")
    if (data.kind === "brainrot" && !data.brainrotId) throw new Error("Выбери брейнрота")
    if (data.kind === "brainrot" && data.amount > 100) throw new Error("Не больше 100 штук за раз")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("pending_grants").insert({
      tg_id: p.tg_id,
      kind: data.kind,
      amount: data.amount,
      case_id: data.kind === "case" ? data.caseId : null,
      brainrot_id: data.kind === "brainrot" ? (data.brainrotId ?? null) : null,
    })
    if (error) throw new Error(error.message)
    return { ok: true, who: p.username ? `@${p.username}` : `ID ${p.tg_id}` }
  })

const PROMO_RE = /^[A-Z0-9_-]{3,32}$/

export const ownerListPromos = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: rows } = await supabaseAdmin.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(100)
    return rows ?? []
  })

export const ownerCreatePromo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().max(4096),
        code: z.string().max(32),
        coins: z.number().int().min(1).max(1_000_000_000_000),
        maxUses: z.number().int().min(1).max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const code = data.code.trim().toUpperCase()
    if (!PROMO_RE.test(code)) throw new Error("Код: 3–32 символа, латиница/цифры/_/-")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { error } = await supabaseAdmin.from("promo_codes").insert({ code, coins: data.coins, max_uses: data.maxUses })
    if (error) throw new Error(error.code === "23505" ? "Такой промокод уже есть" : error.message)
    return { ok: true }
  })

export const ownerDeletePromo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), code: z.string().max(32) }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    await supabaseAdmin.from("promo_codes").delete().eq("code", data.code)
    return { ok: true }
  })

// ---- Backup: export / import all player data so it survives moving to a new site ----

export const BACKUP_VERSION = 1

async function buildBackup() {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const players: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data: rows, error } = await supabaseAdmin
        .from("players")
        .select("tg_id, first_name, username, state, created_at, updated_at")
        .order("tg_id")
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      players.push(...(rows ?? []))
      if (!rows || rows.length < 1000) break
    }
    const [{ data: promos }, { data: redemptions }, { data: grants }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("promo_codes").select("*"),
      supabaseAdmin.from("promo_redemptions").select("*"),
      supabaseAdmin.from("pending_grants").select("tg_id, kind, amount, case_id, brainrot_id, note, created_at").is("claimed_at", null),
      supabaseAdmin.from("app_settings").select("price_overrides").eq("id", 1).maybeSingle(),
    ])
    return JSON.stringify({
      app: "brainrotdrop",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      players,
      promoCodes: promos ?? [],
      promoRedemptions: redemptions ?? [],
      pendingGrants: grants ?? [],
      priceOverrides: settings?.price_overrides ?? {},
    })
}

export const ownerExportBackup = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    return buildBackup()
  })

/** Sends the backup file to the owner's chat with the bot, so it is kept in Telegram. */
export const ownerSendBackupToTelegram = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireOwner(data.initData)
    const json = await buildBackup()
    const token = process.env["TELEGRAM_BOT_TOKEN"]
    if (!token) throw new Error("Бот не настроен")
    const count = (JSON.parse(json) as { players: unknown[] }).players.length
    const form = new FormData()
    form.append("chat_id", String(u.id))
    form.append("caption", `Бэкап BrainrotDrop · игроков: ${count} · ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК`)
    form.append("document", new Blob([json], { type: "application/json" }), `brainrotdrop-backup-${new Date().toISOString().slice(0, 10)}.json`)
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null
    if (!body?.ok) throw new Error(body?.description ? `Telegram: ${body.description}` : "Не удалось отправить файл — напиши боту /start")
    return { ok: true, players: count }
  })

const playerRow = z.object({
  tg_id: z.number().int(),
  first_name: z.string().max(256).nullable().optional(),
  username: z.string().max(256).nullable().optional(),
  state: z.record(z.string(), z.unknown()),
  created_at: z.string().max(64).optional(),
})

const importSchema = z.object({
  initData: z.string().max(4096),
  players: z.array(playerRow).max(500),
  promoCodes: z
    .array(z.object({ code: z.string().max(32), coins: z.number(), max_uses: z.number().int(), uses: z.number().int(), active: z.boolean() }))
    .max(1000)
    .optional(),
  promoRedemptions: z.array(z.object({ code: z.string().max(32), tg_id: z.number().int() })).max(20000).optional(),
  pendingGrants: z
    .array(z.object({ tg_id: z.number().int(), kind: z.enum(["coins", "case", "brainrot"]), amount: z.number(), case_id: z.string().max(80).nullable(), brainrot_id: z.string().max(80).nullable().optional(), note: z.string().max(500).nullable().optional() }))
    .max(5000)
    .optional(),
  priceOverrides: z.record(z.string(), z.number()).optional(),
})

/** Upserts one chunk of a backup. Players already on this site are overwritten with the backup copy. */
export const ownerImportBackup = createServerFn({ method: "POST" })
  .inputValidator((d) => importSchema.parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    if (data.players.length) {
      const { error } = await supabaseAdmin.from("players").upsert(
        data.players.map((p) => ({
          tg_id: p.tg_id,
          first_name: p.first_name ?? "",
          username: p.username ?? null,
          // Fresh savedAt so the restored copy wins over any older copy cached on the device.
          state: { ...p.state, savedAt: Date.now() } as never,
          ...(p.created_at ? { created_at: p.created_at } : {}),
          updated_at: new Date().toISOString(),
        })),
      )
      if (error) throw new Error(error.message)
    }
    if (data.promoCodes?.length) {
      const { error } = await supabaseAdmin.from("promo_codes").upsert(data.promoCodes)
      if (error) throw new Error(error.message)
    }
    if (data.promoRedemptions?.length) {
      const { error } = await supabaseAdmin.from("promo_redemptions").upsert(data.promoRedemptions, { ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    }
    if (data.pendingGrants?.length) {
      const { error } = await supabaseAdmin.from("pending_grants").insert(data.pendingGrants.map((g) => ({ ...g, brainrot_id: g.brainrot_id ?? null, note: g.note ?? null })))
      if (error) throw new Error(error.message)
    }
    if (data.priceOverrides && Object.keys(data.priceOverrides).length) {
      const { error } = await supabaseAdmin.from("app_settings").update({ price_overrides: data.priceOverrides, updated_at: new Date().toISOString() }).eq("id", 1)
      if (error) throw new Error(error.message)
    }
    return { ok: true, players: data.players.length }
  })

// ---- Case editor: chances and brainrots inside each case ----

const overrideSchema = z.object({
  chances: z.record(z.string().max(100), z.number().min(0).max(100)).optional(),
  add: z.array(z.string().max(80)).max(200).optional(),
  remove: z.array(z.string().max(80)).max(200).optional(),
})

export const ownerSetCaseOverride = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), caseId: z.string().max(80), override: overrideSchema.nullable() }).parse(d))
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: row } = await supabaseAdmin.from("app_settings").select("case_overrides").eq("id", 1).maybeSingle()
    const map = { ...((row?.case_overrides as Record<string, CaseOverride> | null) ?? {}) }
    const o = data.override
    const empty = !o || (!Object.keys(o.chances ?? {}).length && !(o.add ?? []).length && !(o.remove ?? []).length)
    if (empty) delete map[data.caseId]
    else map[data.caseId] = o
    const { error } = await supabaseAdmin.from("app_settings").update({ case_overrides: map as never, updated_at: new Date().toISOString() }).eq("id", 1)
    if (error) throw new Error(error.message)
    return { ok: true, caseOverrides: map }
  })

// ---- Deposit / withdraw requests ----

export interface AdminRequest {
  id: string
  tgId: number
  userName: string
  type: "deposit" | "withdraw"
  brainrotId: string
  robloxNick: string
  creditAs: string | null
  status: "pending" | "approved" | "rejected"
  adminReply: string | null
  createdAt: string
}

export const ownerListRequests = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().max(4096), status: z.enum(["pending", "done"]) }).parse(d))
  .handler(async ({ data }): Promise<AdminRequest[]> => {
    await requireOwner(data.initData)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    let q = supabaseAdmin.from("transfer_requests").select("*").order("created_at", { ascending: data.status === "pending" }).limit(100)
    q = data.status === "pending" ? q.eq("status", "pending") : q.neq("status", "pending")
    const { data: rows, error } = await q
    if (error) throw new Error(error.message)
    return (rows ?? []).map((r) => ({
      id: r.id,
      tgId: Number(r.tg_id),
      userName: r.user_name,
      type: r.type as "deposit" | "withdraw",
      brainrotId: r.brainrot_id,
      robloxNick: r.roblox_nick,
      creditAs: r.credit_as,
      status: r.status as AdminRequest["status"],
      adminReply: r.admin_reply,
      createdAt: r.created_at,
    }))
  })

export const ownerResolveRequest = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().max(4096),
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]).nullable(),
        reply: z.string().max(1000).nullable(),
        brainrotName: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireOwner(data.initData)
    const reply = data.reply?.trim() || null
    if (!data.status && !reply) throw new Error("Напиши ответ или выбери решение")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
    const { data: req } = await supabaseAdmin.from("transfer_requests").select("*").eq("id", data.id).maybeSingle()
    if (!req) throw new Error("Заявка не найдена")
    if (data.status && req.status !== "pending") throw new Error("Заявка уже обработана")
    const patch: { admin_reply?: string | null; status?: string; resolved_at?: string } = {}
    if (reply) patch.admin_reply = reply
    if (data.status) {
      patch.status = data.status
      patch.resolved_at = new Date().toISOString()
    }
    const { error } = await supabaseAdmin.from("transfer_requests").update(patch).eq("id", data.id)
    if (error) throw new Error(error.message)
    const what = `${req.type === "deposit" ? "депозит" : "вывод"} «${escapeHtml(data.brainrotName ?? req.brainrot_id)}»`
    const head = data.status === "approved" ? `✅ Заявка на ${what} одобрена` : data.status === "rejected" ? `❌ Заявка на ${what} отклонена` : `💬 Ответ по заявке на ${what}`
    await sendBotMessage(Number(req.tg_id), reply ? `${head}\n\n<b>Админ:</b> ${escapeHtml(reply)}` : head)
    return { ok: true }
  })
