"use client";
// Reaction overlay derived from the RESULT phase. Purely client-side: nothing is stored;
// it unmounts as soon as the phase moves on (host pressing "next" cancels it instantly).
// V1.7: three stages — impact (score flash) → main character animation → ~1.5s photo freeze.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PublicPlayer, Team } from "@/lib/game/types";
import { confettiBurst } from "./effects";
import { Avatar, Character } from "./ui";

export type ReactionKind = "correct" | "wrong" | "steal" | "skipped";

// ─── Shuffle bags ───────────────────────────────────────────────────────────
// A reaction doesn't come back until most of the others in its group have played.

const BAG_KEY = "96:reaction-bags";
type Bags = Record<string, { left: string[]; last: string | null }>;

function loadBags(): Bags {
  try {
    return JSON.parse(localStorage.getItem(BAG_KEY) || "{}") as Bags;
  } catch {
    return {};
  }
}

export function drawFromBag(group: string, ids: string[]): string {
  const bags = loadBags();
  let bag = bags[group];
  if (!bag || bag.left.length === 0 || bag.left.some((id) => !ids.includes(id))) {
    const fresh = ids.slice().sort(() => Math.random() - 0.5);
    // never start a new round with the reaction that just played
    if (bag?.last && fresh[0] === bag.last && fresh.length > 1) fresh.push(fresh.shift()!);
    bag = { left: fresh, last: bag?.last ?? null };
  }
  const id = bag.left.shift()!;
  bag.last = id;
  bags[group] = bag;
  try {
    localStorage.setItem(BAG_KEY, JSON.stringify(bags));
  } catch {}
  return id;
}

const lastLine: Record<string, string> = {};
export function pickLine(group: string, lines: string[]): string {
  const pool = lines.length > 1 ? lines.filter((l) => l !== lastLine[group]) : lines;
  const l = pool[Math.floor(Math.random() * pool.length)];
  lastLine[group] = l;
  return l;
}

// ─── Variants ───────────────────────────────────────────────────────────────

type At = "head" | "face" | "hand" | "feet" | "around" | "above" | "body";
interface Prop {
  e?: string; // emoji
  node?: "hole" | "ice" | "mask" | "podium" | "drops";
  at: At;
  cls?: string;
  scale?: number;
  delay?: number;
}
type Scene =
  | "spotlight"
  | "flashes"
  | "pointsRain"
  | "darken"
  | "smoke"
  | "error"
  | "sandal"
  | "hand"
  | "car"
  | "coins"
  | "magic"
  | "vault"
  | "pointsFly"
  | "moneyThrow"
  | "selfie"
  | "bonk"
  | "hook"
  | "noticed"
  | "flag";
interface Variant {
  id: string;
  anim: string;
  face?: string;
  props?: Prop[];
  scene?: Scene;
  lines?: string[];
  confetti?: number;
}

const CORRECT_LINES = ["كفو!", "يا سلام!", "وحش!", "سهلة!", "كذا اللعب!", "عرفها!", "يا قوي!", "ما شاء الله!", "عين عليك باردة", "صح عليك!", "أبدعت!"];
const WRONG_LINES = ["يا ساتر!", "راحت عليك", "قريبة!", "ركز شوي", "الله يعوض", "مو اليوم", "كان عندك أمل", "وش صار؟", "أوف!", "المرة الجاية"];
// «وش تعرف عنه؟ 👀» — {n} is the person the question was about
const PERSONAL_CORRECT = ["عارفينه زين!", "مكشوف يا {n}!", "حافظينه!", "يعرفونك أكثر منك يا {n}", "واضح ما عند {n} أسرار"];
const PERSONAL_WRONG = ["واضح ما تعرفونه", "مين عايش مع مين؟", "أعيدوا التعارف", "شكلكم ما تسولفون مع بعض", "ورطكم {n}"];
const STEAL_LINES = ["سرقوها!", "خذوها!", "راحت منكم!", "سرقة نظيفة", "شكراً على الهدية", "مع السلامة يا نقاط", "ما قصرتوا", "جاهزة ومغلفة بعد!"];

const CORRECT: Variant[] = [
  { id: "dance", anim: "rx-dance" },
  { id: "hype", anim: "rx-hype", props: [{ e: "🕶️", at: "face", cls: "rxp-drop", delay: 250 }], lines: ["كفو!", "يا سلام!"] },
  { id: "fly", anim: "rx-fly" },
  { id: "rocket", anim: "rx-rocket", props: [{ e: "🚀", at: "feet", cls: "rxp-rocket" }], lines: ["وحش!", "يا قوي!"] },
  { id: "king", anim: "rx-bob", props: [{ e: "👑", at: "head", cls: "rxp-drop", scale: 1.2 }], lines: ["يا ملك!"] },
  { id: "pointsRain", anim: "rx-jump", scene: "pointsRain" },
  { id: "hero", anim: "rx-walkin", scene: "spotlight", lines: ["يا قوي!", "كذا اللعب!"] },
  { id: "celebrity", anim: "rx-pose", scene: "flashes", lines: ["عين عليك باردة", "ما شاء الله!"] },
  { id: "spin", anim: "rx-spin", confetti: 2 },
  { id: "micdrop", anim: "rx-walkoff", props: [{ e: "🎤", at: "hand", cls: "rxp-micdrop" }], lines: ["أبدعت!", "كذا اللعب!"] },
  { id: "podium", anim: "rx-podium", props: [{ node: "podium", at: "feet" }], lines: ["يا بطل!", "كفو!"] },
  { id: "glasses", anim: "rx-cool", props: [{ e: "🕶️", at: "face", cls: "rxp-drop", delay: 150 }], lines: ["سهلة!"] },
  { id: "bighead", anim: "rx-bob", face: "rx-bighead", lines: ["عرفها!", "وحش!"] },
  { id: "slowmo", anim: "rx-slowmo", scene: "darken", lines: ["يا سلام!", "ما شاء الله!"] },
  { id: "superhero", anim: "rx-landing", props: [{ e: "💥", at: "feet", cls: "rxp-dust", delay: 450 }], lines: ["وحش!", "يا قوي!"] },
  { id: "spotlightFreeze", anim: "rx-pose", scene: "spotlight", props: [{ e: "✨", at: "around", cls: "rxp-pop", delay: 300 }] },
  // V1.7
  { id: "flex", anim: "rx-hype", props: [{ e: "💪", at: "hand", cls: "rxp-pop", delay: 200, scale: 1.2 }], lines: ["عضلات المخ!", "يا قوي!"] },
  { id: "moneyThrow", anim: "rx-bob", scene: "moneyThrow", props: [{ e: "💸", at: "hand", cls: "rxp-bounce" }], lines: ["فلوس على الكل!", "كفو!"] },
  { id: "bow", anim: "rx-bow", props: [{ e: "🎩", at: "head", cls: "rxp-drop" }], lines: ["شكراً شكراً", "يا سلام!"] },
  { id: "selfie", anim: "rx-pose", scene: "selfie", props: [{ e: "🤳", at: "hand", cls: "rxp-pop", delay: 250, scale: 1.2 }], lines: ["سيلفي الفوز!", "صوّروني!"] },
  { id: "pointAt", anim: "rx-cool", props: [{ e: "👉", at: "hand", cls: "rxp-point", scale: 1.1 }], lines: ["هذا فريقنا!", "شفتوا؟"] },
  { id: "swagger", anim: "rx-swagger", props: [{ e: "🕶️", at: "face", cls: "rxp-drop", delay: 900 }], lines: ["ولا كأن شي صار", "سهلة!"] },
  { id: "flag", anim: "rx-bob", scene: "flag", props: [{ e: "🇸🇦", at: "hand", cls: "rxp-wave", scale: 1.3 }], lines: ["عزنا بطبعنا!", "كفو يا عيال!"] },
  { id: "camelRide", anim: "rx-ride", props: [{ e: "🐪", at: "feet", cls: "", scale: 1.8 }], lines: ["داخلين بالفزعة!", "وحش!"] },
];

const WRONG: Variant[] = [
  { id: "wall", anim: "rx-wall" },
  { id: "fall", anim: "rx-fall" },
  { id: "shrink", anim: "rx-shrink" },
  { id: "dizzy", anim: "rx-wobble", props: [{ e: "💫", at: "around", cls: "rxp-orbit" }, { e: "⭐", at: "around", cls: "rxp-orbit rxp-orbit-2" }] },
  { id: "smoke", anim: "rx-vanish", scene: "smoke", lines: ["وش صار؟", "أوف!"] },
  { id: "shake", anim: "rx-shake" },
  { id: "hole", anim: "rx-sink", props: [{ node: "hole", at: "feet" }] },
  { id: "facepalm", anim: "rx-sad", props: [{ e: "🤦", at: "face", cls: "rxp-pop", delay: 200, scale: 1.2 }], lines: ["يا ساتر!", "وش صار؟"] },
  { id: "freeze", anim: "rx-frozen", props: [{ node: "ice", at: "body" }, { e: "❄️", at: "head", cls: "rxp-pop", delay: 300 }], lines: ["تجمّد!", "أوف!"] },
  { id: "balloon", anim: "rx-balloon" },
  { id: "error", anim: "rx-shake", scene: "error" },
  { id: "pushback", anim: "rx-pushback" },
  { id: "rain", anim: "rx-sad", props: [{ e: "🌧️", at: "above", cls: "rxp-float" }, { node: "drops", at: "above" }], lines: ["الله يعوض", "المرة الجاية"] },
  { id: "sandal", anim: "rx-duck", scene: "sandal", lines: ["يا ساتر!", "ركز شوي"] },
  { id: "slideoff", anim: "rx-slideoff", lines: ["مو اليوم", "المرة الجاية"] },
  // V1.7
  { id: "cry", anim: "rx-sad", props: [{ e: "😭", at: "face", cls: "rxp-pop", delay: 250, scale: 1.2 }, { node: "drops", at: "above" }], lines: ["لا تبكي!", "الله يعوض"] },
  { id: "walkaway", anim: "rx-walkaway", lines: ["خلاص… أنا طالع", "مو اليوم"] },
  { id: "collapse", anim: "rx-collapse", props: [{ e: "💀", at: "above", cls: "rxp-pop", delay: 900 }], lines: ["مات من القهر", "يا ساتر!"] },
  { id: "hide", anim: "rx-hide", props: [{ e: "🙈", at: "face", cls: "rxp-pop", delay: 300, scale: 1.3 }], lines: ["لا تشوفوني", "فشلة!"] },
  { id: "shocked", anim: "rx-shake", face: "rx-bighead", props: [{ e: "😱", at: "above", cls: "rxp-pop", delay: 150 }], lines: ["مستحيل!", "وش صار؟"] },
  { id: "bonk", anim: "rx-bonked", scene: "bonk", props: [{ e: "💫", at: "around", cls: "rxp-orbit", delay: 700 }], lines: ["ركز شوي!", "صحصح!"] },
  { id: "dragged", anim: "rx-dragged", scene: "hook", lines: ["برا برا!", "مع السلامة"] },
  { id: "sitSad", anim: "rx-sitdown", props: [{ e: "😔", at: "above", cls: "rxp-pop", delay: 600 }], lines: ["المرة الجاية", "الله يعوض"] },
  { id: "disbelief", anim: "rx-stare", face: "rx-bighead", props: [{ e: "😐", at: "above", cls: "rxp-pop", delay: 700 }], lines: ["جد؟", "…"] },
];

const STEAL: Variant[] = [
  { id: "thief", anim: "rx-thief", props: [{ node: "mask", at: "face" }, { e: "💰", at: "hand", cls: "rxp-bounce" }], scene: "pointsFly" },
  { id: "hand", anim: "rx-slidein", scene: "hand", lines: ["مع السلامة يا نقاط"] },
  { id: "coinsRun", anim: "rx-run", props: [{ e: "🪙", at: "hand", cls: "rxp-bounce" }, { e: "🪙", at: "head", cls: "rxp-bounce" }], lines: ["سرقة نظيفة"] },
  { id: "car", anim: "rx-carride", scene: "car" },
  { id: "coins", anim: "rx-slidein", scene: "coins" },
  { id: "magician", anim: "rx-pose", props: [{ e: "🎩", at: "head", cls: "rxp-drop" }], scene: "magic" },
  { id: "tiptoe", anim: "rx-tiptoe", props: [{ e: "💰", at: "hand", cls: "rxp-bounce" }], lines: ["سرقوها!", "ما قصرتوا"] },
  { id: "vault", anim: "rx-grab", scene: "vault", props: [{ e: "💰", at: "hand", cls: "rxp-pop", delay: 1100 }] },
  // V1.7
  { id: "trophy", anim: "rx-run", props: [{ e: "🏆", at: "hand", cls: "rxp-bounce", scale: 1.2 }], lines: ["الكأس لنا!", "خذوها!"] },
  { id: "chased", anim: "rx-run", scene: "noticed", props: [{ e: "💰", at: "hand", cls: "rxp-bounce" }], lines: ["لحقوه!", "راحت منكم!"] },
  { id: "sneak", anim: "rx-tiptoe", scene: "noticed", props: [{ node: "mask", at: "face" }, { e: "🪙", at: "hand", cls: "rxp-bounce" }], lines: ["انتبهوا متأخر!", "سرقة نظيفة"] },
];

const GROUPS: Record<Exclude<ReactionKind, "skipped">, Variant[]> = { correct: CORRECT, wrong: WRONG, steal: STEAL };
export const REACTION_COUNTS = { correct: CORRECT.length, wrong: WRONG.length, steal: STEAL.length };

// ─── Rendering ──────────────────────────────────────────────────────────────

function propStyle(at: At, size: number, scale = 1): CSSProperties {
  const fs = size * 0.36 * scale;
  const base: CSSProperties = { position: "absolute", fontSize: fs, lineHeight: 1, zIndex: 3, pointerEvents: "none" };
  switch (at) {
    case "head":
      return { ...base, top: -size * 0.18, left: "50%", marginLeft: -fs / 2 };
    case "face":
      return { ...base, top: size * 0.24, left: "50%", marginLeft: -fs / 2 };
    case "hand":
      return { ...base, top: size * 0.62, right: -size * 0.22 };
    case "feet":
      return { ...base, bottom: -size * 0.12, left: "50%", marginLeft: -fs / 2 };
    case "around":
      return { ...base, top: size * 0.05, left: "50%", marginLeft: -fs / 2 };
    case "above":
      return { ...base, top: -size * 0.5, left: "50%", marginLeft: -fs / 2 };
    case "body":
      return { ...base, inset: 0 };
  }
}

function PropNode({ p, size }: { p: Prop; size: number }) {
  const style: CSSProperties = { ...propStyle(p.at, size, p.scale), animationDelay: `${p.delay ?? 0}ms` };
  if (p.node === "hole")
    return <span className="rxp-hole" style={{ ...style, width: size * 1.1, height: size * 0.28, marginLeft: -size * 0.55, bottom: -size * 0.1, zIndex: 0 }} />;
  if (p.node === "ice") return <span className="rxp-ice" style={{ ...style, inset: `-${size * 0.06}px` }} />;
  if (p.node === "mask") return <span className="rxp-mask" style={{ ...style, width: size * 0.5, height: size * 0.11, marginLeft: -size * 0.25, top: size * 0.32 }} />;
  if (p.node === "podium")
    return (
      <span className="rxp-podium" style={{ ...style, width: size * 1.1, height: size * 0.42, marginLeft: -size * 0.55, bottom: -size * 0.42, fontSize: size * 0.26 }}>
        1
      </span>
    );
  if (p.node === "drops")
    return (
      <span style={{ ...style, top: -size * 0.2, width: size * 0.6, marginLeft: -size * 0.3, height: size * 0.6, fontSize: size * 0.12 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rxp-drop-fall" style={{ position: "absolute", left: `${i * 28}%`, animationDelay: `${i * 170}ms` }}>
            💧
          </span>
        ))}
      </span>
    );
  return (
    <span className={p.cls} style={style}>
      {p.e}
    </span>
  );
}

function SceneLayer({ scene, points, color }: { scene: Scene; points: number; color: string }) {
  switch (scene) {
    case "spotlight":
      return <div className="rxs-spotlight" />;
    case "darken":
      return <div className="rxs-darken" />;
    case "flashes":
      return (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className="rxs-flash"
              style={{ left: `${10 + ((i * 37) % 80)}%`, top: `${15 + ((i * 53) % 60)}%`, animationDelay: `${(i * 190) % 1400}ms` }}
            >
              📸
            </span>
          ))}
        </div>
      );
    case "pointsRain":
      return (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              className="rxs-rain num font-black"
              style={{ left: `${(i * 53) % 96}%`, animationDelay: `${(i * 137) % 1500}ms`, color }}
            >
              +{points}
            </span>
          ))}
        </div>
      );
    case "smoke":
      return <span className="rxs-smoke">💨</span>;
    case "error":
      return (
        <div className="rxs-error" dir="rtl">
          <div className="rxs-error-bar">⚠️ خطأ</div>
          <div className="px-[2.4vmin] py-[1.6vmin] text-[2.6vmin] text-ink">
            خطأ 404: الإجابة غير موجودة
            <div className="mt-[1.2vmin] flex justify-center">
              <span className="rounded-md bg-sky px-[2vmin] py-[0.4vmin] text-[2.2vmin] font-bold text-white">حسناً 😅</span>
            </div>
          </div>
        </div>
      );
    case "sandal":
      return <span className="rxs-sandal">🩴</span>;
    case "hand":
      return (
        <span className="rxs-hand">
          ✋<span className="num rxs-hand-pts" style={{ color }}>+{points}</span>
        </span>
      );
    case "car":
      return <span className="rxs-car">🚗💨</span>;
    case "coins":
      return (
        <div className="pointer-events-none absolute inset-x-0 bottom-[12%] z-[1] h-[10vmin] overflow-hidden">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="rxs-coin" style={{ animationDelay: `${i * 140}ms` }}>
              🪙
            </span>
          ))}
        </div>
      );
    case "magic":
      return (
        <>
          <span className="rxs-magic-poof">✨</span>
          <span className="rxs-magic-pts num" style={{ color }}>
            +{points}
          </span>
        </>
      );
    case "vault":
      return (
        <div className="rxs-vault">
          <div className="rxs-vault-door">🔐</div>
        </div>
      );
    case "pointsFly":
      return (
        <span className="rxs-pointsfly num" style={{ color }}>
          +{points}
        </span>
      );
    case "moneyThrow":
      return (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="rxs-rain" style={{ left: `${(i * 61) % 96}%`, animationDelay: `${(i * 157) % 1600}ms`, fontSize: "5vmin" }}>
              💵
            </span>
          ))}
        </div>
      );
    case "selfie":
      return <div className="rxs-selfie" />;
    case "bonk":
      return <span className="rxs-bonk">🔨</span>;
    case "hook":
      return <span className="rxs-hook">🪝</span>;
    case "noticed":
      return <span className="rxs-noticed">😠❗</span>;
    case "flag":
      return (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="rxs-rain" style={{ left: `${(i * 97) % 94}%`, animationDelay: `${(i * 211) % 1500}ms`, fontSize: "4.5vmin" }}>
              🇸🇦
            </span>
          ))}
        </div>
      );
  }
}

/** Stage timings (ms): impact flash → main animation → photo freeze → overlay fades (result card stays). */
export function reactionTiming(kind: ReactionKind, surface: "tv" | "phone") {
  if (kind === "skipped") return { impact: 0, main: 1600, total: 1600 };
  const main = kind === "steal" ? 3300 : 2800;
  const total = kind === "steal" ? 5000 : kind === "wrong" ? 4300 : 4500;
  return surface === "tv" ? { impact: 700, main, total } : { impact: 500, main: main - 300, total: total - 500 };
}

export function GameReaction({
  kind,
  players,
  team,
  points,
  answer,
  streak = 0,
  surface = "tv",
  durationMs,
  about,
}: {
  kind: ReactionKind;
  /** kept for API compatibility (older callers) */
  seed?: string;
  players: PublicPlayer[];
  team: Team;
  points: number;
  answer?: string;
  /** consecutive correct answers of the scoring team (after this one) */
  streak?: number;
  surface?: "tv" | "phone";
  durationMs?: number;
  /** personalized question: who it was about (+ their live player, for the photo) */
  about?: { name: string; player: PublicPlayer | null } | null;
}) {
  const variant = useMemo<Variant | null>(() => {
    if (kind === "skipped") return null;
    const list = GROUPS[kind];
    const id = drawFromBag(`${surface}:${kind}`, list.map((v) => v.id));
    return list.find((v) => v.id === id) ?? list[0];
  }, [kind, surface]);
  const title = useMemo(() => {
    if (kind === "skipped") return "تم التخطي";
    if (about && (kind === "correct" || kind === "wrong"))
      return pickLine(`p-${kind}`, kind === "correct" ? PERSONAL_CORRECT : PERSONAL_WRONG).replace("{n}", about.name);
    const lines = variant?.lines ?? (kind === "correct" ? CORRECT_LINES : kind === "wrong" ? WRONG_LINES : STEAL_LINES);
    return pickLine(kind, lines);
  }, [kind, variant, about]);
  const timing = reactionTiming(kind, surface);
  const total = durationMs ?? timing.total;
  const [show, setShow] = useState(true);
  const [stage, setStage] = useState<"impact" | "main" | "freeze">(timing.impact > 0 ? "impact" : "main");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setShow(false), total),
      setTimeout(() => setStage("main"), timing.impact),
      setTimeout(() => setStage("freeze"), Math.min(timing.main, total - 400)),
    ];
    const strength = surface === "phone" ? 0.5 : 1;
    if (kind === "correct") {
      confettiBurst(strength);
      if ((variant?.confetti ?? 0) > 1) timers.push(setTimeout(() => confettiBurst(strength), 1000));
    }
    if (kind === "steal") {
      timers.push(setTimeout(() => confettiBurst(1.4 * strength), 400));
      timers.push(setTimeout(() => confettiBurst(strength), 1300));
    }
    return () => timers.forEach(clearTimeout);
  }, [kind, variant, surface, total, timing.impact, timing.main]);

  if (!show) return null;
  const tv = surface === "tv";
  const good = kind === "correct" || kind === "steal";
  const shown = players.slice(0, tv ? 5 : 1);
  const size = tv ? Math.round(window.innerHeight * (shown.length > 3 ? 0.17 : 0.22)) : 150;
  const streakLine = kind !== "wrong" && kind !== "skipped" ? (streak >= 5 ? "ما يوقفون! 🔥🔥" : streak === 3 ? "مولعين! 🔥" : null) : null;

  // Stage 1: score impact — a flash and one big stamp, nothing else yet
  if (stage === "impact") {
    return (
      <div data-reaction="impact" className={`${tv ? "absolute" : "fixed"} inset-0 z-40 flex items-center justify-center overflow-hidden bg-ink/70`}>
        <div className={`rx-impact ${good ? "rx-impact-good" : "rx-impact-bad"}`} />
        <div
          className="anim-stamp relative z-[2] num font-black leading-none"
          style={{ color: good ? team.color : "#ff6b66", fontSize: tv ? "22vmin" : 96, textShadow: "0 10px 40px rgba(0,0,0,.5)" }}
        >
          {good && points > 0 ? `+${points}` : kind === "steal" ? "⚡" : "✕"}
        </div>
      </div>
    );
  }
  const frozen = stage === "freeze";

  return (
    <div
      data-reaction={stage}
      className={`anim-fade ${tv ? "absolute" : "fixed"} inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-ink/75 backdrop-blur-[2px] ${
        kind === "steal" ? "rx-screenshake" : ""
      }`}
      style={{ gap: tv ? "3vmin" : 16 }}
    >
      {variant?.scene && <SceneLayer scene={variant.scene} points={points} color={team.color} />}

      <div className="anim-stamp relative z-[2] text-center" style={{ animationDelay: kind === "steal" ? "300ms" : undefined }}>
        <div
          className={`leading-none font-black ${good ? "text-goldlight" : "text-cream"}`}
          style={{ fontSize: tv ? (kind === "steal" ? "12vmin" : "10vmin") : 44 }}
        >
          {title}
        </div>
        {good && points > 0 && (
          <div className="num mt-[1vmin] font-black" style={{ color: team.color, fontSize: tv ? "9vmin" : 40 }}>
            +{points}
          </div>
        )}
        {streakLine && (
          <div className="anim-pop mt-[1vmin] font-black text-[#ff9b4a]" style={{ fontSize: tv ? "5vmin" : 24, animationDelay: "500ms" }}>
            {streakLine}
          </div>
        )}
      </div>

      {frozen && <div className="rx-camera-flash" />}
      {variant && shown.length > 0 && (
        <div className={`relative z-[2] flex items-end justify-center ${frozen ? "rx-freeze-frame" : ""}`} style={{ gap: tv ? "4vmin" : 12 }}>
          {shown.map((p, i) => (
            <div key={p.id} className={variant.anim} style={{ animationDelay: `${i * 110}ms` }}>
              <Character player={p} color={team.color} size={size} faceClassName={variant.face}>
                {variant.props?.map((pr, j) => <PropNode key={j} p={pr} size={size} />)}
              </Character>
            </div>
          ))}
        </div>
      )}

      {answer && about && (
        <div
          className="anim-rise relative z-[2] flex items-center gap-[2vmin] rounded-[2vmin] bg-deep/90 px-[3vmin] py-[1.4vmin]"
          style={{ animationDelay: "400ms" }}
        >
          {about.player ? (
            <Avatar player={about.player} color="#d6a63a" size={tv ? Math.round(window.innerHeight * 0.08) : 48} />
          ) : (
            <span className="text-[5vmin]">👀</span>
          )}
          <div className="text-start">
            <div className="text-[2.6vmin] font-bold text-cream/70">{about.name}</div>
            <div className="text-[4.4vmin] leading-tight font-black text-goldlight">«{answer}»</div>
          </div>
        </div>
      )}
      {answer && !about && (
        <div className="anim-rise relative z-[2] rounded-[2vmin] bg-deep/90 px-[3vmin] py-[1.4vmin] text-center" style={{ animationDelay: "400ms" }}>
          <span className="text-[2.6vmin] text-cream/60">الإجابة: </span>
          <span className="text-[4vmin] font-bold text-goldlight">{answer}</span>
        </div>
      )}

      <span
        className="relative z-[2] rounded-full px-4 py-1 font-bold"
        style={{ background: `${team.color}33`, boxShadow: `inset 0 0 0 2px ${team.color}`, fontSize: tv ? "3vmin" : 16 }}
      >
        {team.name}
      </span>
    </div>
  );
}

// ─── Winner / loser pieces for the finale ───────────────────────────────────

const WINNER_STYLES: { id: string; anim: string; props?: Prop[] }[] = [
  { id: "crowns", anim: "rx-bob", props: [{ e: "👑", at: "head", cls: "rxp-drop", scale: 1.2 }] },
  { id: "glasses", anim: "rx-dance", props: [{ e: "🕶️", at: "face", cls: "rxp-drop" }] },
  { id: "podium", anim: "rx-podium", props: [{ node: "podium", at: "feet" }] },
  { id: "jump", anim: "rx-jump-loop" },
  { id: "trophy", anim: "rx-hype", props: [{ e: "🏆", at: "hand", cls: "rxp-pop" }] },
];

const LOSER_STYLES: { id: string; anim: string; props?: Prop[] }[] = [
  { id: "tears", anim: "rx-sad", props: [{ e: "😢", at: "face", cls: "rxp-pop", scale: 1.1 }] },
  { id: "rain", anim: "rx-sad", props: [{ e: "🌧️", at: "above", cls: "rxp-float" }, { node: "drops", at: "above" }] },
  { id: "flag", anim: "rx-sad", props: [{ e: "🏳️", at: "hand", cls: "rxp-flagfall" }] },
  { id: "sit", anim: "rx-sitdown" },
  { id: "shrink", anim: "rx-shrink-stay" },
  { id: "walkoff", anim: "rx-slideoff" },
  { id: "tinyTrophy", anim: "rx-bob", props: [{ e: "🏆", at: "hand", cls: "rxp-pop", scale: 0.45 }] },
];
const LOSER_LINES = ["خيرها بغيرها", "المرة الجاية", "شدوا حيلكم", "كانت قريبة", "تعوضونها"];

export function WinnerCrew({ players, color, size }: { players: PublicPlayer[]; color: string; size: number }) {
  const style = useMemo(() => {
    const id = drawFromBag("winner", WINNER_STYLES.map((s) => s.id));
    return WINNER_STYLES.find((s) => s.id === id)!;
  }, []);
  // end on a photo-worthy freeze pose
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFrozen(true), 6500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-wrap items-end justify-center gap-[3vmin]">
      {players.map((p, i) => (
        <div key={p.id} className={frozen ? "" : style.anim} style={{ animationDelay: `${i * 150}ms`, animationIterationCount: "infinite" }}>
          <Character player={p} color={color} size={size}>
            {style.props?.map((pr, j) => <PropNode key={j} p={pr} size={size} />)}
          </Character>
        </div>
      ))}
    </div>
  );
}

export function LoserCrew({ players, team, size }: { players: PublicPlayer[]; team: Team; size: number }) {
  const style = useMemo(() => {
    const id = drawFromBag("loser", LOSER_STYLES.map((s) => s.id));
    return LOSER_STYLES.find((s) => s.id === id)!;
  }, []);
  const line = useMemo(() => pickLine("loser", LOSER_LINES), []);
  return (
    <div className="anim-rise flex items-end gap-[2vmin] rounded-[2vmin] bg-ink/60 px-[2.4vmin] py-[1.4vmin]">
      <div className="flex flex-col items-center">
        <span className="font-bold" style={{ color: team.color, fontSize: "2.8vmin" }}>
          {team.name}
        </span>
        <span className="text-[2.6vmin] text-cream/80">{line}</span>
      </div>
      {players.slice(0, 4).map((p, i) => (
        <div key={p.id} className={style.anim} style={{ animationDelay: `${i * 120}ms` }}>
          <Character player={p} color={team.color} size={size} showName={false}>
            {style.props?.map((pr, j) => <PropNode key={j} p={pr} size={size} />)}
          </Character>
        </div>
      ))}
    </div>
  );
}

