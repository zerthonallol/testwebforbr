import { useState } from "react"
import { Check, Crown, Gift, Lock, Sparkles, Star, Target, Zap } from "lucide-react"
import { toast } from "sonner"
import {
  LEVELS,
  MAX_LEVEL,
  PREMIUM_PRICE,
  QUESTS,
  SEASON_NAME,
  XP_PER_LEVEL,
  canBuyPremium,
  canClaimLevel,
  levelFromXp,
  questProgress,
  xpIntoLevel,
  type BpReward,
  type TrackId,
} from "@/data/battlepass"
import { BRAINROT_BY_ID } from "@/data/brainrots"
import { CASES } from "@/data/cases"
import { useStore } from "@/lib/store"
import { haptic, notify } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { BrainrotImg, Coin, formatCoins } from "./ui"

function rewardLabel(r: BpReward) {
  if (r.kind === "coins") return `${formatCoins(r.amount)} монет`
  if (r.kind === "case") return `Кейс «${CASES.find((c) => c.id === r.caseId)?.name ?? r.caseId}»${r.amount > 1 ? ` ×${r.amount}` : ""}`
  return BRAINROT_BY_ID[r.id]?.name ?? r.id
}

function shortLabel(r: BpReward) {
  if (r.kind === "coins") return formatCoins(r.amount)
  if (r.kind === "case") return `${CASES.find((c) => c.id === r.caseId)?.name ?? "Кейс"}${r.amount > 1 ? ` ×${r.amount}` : ""}`
  return BRAINROT_BY_ID[r.id]?.name ?? r.id
}

function RewardIcon({ r }: { r: BpReward }) {
  if (r.kind === "coins") return <Coin size={30} />
  if (r.kind === "case") {
    const c = CASES.find((x) => x.id === r.caseId)
    return c ? <img src={c.cover} alt="" className="bd-sticker size-10 object-contain" loading="lazy" /> : <Gift className="size-6" />
  }
  const b = BRAINROT_BY_ID[r.id]
  return b ? <BrainrotImg b={b} size={42} /> : <Gift className="size-6" />
}

type Tab = "levels" | "quests"

export function BattlePassView() {
  const store = useStore()
  const [tab, setTab] = useState<Tab>("levels")
  const level = levelFromXp(store.bp.xp)
  const into = xpIntoLevel(store.bp.xp)
  const questsReady = QUESTS.filter((q) => !store.bp.quests.includes(q.id) && questProgress(q, store.stats).done).length
  const levelsReady = LEVELS.filter(
    (l) => canClaimLevel("free", l.level, store.bp) === "ok" || canClaimLevel("premium", l.level, store.bp) === "ok",
  ).length

  const buy = () => {
    haptic("medium")
    if (!canBuyPremium(store.balance, store.bp)) {
      notify("error")
      toast.error(`Нужно ${formatCoins(PREMIUM_PRICE)} монет`)
      return
    }
    if (store.buyPremium()) {
      notify("success")
      toast.success("Премиум открыт! Забирай награды на всех пройденных уровнях")
    }
  }

  return (
    <div className="space-y-4">
      <div className="bd-bp-hero">
        <span className="bd-rays pointer-events-none absolute -right-20 -top-20 size-64 opacity-30" />
        <div className="relative flex items-center gap-3">
          <div className="bd-bp-badge">
            <span className="text-[9px] font-extrabold uppercase opacity-70">ур.</span>
            <span className="font-heading text-2xl font-extrabold leading-none">{level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--bd-gold)]">{SEASON_NAME}</div>
            <h1 className="font-heading text-2xl font-extrabold leading-tight">Батл пасс</h1>
            <p className="mt-0.5 text-[11px] text-white/60">Квесты дают XP, XP поднимает уровень.</p>
          </div>
          <img src="/img/battlepass.webp" alt="" className="bd-float size-16 shrink-0 object-contain" />
        </div>
        <div className="relative mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 text-[var(--bd-lime)]">
              <Zap className="size-3.5" /> {formatCoins(store.bp.xp)} XP
            </span>
            <span className="text-white/55 tabular-nums">
              {level >= MAX_LEVEL ? "Максимальный уровень" : `${into}/${XP_PER_LEVEL} до ур. ${level + 1}`}
            </span>
          </div>
          <div className="bd-bp-progress bd-bp-progress-lg" style={{ ["--track" as string]: "var(--bd-lime)" }}>
            <span style={{ width: `${(into / XP_PER_LEVEL) * 100}%` }} />
          </div>
        </div>
        {!store.bp.premium && (
          <button type="button" className="bd-btn-gold relative mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm" onClick={buy}>
            <Crown className="size-4" /> Премиум за <Coin size={16} /> {formatCoins(PREMIUM_PRICE)}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/30 p-1">
        {(
          [
            ["levels", "Уровни", Star, levelsReady],
            ["quests", "Квесты", Target, questsReady],
          ] as const
        ).map(([id, label, Icon, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              haptic()
              setTab(id)
            }}
            className={cn("flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition-colors", tab === id ? "bg-white/12 text-white" : "text-white/50")}
          >
            <Icon className="size-4" />
            {label}
            {n > 0 && <span className="rounded-md bg-[var(--bd-gold)] px-1.5 text-[10px] text-black">{n}</span>}
          </button>
        ))}
      </div>

      {tab === "levels" ? <LevelsList /> : <QuestsList />}
    </div>
  )
}

function LevelsList() {
  const store = useStore()
  const current = levelFromXp(store.bp.xp)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2 px-1 text-[10px] font-extrabold uppercase">
        <span className="inline-flex items-center gap-1 text-[var(--bd-lime)]">
          <Sparkles className="size-3.5" /> Бесплатно
        </span>
        <span />
        <span className="inline-flex items-center justify-end gap-1 text-[var(--bd-gold)]">
          Премиум <Crown className="size-3.5" />
        </span>
      </div>
      {LEVELS.map((l) => (
        <div key={l.level} className="grid grid-cols-[1fr_2.5rem_1fr] items-stretch gap-2">
          <RewardCell track="free" level={l.level} reward={l.free} />
          <div className="bd-bp-node" data-reached={current >= l.level}>
            {l.level}
          </div>
          <RewardCell track="premium" level={l.level} reward={l.premium} />
        </div>
      ))}
    </div>
  )
}

function RewardCell({ track, level, reward }: { track: TrackId; level: number; reward: BpReward }) {
  const store = useStore()
  const check = canClaimLevel(track, level, store.bp)
  const claim = () => {
    const r = store.claimBp(track, level)
    if (!r) return
    notify("success")
    toast.success(`Награда получена: ${rewardLabel(r)}`)
  }
  return (
    <button
      type="button"
      disabled={check !== "ok"}
      onClick={claim}
      className="bd-bp-cell"
      data-track={track}
      data-state={check}
      title={rewardLabel(reward)}
    >
      <span className="bd-bp-reward">
        <RewardIcon r={reward} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[11px] font-bold">{shortLabel(reward)}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-extrabold">
          {check === "ok" && <span className="text-[var(--track)]">Забрать</span>}
          {check === "claimed" && (
            <span className="inline-flex items-center gap-0.5 text-white/50">
              <Check className="size-3" /> Есть
            </span>
          )}
          {check === "locked" && (
            <span className="inline-flex items-center gap-0.5 text-white/40">
              <Lock className="size-3" /> Премиум
            </span>
          )}
          {check === "not-reached" && <span className="text-white/35">Ур. {level}</span>}
        </span>
      </span>
    </button>
  )
}

function QuestsList() {
  const store = useStore()
  const sorted = [...QUESTS].sort((a, b) => {
    const rank = (id: string, done: boolean) => (store.bp.quests.includes(id) ? 2 : done ? 0 : 1)
    return rank(a.id, questProgress(a, store.stats).done) - rank(b.id, questProgress(b, store.stats).done)
  })
  return (
    <div className="space-y-2">
      {sorted.map((q) => {
        const { value, done } = questProgress(q, store.stats)
        const claimed = store.bp.quests.includes(q.id)
        const state = claimed ? "claimed" : done ? "ready" : "progress"
        const claim = () => {
          const xp = store.claimQuest(q.id)
          if (!xp) return
          notify("success")
          toast.success(`+${xp} XP`)
        }
        return (
          <div key={q.id} className="bd-bp-tier" data-state={state} style={{ ["--track" as string]: "var(--bd-lime)" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{q.title}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="bd-bp-progress flex-1">
                  <span style={{ width: `${(value / q.target) * 100}%` }} />
                </div>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-white/55">
                  {formatCoins(value)}/{formatCoins(q.target)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className="bd-xp-chip">
                <Zap className="size-3" />+{q.xp} XP
              </span>
              {claimed ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white/55">
                  <Check className="size-3" /> Получено
                </span>
              ) : (
                <button type="button" disabled={!done} onClick={claim} className="bd-btn px-2.5 py-1 text-[10px]">
                  Забрать
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
