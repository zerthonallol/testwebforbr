// Soft looping chiptune "music box" for the whole site (Web Audio, no files).
const LS = "brainrotdrop:music"

let ctx: AudioContext | null = null
let out: GainNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let nextAt = 0
let step = 0

export function musicOn() {
  try {
    return localStorage.getItem(LS) !== "0"
  } catch {
    return true
  }
}

// A minor pentatonic-ish progression: Am - F - C - G
const CHORDS = [
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [48, 52, 55, 60],
  [55, 59, 62, 67],
]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]
const MELODY = [76, -1, 74, 72, -1, 69, 72, -1, 72, -1, 69, 67, -1, 64, 67, -1, 67, -1, 69, 72, -1, 74, 72, -1, 71, -1, 67, 69, -1, -1, -1, -1]
const STEP = 0.24

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const c = ctx!
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out!)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function schedule() {
  const c = ctx!
  while (nextAt < c.currentTime + 0.6) {
    const bar = Math.floor(step / 8) % CHORDS.length
    const chord = CHORDS[bar]
    note(hz(chord[ARP[step % 8]]), nextAt, 0.5, "triangle", 0.18)
    if (step % 8 === 0) note(hz(chord[0] - 12), nextAt, STEP * 7.5, "sine", 0.22)
    const m = MELODY[step % MELODY.length]
    if (m > 0) note(hz(m), nextAt, 0.35, "square", 0.035)
    nextAt += STEP
    step++
  }
}

export function startMusic() {
  if (typeof window === "undefined" || timer) return
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return
  if (!ctx) {
    ctx = new C()
    out = ctx.createGain()
    out.connect(ctx.destination)
  }
  void ctx.resume()
  out!.gain.cancelScheduledValues(ctx.currentTime)
  out!.gain.setValueAtTime(0.0001, ctx.currentTime)
  out!.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 2)
  nextAt = ctx.currentTime + 0.1
  timer = setInterval(schedule, 150)
  schedule()
}

export function stopMusic() {
  if (timer) clearInterval(timer)
  timer = null
  if (ctx && out) {
    const t = ctx.currentTime
    out.gain.cancelScheduledValues(t)
    out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t)
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  }
}

export function setMusic(on: boolean) {
  try {
    localStorage.setItem(LS, on ? "1" : "0")
  } catch {
    /* ignore */
  }
  if (on) startMusic()
  else stopMusic()
}
