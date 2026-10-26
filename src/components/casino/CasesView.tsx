import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Clock, Gift, Lock, Share2, Sparkles, Tag, Users, X, Zap } from "lucide-react"
import { toast } from "sonner"
import { CASES, TAG, rollCase, sortedEntries, type CaseDef, type Drop } from "@/data/cases"
import { MINI_APP_LINK } from "@/data/fixtures"
import { useStore } from "@/lib/store"
import { haptic, notify, openShare, tg } from "@/lib/telegram"
import { REQUIRED_CHANNEL_URL, checkSubscription } from "@/lib/subscription.functions"
import { cn } from "@/lib/utils"
import { useLive } from "@/lib/live"
import { play } from "@/lib/sound"
import { MUTATION_BY_ID, mutatedValue, type MutationId } from "@/data/mutations"
import { BRAINROT_BY_ID, TIER_META, type Tier } from "@/data/brainrots"
import { CoinAmount, BrainrotCard, DropCard, cdnImage, dropLabel, dropValue, Coin, formatCoins } from "./ui"

const STRIP_LEN = 56
const WIN_INDEX = 48
const CELL = 112 // px, card width + gap

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function CasesView() {
  const [open, setOpen] = useState<CaseDef | null>(null)
  const bonus = CASES.filter((c) => c.kind !== "paid")
  const paid = CASES.filter((c) => c.kind === "paid")

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={<Gift className="size-4" />} title="Бонусные кейсы" hint="Бесплатно по таймеру" />
        <div className="grid grid-cols-3 gap-2.5">
          {bonus.map((c) => (
            <CaseTile key={c.id} c={c} onOpen={() => setOpen(c)} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle icon={<Sparkles className="size-4" />} title="Кейсы" hint="Шансы честно указаны внутри" />
        <div className="grid grid-cols-2 gap-3">
          {paid.map((c) => (
            <CaseTile key={c.id} c={c} onOpen={() => setOpen(c)} />
          ))}
        </div>
      </section>
      {open && typeof document !== "undefined" && createPortal(<CaseModal c={open} onClose={() => setOpen(null)} />, document.body)}
    </div>
  )
}

export function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="flex items-center gap-2 font-heading text-base font-extrabold">
        <span className="grid size-7 place-items-center rounded-lg bg-white/8 text-[var(--bd-lime)]">{icon}</span>
        {title}
      </h2>
      {hint && <span className="text-[11px] text-white/45">{hint}</span>}
    </div>
  )
}

const KIND_BADGE: Record<string, string> = { free: "FREE", tag: "ТЕГ", referral: "ДРУЗЬЯ" }

/** Tier composition of a case: how many brainrots of each tier are inside. */
function useCaseMeta(c: CaseDef) {
  return useMemo(() => {
    const counts = new Map<Tier | "coins", number>()
    let top = 0
    for (const e of c.entries) {
      const key = e.drop.kind === "brainrot" ? (BRAINROT_BY_ID[e.drop.id]?.tier ?? "rare") : "coins"
      counts.set(key, (counts.get(key) ?? 0) + 1)
      top = Math.max(top, dropValue(e.drop))
    }
    const order: (Tier | "coins")[] = ["coins", "rare", "epic", "legendary", "mythic", "og"]
    const segments = order.filter((k) => counts.has(k)).map((k) => ({ key: k, n: counts.get(k) ?? 0, color: k === "coins" ? "var(--bd-gold)" : TIER_META[k].color }))
    const rots = c.entries.filter((e) => e.drop.kind === "brainrot").length
    return { segments, top, rots }
  }, [c])
}

// Recently added cases get a NEW badge on their tile.
const NEW_CASES = new Set(["food", "los"])

function CaseTile({ c, onOpen }: { c: CaseDef; onOpen: () => void }) {
  const { caseReadyAt, freeCases } = useStore()
  const now = useNow()
  const readyAt = caseReadyAt(c)
  const locked = readyAt > now
  const small = c.kind !== "paid"
  const gifted = freeCases[c.id] ?? 0
  const meta = useCaseMeta(c)
  const isNew = NEW_CASES.has(c.id)
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        onOpen()
      }}
      className={cn("bd-case group text-center", small && "bd-case-sm")}
      style={{ ["--case" as string]: c.accent }}
    >
      <span className="bd-case-rays" />
      <span className="bd-halftone" />
      <span className="bd-case-shine" />
      <div className="relative z-[2] flex w-full items-start justify-between gap-1">
        {small ? (
          <span className="bd-case-chip">{KIND_BADGE[c.kind] ?? "BONUS"}</span>
        ) : isNew ? (
          <span className="bd-case-new">NEW</span>
        ) : (
          <span />
        )}
        {gifted > 0 && <span className="bd-case-gift">🎁×{gifted}</span>}
      </div>
      <div className={cn("relative -mt-1 grid w-full place-items-center", small ? "h-[84px]" : "h-36")}>
        <span className="bd-case-halo" />
        {/* Cover already shows the case's star brainrot on a Steal a Brainrot style chest. */}
        <img
          src={cdnImage(c.cover, small ? 160 : 260)}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("bd-case-cover bd-case-art relative z-[2] object-contain", small ? "size-[84px]" : "size-36")}
        />
        <span className="bd-pedestal" />
      </div>
      <div className={cn("bd-case-title relative z-[2] mt-2", small ? "text-[11px]" : "text-[15px]")}>{c.name}</div>
      {!small && <div className="relative z-[2] mt-0.5 line-clamp-1 text-[11px] font-semibold text-white/60">{c.subtitle}</div>}
      {!small && (
        <div className="relative z-[2] mt-2 w-full">
          <div className="bd-case-bar">
            {meta.segments.map((sg) => (
              <span key={sg.key} style={{ flexGrow: sg.n, background: sg.color }} />
            ))}
          </div>
        </div>
      )}
      <div className="relative z-[2] mt-2 w-full">
        {gifted > 0 ? (
          <span className="bd-case-open w-full">ПОДАРОК</span>
        ) : c.kind === "paid" ? (
          <span className="bd-case-price w-full justify-center">
            <CoinAmount value={c.price} size={15} className="text-sm" />
          </span>
        ) : locked ? (
          <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-black/45 px-2 py-1 text-[10px] font-bold tabular-nums text-white/70">
            <Clock className="size-3" /> {fmtLeft(readyAt - now)}
          </span>
        ) : (
          <span className="bd-case-open w-full">ОТКРЫТЬ</span>
        )}
      </div>
    </button>
  )
}

function CaseModal({ c, onClose }: { c: CaseDef; onClose: () => void }) {
  const store = useStore()
  const now = useNow()
  const [strip, setStrip] = useState<Drop[]>(() => buildStrip(c))
  const [spinning, setSpinning] = useState(false)
  const [offset, setOffset] = useState(0)
  const [won, setWon] = useState<Drop | null>(null)
  const [wonUid, setWonUid] = useState<string | null>(null)
  const [wonMut, setWonMut] = useState<MutationId | undefined>(undefined)
  const { streamer } = useLive()
  const [fast, setFast] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const entries = useMemo(() => sortedEntries(c), [c])

  const readyAt = store.caseReadyAt(c)
  const cooldownLeft = readyAt - now
  const gate = gateReason(c, store)
  const gifted = store.freeCases[c.id] ?? 0
  const needsSub = c.kind === "free" && gifted === 0
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const verifySub = async (silent = false) => {
    const app = tg()
    if (!app) {
      setSubscribed(false)
      if (!silent) toast.error("Открой приложение в Telegram")
      return false
    }
    setChecking(true)
    try {
      const r = await checkSubscription({ data: { initData: app.initData } })
      setSubscribed(r.subscribed)
      if (!silent) {
        if (r.subscribed) toast.success("Подписка подтверждена!")
        else toast.error(r.error ?? "Ты ещё не подписан на канал")
      }
      return r.subscribed
    } catch {
      setSubscribed(false)
      if (!silent) toast.error("Не удалось проверить подписку")
      return false
    } finally {
      setChecking(false)
    }
  }
  useEffect(() => {
    if (needsSub) void verifySub(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSub])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const spin = async () => {
    if (spinning || checking) return
    if (needsSub && !(await verifySub(true))) {
      notify("error")
      toast.error("Подпишись на канал, чтобы открыть бесплатный кейс")
      return
    }
    if (gifted > 0) {
      if (!store.consumeFreeCase(c.id)) return
    } else if (c.kind === "paid") {
      if (!store.spend(c.price)) {
        notify("error")
        toast.error("Недостаточно монет", { description: "Пополни баланс через депозит брейнрота" })
        return
      }
    } else {
      if (gate || cooldownLeft > 0) return
      store.claimCase(c)
    }
    store.track("cases")
    store.track(c.kind === "paid" ? "paidCases" : "bonusCases")
    haptic("medium")
    const result = rollCase(c)
    const next = buildStrip(c)
    next[WIN_INDEX] = result
    setWon(null)
    setOffset(0)
    setStrip(next)
    setSpinning(true)
    viewport.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    const width = viewport.current?.clientWidth ?? 360
    const jitter = (Math.random() - 0.5) * (CELL - 24)
    const target = 4 + WIN_INDEX * CELL - width / 2 + (CELL - 8) / 2 + jitter
    // Two frames so the reset to 0 paints before the long transition starts.
    requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target)))
    startTicks(viewport.current, fast ? 1300 : 6000)
    window.setTimeout(
      () => {
        setSpinning(false)
        setWon(result)
        notify("success")
        const item = store.grant(result, { mutate: true, source: "Кейс" })
        setWonUid(item?.uid ?? null)
        setWonMut(item?.mutation)
        if (dropValue(result) >= c.price * 3) play("bigwin")
        if (item?.mutation) toast.success(`Мутация ${MUTATION_BY_ID[item.mutation].name}! ×${MUTATION_BY_ID[item.mutation].mult}`)
      },
      fast ? 1300 : 6000,
    )
  }

  const sellWon = () => {
    if (!won || won.kind !== "brainrot" || !wonUid) return
    store.sellItem(wonUid)
    toast.success(`Продано за ${formatCoins(dropValue(won))} монет`)
    setWon(null)
  }

  const disabled =
    spinning || checking || (needsSub && subscribed !== true) || (gifted > 0 ? false : c.kind === "paid" ? !store.canAfford(c.price) : Boolean(gate) || cooldownLeft > 0)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#07040f]/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-4 pb-8 pt-4 no-scrollbar">
        <div className="bd-case-hero" style={{ ["--case" as string]: c.accent }}>
          <span className="bd-case-rays" />
          <span className="bd-halftone" />
          <img src={cdnImage(c.cover, 260)} alt="" className="bd-case-cover bd-float relative z-[2] size-28 shrink-0 object-contain" />
          <div className="relative z-[2] min-w-0 flex-1">
            <div className="bd-case-title text-xl">{c.name}</div>
            <div className="mt-1 text-xs text-white/65">{c.subtitle}</div>
            {gifted > 0 && <div className="mt-2 inline-flex rounded-lg bg-black/40 px-2 py-1 text-[11px] font-bold text-[var(--bd-gold)]">🎁 Подарков: {gifted}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={spinning} className="bd-btn-ghost relative z-[2] grid size-10 shrink-0 place-items-center self-start" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>

        <div ref={viewport} className="relative mt-5 h-[172px] shrink-0 overflow-hidden rounded-2xl border border-white/8 bg-black/40">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[3px] -translate-x-1/2 bg-[var(--bd-lime)] shadow-[0_0_16px_var(--bd-lime)]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#07040f] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#07040f] to-transparent" />
          <div
            className="flex h-full items-center gap-2 px-1"
            style={{
              transform: `translate3d(${-offset}px,0,0)`,
              transition: offset === 0 ? "none" : `transform ${fast ? 1.2 : 5.8}s cubic-bezier(.08,.6,.12,1)`,
              willChange: "transform",
            }}
          >
            {strip.map((d, i) => (
              <div key={i} className="w-[104px] shrink-0">
                <DropCard drop={d} compact />
              </div>
            ))}
          </div>
        </div>

        {won && <WinBanner drop={won} mutation={wonMut} onSell={sellWon} onClose={() => setWon(null)} />}

        <div className="mt-5 space-y-3">
          {needsSub && subscribed !== true && (
            <div className="bd-panel space-y-2 p-4 text-sm">
              <div className="flex items-center gap-2 font-bold">
                <Lock className="size-4 text-sky-400" /> Подпишись на наш канал
              </div>
              <p className="text-white/60">
                Бесплатный кейс доступен только подписчикам <b className="text-white">@BrainrotDroptgk</b>. Подпишись и нажми «Проверить».
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bd-btn flex-1 py-2 text-xs font-bold"
                  onClick={() => {
                    const app = tg()
                    if (app) app.openTelegramLink(REQUIRED_CHANNEL_URL)
                    else window.open(REQUIRED_CHANNEL_URL, "_blank", "noopener")
                  }}
                >
                  Подписаться
                </button>
                <button type="button" className="bd-btn-ghost flex-1 py-2 text-xs font-bold" disabled={checking} onClick={() => verifySub()}>
                  {checking ? "Проверяем…" : "Проверить"}
                </button>
              </div>
            </div>
          )}
          {gate ? (
            <GateNotice c={c} />
          ) : c.kind !== "paid" && cooldownLeft > 0 ? (
            <div className="bd-panel flex items-center justify-center gap-2 p-3 text-sm text-white/70">
              <Lock className="size-4" /> Доступно через <b className="tabular-nums text-white">{fmtLeft(cooldownLeft)}</b>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="bd-btn flex-1 py-3.5 text-base" onClick={spin} disabled={disabled}>
              {spinning ? (
                "Крутим…"
              ) : gifted > 0 ? (
                `Открыть подарок (×${gifted})`
              ) : c.kind === "paid" ? (
                <span className="inline-flex items-center gap-2">
                  Открыть за <Coin size={18} /> {streamer ? "•••" : formatCoins(c.price)}
                </span>
              ) : (
                "Открыть бесплатно"
              )}
            </button>
            <button
              type="button"
              onClick={() => setFast((f) => !f)}
              className={cn("bd-btn-ghost grid w-14 place-items-center", fast && "border-[var(--bd-lime)] text-[var(--bd-lime)]")}
              aria-pressed={fast}
              title="Быстрое открытие"
            >
              <Zap className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 font-heading text-sm font-extrabold text-white/80">Содержимое кейса</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {entries.map((e, i) => (
              <DropCard key={i} drop={e.drop} chance={e.weight} compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function WinBanner({ drop, mutation, onSell, onClose }: { drop: Drop; mutation?: MutationId; onSell: () => void; onClose: () => void }) {
  const value = drop.kind === "brainrot" ? mutatedValue(BRAINROT_BY_ID[drop.id]?.price ?? 0, mutation) : dropValue(drop)
  return (
    <div className="bd-pop relative mt-5 overflow-hidden rounded-2xl border border-[var(--bd-lime)]/40 bg-gradient-to-b from-[#1d2a0c] to-[#120b22] p-4">
      <div className="bd-rays pointer-events-none absolute -top-40 left-1/2 size-80 -translate-x-1/2 opacity-60" />
      <div className="relative flex items-center gap-4">
        <div className="w-28 shrink-0">
          {drop.kind === "brainrot" ? <BrainrotCard b={BRAINROT_BY_ID[drop.id]} mutation={mutation} compact /> : <DropCard drop={drop} compact />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--bd-lime)]">Твой дроп</div>
          <div className="truncate font-heading text-lg font-extrabold">{dropLabel(drop)}</div>
          <div className="mt-1">
            <CoinAmount value={value} />
            {mutation && <div className="mt-1 text-[10px] text-white/55">С мутацией нельзя продать или вывести — только обменять в инвентаре</div>}
          </div>
          <div className="mt-3 flex gap-2">
            {drop.kind === "brainrot" ? (
              <>
                {!mutation && <button type="button" className="bd-btn px-3 py-2 text-xs" onClick={onSell}>
                  Продать
                </button>}
                <button type="button" className="bd-btn-ghost px-3 py-2 text-xs font-bold" onClick={onClose}>
                  В инвентарь
                </button>
              </>
            ) : (
              <button type="button" className="bd-btn-ghost px-3 py-2 text-xs font-bold" onClick={onClose}>
                Зачислено на баланс
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function gateReason(c: CaseDef, store: ReturnType<typeof useStore>) {
  if (c.kind === "tag" && !store.hasTag) return "tag"
  if (c.kind === "referral" && store.invitedFriends < 1) return "referral"
  return null
}

function GateNotice({ c }: { c: CaseDef }) {
  const { user } = useStore()
  if (c.kind === "tag") {
    return (
      <div className="bd-panel space-y-2 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold">
          <Tag className="size-4 text-sky-400" /> Добавь тег в имя Telegram
        </div>
        <p className="text-white/60">
          Допиши <b className="text-white">{TAG}</b> к имени или фамилии в настройках Telegram и перезапусти приложение — кейс откроется.
        </p>
        <button
          type="button"
          className="bd-btn-ghost w-full py-2 text-xs font-bold"
          onClick={() => {
            navigator.clipboard?.writeText(TAG)
            toast.success("Тег скопирован")
          }}
        >
          Скопировать {TAG}
        </button>
      </div>
    )
  }
  return (
    <div className="bd-panel space-y-2 p-4 text-sm">
      <div className="flex items-center gap-2 font-bold">
        <Users className="size-4 text-pink-400" /> Пригласи друга
      </div>
      <p className="text-white/60">Кейс открывается каждые 12 часов, когда по твоей ссылке заходит новый друг.</p>
      <InviteButton userId={user.id} />
    </div>
  )
}

export function InviteButton({ userId }: { userId: number }) {
  const link = `${MINI_APP_LINK}ref_${userId}`
  return (
    <button
      type="button"
      className="bd-btn flex w-full items-center justify-center gap-2 py-2.5 text-sm"
      onClick={() => {
        haptic()
        openShare(link, "🧠 Залетай в BrainrotRoll! Бесплатные кейсы с брейнротами из Steal a Brainrot, апгрейдер и Crash. Забирай бонус по моей ссылке 👇")
      }}
    >
      <Share2 className="size-4" /> Пригласить друга
    </button>
  )
}

/** Clicks each time a card passes the center line while the strip decelerates. */
function startTicks(vp: HTMLDivElement | null, ms: number) {
  const strip = vp?.lastElementChild as HTMLElement | null
  if (!strip) return
  const end = performance.now() + ms
  let last = -1
  const loop = () => {
    const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform)
    const idx = Math.floor(-m.m41 / CELL)
    if (idx !== last) {
      if (last >= 0) play("tick")
      last = idx
    }
    if (performance.now() < end) requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

function buildStrip(c: CaseDef): Drop[] {
  return Array.from({ length: STRIP_LEN }, () => rollCase(c))
}

