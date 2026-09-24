"use client";
import { PALETTE } from "./patterns";

type ConfettiFn = typeof import("canvas-confetti");
let loader: Promise<ConfettiFn> | null = null;
const load = () => (loader ??= import("canvas-confetti").then((m) => (m.default ?? m) as ConfettiFn));

const COLORS = [...PALETTE, "#f6f0e1", "#ffffff"];

export function confettiBurst(strength = 1) {
  void load().then((confetti) => {
    confetti({ particleCount: Math.round(90 * strength), spread: 75, startVelocity: 48, origin: { y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
    setTimeout(
      () => confetti({ particleCount: Math.round(50 * strength), angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors: COLORS }),
      150,
    );
    setTimeout(
      () => confetti({ particleCount: Math.round(50 * strength), angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors: COLORS }),
      300,
    );
  });
}

/** Fireworks-like bursts for a few seconds. Returns a stop function. */
export function fireworks(durationMs = 6000): () => void {
  let stopped = false;
  const end = Date.now() + durationMs;
  void load().then((confetti) => {
    const shoot = () => {
      if (stopped || Date.now() > end) return;
      confetti({
        particleCount: 60,
        startVelocity: 32,
        spread: 360,
        ticks: 80,
        gravity: 0.9,
        scalar: 1.1,
        origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 },
        colors: COLORS,
        disableForReducedMotion: true,
      });
      setTimeout(shoot, 380 + Math.random() * 300);
    };
    shoot();
  });
  return () => {
    stopped = true;
  };
}
