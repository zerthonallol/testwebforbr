// Tiny synthesized sound kit (Web Audio, no files). Plays on game events only —
// plain button presses stay silent on purpose.
type Kind = "start" | "tick" | "win" | "bigwin" | "lose" | "alert" | "coin"

let ctx: AudioContext | null = null
let master: GainNode | null = null
const LS_MUTE = "brainrotdrop:mute"

function ac() {
  if (typeof window === "undefined") return null
  if (isMuted()) return null
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

export function isMuted() {
  try {
    return localStorage.getItem(LS_MUTE) === "1"
  } catch {
    return false
  }
}

export function setMuted(on: boolean) {
  try {
    localStorage.setItem(LS_MUTE, on ? "1" : "0")
  } catch {
    /* ignore */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.5, slideTo?: number) {
  const c = ctx!
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g).connect(master!)
  o.start(start)
  o.stop(start + dur + 0.02)
}

export function play(kind: Kind) {
  const c = ac()
  if (!c) return
  const t = c.currentTime
  switch (kind) {
    case "start":
      tone(220, t, 0.25, "sawtooth", 0.18, 660)
      tone(440, t + 0.05, 0.2, "triangle", 0.2, 880)
      break
    case "tick":
      tone(1400 + Math.random() * 200, t, 0.035, "square", 0.08)
      break
    case "coin":
      tone(988, t, 0.08, "square", 0.15)
      tone(1319, t + 0.07, 0.18, "square", 0.15)
      break
    case "win":
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.22, "triangle", 0.35))
      break
    case "bigwin":
      ;[523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.3, "triangle", 0.4))
      tone(2093, t + 0.45, 0.6, "sine", 0.25)
      break
    case "lose":
      tone(392, t, 0.18, "sawtooth", 0.2, 330)
      tone(294, t + 0.16, 0.35, "sawtooth", 0.2, 196)
      break
    case "alert":
      tone(880, t, 0.12, "sine", 0.3)
      tone(1175, t + 0.13, 0.2, "sine", 0.3)
      break
  }
}
