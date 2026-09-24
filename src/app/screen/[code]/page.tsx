"use client";
import { use, useEffect, useRef, useState } from "react";
import { confettiBurst, fireworks } from "@/components/effects";
import { GameReaction, LoserCrew, WinnerCrew } from "@/components/GameReaction";
import { patternBg } from "@/components/patterns";
import {
  Avatar,
  CardBack,
  Character,
  FullScreenMessage,
  Logo96,
  OPTION_LETTERS,
  QR,
  Spinner,
  TeamBadge,
  teamById,
  THEME_LABEL,
  TimerRing,
  UsedCard,
  type CharacterAction,
} from "@/components/ui";
import { sfx } from "@/lib/client/sound";
import { useGame, useTickDriver, useUntil } from "@/lib/client/useGame";
import { useGameSounds } from "@/lib/client/useGameSounds";
import type { PublicCategory, PublicGame, PublicPhase, PublicQuestion, Team } from "@/lib/game/types";

type Phase<N extends PublicPhase["name"]> = Extract<PublicPhase, { name: N }>;

export default function ScreenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { game, error, online, now } = useGame(code.toUpperCase());
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => setMuted(sfx?.muted ?? false), []);
  useTickDriver(game, now);
  useGameSounds(game, now, started && !muted);
  useWakeLock(started);

  if (error?.status === 404) {
    return (
      <FullScreenMessage title="الجلسة غير موجودة">
        <p className="text-cream/60">تأكد من الكود أو أنشئ لعبة جديدة</p>
      </FullScreenMessage>
    );
  }
  if (!game) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <Spinner />
      </main>
    );
  }

  const start = () => {
    sfx?.unlock();
    setStarted(true);
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  return (
    <main className="bg-majlis relative flex h-dvh w-screen flex-col overflow-hidden select-none" onClick={() => sfx?.unlock()}>
      {game.phase.name === "LOBBY" ? (
        <Lobby game={game} />
      ) : game.phase.name === "GAME_OVER" ? (
        <Finale game={game} phase={game.phase} sound={started && !muted && game.settings.soundOn} />
      ) : (
        <>
          <TopBar game={game} />
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-[3vmin] pb-[3vmin]">
            <Stage game={game} now={now} />
          </div>
        </>
      )}

      {game.paused && (
        <div className="anim-fade absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ink/80 backdrop-blur-sm">
          <span className="text-[12vmin]">⏸</span>
          <span className="text-[6vmin] font-bold">استراحة قصيرة</span>
        </div>
      )}

      {!online && (
        <div className="absolute top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-danger px-4 py-1 text-sm font-bold">
          جارٍ إعادة الاتصال…
        </div>
      )}

      {!started && (
        <button
          className="anim-fade absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-ink/85 backdrop-blur"
          onClick={start}
        >
          <Logo96 size={140} />
          <span className="btn btn-gold anim-pulse px-10 py-5 text-[3.5vmin]">ابدأ العرض</span>
          <span className="text-cream/60">يشغّل الصوت وملء الشاشة</span>
        </button>
      )}

      <button
        className="absolute bottom-3 left-3 z-30 rounded-full bg-ink/60 px-3 py-2 text-lg opacity-50 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          sfx?.unlock();
          sfx?.setMuted(!muted);
          setMuted(!muted);
        }}
        aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
      >
        {muted || !game.settings.soundOn ? "🔇" : "🔊"}
      </button>
    </main>
  );
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const req = () => navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    void req();
    const onVis = () => document.visibilityState === "visible" && void req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

// ─── Lobby ──────────────────────────────────────────────────────────────────

function Lobby({ game }: { game: PublicGame }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = `${origin}/play/${game.code}`;
  return (
    <div className="flex h-full w-full items-stretch gap-[4vmin] p-[5vmin]">
      <div className="anim-rise flex w-[38%] flex-col items-center justify-center gap-[3vmin] text-center">
        <Logo96 size={Math.round(window.innerHeight * 0.16)} />
        <div className="flex items-center gap-[1.5vmin] text-[2.6vmin] font-semibold text-cream/80">
          {game.name !== "خيمة الفنتوخ" && <span>{game.name} ·</span>}
          <span className="rounded-full bg-gold/15 px-[1.6vmin] py-[0.3vmin] text-goldlight">{THEME_LABEL}</span>
        </div>
        {origin && <QR value={joinUrl} size={Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.26)} />}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[2.4vmin] text-cream/60">امسح الكود أو ادخل الرمز</span>
          <span className="num text-[9vmin] font-bold tracking-[0.2em] text-goldlight">{game.code}</span>
          <span className="num text-[2vmin] text-cream/50">{origin.replace(/^https?:\/\//, "")}/play/{game.code}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3vmin]">
        <h2 className="text-[4.5vmin] font-bold">
          اللاعبون <span className="num text-gold">{game.players.length}</span>
        </h2>
        <div className="grid min-h-0 flex-1 gap-[2.5vmin]" style={{ gridTemplateColumns: `repeat(${game.teams.length}, 1fr)` }}>
          {game.teams.map((t) => {
            const members = game.players.filter((p) => p.teamId === t.id);
            return (
              <div
                key={t.id}
                className="panel flex min-h-0 flex-col gap-[2vmin] overflow-hidden p-[2.5vmin]"
                style={{ boxShadow: `inset 0 4px 0 ${t.color}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[4vmin] font-bold" style={{ color: t.color }}>
                    {t.name}
                  </span>
                  <span className="num text-[3vmin] text-cream/50">{members.length}</span>
                </div>
                <div className="flex flex-wrap content-start gap-[2vmin]">
                  {members.map((p) => (
                    <div key={p.id} className="anim-pop flex w-[11vmin] flex-col items-center gap-1">
                      <Avatar player={p} color={t.color} size={Math.round(window.innerHeight * 0.085)} />
                      <span className="w-full truncate text-center text-[2.1vmin] font-semibold">{p.name}</span>
                    </div>
                  ))}
                  {members.length === 0 && <span className="text-[2.4vmin] text-cream/40">بانتظار اللاعبين…</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center text-[2.4vmin] text-cream/50">المضيف يبدأ اللعبة عندما يجهز الجميع</p>
      </div>
    </div>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────────

function activeTeamId(p: PublicPhase): string | null {
  switch (p.name) {
    case "CATEGORY_VOTE":
    case "CARD_PICK":
    case "QUESTION":
      return p.teamId;
    case "STEAL":
      return p.fromTeamId;
    case "RESULT":
      return p.activeTeamId;
    default:
      return null;
  }
}

function TopBar({ game }: { game: PublicGame }) {
  const active = activeTeamId(game.phase);
  const s = game.settings;
  return (
    <header className="flex items-center justify-between gap-[3vmin] px-[4vmin] pt-[3vmin] pb-[2vmin]">
      <div className="flex items-center gap-[2vmin]">
        <Logo96 size={Math.round(window.innerHeight * 0.045)} />
        <span className="text-[2.2vmin] text-cream/60">
          {s.totalQuestions ? (
            <>
              سؤال <span className="num">{Math.min(game.turn.questionsPlayed + 1, s.totalQuestions)}</span> من{" "}
              <span className="num">{s.totalQuestions}</span>
            </>
          ) : (
            <>
              الهدف <span className="num">{s.targetScore}</span>
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-[2vmin]">
        {game.teams.map((t) => (
          <ScorePill key={t.id} team={t} active={t.id === active} />
        ))}
      </div>
    </header>
  );
}

/** Animates a number from its previous value to the new one (~500ms). */
function useCountUp(value: number, ms = 520) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

function ScorePill({ team, active }: { team: Team; active: boolean }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(team.score);
  const shown = useCountUp(team.score);
  useEffect(() => {
    if (team.score !== prev.current) {
      prev.current = team.score;
      setBump(true);
      const t = setTimeout(() => setBump(false), 700);
      return () => clearTimeout(t);
    }
  }, [team.score]);
  return (
    <div
      className="flex items-center gap-[1.6vmin] rounded-full px-[2.4vmin] py-[1vmin] transition-all duration-300"
      style={{
        background: active ? team.color : "rgba(4,26,18,.6)",
        boxShadow: active ? `0 0 0 3px ${team.color}55, 0 10px 30px ${team.color}55` : `inset 0 0 0 2px ${team.color}88`,
        transform: active ? "scale(1.06)" : "scale(1)",
      }}
    >
      <span className="text-[2.8vmin] font-bold">{team.name}</span>
      <span className={`num text-[3.6vmin] font-bold ${bump ? "anim-pop" : ""}`}>{shown}</span>
    </div>
  );
}

// ─── Stage ──────────────────────────────────────────────────────────────────

function Stage({ game, now }: { game: PublicGame; now: () => number }) {
  const p = game.phase;
  switch (p.name) {
    case "CATEGORY_VOTE":
      return <VoteStage game={game} phase={p} now={now} />;
    case "CARD_PICK":
      return <CardStage game={game} phase={p} now={now} />;
    case "QUESTION":
    case "STEAL":
    case "RESULT":
      return <QuestionStage game={game} phase={p} now={now} />;
    default:
      return null;
  }
}

/** Occasionally (every other turn) flag a tight race: top two within 100 points. */
function closeRace(game: PublicGame) {
  const s = game.teams.map((t) => t.score).sort((a, b) => b - a);
  return s[0] > 0 && s[0] - s[1] <= 100 && game.turn.questionsPlayed >= 2 && game.turn.questionsPlayed % 2 === 0;
}

function catOf(game: PublicGame, id: string): PublicCategory {
  return game.categories.find((c) => c.id === id) ?? { id, name: "", color: "#22A06B", pattern: "star", mode: "normal" };
}

function VoteStage({ game, phase, now }: { game: PublicGame; phase: Phase<"CATEGORY_VOTE">; now: () => number }) {
  const team = teamById(game.teams, phase.teamId)!;
  const members = game.players.filter((p) => p.teamId === team.id);
  const total = Math.max(1, ...Object.values(phase.counts));
  const cols = phase.options.length <= 4 ? 2 : phase.options.length <= 6 ? 3 : 4;
  return (
    <div className="flex h-full w-full flex-col items-center gap-[3vmin]">
      <div className="anim-rise flex items-center gap-[3vmin]">
        <div className="text-center">
          <div className="text-[5vmin] font-bold">
            دور <span style={{ color: team.color }}>{team.name}</span>
          </div>
          <div className="text-[2.8vmin] text-cream/70">صوّتوا للفئة من جوالاتكم</div>
        </div>
        <TimerRing timer={phase.timer} now={now} size={Math.round(window.innerHeight * 0.11)} />
      </div>
      {closeRace(game) && (
        <div className="anim-stamp rounded-full bg-[#e0592a] px-[3vmin] py-[0.8vmin] text-[3.4vmin] font-black">المنافسة ولعت! 🔥</div>
      )}

      {phase.tie && (
        <div className="anim-stamp rounded-2xl bg-gold px-[4vmin] py-[1.4vmin] text-[3.6vmin] font-bold text-ink">
          تعادل التصويت — غيّروا صوتاً واحداً!
        </div>
      )}

      <div className="grid w-full max-w-[150vmin] flex-1 gap-[2.4vmin]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {phase.options.map((id, i) => {
          const c = catOf(game, id);
          const n = phase.counts[id] ?? 0;
          return (
            <div
              key={id}
              className="anim-deal relative flex flex-col justify-end overflow-hidden rounded-[2.4vmin] p-[2.4vmin]"
              style={{
                animationDelay: `${i * 60}ms`,
                backgroundColor: c.color,
                backgroundImage: `${patternBg(c.pattern, "rgba(255,255,255,.2)")}, linear-gradient(180deg, transparent, rgba(0,0,0,.35))`,
                boxShadow: n ? `0 0 0 4px #f6f0e1, 0 10px 40px ${c.color}88` : "0 10px 30px rgba(0,0,0,.3)",
                transform: n ? `scale(${1 + (0.05 * n) / total})` : undefined,
                transition: "transform 300ms, box-shadow 300ms",
              }}
            >
              <span className="text-[4vmin] leading-tight font-bold drop-shadow">{c.name}</span>
              {c.mode === "buzzer" && <span className="text-[2vmin] text-cream/90">⚡ أسرع إصبع</span>}
              <div className="mt-[1.2vmin] h-[1.2vmin] overflow-hidden rounded-full bg-ink/40">
                <div className="h-full rounded-full bg-cream transition-all duration-300" style={{ width: `${(n / total) * 100}%` }} />
              </div>
              {n > 0 && (
                <span className="num anim-pop absolute top-[1.6vmin] left-[1.6vmin] flex h-[6vmin] w-[6vmin] items-center justify-center rounded-full bg-cream text-[3.2vmin] font-bold text-ink">
                  {n}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-[1.5vmin] text-[2.4vmin] text-cream/70">
        {members.map((m) => (
          <div key={m.id} className="relative" style={{ opacity: phase.voters.includes(m.id) ? 1 : 0.35 }}>
            <Avatar player={m} color={team.color} size={Math.round(window.innerHeight * 0.05)} />
            {phase.voters.includes(m.id) && <span className="anim-pop absolute -bottom-1 -left-1 text-[2vmin]">✅</span>}
          </div>
        ))}
        <span className="num ms-2">
          {phase.voters.length}/{members.length}
        </span>
      </div>
    </div>
  );
}

function CardStage({ game, phase, now }: { game: PublicGame; phase: Phase<"CARD_PICK">; now: () => number }) {
  const team = teamById(game.teams, phase.teamId)!;
  const c = catOf(game, phase.categoryId);
  const cards = game.boards[phase.categoryId] ?? [];
  const cols = cards.length <= 4 ? cards.length : Math.ceil(cards.length / 2);
  return (
    <div className="flex h-full w-full flex-col items-center gap-[2.5vmin]">
      <div className="anim-rise flex items-center gap-[3vmin]">
        <span
          className="rounded-full px-[3vmin] py-[1vmin] text-[4.4vmin] font-bold"
          style={{ backgroundColor: c.color, backgroundImage: patternBg(c.pattern, "rgba(255,255,255,.18)") }}
        >
          {c.name}
        </span>
        <span className="text-[3.4vmin]">
          <span style={{ color: team.color }} className="font-bold">
            {team.name}
          </span>{" "}
          — اختاروا الكرت
        </span>
        <TimerRing timer={phase.timer} now={now} size={Math.round(window.innerHeight * 0.09)} />
      </div>
      <div
        className="grid min-h-0 w-full flex-1 place-content-center gap-[3vmin]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 24vmin))` }}
      >
        {cards.map((card, i) => (
          <div key={i} className="anim-deal aspect-[5/7] w-full" style={{ animationDelay: `${i * 70}ms` }}>
            {card.used ? <UsedCard outcome={card.outcome} /> : <CardBack color={c.color} pattern={c.pattern} label={<span className="num">{i + 1}</span>} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionStage({
  game,
  phase,
  now,
}: {
  game: PublicGame;
  phase: Phase<"QUESTION"> | Phase<"STEAL"> | Phase<"RESULT">;
  now: () => number;
}) {
  const c = catOf(game, phase.question.categoryId);
  const q = phase.question;
  const [flipped, setFlipped] = useState(phase.name !== "QUESTION");
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 380);
    return () => clearTimeout(t);
  }, [q.id]);

  const teamId = phase.name === "RESULT" ? phase.activeTeamId : phase.teamId;
  const team = teamById(game.teams, teamId)!;
  const cardIndex = phase.name === "RESULT" ? 0 : phase.cardIndex;
  const timer = phase.name === "RESULT" ? null : phase.timer;
  const buzzer = phase.name === "QUESTION" ? phase.buzzer : null;
  const attempt = phase.name === "RESULT" ? null : phase.attempt;
  const correctOption = phase.name === "RESULT" ? phase.correctOption : null;
  const excluded = phase.name === "STEAL" ? phase.excludedOption : null;
  const readyAt = phase.name === "RESULT" ? 0 : phase.readyAt;
  const vote = phase.name === "RESULT" ? null : phase.teamVote;
  const prepLeft = useUntil(readyAt, now);
  const [goFlash, setGoFlash] = useState(false);
  const wasPrep = useRef(false);
  useEffect(() => {
    if (prepLeft > 0) {
      wasPrep.current = true;
      return;
    }
    if (!wasPrep.current) return;
    wasPrep.current = false;
    setGoFlash(true);
    const t = setTimeout(() => setGoFlash(false), 1300);
    return () => clearTimeout(t);
  }, [prepLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full w-full items-center gap-[4vmin]">
      <div className="card3d relative h-full max-h-[78vh] flex-1" style={{ perspective: "1600px" }}>
        <div
          className="card3d-inner"
          style={{
            transform: flipped ? "rotateY(180deg)" : "translateY(-2vmin) scale(0.55)",
            transition: "transform 750ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          <div className="card3d-face">
            <CardBack color={c.color} pattern={c.pattern} label={<span className="num">{cardIndex + 1}</span>} big />
          </div>
          <div
            className="card3d-face card3d-back flex flex-col bg-cream text-ink"
            style={{ boxShadow: `inset 0 0 0 1.2vmin ${c.color}, 0 30px 60px rgba(0,0,0,.45)` }}
          >
            <div
              className="flex items-center justify-between px-[4vmin] py-[2vmin] text-cream"
              style={{ backgroundColor: c.color, backgroundImage: patternBg(c.pattern, "rgba(255,255,255,.18)") }}
            >
              <span className="text-[3.4vmin] font-bold">{c.name}</span>
              <span className="num text-[2.8vmin] font-bold opacity-90">{q.points}</span>
            </div>
            <QuestionBody q={q} attempt={attempt} correctOption={correctOption} excluded={excluded} />
            {phase.name === "RESULT" && (
              <div className="anim-rise mx-[3vmin] mb-[3vmin] rounded-[2vmin] bg-deep px-[3vmin] py-[2vmin] text-center text-cream">
                <span className="text-[2.6vmin] text-cream/60">الإجابة: </span>
                <span className="text-[4.4vmin] font-bold text-goldlight">{phase.answer}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="flex w-[26vmin] shrink-0 flex-col items-center gap-[3vmin]">
        {prepLeft > 0 ? (
          <div className="flex flex-col items-center gap-[1vmin] text-center">
            <span className="text-[3.4vmin] font-bold text-cream/80">استعدوا…</span>
            <span key={Math.ceil(prepLeft / 1000)} className="num anim-count text-[16vmin] leading-none font-black text-goldlight">
              {Math.ceil(prepLeft / 1000)}
            </span>
          </div>
        ) : (
          timer && !timer.stopped && <TimerRing timer={timer} now={now} size={Math.round(window.innerHeight * 0.2)} />
        )}
        {goFlash && (
          <div className="anim-stamp rounded-[2vmin] bg-gold px-[2vmin] py-[1vmin] text-[4.4vmin] font-black text-ink">
            {buzzer ? "انطلق!" : "جاوب الآن!"}
          </div>
        )}
        {vote && !attempt && prepLeft <= 0 && (
          <div className="flex flex-col items-center gap-[0.6vmin] rounded-[2vmin] bg-ink/60 px-[2vmin] py-[1.4vmin] text-center">
            <span className="text-[2.8vmin] font-bold">
              {vote.stuck ? "تعادل — المضيف يحسم" : vote.tie ? "تعادل! جولة حسم" : "الفريق يتشاور..."}
            </span>
            <span className="num text-[2.6vmin] text-cream/70">
              صوّت {vote.voters.length} من {vote.total}
            </span>
          </div>
        )}
        {phase.name === "STEAL" ? (
          <div className="anim-stamp flex flex-col items-center gap-[1vmin] text-center">
            <span className="text-[7vmin] font-black text-gold">سرقة!</span>
            <TeamBadge team={teamById(game.teams, phase.teamId)!} className="text-[3vmin]" />
          </div>
        ) : buzzer ? (
          <BuzzerPanel game={game} buzzer={buzzer} />
        ) : phase.name !== "RESULT" ? (
          <div className="flex flex-col items-center gap-[1vmin] text-center">
            <span className="text-[2.4vmin] text-cream/60">يجاوب الآن</span>
            <TeamBadge team={team} className="text-[3.2vmin]" />
          </div>
        ) : null}
      </aside>

      {phase.name === "RESULT" && <Reaction game={game} phase={phase} />}
    </div>
  );
}

function QuestionBody({
  q,
  attempt,
  correctOption,
  excluded,
}: {
  q: PublicQuestion;
  attempt: { option: number; correct: boolean } | null;
  correctOption: number | null;
  excluded: number | null;
}) {
  const emojiOnly = !/[\u0600-\u06FFA-Za-z]/.test(q.question);
  const long = q.question.length > 90;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2.5vmin] px-[5vmin] py-[3vmin] text-center">
      {q.type === "COMPLETE_PHRASE" && <span className="text-[2.6vmin] font-semibold text-forest/70">أكمل العبارة</span>}
      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" className="max-h-[34vh] max-w-full rounded-[2vmin] object-contain shadow-lg" />
      )}
      <p
        className="leading-snug font-bold"
        style={{ fontSize: emojiOnly ? "11vmin" : long ? "4.4vmin" : q.imageUrl ? "4.6vmin" : "6vmin" }}
      >
        {q.question}
      </p>
      {q.options && (
        <div className={`grid w-full gap-[1.8vmin] ${q.options.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {q.options.map((o, i) => {
            const picked = attempt?.option === i;
            const right = correctOption === i || (picked && attempt?.correct);
            const wrong = picked && !attempt?.correct;
            return (
              <div
                key={i}
                className={`flex items-center gap-[2vmin] rounded-[1.8vmin] px-[2.4vmin] py-[1.6vmin] text-start text-[3.4vmin] font-bold transition ${
                  right ? "bg-leaf text-white anim-pop" : wrong ? "bg-danger text-white act-shake" : excluded === i ? "bg-ink/10 line-through opacity-40" : "bg-deep/8"
                }`}
                style={{ boxShadow: "inset 0 0 0 2px rgba(7,42,29,.15)" }}
              >
                <span className="flex h-[5vmin] w-[5vmin] shrink-0 items-center justify-center rounded-full bg-deep text-[2.6vmin] text-cream">
                  {q.type === "TRUE_FALSE" ? (i === 0 ? "✓" : "✕") : OPTION_LETTERS[i]}
                </span>
                {o}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuzzerPanel({ game, buzzer }: { game: PublicGame; buzzer: NonNullable<Phase<"QUESTION">["buzzer"]> }) {
  if (!buzzer.lockedBy) {
    return (
      <div className="flex flex-col items-center gap-[2vmin] text-center">
        <div className="anim-pulse flex h-[18vmin] w-[18vmin] items-center justify-center rounded-full bg-danger text-[4vmin] font-black">
          اضغط!
        </div>
        <span className="text-[2.6vmin] text-cream/80">أسرع إصبع يجاوب</span>
        {buzzer.excludedTeamIds.length > 0 && (
          <span className="text-[2vmin] text-cream/50">
            خارج المحاولة: {buzzer.excludedTeamIds.map((id) => teamById(game.teams, id)?.name).join("، ")}
          </span>
        )}
      </div>
    );
  }
  const player = game.players.find((p) => p.id === buzzer.lockedBy!.playerId);
  const team = teamById(game.teams, buzzer.lockedBy.teamId)!;
  return (
    <div className="anim-pop flex flex-col items-center gap-[1.4vmin] text-center">
      <span className="mb-[5vmin] text-[2.8vmin] font-bold text-goldlight">اللاعب الأسرع</span>
      {player && <Character player={player} color={team.color} size={Math.round(window.innerHeight * 0.16)} action="jump" />}
      <TeamBadge team={team} className="text-[2.6vmin]" />
    </div>
  );
}

function Reaction({ game, phase }: { game: PublicGame; phase: Phase<"RESULT"> }) {
  const good = phase.outcome === "correct" || phase.outcome === "steal";
  const teamId = good ? phase.teamId! : phase.activeTeamId;
  const team = teamById(game.teams, teamId)!;
  return (
    <GameReaction
      kind={phase.outcome}
      seed={`${phase.question.id}:${phase.outcome}`}
      players={game.players.filter((p) => p.teamId === teamId)}
      team={team}
      points={phase.points}
      answer={phase.answer}
      streak={good ? game.streaks[teamId] ?? 0 : 0}
    />
  );
}

// ─── Finale ─────────────────────────────────────────────────────────────────

const WINNER_LINES = ["يستاهلون", "خذوها بجدارة", "كفو والله", "أبطال الخيمة", "ما خلو لكم شيء", "وش هالمستوى!"];

function WinnerLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WINNER_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div key={i} className="rx-line mt-[1vmin] text-[5vmin] font-bold text-cream/90">
      {WINNER_LINES[i]}
    </div>
  );
}

function Finale({ game, phase, sound }: { game: PublicGame; phase: Phase<"GAME_OVER">; sound: boolean }) {
  const [step, setStep] = useState<"dim" | 3 | 2 | 1 | "reveal">("dim");
  useEffect(() => {
    const seq: ("dim" | 3 | 2 | 1 | "reveal")[] = [3, 2, 1, "reveal"];
    const timers = seq.map((s, i) =>
      setTimeout(() => {
        setStep(s);
        if (sound) sfx?.play(s === "reveal" ? "winner" : "drum");
      }, 900 + i * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [sound]);

  useEffect(() => {
    if (step !== "reveal") return;
    confettiBurst(1.4);
    return fireworks(7000);
  }, [step]);

  const winners = phase.winners.map((id) => teamById(game.teams, id)!).filter(Boolean);
  // the losing team gets its (gentle) moment after the winner celebration
  const [showLosers, setShowLosers] = useState(false);
  useEffect(() => {
    if (step !== "reveal") return;
    const t = setTimeout(() => setShowLosers(true), 5000);
    return () => clearTimeout(t);
  }, [step]);
  const tie = winners.length > 1;
  const sorted = [...game.teams].sort((a, b) => b.score - a.score);

  if (step !== "reveal") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink">
        {step !== "dim" && (
          <span key={step} className="num anim-count text-[40vmin] font-black text-goldlight">
            {step}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="rx-screenshake relative flex h-full w-full flex-col items-center justify-center gap-[2.5vmin] p-[4vmin]">
      <div className="rx-glow" />
      <Logo96 size={Math.round(window.innerHeight * 0.11)} />
      <div className="anim-pop relative text-center">
        {tie ? (
          <div className="text-[12vmin] font-black text-goldlight">تعادل!</div>
        ) : (
          <>
            <div className="text-[5vmin] font-bold text-goldlight">الفائز</div>
            <div className="rx-pulse text-[15vmin] leading-tight font-black drop-shadow-[0_8px_30px_rgba(0,0,0,.5)]" style={{ color: winners[0].color }}>
              {winners[0].name}
            </div>
          </>
        )}
        <WinnerLine />
      </div>
      {winners.map((w) => (
        <WinnerCrew
          key={w.id}
          players={game.players.filter((p) => p.teamId === w.id)}
          color={w.color}
          size={Math.round(window.innerHeight * 0.17)}
        />
      ))}
      {showLosers && !tie && (
        <div className="flex flex-wrap justify-center gap-[2vmin]">
          {game.teams
            .filter((t) => !phase.winners.includes(t.id))
            .map((t) => (
              <LoserCrew key={t.id} team={t} players={game.players.filter((p) => p.teamId === t.id)} size={Math.round(window.innerHeight * 0.08)} />
            ))}
        </div>
      )}
      <div className="flex gap-[3vmin]">
        {sorted.map((t, i) => (
          <div
            key={t.id}
            className="anim-rise flex items-center gap-[2vmin] rounded-full px-[3vmin] py-[1.2vmin]"
            style={{ animationDelay: `${300 + i * 150}ms`, background: `${t.color}33`, boxShadow: `inset 0 0 0 2px ${t.color}` }}
          >
            <span className="text-[3vmin] font-bold">{t.name}</span>
            <span className="num text-[4vmin] font-black">{t.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
