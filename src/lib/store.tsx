import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BRAINROT_BY_ID } from "@/data/brainrots"
import { TAG, type CaseDef, type Drop } from "@/data/cases"
import {
  DEMO_INVITED_FRIENDS,
  DEMO_USER,
  type DemoUser,
} from "@/data/fixtures"
import { initTelegram, tg } from "./telegram"
import { claimGrants, loadPlayer, myRequests, reportDrop, savePlayer, submitRequest } from "./player.functions"
import { toast } from "sonner"
import { getSettings } from "./owner.functions"
import { applyCaseConfig, applyPriceOverrides, initStreamer, useLive } from "./live"
import { play } from "./sound"
import { rollMutation, mutatedValue, type MutationId } from "@/data/mutations"
import { EMPTY_BP, LEVELS, PREMIUM_PRICE, QUESTS, canClaimLevel, canClaimQuest, normalizeBp, type BpReward, type BpState, type StatKey, type Stats, type TrackId } from "@/data/battlepass"

// New players start from zero: no coins, no brainrots.
export const START_BALANCE = 0
const LS_KEY = "brainrotdrop:state:v2"
const SAVE_EVERY_MS = 5000

interface SavedState {
  balance: number
  inventory: InvItem[]
  requests: TransferRequest[]
  cooldowns: Record<string, number>
  freeCases?: Record<string, number>
  stats?: Stats
  bp?: BpState
  savedAt: number
}

export interface InvItem {
  uid: string
  brainrotId: string
  obtainedAt: number
  status: "owned" | "withdrawing"
  mutation?: MutationId
}

export function itemValue(i: InvItem) {
  return mutatedValue(BRAINROT_BY_ID[i.brainrotId]?.price ?? 0, i.mutation)
}

export interface Announcement {
  id: string
  text: string
  by: number | null
}

export type DropSource = "Кейс" | "Апгрейд" | "Crash" | "Dice"

export interface TransferRequest {
  id: string
  type: "deposit" | "withdraw"
  brainrotId: string
  robloxNick: string
  creditAs?: "coins" | "brainrot"
  itemUid?: string
  adminReply?: string | null
  status: "pending" | "approved" | "rejected"
  createdAt: number
}

interface Store {
  user: DemoUser
  inTelegram: boolean
  balance: number
  inventory: InvItem[]
  requests: TransferRequest[]
  invitedFriends: number
  cooldowns: Record<string, number>
  hasTag: boolean
  canAfford: (n: number) => boolean
  spend: (n: number) => boolean
  credit: (n: number) => void
  grant: (d: Drop, opts?: { mutate?: boolean; source?: DropSource }) => InvItem | null
  freeCases: Record<string, number>
  consumeFreeCase: (caseId: string) => boolean
  tradeItem: (uid: string, brainrotId: string) => void
  announcement: Announcement | null
  refreshSettings: () => Promise<void>
  priceVersion: number
  removeItems: (uids: string[]) => void
  sellItem: (uid: string) => void
  claimCase: (c: CaseDef) => void
  caseReadyAt: (c: CaseDef) => number
  requestDeposit: (brainrotId: string, robloxNick: string, creditAs: "coins" | "brainrot") => void
  requestWithdraw: (uid: string, robloxNick: string) => void
  stats: Stats
  bp: BpState
  track: (stat: StatKey, n?: number) => void
  buyPremium: () => boolean
  claimBp: (track: TrackId, level: number) => BpReward | null
  claimQuest: (questId: string) => number
}

// Keep one context across hot reloads so the provider and consumers always match.
const g = globalThis as { __bdStoreCtx?: import("react").Context<Store | null> }
const Ctx = (g.__bdStoreCtx ??= createContext<Store | null>(null))
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser>(DEMO_USER)
  const [inTelegram, setInTelegram] = useState(false)
  const [balance, setBalance] = useState(START_BALANCE)
  const [inventory, setInventory] = useState<InvItem[]>([])
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})
  const [freeCases, setFreeCases] = useState<Record<string, number>>({})
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [stats, setStats] = useState<Stats>({})
  const [bp, setBp] = useState<BpState>(EMPTY_BP)
  const { priceVersion } = useLive()

  const refreshSettings = useCallback(async () => {
    try {
      const s = await getSettings()
      applyPriceOverrides(s.priceOverrides)
      applyCaseConfig(s.caseOverrides ?? {})
      setAnnouncement(s.announcement && s.announcementId ? { id: s.announcementId, text: s.announcement, by: s.announcementBy } : null)
    } catch (e) {
      console.error("getSettings failed", e)
    }
  }, [])

  useEffect(() => {
    initStreamer()
    refreshSettings()
    const t = setInterval(refreshSettings, 30_000)
    return () => clearInterval(t)
  }, [refreshSettings])

  useEffect(() => {
    // telegram-web-app.js may finish loading after hydration, so retry briefly.
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const u = initTelegram()
      if (u) {
        setInTelegram(true)
        setUser({ id: u.id, firstName: u.first_name, lastName: u.last_name, username: u.username, photoUrl: u.photo_url })
      } else if (!window.Telegram && tries++ < 30) {
        timer = setTimeout(attempt, 100)
      }
    }
    attempt()
    return () => clearTimeout(timer)
  }, [])

  // ---- persistence: restore once, then autosave every 5s and when the app is hidden ----
  const [loaded, setLoaded] = useState(false)
  const apply = useCallback((st: Partial<SavedState> | null | undefined) => {
    if (!st) return
    if (typeof st.balance === "number") setBalance(st.balance)
    if (Array.isArray(st.inventory)) setInventory(st.inventory.filter((i) => BRAINROT_BY_ID[i.brainrotId]))
    if (Array.isArray(st.requests)) setRequests(st.requests)
    if (st.cooldowns && typeof st.cooldowns === "object") setCooldowns(st.cooldowns)
    if (st.freeCases && typeof st.freeCases === "object") setFreeCases(st.freeCases)
    if (st.stats && typeof st.stats === "object") setStats(st.stats)
    if (st.bp) setBp(normalizeBp(st.bp))
  }, [])

  useEffect(() => {
    let local: SavedState | null = null
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) local = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    apply(local)
    let cancelled = false
    const waitTg = async () => {
      for (let i = 0; i < 30 && !tg(); i++) await new Promise((r) => setTimeout(r, 100))
      const app = tg()
      if (!app) return
      try {
        const res = await loadPlayer({ data: { initData: app.initData } })
        const remote = (res.state ? JSON.parse(res.state) : null) as Partial<SavedState> | null
        if (!cancelled && remote && (remote.savedAt ?? 0) >= (local?.savedAt ?? 0)) apply(remote)
      } catch (e) {
        console.error("loadPlayer failed", e)
      }
    }
    waitTg().finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [apply])

  const snapshot = useRef<SavedState | null>(null)
  snapshot.current = { balance, inventory, requests, cooldowns, freeCases, stats, bp, savedAt: Date.now() }
  const lastSent = useRef("")

  const persistRef = useRef<() => void>(() => {})
  const persist = useCallback(() => {
    const st = snapshot.current
    if (!st) return
    const body = JSON.stringify({ ...st, savedAt: 0 })
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(st))
    } catch {
      /* ignore */
    }
    if (body === lastSent.current) return
    const app = tg()
    if (!app) return
    lastSent.current = body
    savePlayer({ data: { initData: app.initData, state: st as unknown as Record<string, unknown> } }).catch((e) => {
      lastSent.current = ""
      console.error("savePlayer failed", e)
    })
  }, [])

  persistRef.current = persist
  useEffect(() => {
    if (!loaded) return
    const t = setInterval(persist, SAVE_EVERY_MS)
    const onHide = () => document.visibilityState === "hidden" && persist()
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", persist)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", persist)
    }
  }, [loaded, persist])

  // Deposit/withdraw requests live on the server; pull admin decisions and apply them once.
  const requestsRef = useRef(requests)
  requestsRef.current = requests
  const syncRequests = useCallback(async (initData: string) => {
    const remote = await myRequests({ data: { initData } })
    const byId = new Map(remote.map((r) => [r.clientId, r]))
    const local = requestsRef.current
    // Re-send pending requests the server never received (e.g. sent while offline).
    for (const r of local) {
      if (r.status === "pending" && !byId.has(r.id)) {
        submitRequest({
          data: { initData, clientId: r.id, type: r.type, brainrotId: r.brainrotId, brainrotName: BRAINROT_BY_ID[r.brainrotId]?.name ?? r.brainrotId, robloxNick: r.robloxNick, creditAs: r.creditAs ?? null },
        }).catch(() => {})
      }
    }
    let changed = false
    const next = local.map((r) => {
      const s = byId.get(r.id)
      if (!s) return r
      const reply = s.reply ?? null
      if (reply && reply !== (r.adminReply ?? null)) {
        changed = true
        toast.message("Ответ администратора", { description: reply })
        play("alert")
      }
      if (r.status !== "pending" || s.status === "pending") return reply !== (r.adminReply ?? null) ? { ...r, adminReply: reply } : r
      changed = true
      const name = BRAINROT_BY_ID[r.brainrotId]?.name ?? "брейнрот"
      if (s.status === "approved") {
        play("win")
        if (r.type === "deposit") {
          if (r.creditAs === "coins") setBalance((b) => b + (BRAINROT_BY_ID[r.brainrotId]?.price ?? 0))
          else if (BRAINROT_BY_ID[r.brainrotId]) setInventory((inv) => [{ uid: uid(), brainrotId: r.brainrotId, obtainedAt: Date.now(), status: "owned" }, ...inv])
          toast.success(`Депозит ${name} одобрен`)
        } else {
          setInventory((inv) => {
            const idx = inv.findIndex((i) => (r.itemUid ? i.uid === r.itemUid : i.brainrotId === r.brainrotId && i.status === "withdrawing"))
            return idx < 0 ? inv : inv.filter((_, k) => k !== idx)
          })
          toast.success(`Вывод ${name} одобрен`)
        }
      } else {
        play("lose")
        if (r.type === "withdraw") {
          setInventory((inv) => {
            const idx = inv.findIndex((i) => (r.itemUid ? i.uid === r.itemUid : i.brainrotId === r.brainrotId && i.status === "withdrawing"))
            return idx < 0 ? inv : inv.map((i, k) => (k === idx ? { ...i, status: "owned" } : i))
          })
        }
        toast.error(`Заявка на ${r.type === "deposit" ? "депозит" : "вывод"} ${name} отклонена`)
      }
      return { ...r, status: s.status, adminReply: reply }
    })
    if (changed) {
      requestsRef.current = next
      setRequests(next)
      setTimeout(() => persistRef.current(), 300)
    }
  }, [])

  // Developer gifts (coins / cases) are queued server-side and claimed here.
  useEffect(() => {
    if (!loaded) return
    let stop = false
    const pull = async () => {
      const app = tg()
      if (!app || stop) return
      try {
        const grants = await claimGrants({ data: { initData: app.initData } })
        for (const g of grants) {
          if (g.kind === "coins") {
            setBalance((b) => b + g.amount)
            toast.success(`Разработчик выдал тебе ${g.amount.toLocaleString("ru-RU")} монет`)
          } else if (g.kind === "brainrot" && g.brainrotId && BRAINROT_BY_ID[g.brainrotId]) {
            const bid = g.brainrotId
            const items: InvItem[] = Array.from({ length: Math.min(100, g.amount) }, () => ({ uid: uid(), brainrotId: bid, obtainedAt: Date.now(), status: "owned" }))
            setInventory((inv) => [...items, ...inv])
            toast.success(`Разработчик выдал тебе ${BRAINROT_BY_ID[bid].name}${g.amount > 1 ? ` ×${g.amount}` : ""}`)
          } else if (g.caseId) {
            const id = g.caseId
            setFreeCases((fc) => ({ ...fc, [id]: (fc[id] ?? 0) + g.amount }))
            toast.success(`Разработчик выдал тебе кейс ×${g.amount}`)
          }
        }
        if (grants.length) {
          play("coin")
          setTimeout(() => persistRef.current(), 300)
        }
        await syncRequests(app.initData)
      } catch (e) {
        console.error("claimGrants failed", e)
      }
    }
    pull()
    const t = setInterval(pull, 15_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [loaded, syncRequests])

  const freeCasesRef = useRef(freeCases)
  freeCasesRef.current = freeCases
  const consumeFreeCase = useCallback((caseId: string) => {
    if ((freeCasesRef.current[caseId] ?? 0) <= 0) return false
    freeCasesRef.current = { ...freeCasesRef.current, [caseId]: freeCasesRef.current[caseId] - 1 }
    setFreeCases(freeCasesRef.current)
    return true
  }, [])

  const hasTag = `${user.firstName} ${user.lastName ?? ""}`.toLowerCase().includes(TAG)

  // Ref mirrors balance so rapid consecutive bets can't overspend between renders.
  const balanceRef = useRef(balance)
  balanceRef.current = balance
  const track = useCallback((stat: StatKey, n = 1) => {
    if (n <= 0) return
    setStats((s) => ({ ...s, [stat]: (s[stat] ?? 0) + n }))
  }, [])

  const spend = useCallback(
    (n: number) => {
      if (n <= 0 || balanceRef.current < n) return false
      balanceRef.current -= n
      setBalance((b) => b - n)
      track("spent", n)
      return true
    },
    [track],
  )

  const credit = useCallback((n: number) => setBalance((b) => b + n), [])

  const grant = useCallback((d: Drop, opts?: { mutate?: boolean; source?: DropSource }) => {
    if (d.kind === "brainrot" && opts?.source) {
      const app = tg()
      if (app) reportDrop({ data: { initData: app.initData, brainrotId: d.id, source: opts.source } }).catch(() => {})
    }
    if (d.kind === "coins") {
      setBalance((b) => b + d.amount)
      return null
    }
    const mutation = opts?.mutate ? rollMutation() : undefined
    track("brainrots")
    if (mutation) track("mutations")
    const item: InvItem = { uid: uid(), brainrotId: d.id, obtainedAt: Date.now(), status: "owned", ...(mutation ? { mutation } : {}) }
    setInventory((inv) => [item, ...inv])
    return item
  }, [track])

  const removeItems = useCallback((uids: string[]) => {
    setInventory((inv) => inv.filter((i) => !uids.includes(i.uid)))
  }, [])

  const sellItem = useCallback(
    (id: string) => {
      const it = inventory.find((i) => i.uid === id && i.status === "owned")
      if (!it || it.mutation) return
      setInventory((inv) => inv.filter((i) => i.uid !== id))
      setBalance((b) => b + (BRAINROT_BY_ID[it.brainrotId]?.price ?? 0))
    },
    [inventory],
  )

  const caseReadyAt = useCallback(
    (c: CaseDef) => {
      const last = cooldowns[c.id]
      if (!last || !c.cooldownHours) return 0
      return last + c.cooldownHours * 3600_000
    },
    [cooldowns],
  )

  const claimCase = useCallback((c: CaseDef) => {
    setCooldowns((cd) => ({ ...cd, [c.id]: Date.now() }))
  }, [])

  const sendRequest = useCallback((r: TransferRequest) => {
    const app = tg()
    if (!app) return
    submitRequest({
      data: { initData: app.initData, clientId: r.id, type: r.type, brainrotId: r.brainrotId, brainrotName: BRAINROT_BY_ID[r.brainrotId]?.name ?? r.brainrotId, robloxNick: r.robloxNick, creditAs: r.creditAs ?? null },
    }).catch((e) => console.error("submitRequest failed", e))
    setTimeout(() => persistRef.current(), 300)
  }, [])

  const requestDeposit = useCallback((brainrotId: string, robloxNick: string, creditAs: "coins" | "brainrot") => {
    const req: TransferRequest = { id: uid(), type: "deposit", brainrotId, robloxNick, creditAs, status: "pending", createdAt: Date.now() }
    setRequests((r) => [req, ...r])
    sendRequest(req)
  }, [sendRequest])

  const requestWithdraw = useCallback(
    (itemUid: string, robloxNick: string) => {
      const it = inventory.find((i) => i.uid === itemUid && i.status === "owned")
      if (!it || it.mutation) return
      setInventory((inv) => inv.map((i) => (i.uid === itemUid ? { ...i, status: "withdrawing" } : i)))
      const req: TransferRequest = { id: uid(), type: "withdraw", brainrotId: it.brainrotId, robloxNick, itemUid, status: "pending", createdAt: Date.now() }
      setRequests((r) => [req, ...r])
      sendRequest(req)
    },
    [inventory, sendRequest],
  )

  const tradeItem = useCallback((itemUid: string, brainrotId: string) => {
    setInventory((inv) =>
      inv.map((i) =>
        i.uid === itemUid && i.mutation && i.status === "owned" && BRAINROT_BY_ID[brainrotId]
          ? { uid: uid(), brainrotId, obtainedAt: Date.now(), status: "owned" }
          : i,
      ),
    )
  }, [])

  const statsRef = useRef(stats)
  statsRef.current = stats
  const bpRef = useRef(bp)
  bpRef.current = bp

  // Buying the pass is not counted as "spent" so it can't complete spend quests by itself.
  const buyPremium = useCallback(() => {
    if (bpRef.current.premium || balanceRef.current < PREMIUM_PRICE) return false
    balanceRef.current -= PREMIUM_PRICE
    setBalance((b) => b - PREMIUM_PRICE)
    const next = { ...bpRef.current, premium: true }
    bpRef.current = next
    setBp(next)
    setTimeout(() => persistRef.current(), 300)
    return true
  }, [])

  const claimQuest = useCallback((questId: string) => {
    if (canClaimQuest(questId, statsRef.current, bpRef.current) !== "ok") return 0
    const q = QUESTS.find((x) => x.id === questId)
    if (!q) return 0
    const next = { ...bpRef.current, xp: bpRef.current.xp + q.xp, quests: [...bpRef.current.quests, questId] }
    bpRef.current = next
    setBp(next)
    setTimeout(() => persistRef.current(), 300)
    return q.xp
  }, [])

  const claimBp = useCallback((trackId: TrackId, level: number) => {
    if (canClaimLevel(trackId, level, bpRef.current) !== "ok") return null
    const lvl = LEVELS.find((l) => l.level === level)
    if (!lvl) return null
    const next = { ...bpRef.current, claimed: { ...bpRef.current.claimed, [trackId]: [...bpRef.current.claimed[trackId], level] } }
    bpRef.current = next
    setBp(next)
    const r = lvl[trackId]
    if (r.kind === "coins") setBalance((b) => b + r.amount)
    else if (r.kind === "case") setFreeCases((fc) => ({ ...fc, [r.caseId]: (fc[r.caseId] ?? 0) + r.amount }))
    else if (BRAINROT_BY_ID[r.id]) setInventory((inv) => [{ uid: uid(), brainrotId: r.id, obtainedAt: Date.now(), status: "owned" }, ...inv])
    setTimeout(() => persistRef.current(), 300)
    return r
  }, [])

  const value = useMemo<Store>(
    () => ({
      user,
      inTelegram,
      balance,
      inventory,
      requests,
      invitedFriends: DEMO_INVITED_FRIENDS,
      cooldowns,
      hasTag,
      canAfford: (n) => balance >= n,
      spend,
      credit,
      grant,
      removeItems,
      sellItem,
      claimCase,
      caseReadyAt,
      requestDeposit,
      requestWithdraw,
      tradeItem,
      freeCases,
      consumeFreeCase,
      announcement,
      refreshSettings,
      priceVersion,
      stats,
      bp,
      track,
      buyPremium,
      claimBp,
      claimQuest,
    }),
    [stats, bp, track, buyPremium, claimBp, claimQuest, tradeItem, freeCases, consumeFreeCase, announcement, refreshSettings, priceVersion, user, inTelegram, balance, inventory, requests, cooldowns, hasTag, spend, credit, grant, removeItems, sellItem, claimCase, caseReadyAt, requestDeposit, requestWithdraw],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error("useStore must be used inside StoreProvider")
  return s
}
