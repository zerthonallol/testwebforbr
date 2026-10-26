import { describe, expect, it } from "vitest"

import { REQUIRED_CHANNEL, REQUIRED_CHANNEL_URL, isSubscribedMember } from "@/lib/subscription-rules"

describe("free case channel gate", () => {
  it("requires the BrainrotDroptgk channel", () => {
    expect(REQUIRED_CHANNEL).toBe("@BrainrotDroptgk")
    expect(REQUIRED_CHANNEL_URL).toBe("https://t.me/BrainrotDroptgk")
  })

  it("counts channel owners, admins and members as subscribed", () => {
    for (const status of ["creator", "administrator", "member"]) {
      expect(isSubscribedMember(status)).toBe(true)
    }
  })

  it("does not count users who left or were kicked", () => {
    expect(isSubscribedMember("left")).toBe(false)
    expect(isSubscribedMember("kicked")).toBe(false)
    expect(isSubscribedMember("")).toBe(false)
    expect(isSubscribedMember(undefined)).toBe(false)
  })

  it("counts a restricted user only while Telegram still reports them as a member", () => {
    expect(isSubscribedMember("restricted", true)).toBe(true)
    expect(isSubscribedMember("restricted", false)).toBe(false)
    expect(isSubscribedMember("restricted")).toBe(false)
  })
})
