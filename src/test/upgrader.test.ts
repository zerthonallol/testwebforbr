import { describe, expect, it } from "vitest"
import { PRESETS, pickForPreset, upgradeChance } from "@/data/upgrader"

const items = [100, 130, 200, 400, 800, 1000, 3000].map((price) => ({ price }))
const p = (id: string) => PRESETS.find((x) => x.id === id)!

describe("upgrader", () => {
  it("caps chance at 75%", () => {
    expect(upgradeChance(1000, 1001)).toBe(0.75)
  })
  it("x2 picks item at ~2x stake", () => {
    expect(pickForPreset(items, p("x2"), 100)?.price).toBe(200)
  })
  it("x10 picks item at ~10x stake", () => {
    expect(pickForPreset(items, p("x10"), 100)?.price).toBe(1000)
  })
  it("75% picks item giving the max chance", () => {
    const t = pickForPreset(items, p("c75"), 100)!
    expect(t.price).toBe(130)
    expect(upgradeChance(100, t.price)).toBeCloseTo(0.7308, 3)
  })
  it("never picks an item cheaper than the stake", () => {
    expect(pickForPreset(items, p("c75"), 3000)).toBeNull()
  })
})
