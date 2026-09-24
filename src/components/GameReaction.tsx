"use client";
// Short, funny reaction overlay derived from the RESULT / GAME_OVER state.
// Purely client-side: nothing is stored; it unmounts as soon as the phase moves on.
import { useEffect, useMemo, useState } from "react";
import type { PublicPlayer, Team } from "@/lib/game/types";
import { confettiBurst } from "./effects";
import { Character } from "./ui";

export type ReactionKind = "correct" | "wrong" | "steal" | "skipped";

const CORRECT_STYLES = ["dance", "hype", "fly", "spin", "jump"] as const;
const WRONG_STYLES = ["wall", "fall", "shake", "shrink"] as const;
type Style = (typeof CORRECT_STYLES)[number] | (typeof WRONG_STYLES)[number] | "slidein" | "still";

const CORRECT_LINES = ["كفو!", "إجابة صحيحة!", "صح عليك!", "ما شاء الله!"];
const HYPE_LINES = ["يا سلام!", "كفو!"];
const WRONG_LINES = ["يا ساتر!", "راحت عليك", "قريبة!", "ركز شوي"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

// Avoid showing the same animation twice in a row on this device.
let lastStyle: Style | null = null;

function pickStyle(kind: ReactionKind, seed: string): Style {
  if (kind === "steal") return "slidein";
  if (kind === "skipped") return "still";
  const list: readonly Style[] = kind === "correct" ? CORRECT_STYLES : WRONG_STYLES;
  let s = list[hash(seed) % list.length];
  if (s === lastStyle) s = list[(list.indexOf(s) + 1) % list.length];
  lastStyle = s;
  return s;
}

export function GameReaction({
  kind,
  seed,
  players,
  team,
  points,
  answer,
  surface = "tv",
  durationMs = 2800,
}: {
  kind: ReactionKind;
  /** stable per result (e.g. question id) so TV and phones pick consistently */
  seed: string;
  players: PublicPlayer[];
  team: Team;
  points: number;
  answer?: string;
  surface?: "tv" | "phone";
  durationMs?: number;
}) {
  const style = useMemo(() => pickStyle(kind, seed), [kind, seed]);
  const title = useMemo(() => {
    const h = hash(seed + "t");
    if (kind === "steal") return "سرقوها!";
    if (kind === "skipped") return "تم التخطي";
    if (kind === "wrong") return WRONG_LINES[h % WRONG_LINES.length];
    if (style === "hype") return HYPE_LINES[h % HYPE_LINES.length];
    return CORRECT_LINES[h % CORRECT_LINES.length];
  }, [kind, seed, style]);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => setShow(false), durationMs)];
    const strength = surface === "phone" ? 0.5 : 1;
    if (kind === "correct") {
      confettiBurst(strength);
      if (style === "spin") timers.push(setTimeout(() => confettiBurst(strength), 1000));
    }
    if (kind === "steal") {
      timers.push(setTimeout(() => confettiBurst(1.4 * strength), 350));
      timers.push(setTimeout(() => confettiBurst(strength), 1100));
    }
    return () => timers.forEach(clearTimeout);
  }, [kind, style, surface, durationMs]);

  if (!show) return null;
  const tv = surface === "tv";
  const good = kind === "correct" || kind === "steal";
  const shown = players.slice(0, tv ? 5 : 1);
  const charSize = tv ? Math.round(window.innerHeight * (shown.length > 3 ? 0.17 : 0.22)) : 150;

  return (
    <div
      className={`anim-fade ${tv ? "absolute" : "fixed"} inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-ink/75 backdrop-blur-[2px] ${
        kind === "steal" ? "rx-screenshake" : ""
      }`}
      style={{ gap: tv ? "3vmin" : 16 }}
    >
      <div className="anim-stamp text-center" style={{ animationDelay: kind === "steal" ? "300ms" : undefined }}>
        <div
          className={`font-black leading-none ${good ? "text-goldlight" : "text-cream"}`}
          style={{ fontSize: tv ? (kind === "steal" ? "13vmin" : "10vmin") : 44 }}
        >
          {title}
        </div>
        {good && points > 0 && (
          <div className="num mt-[1vmin] font-black" style={{ color: team.color, fontSize: tv ? "9vmin" : 40 }}>
            +{points}
          </div>
        )}
      </div>

      {shown.length > 0 && kind !== "skipped" && (
        <div className="flex items-end justify-center" style={{ gap: tv ? "3vmin" : 12 }}>
          {shown.map((p, i) => (
            <div
              key={p.id}
              className={`rx-${style}`}
              style={{ animationDelay: `${style === "slidein" ? i * 90 : i * 120}ms` }}
            >
              <Character player={p} color={team.color} size={charSize} />
            </div>
          ))}
        </div>
      )}

      {answer && (
        <div
          className="anim-rise rounded-[2vmin] bg-deep/90 px-[3vmin] py-[1.4vmin] text-center"
          style={{ animationDelay: "400ms" }}
        >
          <span className="text-[2.6vmin] text-cream/60">الإجابة: </span>
          <span className="text-[4vmin] font-bold text-goldlight">{answer}</span>
        </div>
      )}

      <span
        className="rounded-full px-4 py-1 font-bold"
        style={{ background: `${team.color}33`, boxShadow: `inset 0 0 0 2px ${team.color}`, fontSize: tv ? "3vmin" : 16 }}
      >
        {team.name}
      </span>
    </div>
  );
}
