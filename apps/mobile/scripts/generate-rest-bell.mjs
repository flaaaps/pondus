#!/usr/bin/env node
// Synthesises the rest-end bell (assets/sounds/rest-bell.wav). No samples, no third-party audio:
// additive synthesis of a small bell's partials, each with its own exponential decay, struck twice
// ("ding – ding") so it stands out over music. Own work, dedicated to the public domain (CC0), so no
// attribution or licence file is needed. Rerun after changing parameters:
//
//   node apps/mobile/scripts/generate-rest-bell.mjs
//
// Output: 44.1 kHz, 16-bit PCM, mono WAV (iOS notification sounds accept linear PCM in .wav, max 30 s).
import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const RATE = 44100
const LENGTH_S = 1.9
const STRIKE_FREQ = 880 // A5: bright enough to cut through music without being shrill
/** [frequency ratio, amplitude, decay time constant in s]. Inharmonic ratios as in a church/hand bell. */
const PARTIALS = [
  [0.5, 0.1, 1.4], // hum
  [1.0, 1.0, 1.1], // prime (strike tone)
  [1.002, 0.35, 1.1], // slightly detuned twin: slow shimmer
  [1.19, 0.3, 0.75], // minor third (tierce) gives the "bell" colour
  [1.5, 0.22, 0.55], // quint
  [2.0, 0.4, 0.45], // nominal
  [2.51, 0.16, 0.28],
  [2.66, 0.1, 0.24],
  [3.01, 0.08, 0.18],
  [4.1, 0.05, 0.1],
]
/** [start time in s, gain] of each strike. */
const STRIKES = [
  [0.0, 1.0],
  [0.42, 0.8],
]
const ATTACK_S = 0.003
const FADE_OUT_S = 0.15
const PEAK = 10 ** (-1 / 20) // normalise to -1 dBFS

const n = Math.round(RATE * LENGTH_S)
const samples = new Float64Array(n)
for (const [start, gain] of STRIKES) {
  const offset = Math.round(start * RATE)
  for (let i = offset; i < n; i++) {
    const t = (i - offset) / RATE
    const attack = t < ATTACK_S ? 0.5 - 0.5 * Math.cos((Math.PI * t) / ATTACK_S) : 1
    let v = 0
    for (const [ratio, amp, tau] of PARTIALS) v += amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * STRIKE_FREQ * ratio * t)
    samples[i] += gain * attack * v
  }
}
const fadeStart = n - Math.round(FADE_OUT_S * RATE)
for (let i = fadeStart; i < n; i++) samples[i] *= 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeStart)) / (n - fadeStart))

let max = 0
for (const s of samples) max = Math.max(max, Math.abs(s))
const pcm = Buffer.alloc(n * 2)
for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round((samples[i] / max) * PEAK * 32767), i * 2)

const header = Buffer.alloc(44)
header.write("RIFF", 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write("WAVE", 8)
header.write("fmt ", 12)
header.writeUInt32LE(16, 16) // fmt chunk size
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(1, 22) // mono
header.writeUInt32LE(RATE, 24)
header.writeUInt32LE(RATE * 2, 28) // byte rate
header.writeUInt16LE(2, 32) // block align
header.writeUInt16LE(16, 34) // bits per sample
header.write("data", 36)
header.writeUInt32LE(pcm.length, 40)

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/sounds/rest-bell.wav")
writeFileSync(out, Buffer.concat([header, pcm]))
console.log(`wrote ${out} (${LENGTH_S} s, ${((44 + pcm.length) / 1024).toFixed(0)} KB)`)
