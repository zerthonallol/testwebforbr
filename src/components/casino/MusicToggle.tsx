import { useEffect, useState } from "react"
import { Music, Music2 } from "lucide-react"
import { musicOn, setMusic, startMusic } from "@/lib/music"

/** Background music: starts on the first tap (browsers block autoplay), with an on/off button. */
export function MusicToggle() {
  const [on, setOn] = useState(true)

  useEffect(() => {
    const enabled = musicOn()
    setOn(enabled)
    if (!enabled) return
    const kick = () => startMusic()
    window.addEventListener("pointerdown", kick, { once: true })
    window.addEventListener("keydown", kick, { once: true })
    return () => {
      window.removeEventListener("pointerdown", kick)
      window.removeEventListener("keydown", kick)
    }
  }, [])

  return (
    <button
      type="button"
      className="bd-music-toggle"
      data-on={on}
      aria-label={on ? "Выключить музыку" : "Включить музыку"}
      onClick={() => {
        const next = !on
        setOn(next)
        setMusic(next)
      }}
    >
      {on ? <Music2 className="size-4" /> : <Music className="size-4" />}
    </button>
  )
}
