import { describe, expect, it } from "vitest"
import { EMPTY_BP, LEVELS, PREMIUM_PRICE, QUESTS, XP_PER_LEVEL, canBuyPremium, canClaimLevel, canClaimQuest, levelFromXp } from "@/data/battlepass"
import { BRAINROT_BY_ID } from "@/data/brainrots"
import { CASES } from "@/data/cases"

describe("battle pass", () => {
  it("premium costs 3000 coins", () => {
    expect(PREMIUM_PRICE).toBe(3000)
    expect(canBuyPremium(2999, EMPTY_BP)).toBe(false)
    expect(canBuyPremium(3000, EMPTY_BP)).toBe(true)
    expect(canBuyPremium(10_000, { ...EMPTY_BP, premium: true })).toBe(false)
  })

  it("quests only give XP", () => {
    for (const q of QUESTS) {
      expect(q.xp).toBeGreaterThan(0)
      expect(Object.keys(q).sort()).toEqual(["id", "stat", "target", "title", "xp"])
    }
  })

  it("a quest's XP can be collected once and only when done", () => {
    expect(canClaimQuest("q1", { cases: 2 }, EMPTY_BP)).toBe("not-done")
    expect(canClaimQuest("q1", { cases: 3 }, EMPTY_BP)).toBe("ok")
    expect(canClaimQuest("q1", { cases: 3 }, { ...EMPTY_BP, quests: ["q1"] })).toBe("claimed")
  })

  it("levels come from XP", () => {
    expect(levelFromXp(XP_PER_LEVEL - 1)).toBe(0)
    expect(levelFromXp(XP_PER_LEVEL)).toBe(1)
    expect(levelFromXp(XP_PER_LEVEL * 999)).toBe(LEVELS.length)
  })

  it("level rewards need the level, premium needs the pass", () => {
    const bp = { ...EMPTY_BP, xp: XP_PER_LEVEL * 2 }
    expect(canClaimLevel("free", 2, bp)).toBe("ok")
    expect(canClaimLevel("free", 3, bp)).toBe("not-reached")
    expect(canClaimLevel("premium", 1, bp)).toBe("locked")
    expect(canClaimLevel("premium", 1, { ...bp, premium: true })).toBe("ok")
    expect(canClaimLevel("free", 1, { ...bp, claimed: { free: [1], premium: [] } })).toBe("claimed")
  })

  it("every reward points at a real case or brainrot", () => {
    const caseIds = new Set(CASES.map((c) => c.id))
    for (const l of LEVELS)
      for (const r of [l.free, l.premium]) {
        if (r.kind === "case") expect(caseIds.has(r.caseId)).toBe(true)
        if (r.kind === "brainrot") expect(BRAINROT_BY_ID[r.id]).toBeDefined()
      }
  })
})
