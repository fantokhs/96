"use client";
// Original synthesized sound effects (WebAudio), no audio files or licences needed.
// An optional celebration track can be dropped at /public/audio/celebration.mp3.

export type SfxName =
  | "flip"
  | "tick"
  | "correct"
  | "wrong"
  | "steal"
  | "score"
  | "winner"
  | "buzz"
  | "tap"
  | "join"
  | "whoosh"
  | "drum"
  | "laugh"
  | "whistle"
  | "crackers";

const MUTE_KEY = "96:muted";

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private track: HTMLAudioElement | null = null;
  private trackChecked = false;
  muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.muted = localStorage.getItem(MUTE_KEY) === "1";
      } catch {}
    }
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.trackChecked) {
      this.trackChecked = true;
      fetch("/audio/celebration.mp3", { method: "HEAD" })
        .then((r) => {
          if (r.ok && (r.headers.get("content-type") ?? "").includes("audio")) {
            this.track = new Audio("/audio/celebration.mp3");
            this.track.preload = "auto";
          }
        })
        .catch(() => {});
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {}
    if (m && this.track) this.track.pause();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.3, slideTo?: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(start: number, dur: number, gain = 0.25, from = 800, to = 4000) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + start;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
  }

  /** vibrato on top of a held note */
  private wobble(freq: number, start: number, dur: number, depth = 12, rate = 7) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    lfo.frequency.value = rate;
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  }

  private drum(start: number, gain = 0.6) {
    this.tone(140, start, 0.25, "sine", gain, 45);
    this.noise(start, 0.08, gain * 0.3, 300, 900);
  }

  play(name: SfxName) {
    if (this.muted || !this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    switch (name) {
      case "tap":
        this.tone(660, 0, 0.07, "triangle", 0.18);
        break;
      case "tick":
        this.tone(1200, 0, 0.05, "square", 0.08);
        break;
      case "flip":
        this.noise(0, 0.28, 0.35, 600, 5000);
        this.tone(520, 0.18, 0.12, "triangle", 0.2, 880);
        break;
      case "whoosh":
        this.noise(0, 0.4, 0.3, 300, 3000);
        break;
      case "correct":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.28, "triangle", 0.28));
        this.tone(1568, 0.34, 0.4, "sine", 0.12);
        break;
      case "wrong":
        // "wah wah wah waaah" sad trombone
        [
          [392, 0, 0.26],
          [370, 0.28, 0.26],
          [349, 0.56, 0.26],
          [330, 0.84, 0.7],
        ].forEach(([f, t, d]) => {
          this.tone(f, t, d, "sawtooth", 0.14, f * 0.97);
          this.tone(f / 2, t, d, "triangle", 0.1);
        });
        this.wobble(330, 0.84, 0.7);
        break;
      case "steal":
        this.noise(0, 0.45, 0.4, 250, 6000);
        this.tone(200, 0, 0.35, "sawtooth", 0.12, 900);
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3 + i * 0.06, 0.2, "square", 0.12));
        break;
      case "laugh":
        // bouncy "ha-ha-ha-ha"
        [0, 0.16, 0.32, 0.48, 0.64].forEach((t, i) => {
          this.tone(620 - i * 40, t, 0.12, "sawtooth", 0.14, 480 - i * 40);
          this.noise(t, 0.08, 0.08, 800, 1600);
        });
        break;
      case "whistle":
        this.tone(1900, 0, 0.25, "sine", 0.22, 2300);
        this.tone(2300, 0.28, 0.5, "sine", 0.22, 2250);
        this.wobble(2250, 0.28, 0.5, 60, 30);
        break;
      case "crackers":
        for (let i = 0; i < 9; i++) {
          const t = i * 0.11 + Math.random() * 0.05;
          this.noise(t, 0.09, 0.45, 1500, 5000);
          this.tone(90, t, 0.08, "square", 0.2, 50);
        }
        break;
      case "score":
        this.tone(988, 0, 0.09, "square", 0.12);
        this.tone(1319, 0.09, 0.25, "square", 0.12);
        break;
      case "buzz":
        this.tone(880, 0, 0.12, "square", 0.25);
        this.tone(1175, 0.1, 0.25, "square", 0.25);
        break;
      case "join":
        this.tone(784, 0, 0.1, "sine", 0.18);
        this.tone(1175, 0.08, 0.18, "sine", 0.18);
        break;
      case "drum":
        this.drum(0);
        break;
      case "winner": {
        if (this.track) {
          this.track.currentTime = 0;
          void this.track.play().catch(() => {});
          break;
        }
        // Short original fanfare with an ardha-like drum pattern
        [0, 0.3, 0.45, 0.75, 1.05, 1.2].forEach((t) => this.drum(t, 0.5));
        const melody: [number, number, number][] = [
          [523, 0, 0.18], [523, 0.2, 0.18], [659, 0.4, 0.18], [784, 0.6, 0.35],
          [659, 1.0, 0.18], [784, 1.2, 0.18], [1047, 1.4, 0.8],
        ];
        melody.forEach(([f, t, d]) => {
          this.tone(f, t, d, "triangle", 0.25);
          this.tone(f / 2, t, d, "sine", 0.12);
        });
        break;
      }
    }
  }

  stopTrack() {
    this.track?.pause();
  }
}

export const sfx = typeof window !== "undefined" ? new Sfx() : (null as unknown as Sfx);
