// Upgrader odds and quick-pick presets. Pure functions so rules are testable.
export const HOUSE = 0.95
export const MAX_CHANCE = 0.75

export function upgradeChance(inputValue: number, targetPrice: number) {
  if (inputValue <= 0 || targetPrice <= 0) return 0
  return Math.min(MAX_CHANCE, (inputValue / targetPrice) * HOUSE)
}

export type Preset = { id: string; label: string; kind: "mult" | "chance"; value: number }

export const PRESETS: Preset[] = [
  { id: "x2", label: "x2", kind: "mult", value: 2 },
  { id: "x4", label: "x4", kind: "mult", value: 4 },
  { id: "x8", label: "x8", kind: "mult", value: 8 },
  { id: "x10", label: "x10", kind: "mult", value: 10 },
  { id: "c75", label: "75%", kind: "chance", value: 0.75 },
  { id: "c50", label: "50%", kind: "chance", value: 0.5 },
  { id: "c25", label: "25%", kind: "chance", value: 0.25 },
]

/** Ideal target price for a preset given the staked value. */
export function presetTargetPrice(p: Preset, inputValue: number) {
  return p.kind === "mult" ? inputValue * p.value : (inputValue * HOUSE) / p.value
}

/** Picks the brainrot (priced above the stake) whose price is closest (log scale) to the preset's ideal price. */
export function pickForPreset<T extends { price: number }>(items: T[], p: Preset, inputValue: number): T | null {
  if (inputValue <= 0) return null
  const ideal = presetTargetPrice(p, inputValue)
  let best: T | null = null
  let bestDist = Infinity
  for (const it of items) {
    if (it.price <= inputValue) continue
    const d = Math.abs(Math.log(it.price / ideal))
    if (d < bestDist) {
      bestDist = d
      best = it
    }
  }
  return best
}
