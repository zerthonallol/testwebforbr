import { describe, expect, it } from "vitest"
import { CASES, baseEntries, buildEntries } from "@/data/cases"

describe("case overrides", () => {
  const base = baseEntries("dragon")

  it("tag case is gone and dragon case exists", () => {
    expect(CASES.some((c) => c.id === "tag")).toBe(false)
    expect(CASES.some((c) => c.id === "dragon")).toBe(true)
  })

  it("pinned chance is used exactly and total stays 100%", () => {
    const out = buildEntries(base, { chances: { "b:dragon-cannelloni": 10 } })
    const dc = out.find((e) => e.drop.kind === "brainrot" && e.drop.id === "dragon-cannelloni")
    expect(dc?.weight).toBeCloseTo(0.1, 6)
    expect(out.reduce((a, e) => a + e.weight, 0)).toBeCloseTo(1, 6)
  })

  it("adds and removes brainrots", () => {
    const out = buildEntries(base, { add: ["skibidi-toilet"], remove: ["phoenix"] })
    const ids = out.map((e) => (e.drop.kind === "brainrot" ? e.drop.id : ""))
    expect(ids).toContain("skibidi-toilet")
    expect(ids).not.toContain("phoenix")
  })
})
