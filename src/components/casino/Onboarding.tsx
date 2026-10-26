import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Box, Coins, Ellipsis, Ghost, Package, Rocket, Skull, Ticket, TrendingUp, Volume2, VolumeX, X } from "lucide-react"
import meowl from "@/assets/meowl-halloween.png"
import { haptic } from "@/lib/telegram"
import { isMuted, setMuted } from "@/lib/sound"
import { blip, hush, meow, stopAmbient, whoosh } from "@/lib/tour-sound"
import { cn } from "@/lib/utils"

/** Tabs the tour can jump to. Kept loose so the shell owns the real tab list. */
export type TourTarget = "cases" | "battlepass" | "upgrade" | "dice" | "crash" | "profile"

type Pose = "wave" | "jump" | "spin" | "peek" | "shake" | "float"

type Step = {
  icon: typeof Box
  accent: string
  pose: Pose
  title: string
  text: string
  tips: string[]
  target?: TourTarget
  cta?: string
}

const STEPS: Step[] = [
  {
    icon: Ghost,
    accent: "#ff8a1f",
    pose: "wave",
    title: "Мяу-у! Я Meowl",
    text: "Добро пожаловать в BrainrotRoll! Сегодня Хеллуин — будем красть брейнротов. Я всё покажу.",
    tips: ["Кнопка слева сверху открывает меню со всеми разделами", "Обучение можно открыть снова в меню"],
  },
  {
    icon: Coins,
    accent: "#ffc83d",
    pose: "jump",
    title: "Монеты",
    text: "Баланс всегда вверху справа. На монеты открываешь кейсы и делаешь ставки.",
    tips: ["Нажми «+» рядом с балансом, чтобы пополнить через админа", "Монеты — валюта сайта, не реальные деньги"],
    target: "profile",
    cta: "Открыть профиль",
  },
  {
    icon: Box,
    accent: "#b14bff",
    pose: "peek",
    title: "Кейсы",
    text: "Выбери кейс, посмотри, что внутри и с каким шансом, и крути. Хеллуинский кейс — главный в ивенте!",
    tips: ["Начни с бесплатного кейса — он открывается по таймеру", "Чем дороже кейс, тем жутче брейнроты внутри"],
    target: "cases",
    cta: "К кейсам",
  },
  {
    icon: Package,
    accent: "#4ff0a0",
    pose: "float",
    title: "Твоя добыча",
    text: "Всё, что украл, лежит в профиле. Брейнрота можно продать за монеты или вывести в Roblox.",
    tips: ["Продавай дубли, чтобы открыть кейс подороже", "Вывод в Roblox идёт через админа"],
    target: "profile",
    cta: "Мой инвентарь",
  },
  {
    icon: TrendingUp,
    accent: "#ff4f6d",
    pose: "spin",
    title: "Апгрейдер",
    text: "Поставь брейнрота и попробуй превратить его в более дорогого. Чем больше прирост, тем меньше шанс.",
    tips: ["Новичкам лучше брать шанс 50% и выше"],
    target: "upgrade",
    cta: "Попробовать",
  },
  {
    icon: Rocket,
    accent: "#ff8a1f",
    pose: "shake",
    title: "Crash и Dice",
    text: "В Crash забирай выигрыш, пока ракета не взорвалась. В Dice выбирай шанс и бросай кубик.",
    tips: ["Начинай с маленьких ставок", "Не гонись за проигрышем — это просто игра"],
    target: "dice",
    cta: "Бросить кубик",
  },
  {
    icon: Ticket,
    accent: "#4ff0a0",
    pose: "jump",
    title: "Батл пасс",
    text: "Выполняй квесты, качай уровень и забирай награды. Всё, удачной охоты, вор!",
    tips: ["Заглядывай каждый день — квесты обновляются"],
    target: "battlepass",
    cta: "Открыть батл пасс",
  },
]

function useTypewriter(text: string, sound: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    let i = 0
    const t = setInterval(() => {
      i++
      setN(i)
      if (sound && i % 2 === 0 && /[\p{L}]/u.test(text[i] ?? "")) blip(text[i])
      if (i >= text.length) clearInterval(t)
    }, 24)
    return () => clearInterval(t)
  }, [text, sound])
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) }
}

export function Onboarding({ onClose, onGo }: { onClose: () => void; onGo: (t: TourTarget) => void }) {
  const [i, setI] = useState(0)
  const [sound, setSound] = useState(() => !isMuted())
  const touch = useRef<number | null>(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const Icon = step.icon
  const { shown, done, skip } = useTypewriter(step.text, sound)

  // Ambient + meow + voice on each step.
  useEffect(() => {
    if (!sound) {
      stopAmbient()
      hush()
      return
    }
    return () => undefined
  }, [sound])
  useEffect(() => {
    if (!sound) return
    meow(1 + (i % 3) * 0.08)
  }, [i, sound])
  useEffect(
    () => () => {
      stopAmbient()
      hush()
    },
    [],
  )

  const close = () => {
    stopAmbient()
    hush()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "ArrowRight") move(1)
      if (e.key === "ArrowLeft") move(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const move = (d: number) => {
    haptic()
    setI((v) => {
      const n = Math.min(STEPS.length - 1, Math.max(0, v + d))
      if (n !== v && sound) whoosh()
      return n
    })
  }

  const toggleSound = () => {
    const next = !sound
    setMuted(!next)
    setSound(next)
  }

  return (
    <div className="bd-tour-backdrop" onClick={close}>
      <div className="hw-tour-fog" aria-hidden />
      <div
        className="bd-tour hw-tour"
        role="dialog"
        aria-label="Обучение"
        style={{ ["--tour" as string]: step.accent }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1)
        }}
      >
        <div className="absolute left-3 top-3 z-20 flex gap-1.5">
          <button type="button" onClick={toggleSound} className="bd-tour-close !static" aria-label={sound ? "Выключить звук" : "Включить звук"}>
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
        <button type="button" onClick={close} className="bd-tour-close" aria-label="Закрыть обучение">
          <X className="size-4" />
        </button>

        <div className="hw-stage">
          <span className="hw-stage-moon" />
          <span className="hw-stage-glow" />
          <span className="hw-bat hw-bat-a" aria-hidden>🦇</span>
          <span className="hw-bat hw-bat-b" aria-hidden>🦇</span>
          <span className="hw-stage-pumpkin" aria-hidden>🎃</span>
          <span className="hw-stage-skull" aria-hidden>
            <Skull className="size-4" />
          </span>
          <div className="hw-meowl-wrap" key={`m${i}`} data-pose={step.pose}>
            <div className="hw-meowl-body" data-talking={!done}>
              <div className="hw-meowl-face">
                <img src={meowl} alt="Meowl" className="hw-meowl" draggable={false} />
                <span className="hw-eyelid hw-eyelid-l" aria-hidden />
                <span className="hw-eyelid hw-eyelid-r" aria-hidden />
                <span className="hw-mouth" aria-hidden />
              </div>
            </div>
            <span className="hw-meowl-shadow" />
          </div>
          <span className="hw-stage-icon" key={`i${i}`}>
            <Icon className="size-5" strokeWidth={2.5} />
          </span>
        </div>

        <div className="hw-bubble" key={`b${i}`} onClick={skip}>
          <div className="bd-tour-step">
            Шаг {i + 1} из {STEPS.length}
          </div>
          <h2 className="mt-1 font-heading text-[21px] font-extrabold leading-tight">{step.title}</h2>
          <p className="mt-2 min-h-[3.6em] text-[13px] leading-relaxed text-white/80">
            {shown}
            {!done && <span className="hw-caret" />}
          </p>
        </div>

        <ul className={cn("mt-3 space-y-1.5 transition-opacity duration-500", done ? "opacity-100" : "opacity-0")}>
          {step.tips.map((t, n) => (
            <li key={t} className="bd-tour-tip hw-tip" style={{ animationDelay: `${n * 90}ms` }}>
              {t}
            </li>
          ))}
        </ul>
        {step.target && step.cta && (
          <button
            type="button"
            className="bd-tour-link"
            onClick={() => {
              haptic()
              close()
              onGo(step.target!)
            }}
          >
            {step.cta} <ArrowRight className="size-3.5" />
          </button>
        )}

        <div className="bd-tour-dots" aria-hidden>
          {STEPS.map((s, n) => (
            <button key={s.title + n} type="button" tabIndex={-1} data-active={n === i} data-done={n < i} onClick={() => setI(n)} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {i > 0 ? (
            <button type="button" onClick={() => move(-1)} className="bd-btn-ghost grid size-12 shrink-0 place-items-center" aria-label="Назад">
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <button type="button" onClick={close} className="bd-btn-ghost h-12 shrink-0 px-4 text-xs font-bold text-white/60">
              Пропустить
            </button>
          )}
          <button type="button" onClick={() => (last ? close() : move(1))} className="bd-btn flex h-12 flex-1 items-center justify-center gap-2 text-sm">
            {last ? (
              <>
                Красть брейнротов! <Ellipsis className="size-4" />
              </>
            ) : (
              <>
                Дальше <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
