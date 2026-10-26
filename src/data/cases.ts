import { BRAINROTS, BRAINROT_BY_ID, type Brainrot, type Tier } from "./brainrots"

export type Drop =
  | { kind: "coins"; amount: number }
  | { kind: "brainrot"; id: string }

export interface CaseEntry {
  drop: Drop
  weight: number
}

export type CaseKind = "free" | "tag" | "referral" | "paid"

export interface CaseDef {
  id: string
  name: string
  subtitle: string
  kind: CaseKind
  price: number
  cooldownHours?: number
  accent: string
  cover: string
  entries: CaseEntry[]
}

export const TAG = "@brainrotdroppbot"

export function dropValue(d: Drop) {
  return d.kind === "coins" ? d.amount : (BRAINROT_BY_ID[d.id]?.price ?? 0)
}

const byTier = (...tiers: Tier[]) => BRAINROTS.filter((b) => tiers.includes(b.tier))
const byIds = (ids: string[]) => ids.map((id) => BRAINROT_BY_ID[id]).filter(Boolean)
const byCats = (cats: string[]) => BRAINROTS.filter((b) => b.obtain.some((o) => cats.includes(o)))

const coins = (amount: number): Drop => ({ kind: "coins", amount })
const rot = (b: Brainrot): Drop => ({ kind: "brainrot", id: b.id })

// Weights proportional to value^-k, with k found by bisection so the case returns
// `rtp` of its price on average. Cheap drops are common, jackpots stay rare.
function balance(drops: Drop[], price: number, rtp = 0.92): CaseEntry[] {
  const values = drops.map(dropValue)
  const target = price * rtp
  const ev = (k: number) => {
    const w = values.map((v) => Math.pow(v, -k))
    const sum = w.reduce((a, b) => a + b, 0)
    return values.reduce((acc, v, i) => acc + (v * w[i]) / sum, 0)
  }
  let lo = 0
  let hi = 12
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (ev(mid) > target) lo = mid
    else hi = mid
  }
  const k = (lo + hi) / 2
  const raw = values.map((v) => Math.pow(v, -k))
  const sum = raw.reduce((a, b) => a + b, 0)
  return drops.map((drop, i) => ({ drop, weight: raw[i] / sum }))
}

// Fixed split between a coin group and a brainrot group (used by bonus cases).
function split(coinDrops: number[], coinShare: number, rots: Brainrot[]): CaseEntry[] {
  const coinW = coinShare / coinDrops.length
  const inv = rots.map((r) => 1 / r.price)
  const invSum = inv.reduce((a, b) => a + b, 0)
  return [
    ...coinDrops.map((a) => ({ drop: coins(a), weight: coinW })),
    ...rots.map((r, i) => ({ drop: rot(r), weight: (1 - coinShare) * (inv[i] / invSum) })),
  ]
}

// Case covers: Steal a Brainrot styled chests, each with a star brainrot of the case on top.
const art = (name: string) => `/img/cases/${name}-v2.webp`

// Paid case price sits between the cheapest drop and the average drop value, then
// balance() tunes weights to 92% RTP — so rarer brainrots inside are always rarer to hit.
function paid(id: string, name: string, subtitle: string, accent: string, coverImg: string, rots: Brainrot[]): CaseDef {
  const vals = rots.map((r) => r.price)
  const min = Math.min(...vals)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const price = Math.max(49, Math.round(Math.sqrt(min * mean) / 10) * 10 - 1)
  const coin = Math.max(10, Math.round((price * 0.35) / 5) * 5)
  return { id, name, subtitle, kind: "paid", price, accent, cover: coverImg, entries: balance([coins(coin), ...rots.map(rot)], price) }
}

const HALLOWEEN = ["la-spooky-grande", "mieteteira-bicicleteira", "oni-oni-panda", "eviledon", "boo-boo-rocket", "sammyni-spookyni", "spooky-and-pumpky", "flying-dutchman", "plant-bros", "dragon-skeletonini", "phoenix", "headless-horseman", "bat-in-the-box", "skelly-and-coffy", "medusini-and-demonini", "draculino", "la-casa-boo", "cerberus", "guest-666"]
const SEA = ["tralaledon", "los-primos", "eviledon", "orcaledon", "fishino-clownino", "capitano-moby", "jelly-moby", "digi-narwhal", "dragon-aquanini", "abyssaloco", "moby-bros", "hydra-serpent", "capitano-gullini", "chicleteira-surfeiteira"]
const CRYSTAL = ["nachorilla", "pretzo-robo", "grabatron", "la-fuse-machine", "bumbatron", "celestial-pegasus", "digi-narwhal", "arcadragon", "rubrikiko", "griffin", "phoenix", "orchidox", "hydra-dragon-cannelloni"]
const CHRISTMAS = ["los-candies", "money-money-reindeer", "la-jolly-grande", "festive-67", "ginger-gerat", "la-ginger-sekolah", "reinito-sleighito", "cooki-and-milki", "chicleteira-noelteira", "chimnino", "yetimatic"]
const SPRING = ["churrito-bunnito", "hopilikalika-hopilikalako", "la-easter-grande", "quackini-snackini", "boppin-bunny", "bunny-and-eggy", "hydra-bunny", "lovin-rose", "la-romantic-grande", "rosetti-tualetti", "love-love-bear", "rosey-and-teddy", "chicleteira-cupideira", "gold-gold-gold", "cloverat-clapat", "fortunu-and-cashuru"]
const DRAGON = ["dragon-cannelloni", "hydra-dragon-cannelloni", "dragon-skeletonini", "arcadragon", "dragon-aquanini", "los-dragons", "phoenix", "lavamanta", "cerberus", "griffin", "chillin-chili", "los-chillis"]
const FOOD = ["burguro-and-fryuro", "pancake-and-syrup", "popcuru-and-fizzuru", "la-breakfast-combinasion", "los-tacoritas", "ketchuru-and-musturu", "pizza-and-ranch", "la-food-combinasion", "fragrama-and-chocrama", "spaghetti-tualetti", "los-spaghettis", "quackini-snackini", "nacho-spyder", "la-taco-combinasion", "cooki-and-milki", "chipso-and-queso", "nachorilla", "tacoturbo-tacorito", "pretzo-robo"]
// Every "Los ..." squad brainrot.
const byLos = () => BRAINROTS.filter((b) => b.name.startsWith("Los "))
const SUMMER = ["capitano-gullini", "los-fruits", "sand-sand-sand", "coco-and-mango", "venuspino", "dragon-aquanini", "honey-honey-bear", "pop-pop-petalini", "queen-bee", "s-more-serat", "bumbatron", "orchidox", "la-summer-grande"]

export const CASES: CaseDef[] = [
  {
    id: "free",
    name: "Бесплатный",
    subtitle: "Раз в 24 часа · шанс на Secret брейнрота",
    kind: "free",
    price: 0,
    cooldownHours: 24,
    accent: "#22c55e",
    cover: art("free"),
    entries: split([5, 10, 15, 25, 40], 0.97, byTier("rare")),
  },
  {
    id: "referral",
    name: "Реферальный",
    subtitle: "Пригласи друга · раз в 12 ч",
    kind: "referral",
    price: 0,
    cooldownHours: 12,
    accent: "#f472b6",
    cover: art("referral"),
    entries: split([30, 60, 100, 150, 200], 0.75, byTier("rare", "epic")),
  },
  paid("secret", "Секретный", "Обычные Secret брейнроты", "#38bdf8", art("secret"), byTier("rare")),
  paid("lucky", "Лаки Кэтч", "Secret + редкие", "#a855f7", art("lucky"), byTier("rare", "epic")),
  paid("sea", "Морская братва", "Акулы, рыбы и капитаны", "#0ea5e9", art("sea"), byIds(SEA)),
  paid("halloween", "Хеллуин", "Тыквы, скелеты и призраки", "#f97316", art("halloween"), byIds(HALLOWEEN)),
  paid("christmas", "Рождество", "Новогодние брейнроты", "#ef4444", art("christmas"), byIds(CHRISTMAS)),
  paid("spring", "Весна и любовь", "Пасха, Валентин и Патрик", "#f9a8d4", art("spring"), byIds(SPRING)),
  paid("summer", "Лето и пчёлы", "Солнце, фрукты и мёд", "#facc15", art("summer"), byIds(SUMMER)),
  paid("crystal", "Кристальный", "Роботы, драконы и небесные", "#22d3ee", art("crystal"), byIds(CRYSTAL)),
  paid("admin", "Админ Абуз", "Только с Admin Abuse ивентов", "#dc2626", art("admin"), byCats(["Admin Abuse"])),
  paid("dragon", "Драгон", "Лава, огонь и драконы", "#f97316", art("dragon"), byIds(DRAGON)),
  paid("og", "OG Легенды", "Эксклюзивы и OG", "#f472b6", art("og"), byTier("mythic", "og")),
  paid("food", "Фуд-корт", "Бургеры, тако и спагетти", "#fb923c", art("food"), byIds(FOOD)),
  paid("los", "Лос Банда", "Вся семейка Los", "#2dd4bf", art("los"), byLos()),
]

// ---- Owner overrides: custom chances and extra brainrots per case ----

export interface CaseOverride {
  /** Fixed chance in percent per drop key ("b:<id>" or "c:<amount>"). Other drops share the rest. */
  chances?: Record<string, number>
  /** Extra brainrot ids added to the case. */
  add?: string[]
  /** Brainrot ids removed from the case. */
  remove?: string[]
}

export const dropKey = (d: Drop) => (d.kind === "coins" ? `c:${d.amount}` : `b:${d.id}`)

/** Builds the final entries of a case from its base entries and an owner override. Weights sum to 1. */
export function buildEntries(base: CaseEntry[], o: CaseOverride | undefined): CaseEntry[] {
  if (!o) return base
  const removed = new Set(o.remove ?? [])
  let list = base.filter((e) => !(e.drop.kind === "brainrot" && removed.has(e.drop.id)))
  const have = new Set(list.map((e) => dropKey(e.drop)))
  const minW = list.length ? Math.min(...list.map((e) => e.weight)) : 1
  for (const id of o.add ?? []) {
    if (!BRAINROT_BY_ID[id] || have.has(`b:${id}`) || removed.has(id)) continue
    have.add(`b:${id}`)
    list = [...list, { drop: rot(BRAINROT_BY_ID[id]), weight: minW }]
  }
  if (!list.length) return base
  const chances = o.chances ?? {}
  const fixed = list.filter((e) => typeof chances[dropKey(e.drop)] === "number")
  const fixedSum = Math.min(1, fixed.reduce((a, e) => a + Math.max(0, chances[dropKey(e.drop)]) / 100, 0))
  const free = list.filter((e) => typeof chances[dropKey(e.drop)] !== "number")
  const freeSum = free.reduce((a, e) => a + e.weight, 0)
  const rest = 1 - fixedSum
  const out = list.map((e) => {
    const c = chances[dropKey(e.drop)]
    if (typeof c === "number") return { drop: e.drop, weight: Math.max(0, c) / 100 }
    return { drop: e.drop, weight: freeSum > 0 ? (e.weight / freeSum) * rest : 0 }
  })
  const total = out.reduce((a, e) => a + e.weight, 0)
  return total > 0 ? out.map((e) => ({ ...e, weight: e.weight / total })) : base
}

const BASE_ENTRIES: Record<string, CaseEntry[]> = Object.fromEntries(CASES.map((c) => [c.id, c.entries]))

export function baseEntries(caseId: string) {
  return BASE_ENTRIES[caseId] ?? []
}

/** Applies owner overrides to every case in place. Returns true when something changed. */
export function applyCaseOverrides(map: Record<string, CaseOverride>) {
  let changed = false
  for (const c of CASES) {
    const next = buildEntries(BASE_ENTRIES[c.id], map[c.id])
    if (JSON.stringify(next) !== JSON.stringify(c.entries)) {
      c.entries = next
      changed = true
    }
  }
  return changed
}

export function rollCase(c: CaseDef): Drop {
  let r = Math.random()
  for (const e of c.entries) {
    r -= e.weight
    if (r <= 0) return e.drop
  }
  return c.entries[c.entries.length - 1].drop
}

export function sortedEntries(c: CaseDef) {
  return [...c.entries].sort((a, b) => dropValue(b.drop) - dropValue(a.drop))
}
