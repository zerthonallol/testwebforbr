// Battle pass by levels: quests only give XP, XP raises the pass level,
// and every level has a free reward plus a premium reward (premium bought for coins).

export const PREMIUM_PRICE = 3000
export const XP_PER_LEVEL = 400
export const SEASON_NAME = "Сезон 1 · Брейнрот-лихорадка"

export type StatKey =
  | "cases"
  | "paidCases"
  | "bonusCases"
  | "upgrades"
  | "upgradeWins"
  | "crash"
  | "crashWins"
  | "dice"
  | "diceWins"
  | "spent"
  | "brainrots"
  | "mutations"

export type Stats = Partial<Record<StatKey, number>>

export type BpReward =
  | { kind: "coins"; amount: number }
  | { kind: "case"; caseId: string; amount: number }
  | { kind: "brainrot"; id: string }

export interface BpQuest {
  id: string
  stat: StatKey
  target: number
  title: string
  xp: number
}

export interface BpLevel {
  level: number
  free: BpReward
  premium: BpReward
}

export type TrackId = "free" | "premium"

export interface BpState {
  premium: boolean
  xp: number
  /** Quest ids whose XP was already collected. */
  quests: string[]
  /** Levels whose reward was claimed, per track. */
  claimed: Record<TrackId, number[]>
}

export const EMPTY_BP: BpState = { premium: false, xp: 0, quests: [], claimed: { free: [], premium: [] } }

export const QUESTS: BpQuest[] = [
  { id: "q1", stat: "cases", target: 3, title: "Открой 3 кейса", xp: 100 },
  { id: "q2", stat: "crash", target: 3, title: "Сыграй 3 раунда в Crash", xp: 100 },
  { id: "q3", stat: "upgrades", target: 2, title: "Сделай 2 апгрейда", xp: 100 },
  { id: "q4", stat: "dice", target: 5, title: "Брось кубик 5 раз", xp: 100 },
  { id: "q5", stat: "brainrots", target: 5, title: "Выбей 5 брейнротов", xp: 150 },
  { id: "q6", stat: "bonusCases", target: 3, title: "Открой 3 бонусных кейса", xp: 150 },
  { id: "q7", stat: "spent", target: 2000, title: "Потрать 2 000 монет", xp: 200 },
  { id: "q8", stat: "crashWins", target: 3, title: "Забери выигрыш в Crash 3 раза", xp: 200 },
  { id: "q9", stat: "upgradeWins", target: 3, title: "Выиграй 3 апгрейда", xp: 250 },
  { id: "q10", stat: "diceWins", target: 5, title: "Выиграй 5 раз в Dice", xp: 250 },
  { id: "q11", stat: "cases", target: 15, title: "Открой 15 кейсов", xp: 300 },
  { id: "q12", stat: "mutations", target: 1, title: "Выбей брейнрота с мутацией", xp: 300 },
  { id: "q13", stat: "paidCases", target: 10, title: "Открой 10 платных кейсов", xp: 300 },
  { id: "q14", stat: "brainrots", target: 15, title: "Выбей 15 брейнротов", xp: 350 },
  { id: "q15", stat: "crash", target: 25, title: "Сыграй 25 раундов в Crash", xp: 400 },
  { id: "q16", stat: "dice", target: 25, title: "Брось кубик 25 раз", xp: 400 },
  { id: "q17", stat: "spent", target: 5000, title: "Потрать 5 000 монет", xp: 400 },
  { id: "q18", stat: "mutations", target: 2, title: "Выбей 2 мутации", xp: 500 },
  { id: "q19", stat: "cases", target: 40, title: "Открой 40 кейсов", xp: 600 },
  { id: "q20", stat: "spent", target: 15000, title: "Потрать 15 000 монет", xp: 700 },
]

const coins = (amount: number): BpReward => ({ kind: "coins", amount })
const kase = (caseId: string, amount = 1): BpReward => ({ kind: "case", caseId, amount })
const rot = (id: string): BpReward => ({ kind: "brainrot", id })

export const LEVELS: BpLevel[] = [
  { level: 1, free: coins(100), premium: coins(400) },
  { level: 2, free: coins(150), premium: kase("secret") },
  { level: 3, free: kase("secret"), premium: coins(600) },
  { level: 4, free: coins(200), premium: kase("sea", 2) },
  { level: 5, free: kase("lucky"), premium: rot("fragrama-and-chocrama") },
  { level: 6, free: coins(250), premium: coins(800) },
  { level: 7, free: coins(300), premium: kase("crystal") },
  { level: 8, free: kase("halloween"), premium: coins(1000) },
  { level: 9, free: coins(350), premium: kase("crystal", 2) },
  { level: 10, free: rot("draculino"), premium: rot("digi-narwhal") },
  { level: 11, free: coins(400), premium: coins(1200) },
  { level: 12, free: kase("lucky"), premium: kase("og") },
  { level: 13, free: coins(500), premium: coins(1500) },
  { level: 14, free: kase("halloween", 2), premium: kase("og", 2) },
  { level: 15, free: coins(1000), premium: rot("skibidi-toilet") },
]

export const MAX_LEVEL = LEVELS.length

/** Level reached with the given XP (0 = none yet), capped at the last level. */
export function levelFromXp(xp: number) {
  return Math.min(MAX_LEVEL, Math.floor(Math.max(0, xp) / XP_PER_LEVEL))
}

/** XP inside the current level, for the progress bar. */
export function xpIntoLevel(xp: number) {
  if (levelFromXp(xp) >= MAX_LEVEL) return XP_PER_LEVEL
  return Math.max(0, xp) % XP_PER_LEVEL
}

export function questProgress(q: BpQuest, stats: Stats) {
  const value = stats[q.stat] ?? 0
  return { value: Math.min(value, q.target), done: value >= q.target }
}

export type QuestCheck = "ok" | "not-done" | "claimed" | "unknown"

export function canClaimQuest(questId: string, stats: Stats, bp: BpState): QuestCheck {
  const q = QUESTS.find((x) => x.id === questId)
  if (!q) return "unknown"
  if (bp.quests.includes(questId)) return "claimed"
  return questProgress(q, stats).done ? "ok" : "not-done"
}

export type ClaimCheck = "ok" | "locked" | "not-reached" | "claimed" | "unknown"

export function canClaimLevel(track: TrackId, level: number, bp: BpState): ClaimCheck {
  if (!LEVELS.some((l) => l.level === level)) return "unknown"
  if (track === "premium" && !bp.premium) return "locked"
  if (bp.claimed[track].includes(level)) return "claimed"
  return levelFromXp(bp.xp) >= level ? "ok" : "not-reached"
}

export function canBuyPremium(balance: number, bp: BpState) {
  return !bp.premium && balance >= PREMIUM_PRICE
}

export function normalizeBp(raw: unknown): BpState {
  const r = (raw ?? {}) as Partial<BpState>
  const nums = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is number => typeof x === "number") : [])
  return {
    premium: Boolean(r.premium),
    xp: typeof r.xp === "number" && r.xp > 0 ? r.xp : 0,
    quests: Array.isArray(r.quests) ? r.quests.filter((x): x is string => typeof x === "string") : [],
    claimed: { free: nums(r.claimed?.free), premium: nums(r.claimed?.premium) },
  }
}
