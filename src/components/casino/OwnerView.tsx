import { useEffect, useMemo, useRef, useState } from "react"
import { Crown, DatabaseBackup, Download, Megaphone, RotateCcw, Search, Send, Ticket, Trash2, Upload, Wrench } from "lucide-react"

import { toast } from "sonner"
import { BRAINROTS } from "@/data/brainrots"
import { originalPrice, useLive } from "@/lib/live"
import { ownerExportBackup, ownerImportBackup, ownerSendBackupToTelegram, getMaintenance, ownerAnnounce, ownerCreatePromo, ownerDeletePromo, ownerListPromos, ownerSetMaintenance, ownerSetPrice } from "@/lib/owner.functions"
import { useStore } from "@/lib/store"
import { tg } from "@/lib/telegram"
import { BrainrotImg, formatCoins } from "./ui"
import { CaseEditorPanel, GrantPanel, RequestsPanel } from "./OwnerPanels"

export function OwnerView() {
  const store = useStore()
  useLive()
  const [q, setQ] = useState("")
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const list = useMemo(() => BRAINROTS.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [q])

  const initData = () => {
    const app = tg()
    if (!app) {
      toast.error("Открой приложение в Telegram")
      return null
    }
    return app.initData
  }

  const savePrice = async (id: string, price: number | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerSetPrice({ data: { initData: d, id, price } })
      await store.refreshSettings()
      setEdits((e) => ({ ...e, [id]: "" }))
      toast.success("Цена обновлена у всех")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const announce = async (value: string | null) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerAnnounce({ data: { initData: d, text: value } })
      await store.refreshSettings()
      setText("")
      toast.success(value ? "Плашка показана всем, кроме тебя" : "Плашка убрана")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bd-panel flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-xl bg-[var(--bd-gold)]/15 text-[var(--bd-gold)]">
          <Crown className="size-5" />
        </div>
        <div>
          <div className="font-heading font-extrabold">Панель владельца</div>
          <div className="text-xs text-white/50">Изменения применяются у всех пользователей</div>
        </div>
      </div>

      <div className="bd-panel space-y-3 p-4">
        <div className="flex items-center gap-2 font-bold">
          <Megaphone className="size-4 text-[var(--bd-lime)]" /> Плашка об обновлении
        </div>
        {store.announcement && (
          <div className="rounded-xl bg-black/30 p-3 text-xs text-white/70">
            Сейчас: <b className="text-white">{store.announcement.text}</b>
          </div>
        )}
        <textarea
          className="bd-input min-h-20"
          maxLength={300}
          placeholder="Например: Вышло обновление! Добавили мутации и Dragon Cannelloni"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="bd-btn flex-1 py-2.5 text-sm" disabled={busy || !text.trim()} onClick={() => announce(text)}>
            Показать всем
          </button>
          {store.announcement && (
            <button type="button" className="bd-btn-ghost px-4 py-2.5 text-sm font-bold" disabled={busy} onClick={() => announce(null)}>
              Убрать
            </button>
          )}
        </div>
      </div>

      <RequestsPanel />
      <GrantPanel />
      <CaseEditorPanel />
      <BackupPanel />
      <MaintenancePanel />
      <PromoPanel />

      <div className="space-y-3">
        <div className="font-heading font-extrabold">Цены брейнротов</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input className="bd-input pl-9" placeholder="Найти брейнрота" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.map((b) => {
          const orig = originalPrice(b.id)
          const changed = b.price !== orig
          const v = edits[b.id] ?? ""
          const n = Number(v)
          return (
            <div key={b.id} className="bd-panel flex items-center gap-2 p-2.5">
              <BrainrotImg b={b} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{b.name}</div>
                <div className="text-[11px] text-white/50">
                  {formatCoins(b.price)} 🪙{changed && <span className="text-white/35"> · было {formatCoins(orig)}</span>}
                </div>
              </div>
              <input
                className="bd-input !w-24 !py-1.5 text-xs"
                inputMode="numeric"
                placeholder="Цена"
                value={v}
                onChange={(e) => setEdits((s) => ({ ...s, [b.id]: e.target.value.replace(/\D/g, "") }))}
              />
              <button type="button" className="bd-btn px-3 py-1.5 text-xs" disabled={busy || !(n >= 1)} onClick={() => savePrice(b.id, n)}>
                ОК
              </button>
              {changed && (
                <button type="button" className="bd-btn-ghost grid size-8 place-items-center" disabled={busy} onClick={() => savePrice(b.id, null)} aria-label="Сбросить">
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useInitData() {
  return () => {
    const app = tg()
    if (!app) {
      toast.error("Открой приложение в Telegram")
      return null
    }
    return app.initData
  }
}

function MaintenancePanel() {
  const initData = useInitData()
  const [on, setOn] = useState(false)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getMaintenance().then((m) => {
      setOn(m.on)
      setText(m.text ?? "")
    })
  }, [])
  const save = async (next: boolean) => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerSetMaintenance({ data: { initData: d, on: next, text: text || null } })
      setOn(next)
      toast.success(next ? "Тех. перерыв включён для всех, кроме тебя" : "Сайт снова открыт")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Wrench className="size-4 text-[var(--bd-gold)]" /> Тех. перерыв
        <span className={`ml-auto text-xs ${on ? "text-[var(--bd-gold)]" : "text-white/40"}`}>{on ? "ВКЛЮЧЁН" : "выключен"}</span>
      </div>
      <textarea className="bd-input min-h-16" maxLength={300} placeholder="Текст для игроков (необязательно)" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className={on ? "bd-btn-ghost w-full py-2.5 text-sm font-bold" : "bd-btn w-full py-2.5 text-sm"} disabled={busy} onClick={() => save(!on)}>
        {on ? "Открыть сайт" : "Закрыть сайт на перерыв"}
      </button>
    </div>
  )
}

type Promo = { code: string; coins: number; max_uses: number; uses: number }

function PromoPanel() {
  const initData = useInitData()
  const [list, setList] = useState<Promo[]>([])
  const [code, setCode] = useState("")
  const [coins, setCoins] = useState("")
  const [uses, setUses] = useState("1")
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const d = tg()?.initData
    if (!d) return
    try {
      setList((await ownerListPromos({ data: { initData: d } })) as Promo[])
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load()
  }, [])
  const create = async () => {
    const d = initData()
    if (!d) return
    setBusy(true)
    try {
      await ownerCreatePromo({ data: { initData: d, code, coins: Number(coins), maxUses: Number(uses) } })
      toast.success(`Промокод ${code} создан`)
      setCode("")
      setCoins("")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }
  const remove = async (c: string) => {
    const d = initData()
    if (!d) return
    await ownerDeletePromo({ data: { initData: d, code: c } })
    await load()
  }
  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <Ticket className="size-4 text-[var(--bd-lime)]" /> Промокоды
      </div>
      <input className="bd-input uppercase" placeholder="КОД (напр. BRAINROT100)" maxLength={32} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} />
      <div className="grid grid-cols-2 gap-2">
        <input className="bd-input" inputMode="numeric" placeholder="Монет" value={coins} onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))} />
        <input className="bd-input" inputMode="numeric" placeholder="Активаций" value={uses} onChange={(e) => setUses(e.target.value.replace(/\D/g, ""))} />
      </div>
      <button type="button" className="bd-btn w-full py-2.5 text-sm" disabled={busy || code.length < 3 || !(Number(coins) >= 1) || !(Number(uses) >= 1)} onClick={create}>
        Создать промокод
      </button>
      {list.map((p) => (
        <div key={p.code} className="flex items-center gap-2 rounded-xl bg-black/30 p-2.5 text-xs">
          <b className="font-mono">{p.code}</b>
          <span className="text-white/55">+{formatCoins(Number(p.coins))} 🪙</span>
          <span className="ml-auto text-white/45">
            {p.uses}/{p.max_uses}
          </span>
          <button type="button" aria-label="Удалить" className="text-white/40" onClick={() => remove(p.code)}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

type Backup = {
  app: string
  version: number
  exportedAt?: string
  players: { tg_id: number; first_name?: string | null; username?: string | null; state: Record<string, unknown>; created_at?: string }[]
  promoCodes?: { code: string; coins: number; max_uses: number; uses: number; active: boolean }[]
  promoRedemptions?: { code: string; tg_id: number }[]
  pendingGrants?: { tg_id: number; kind: "coins" | "case" | "brainrot"; amount: number; case_id: string | null; brainrot_id?: string | null; note?: string | null }[]
  priceOverrides?: Record<string, number>
}

const CHUNK = 200

function BackupPanel() {
  const initData = useInitData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<Backup | null>(null)

  const download = async () => {
    const d = initData()
    if (!d) return
    setBusy("Готовлю файл…")
    try {
      const json = await ownerExportBackup({ data: { initData: d } })
      const count = (JSON.parse(json) as Backup).players.length
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `brainrotdrop-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      toast.success(`Бэкап сохранён · игроков: ${count}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(null)
    }
  }

  const sendTg = async () => {
    const d = initData()
    if (!d) return
    setBusy("Отправляю в Telegram…")
    try {
      const r = await ownerSendBackupToTelegram({ data: { initData: d } })
      toast.success(`Файл отправлен тебе в чат с ботом · игроков: ${r.players}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(null)
    }
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    try {
      const b = JSON.parse(await f.text()) as Backup
      if (b.app !== "brainrotdrop" || !Array.isArray(b.players)) throw new Error("Это не файл бэкапа BrainrotDrop")
      setPending(b)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать файл")
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const restore = async () => {
    const d = initData()
    if (!d || !pending) return
    const total = pending.players.length
    try {
      // First chunk carries promo codes, grants and prices; the rest are players only.
      for (let i = 0; i === 0 || i < total; i += CHUNK) {
        setBusy(`Переношу игроков: ${Math.min(i + CHUNK, total)}/${total}`)
        await ownerImportBackup({
          data: {
            initData: d,
            players: pending.players.slice(i, i + CHUNK).map((p) => ({
              tg_id: p.tg_id,
              first_name: p.first_name ?? "",
              username: p.username ?? null,
              state: p.state ?? {},
              ...(p.created_at ? { created_at: p.created_at } : {}),
            })),
            ...(i === 0
              ? { promoCodes: pending.promoCodes ?? [], promoRedemptions: pending.promoRedemptions ?? [], pendingGrants: pending.pendingGrants ?? [], priceOverrides: pending.priceOverrides ?? {} }
              : {}),
          },
        })
      }
      toast.success(`Готово! Перенесено игроков: ${total}`)
      setPending(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка переноса")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bd-panel space-y-3 p-4">
      <div className="flex items-center gap-2 font-bold">
        <DatabaseBackup className="size-4 text-sky-400" /> Сохранение и перенос игроков
      </div>
      <p className="text-[11px] text-white/50">
        Сохрани всех игроков (баланс, инвентарь, батл пасс), промокоды и цены в файл. На новом сайте открой эту панель и загрузи файл — всё перенесётся.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="bd-btn flex items-center justify-center gap-1.5 py-2.5 text-xs" disabled={!!busy} onClick={sendTg}>
          <Send className="size-4" /> В Telegram
        </button>
        <button type="button" className="bd-btn-ghost flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold" disabled={!!busy} onClick={download}>
          <Download className="size-4" /> Скачать файл
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {pending ? (
        <div className="space-y-2 rounded-xl bg-black/30 p-3 text-xs">
          <div>
            Файл от <b>{pending.exportedAt ? new Date(pending.exportedAt).toLocaleString("ru-RU") : "—"}</b> · игроков: <b>{pending.players.length}</b> · промокодов: <b>{pending.promoCodes?.length ?? 0}</b>
          </div>
          <div className="text-white/50">Игроки из файла заменят тех же игроков на этом сайте. Загружай один файл один раз.</div>
          <div className="flex gap-2">
            <button type="button" className="bd-btn flex-1 py-2 text-xs" disabled={!!busy} onClick={restore}>
              Перенести
            </button>
            <button type="button" className="bd-btn-ghost px-3 py-2 text-xs font-bold" disabled={!!busy} onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="bd-btn-ghost flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-bold" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Загрузить бэкап
        </button>
      )}
      {busy && <div className="text-center text-[11px] text-[var(--bd-lime)]">{busy}</div>}
    </div>
  )
}
