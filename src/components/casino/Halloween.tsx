import { useEffect, useMemo, useState } from "react"
import { Ghost, Skull } from "lucide-react"
import bg from "@/assets/halloween-bg.jpg"

/** Fixed decorative layer: bats, embers and drifting fog. */
export function HalloweenFX() {
  const embers = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (i * 53) % 100,
        delay: (i * 0.73) % 9,
        dur: 9 + ((i * 1.7) % 7),
        size: 3 + (i % 4),
      })),
    [],
  )
  return (
    <div className="hw-fx" aria-hidden>
      <div className="hw-fog hw-fog-1" />
      <div className="hw-fog hw-fog-2" />
      {embers.map((e, i) => (
        <span
          key={i}
          className="hw-ember"
          style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s`, width: e.size, height: e.size }}
        />
      ))}
      <span className="hw-fly hw-fly-1">🦇</span>
      <span className="hw-fly hw-fly-2">🦇</span>
      <span className="hw-fly hw-fly-3">🦇</span>
    </div>
  )
}

const EVENT_END = new Date("2026-11-01T00:00:00+03:00").getTime()

function useCountdown() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (now === null) return null
  const left = Math.max(0, EVENT_END - now)
  const d = Math.floor(left / 86_400_000)
  const h = Math.floor((left / 3_600_000) % 24)
  const m = Math.floor((left / 60_000) % 60)
  const s = Math.floor((left / 1000) % 60)
  return { d, h, m, s, over: left === 0 }
}

/** «Укради брейнрот» Halloween event banner. */
export function HalloweenEvent({ onPlay }: { onPlay: () => void }) {
  const c = useCountdown()
  const cells = c ? [
    [c.d, "дн"],
    [c.h, "ч"],
    [c.m, "мин"],
    [c.s, "сек"],
  ] : []
  return (
    <div className="hw-event">
      <img src={bg} alt="" className="hw-event-bg" width={1280} height={768} />
      <div className="hw-event-shade" />
      <div className="relative z-10">
        <div className="hw-event-chip">
          <Ghost className="size-3.5" /> Хеллуинский ивент
        </div>
        <h2 className="hw-event-title mt-2 font-heading">
          Укради
          <br />
          <span>брейнрот</span>
        </h2>
        <p className="mt-1.5 max-w-[17rem] text-[12px] leading-snug text-white/75">
          Пробирайся в жуткие базы, открывай хеллуинские кейсы и уноси самых редких брейнротов, пока луна полная.
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          {c && !c.over
            ? cells.map(([v, l]) => (
                <div key={l} className="hw-count">
                  <b>{String(v).padStart(2, "0")}</b>
                  <span>{l}</span>
                </div>
              ))
            : <div className="h-11" />}
        </div>
        <button type="button" onClick={onPlay} className="bd-btn hw-steal mt-3 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          <Skull className="size-4" /> Красть брейнротов
        </button>
      </div>
    </div>
  )
}
