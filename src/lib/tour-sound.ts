// Synthesized sounds for the animated Meowl tour (Web Audio + speech, no files).
import { isMuted } from "@/lib/sound"

let ctx: AudioContext | null = null
let out: GainNode | null = null
let ambient: { stop: () => void } | null = null

function ac() {
  if (typeof window === "undefined" || isMuted()) return null
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
    out = ctx.createGain()
    out.gain.value = 0.4
    out.connect(ctx.destination)
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Cartoon "meow": a sawtooth through a sweeping band-pass, pitch rises then falls. */
export function meow(pitch = 1) {
  const c = ac()
  if (!c || !out) return
  const t = c.currentTime
  const o = c.createOscillator()
  const f = c.createBiquadFilter()
  const g = c.createGain()
  o.type = "sawtooth"
  o.frequency.setValueAtTime(520 * pitch, t)
  o.frequency.exponentialRampToValueAtTime(980 * pitch, t + 0.16)
  o.frequency.exponentialRampToValueAtTime(430 * pitch, t + 0.55)
  f.type = "bandpass"
  f.Q.value = 6
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.18)
  f.frequency.exponentialRampToValueAtTime(700, t + 0.55)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
  o.connect(f).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.65)
}

/** Short typewriter blip while Meowl "talks". */
export function blip() {
  const c = ac()
  if (!c || !out) return
  const t = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = "square"
  o.frequency.value = 620 + Math.random() * 260
  g.gain.setValueAtTime(0.05, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.06)
}

/** Airy whoosh between steps. */
export function whoosh() {
  const c = ac()
  if (!c || !out) return
  const t = c.currentTime
  const len = Math.floor(c.sampleRate * 0.4)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const s = c.createBufferSource()
  const f = c.createBiquadFilter()
  const g = c.createGain()
  s.buffer = buf
  f.type = "bandpass"
  f.frequency.setValueAtTime(400, t)
  f.frequency.exponentialRampToValueAtTime(3000, t + 0.35)
  g.gain.value = 0.35
  s.connect(f).connect(g).connect(out)
  s.start(t)
}

/** Low spooky pad that loops while the tour is open. */
export function startAmbient() {
  const c = ac()
  if (!c || !out || ambient) return
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 1.5)
  const lfo = c.createOscillator()
  const lfoG = c.createGain()
  lfo.frequency.value = 0.2
  lfoG.gain.value = 6
  const oscs = [110, 110 * 1.19, 164.8].map((fr, i) => {
    const o = c.createOscillator()
    o.type = i === 2 ? "triangle" : "sine"
    o.frequency.value = fr
    o.detune.value = i * 7
    lfo.connect(lfoG).connect(o.detune)
    o.connect(g)
    o.start()
    return o
  })
  lfo.start()
  g.connect(out)
  ambient = {
    stop: () => {
      const t = c.currentTime
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      oscs.forEach((o) => o.stop(t + 0.55))
      lfo.stop(t + 0.55)
    },
  }
}

export function stopAmbient() {
  ambient?.stop()
  ambient = null
}

/** Meowl reads the line aloud with a high cartoon voice. */
export function speak(text: string) {
  if (typeof window === "undefined" || isMuted() || !("speechSynthesis" in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "ru-RU"
    u.pitch = 1.7
    u.rate = 1.08
    u.volume = 0.9
    const ru = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("ru"))
    if (ru) u.voice = ru
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

export function hush() {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ignore */
  }
}
