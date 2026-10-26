import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Boxes, Check, Gift, Inbox, MessageSquare, Plus, RotateCcw, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { BRAINROTS, BRAINROT_BY_ID } from "@/data/brainrots"
import { CASES, baseEntries, dropKey, type CaseOverride } from "@/data/cases"
import { getSettings, ownerGrant, ownerListRequests, ownerResolveRequest, ownerSetCaseOverride, type AdminRequest } from "@/lib/owner.functions"
import { useStore } from "@/lib/store"
import { tg } from "@/lib/telegram"
import { play } from "@/lib/sound"
import { useLive } from "@/lib/live"
import { BrainrotImg, formatCoins } from "./ui"

function initData() {
  const app = tg()
  if (!app) {
    toast.error("Открой приложение в Telegram")
    return null
  }
  return app.initData
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Ошибка")

// ---------------- Requests ----------------

export function RequestsPanel() {
  const [tab, setTab] = useState<"pending" | "done">("pending")
  const [list, setList] = useState<AdminRequest[]>([])
  const seen = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    const d = tg()?.initData
    if (!d) return
    try {
      const rows = await ownerListRequests({ data: { initData: d, status: tab } })
      if (tab === "pending") {
        const ids = new Set(rows.map((r) => r.id))
        if (seen.current && rows.some((r) => !seen.current!.has(r.id))) {
          play("alert")
          toast.message("Новая заявка", { description: "Пришла новая заявка на депозит или вывод" })
        }
        seen.current = ids
      }
      setList(rows)
    } catch {
      /* ignore */
    }
  }, [tab])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Inbox className="size-4 text-[var(--bd-lime)]" /> Заявки на депозит и вывод
        {tab === "pending" && list.length > 0 && <span className="ml-auto rounded-full bg-[var(--bd-lime)] px-2 text-xs text-black">{list.length}</span>}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
        {(["pending", "done"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg py-2 text-xs font-bold ${tab === k ? "bg-white/12 text-white" : "text-white/50"}`}>
            {k === "pending" ? "Новые" : "Обработанные"}
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="py-3 text-center text-xs text-white/45">{tab === "pending" ? "Новых заявок нет" : "Пока пусто"}</div>}
      {list.map((r) => (
        <RequestRow key={r.id} r={r} onDone={load} />
      ))}
      <div className="text-[11px] text-white/40">О каждой новой заявке бот пишет тебе в личку. Игрок получает ответ и решение в бот и в приложение.</div>
    </div>
  )
}

function RequestRow({ r, onDone }: { r: AdminRequest; onDone: () => void }) {
  const b = BRAINROT_BY_ID[r.brainrotId]
  const [reply, setReply] = useState("")
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const act = async (status: "approved" | "rejected" | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerResolveRequest({ data: { initData: d, id: r.id, status, reply: reply.trim() || null, brainrotName: b?.name } })
      toast.success(status === "approved" ? "Заявка принята" : status === "rejected" ? "Заявка отклонена" : "Ответ отправлен")
      setReply("")
      setOpen(false)
      onDone()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2 rounded-xl bg-black/30 p-3">
      <div className="flex items-center gap-3">
        {b && <BrainrotImg b={b} size={44} />}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase text-white/45">
            {r.type === "deposit" ? "📥 Депозит" : "📤 Вывод"} · {new Date(r.createdAt).toLocaleString("ru-RU")}
          </div>
          <div className="truncate text-sm font-bold">{b?.name ?? r.brainrotId}</div>
          <div className="truncate text-[11px] text-white/60">
            {r.userName} · ID {r.tgId} · Roblox: <b className="text-white">{r.robloxNick}</b>
            {r.type === "deposit" && ` · ${r.creditAs === "coins" ? `монетами (${formatCoins(b?.price ?? 0)})` : "брейнротом"}`}
          </div>
        </div>
        {r.status !== "pending" && (
          <span className={`text-xs font-bold ${r.status === "approved" ? "text-[var(--bd-lime)]" : "text-red-400"}`}>{r.status === "approved" ? "Принята" : "Отклонена"}</span>
        )}
      </div>
      {r.adminReply && <div className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/70">💬 {r.adminReply}</div>}
      {(open || r.status === "pending") && (
        <textarea className="bd-input min-h-14 text-xs" maxLength={1000} placeholder="Свой ответ игроку (необязательно)" value={reply} onChange={(e) => setReply(e.target.value)} />
      )}
      <div className="flex gap-2">
        {r.status === "pending" && (
          <>
            <button type="button" className="bd-btn flex flex-1 items-center justify-center gap-1 py-2 text-xs" disabled={busy} onClick={() => act("approved")}>
              <Check className="size-4" /> Принять
            </button>
            <button type="button" className="bd-btn-ghost flex flex-1 items-center justify-center gap-1 py-2 text-xs font-bold" disabled={busy} onClick={() => act("rejected")}>
              <X className="size-4" /> Отклонить
            </button>
          </>
        )}
        {r.status !== "pending" && !open ? (
          <button type="button" className="bd-btn-ghost flex flex-1 items-center justify-center gap-1 py-2 text-xs font-bold" onClick={() => setOpen(true)}>
            <MessageSquare className="size-4" /> Написать ответ
          </button>
        ) : (
          <button type="button" className="bd-btn-ghost grid w-12 place-items-center py-2" title="Только ответить" disabled={busy || !reply.trim()} onClick={() => act(null)}>
            <MessageSquare className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------- Grant (coins / case / brainrot) ----------------

export function GrantPanel() {
  const [target, setTarget] = useState("")
  const [kind, setKind] = useState<"coins" | "case" | "brainrot">("coins")
  const [amount, setAmount] = useState("")
  const [caseId, setCaseId] = useState(CASES[0]?.id ?? "")
  const [rotId, setRotId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const n = Number(amount)
  const found = useMemo(() => (q.trim() ? BRAINROTS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []), [q])
  const submit = async () => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      const r = await ownerGrant({ data: { initData: d, target, kind, amount: n, caseId: kind === "case" ? caseId : null, brainrotId: kind === "brainrot" ? rotId : null } })
      toast.success(`Выдано ${r.who}`)
      setAmount("")
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  const rot = rotId ? BRAINROT_BY_ID[rotId] : null
  const label = kind === "coins" ? `${formatCoins(n)} монет` : kind === "case" ? `${n} кейс(ов)` : `${rot?.name ?? "брейнрота"} ×${n}`
  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Gift className="size-4 text-[var(--bd-pink)]" /> Выдать игроку
      </div>
      <input className="bd-input" placeholder="@username или Telegram ID" value={target} onChange={(e) => setTarget(e.target.value.trim())} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/30 p-1">
        {(["coins", "case", "brainrot"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg py-2 text-xs font-bold ${kind === k ? "bg-white/12 text-white" : "text-white/50"}`}>
            {k === "coins" ? "Монеты" : k === "case" ? "Кейс" : "Брейнрот"}
          </button>
        ))}
      </div>
      {kind === "case" && (
        <select className="bd-input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          {CASES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {kind === "brainrot" && (
        <div className="space-y-2">
          {rot ? (
            <div className="flex items-center gap-2 rounded-xl bg-black/30 p-2">
              <BrainrotImg b={rot} size={36} />
              <div className="flex-1 truncate text-xs font-bold">{rot.name}</div>
              <button type="button" className="text-white/50" onClick={() => setRotId(null)} aria-label="Сменить">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <BrainrotSearch q={q} setQ={setQ} found={found} onPick={(id) => { setRotId(id); setQ("") }} />
          )}
        </div>
      )}
      <input className="bd-input" inputMode="numeric" placeholder={kind === "coins" ? "Сколько монет" : "Сколько штук"} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
      <button type="button" className="bd-btn w-full py-2.5 text-sm" disabled={busy || !target || !(n >= 1) || (kind === "brainrot" && !rotId)} onClick={submit}>
        Выдать {n >= 1 ? label : ""}
      </button>
      <div className="text-[11px] text-white/40">Игрок получит выдачу в течение ~15 секунд, если он в приложении, или при следующем заходе. Брейнрот попадёт прямо в инвентарь.</div>
    </div>
  )
}

function BrainrotSearch({ q, setQ, found, onPick }: { q: string; setQ: (s: string) => void; found: typeof BRAINROTS; onPick: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
        <input className="bd-input pl-9" placeholder="Найти брейнрота" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {found.map((b) => (
        <button key={b.id} type="button" className="flex w-full items-center gap-2 rounded-xl bg-black/30 p-2 text-left" onClick={() => onPick(b.id)}>
          <BrainrotImg b={b} size={32} />
          <span className="flex-1 truncate text-xs font-bold">{b.name}</span>
          <span className="text-[11px] text-white/50">{formatCoins(b.price)} 🪙</span>
        </button>
      ))}
    </div>
  )
}

// ---------------- Case editor ----------------

export function CaseEditorPanel() {
  const store = useStore()
  useLive()
  const [caseId, setCaseId] = useState(CASES[0]?.id ?? "")
  const [ov, setOv] = useState<CaseOverride>({})
  const [all, setAll] = useState<Record<string, CaseOverride>>({})
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSettings().then((s) => setAll(s.caseOverrides ?? {})).catch(() => {})
  }, [])
  useEffect(() => {
    setOv(all[caseId] ?? {})
    setEdits({})
  }, [caseId, all])

  const c = CASES.find((x) => x.id === caseId)
  const removed = new Set(ov.remove ?? [])
  const baseRots = baseEntries(caseId).filter((e) => e.drop.kind === "brainrot").map((e) => (e.drop.kind === "brainrot" ? e.drop.id : ""))
  const found = useMemo(
    () => (q.trim() ? BRAINROTS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()) && !c?.entries.some((e) => e.drop.kind === "brainrot" && e.drop.id === b.id)).slice(0, 8) : []),
    [q, c],
  )

  const save = async (next: CaseOverride | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      const r = await ownerSetCaseOverride({ data: { initData: d, caseId, override: next } })
      setAll(r.caseOverrides)
      await store.refreshSettings()
      toast.success(next ? "Кейс обновлён у всех" : "Кейс сброшен к стандарту")
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const setChance = (key: string, v: number | null) => {
    const chances = { ...(ov.chances ?? {}) }
    if (v === null) delete chances[key]
    else chances[key] = v
    save({ ...ov, chances })
  }
  const addRot = (id: string) => {
    const rem = (ov.remove ?? []).filter((x) => x !== id)
    const add = baseRots.includes(id) ? (ov.add ?? []) : [...new Set([...(ov.add ?? []), id])]
    setQ("")
    save({ ...ov, add, remove: rem })
  }
  const removeRot = (id: string) => {
    const add = (ov.add ?? []).filter((x) => x !== id)
    const remove = baseRots.includes(id) ? [...new Set([...(ov.remove ?? []), id])] : ov.remove ?? []
    const chances = { ...(ov.chances ?? {}) }
    delete chances[`b:${id}`]
    save({ ...ov, add, remove, chances })
  }

  const fixedSum = Object.values(ov.chances ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Boxes className="size-4 text-orange-400" /> Редактор кейсов
      </div>
      <select className="bd-input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
        {CASES.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
            {all[x.id] ? " ✏️" : ""}
          </option>
        ))}
      </select>
      <div className="text-[11px] text-white/45">
        Впиши шанс в % и нажми ОК — он закрепится. Остальные дропы делят оставшийся шанс пропорционально. Закреплено: <b className="text-white">{+fixedSum.toFixed(3)}%</b>
      </div>
      {c?.entries
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .map((e) => {
          const key = dropKey(e.drop)
          const b = e.drop.kind === "brainrot" ? BRAINROT_BY_ID[e.drop.id] : null
          const pinned = typeof ov.chances?.[key] === "number"
          const v = edits[key] ?? ""
          const n = Number(v.replace(",", "."))
          return (
            <div key={key} className="flex items-center gap-2 rounded-xl bg-black/30 p-2">
              {b ? <BrainrotImg b={b} size={32} /> : <span className="grid size-8 place-items-center text-lg">🪙</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{b ? b.name : `${formatCoins(e.drop.kind === "coins" ? e.drop.amount : 0)} монет`}</div>
                <div className={`text-[11px] ${pinned ? "text-[var(--bd-lime)]" : "text-white/50"}`}>
                  {+(e.weight * 100).toFixed(4)}%{pinned && " · закреплён"}
                </div>
              </div>
              <input
                className="bd-input !w-20 !py-1.5 text-xs"
                inputMode="decimal"
                placeholder="%"
                value={v}
                onChange={(ev) => setEdits((s) => ({ ...s, [key]: ev.target.value.replace(/[^\d.,]/g, "") }))}
              />
              <button type="button" className="bd-btn px-2.5 py-1.5 text-xs" disabled={busy || !v || !(n >= 0 && n <= 100)} onClick={() => setChance(key, n)}>
                ОК
              </button>
              {pinned && (
                <button type="button" className="bd-btn-ghost grid size-8 place-items-center" disabled={busy} onClick={() => setChance(key, null)} aria-label="Открепить">
                  <RotateCcw className="size-3.5" />
                </button>
              )}
              {b && (
                <button type="button" className="grid size-8 place-items-center text-white/40" disabled={busy} onClick={() => removeRot(b.id)} aria-label="Убрать из кейса">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      {[...removed].length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-white/45">Убраны из кейса:</div>
          <div className="flex flex-wrap gap-1.5">
            {[...removed].map((id) => (
              <button key={id} type="button" className="rounded-lg bg-white/8 px-2 py-1 text-[11px]" disabled={busy} onClick={() => addRot(id)}>
                <Plus className="mr-1 inline size-3" />
                {BRAINROT_BY_ID[id]?.name ?? id}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs font-bold text-white/70">Добавить брейнрота в кейс</div>
      <BrainrotSearch q={q} setQ={setQ} found={found} onPick={addRot} />
      {all[caseId] && (
        <button type="button" className="bd-btn-ghost w-full py-2 text-xs font-bold" disabled={busy} onClick={() => save(null)}>
          Сбросить кейс к стандарту
        </button>
      )}
    </div>
  )
}
