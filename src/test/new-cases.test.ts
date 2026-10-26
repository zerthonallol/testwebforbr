import { describe, expect, it } from "vitest"
import { CASES } from "@/data/cases"
import { BRAINROT_BY_ID } from "@/data/brainrots"

const byId = (id: string) => CASES.find((c) => c.id === id)

describe("new cases", () => {
  it("adds the Фуд-корт and Лос Банда cases as paid cases", () => {
    expect(byId("food")?.kind).toBe("paid")
    expect(byId("los")?.kind).toBe("paid")
  })

  it("fills Лос Банда only with Los brainrots", () => {
    const ids = byId("los")!.entries.flatMap((e) => (e.drop.kind === "brainrot" ? [e.drop.id] : []))
    expect(ids.length).toBeGreaterThan(5)
    for (const id of ids) expect(BRAINROT_BY_ID[id].name.startsWith("Los ")).toBe(true)
  })

  it("only references existing brainrots in Фуд-корт", () => {
    const ids = byId("food")!.entries.flatMap((e) => (e.drop.kind === "brainrot" ? [e.drop.id] : []))
    expect(ids.length).toBeGreaterThan(5)
    for (const id of ids) expect(BRAINROT_BY_ID[id]).toBeDefined()
  })

  it("every case uses a redrawn cover", () => {
    for (const c of CASES) expect(c.cover).toMatch(/^\/img\/cases\/[a-z]+-v2\.webp$/)
  })
})
