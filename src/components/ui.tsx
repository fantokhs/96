"use client";
import { QRCodeSVG } from "qrcode.react";
import type { CSSProperties, ReactNode } from "react";
import type { Outcome, PatternId, PublicPlayer, Team, Timer } from "@/lib/game/types";
import { useCountdown } from "@/lib/client/useGame";
import { patternBg } from "./patterns";

export const APP_VERSION = "V1.3";

/** Official "خيمة الفنتوخ" logo (includes its own subtitle). `size` ≈ visual height / 1.4. */
export function Logo96({ size = 64 }: { size?: number; sub?: boolean }) {
  const h = Math.round(size * 1.4);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/game-logo.webp"
      alt="خيمة الفنتوخ"
      width={Math.round(h * (900 / 708))}
      height={h}
      className="select-none"
      style={{ height: h, width: "auto", filter: "drop-shadow(0 6px 18px rgba(0,0,0,.35))" }}
      draggable={false}
    />
  );
}

export const THEME_LABEL = "اليوم الوطني 96";

export function Star({ size = 16, color = "#d6a63a" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <g fill={color}>
        <rect x="6" y="6" width="12" height="12" />
        <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
      </g>
      <circle cx="12" cy="12" r="3" fill="#072a1d" />
    </svg>
  );
}

// ─── Avatars & characters ───────────────────────────────────────────────────

export function Avatar({
  player,
  color,
  size = 48,
  ring = true,
}: {
  player: Pick<PublicPlayer, "name" | "avatarUrl">;
  color: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 ${Math.max(2, size / 16)}px ${color}` : undefined,
        background: color,
      }}
    >
      {player.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ fontSize: size * 0.42 }}
        >
          {player.name.trim().slice(0, 1)}
        </span>
      )}
    </div>
  );
}

export type CharacterAction = "idle" | "dance" | "jump" | "shake" | "fall" | "sad";

/**
 * A simple Saudi character: the player's face on a small illustrated body.
 * Bodies are keyed by gender so richer artwork can be swapped in later.
 */
export function Character({
  player,
  color,
  action = "idle",
  size = 120,
  showName = true,
  delay = 0,
}: {
  player: PublicPlayer;
  color: string;
  action?: CharacterAction;
  size?: number;
  showName?: boolean;
  delay?: number;
}) {
  const w = size;
  const h = size * 1.5;
  const face = size * 0.46;
  const cls = action === "idle" ? "" : `act-${action}`;
  return (
    <div className="flex flex-col items-center" style={{ width: w }}>
      <div className={`relative ${cls}`} style={{ width: w, height: h, animationDelay: `${delay}ms` }}>
        <svg viewBox="0 0 100 150" width={w} height={h} className="absolute inset-0" aria-hidden>
          <defs>
            <pattern id="shemagh" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#f4f1ea" />
              <path d="M0 0h3v3H0zM3 3h3v3H3z" fill="#c8102e" />
            </pattern>
          </defs>
          {player.gender === "male" && (
            <>
              <path d="M17 44 Q18 9 50 9 Q82 9 83 44 L92 92 L50 80 L8 92 Z" fill="url(#shemagh)" />
              <path d="M22 150 L28 80 Q50 68 72 80 L78 150 Z" fill="#f6f3ea" />
              <path d="M50 76 V112" stroke="#d8d1c0" strokeWidth="1.5" />
              <circle cx="50" cy="86" r="1.6" fill="#b9ae96" />
              <circle cx="50" cy="94" r="1.6" fill="#b9ae96" />
            </>
          )}
          {player.gender === "female" && (
            <>
              <path d="M18 46 Q18 7 50 7 Q82 7 82 46 L86 88 L14 88 Z" fill="#1d1d22" />
              <path d="M22 44 Q22 12 50 12 Q78 12 78 44" fill="none" stroke={color} strokeWidth="3" opacity=".9" />
              <path d="M20 150 L27 82 Q50 70 73 82 L80 150 Z" fill="#18181c" />
              <path d="M27 82 L20 150 M73 82 L80 150" stroke="#d6a63a" strokeWidth="2.2" />
              <path d="M36 104 Q50 110 64 104" stroke={color} strokeWidth="3" fill="none" />
            </>
          )}
          {!player.gender && (
            <>
              <path d="M22 150 L28 80 Q50 68 72 80 L78 150 Z" fill={color} />
              <path d="M28 80 Q50 92 72 80" stroke="rgba(255,255,255,.4)" strokeWidth="2" fill="none" />
            </>
          )}
        </svg>
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: size * 0.14 }}>
          <Avatar player={player} color={color} size={face} ring={!player.gender} />
        </div>
        {player.gender === "male" && (
          <svg viewBox="0 0 100 150" width={w} height={h} className="pointer-events-none absolute inset-0" aria-hidden>
            <ellipse cx="50" cy="17" rx="23" ry="5" fill="none" stroke="#111" strokeWidth="3.5" />
            <ellipse cx="50" cy="21" rx="24" ry="5" fill="none" stroke="#111" strokeWidth="3.5" />
          </svg>
        )}
        {action === "sad" && (
          <span className="absolute -top-2 left-0 anim-pop" style={{ fontSize: size * 0.28 }}>
            💧
          </span>
        )}
        {action === "dance" && player.gender === "male" && (
          <span className="absolute -top-4 right-0 anim-toss" style={{ fontSize: size * 0.25 }}>
            🎉
          </span>
        )}
      </div>
      {showName && (
        <span
          className="mt-1 max-w-full truncate rounded-full px-2 text-center font-semibold"
          style={{ fontSize: Math.max(12, size * 0.14), background: `${color}33` }}
        >
          {player.name}
        </span>
      )}
    </div>
  );
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export function CardBack({
  color,
  pattern,
  label,
  big = false,
}: {
  color: string;
  pattern: PatternId;
  label?: ReactNode;
  big?: boolean;
}) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded-[1.1rem]"
      style={{
        backgroundColor: color,
        backgroundImage: `${patternBg(pattern)}, linear-gradient(160deg, rgba(255,255,255,.18), rgba(0,0,0,.25))`,
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,.25), 0 14px 30px rgba(0,0,0,.35)",
      }}
    >
      <div className="absolute inset-[7%] rounded-[0.8rem] border-2 border-white/35" />
      <div
        className="relative flex items-center justify-center rounded-full bg-deep/85 font-bold text-goldlight shadow-lg"
        style={{ width: big ? "42%" : "46%", aspectRatio: "1", fontSize: big ? "3.4vmin" : "clamp(18px, 4vmin, 56px)" }}
      >
        {label}
      </div>
    </div>
  );
}

const OUTCOME_MARK: Record<Outcome, { t: string; c: string }> = {
  correct: { t: "✓", c: "#22A06B" },
  steal: { t: "⚡", c: "#D6A63A" },
  wrong: { t: "✕", c: "#d9534f" },
  skipped: { t: "–", c: "#8a8a8a" },
};

export function UsedCard({ outcome }: { outcome: Outcome | null }) {
  const m = outcome ? OUTCOME_MARK[outcome] : OUTCOME_MARK.skipped;
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[1.1rem] border-2 border-dashed border-cream/15 bg-ink/40">
      <span className="font-bold" style={{ color: m.c, fontSize: "clamp(22px,5vmin,64px)" }}>
        {m.t}
      </span>
    </div>
  );
}

// ─── Timer ──────────────────────────────────────────────────────────────────

export function TimerRing({
  timer,
  now,
  size = 120,
  color = "#d6a63a",
}: {
  timer: Timer;
  now: () => number;
  size?: number;
  color?: string;
}) {
  const { left, fraction } = useCountdown(timer, now);
  const r = 44;
  const c = 2 * Math.PI * r;
  const danger = left <= 5 && !timer.stopped;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} stroke="rgba(246,240,225,.12)" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={danger ? "#d9534f" : color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
      </svg>
      <span
        className={`num absolute inset-0 flex items-center justify-center font-bold ${danger ? "text-[#ff8a85]" : ""}`}
        style={{ fontSize: size * 0.38 }}
      >
        {left}
      </span>
    </div>
  );
}

// ─── Teams / scores ─────────────────────────────────────────────────────────

export function TeamBadge({ team, style, className = "" }: { team: Team; style?: CSSProperties; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-bold ${className}`}
      style={{ background: `${team.color}2e`, color: "#f6f0e1", boxShadow: `inset 0 0 0 1.5px ${team.color}`, ...style }}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
      {team.name}
    </span>
  );
}

export function QR({ value, size = 220 }: { value: string; size?: number }) {
  return (
    <div className="rounded-2xl bg-cream p-3 shadow-xl">
      <QRCodeSVG value={value} size={size} bgColor="#f6f0e1" fgColor="#072a1d" level="M" />
    </div>
  );
}

export function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="bg-majlis flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo96 size={72} />
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

export function Spinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-cream/15 border-t-gold" aria-label="جارٍ التحميل" />
  );
}

export function teamById(teams: Team[], id: string | null | undefined): Team | undefined {
  return teams.find((t) => t.id === id);
}

export const OPTION_LETTERS = ["أ", "ب", "ج", "د"];
