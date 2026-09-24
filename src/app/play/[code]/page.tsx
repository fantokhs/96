"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { confettiBurst } from "@/components/effects";
import { GameReaction } from "@/components/GameReaction";
import { patternBg } from "@/components/patterns";
import {
  Avatar,
  CardBack,
  Character,
  FullScreenMessage,
  Logo96,
  OPTION_LETTERS,
  Spinner,
  TeamBadge,
  teamById,
  UsedCard,
} from "@/components/ui";
import { api, local } from "@/lib/client/api";
import { fileToDataUrl } from "@/lib/client/image";
import { useCountdown, useGame, useTickDriver, useUntil } from "@/lib/client/useGame";
import type { Gender, PlayerAction, PublicGame, PublicPhase, PublicPlayer, Team } from "@/lib/game/types";

type Phase<N extends PublicPhase["name"]> = Extract<PublicPhase, { name: N }>;
interface Identity {
  playerId: string;
  token: string;
}
type Send = (a: PlayerAction) => Promise<boolean>;

const buzz = (ms = 25) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const code = use(params).code.toUpperCase();
  const [key, setKey] = useState<string | null>(null);
  const [me, setMe] = useState<Identity | null>(null);
  const justJoined = useRef(false);
  const { game, setGame, error, online, now } = useGame(code);
  const [toast, setToast] = useState("");
  // Phones also nudge timed transitions (staggered) in case the host device sleeps.
  useTickDriver(game, now, 1500);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const restored = useRef(false);
  const [reconnected, setReconnected] = useState(false);
  const wasOffline = useRef(false);

  const isPlayer = !!(me && game?.players.some((p) => p.id === me.playerId));

  // Auto-reconnect: a stored identity that still exists in the game is simply resumed.
  useEffect(() => {
    if (!isPlayer || restored.current) return;
    restored.current = true;
    if (!justJoined.current) {
      setWelcomeBack(true);
      const t = setTimeout(() => setWelcomeBack(false), 2200);
      return () => clearTimeout(t);
    }
  }, [isPlayer]);

  // Presence heartbeat (used for the team-vote majority). Cheap: the server writes at most every ~20s.
  useEffect(() => {
    if (!isPlayer || !me) return;
    const ping = () =>
      void api(`/api/sessions/${code}/act`, { json: { role: "player", ...me, action: { type: "ping" } } }).catch(() => {});
    ping();
    const id = setInterval(ping, 15_000);
    const onVis = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [isPlayer, me, code]);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setReconnected(true);
      const t = setTimeout(() => setReconnected(false), 1800);
      return () => clearTimeout(t);
    }
  }, [online]);

  useEffect(() => {
    // `?slot=n` lets several test players share one browser (see /dev).
    const slot = new URLSearchParams(window.location.search).get("slot");
    const k = `96:player:${code}${slot ? `:${slot}` : ""}`;
    setKey(k);
    setMe(local.get<Identity>(k));
  }, [code]);

  const send: Send = useCallback(
    async (action) => {
      if (!me) return false;
      try {
        setGame(await api<PublicGame>(`/api/sessions/${code}/act`, { json: { role: "player", ...me, action } }));
        return true;
      } catch (e) {
        setToast((e as Error).message);
        setTimeout(() => setToast(""), 2200);
        return false;
      }
    },
    [code, me, setGame],
  );

  if (error?.status === 404) {
    return (
      <FullScreenMessage title="ما لقينا هذه الجلسة">
        <p className="text-cream/60">
          الكود <span className="num font-bold">{code}</span> غير صحيح أو انتهت الجلسة
        </p>
        <Link href="/" className="btn btn-gold">
          جرّب كود ثاني
        </Link>
      </FullScreenMessage>
    );
  }
  if (!game || key === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    );
  }

  const player = me ? game.players.find((p) => p.id === me.playerId) : undefined;
  if (!player) {
    return (
      <JoinForm
        game={game}
        removed={!!me}
        onJoined={(id, state) => {
          justJoined.current = true;
          local.set(key, id);
          setMe(id);
          setGame(state);
        }}
      />
    );
  }

  const team = teamById(game.teams, player.teamId);
  return (
    <main className="bg-majlis flex min-h-dvh flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar player={player} color={team?.color ?? "#22A06B"} size={42} />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-bold">{player.name}</div>
            {team && <div className="text-sm font-semibold" style={{ color: team.color }}>{team.name}</div>}
          </div>
        </div>
        {team && game.phase.name !== "LOBBY" && (
          <div className="rounded-2xl bg-ink/50 px-3 py-1.5 text-center">
            <div className="text-[11px] text-cream/60">نقاط فريقك</div>
            <div className="num text-xl font-bold">{team.score}</div>
          </div>
        )}
      </header>

      {!online && <div className="mx-4 rounded-xl bg-danger/30 px-3 py-2 text-center text-sm">جاري إعادة الاتصال...</div>}
      {online && reconnected && <div className="anim-fade mx-4 rounded-xl bg-leaf/30 px-3 py-2 text-center text-sm">تم الاتصال ✓</div>}
      {welcomeBack && (
        <div className="anim-pop fixed inset-x-6 top-6 z-50 rounded-2xl bg-gold px-4 py-3 text-center text-lg font-bold text-ink shadow-xl">
          رجعنا لك 👋
        </div>
      )}

      <section className="flex flex-1 flex-col px-4 pb-6">
        {game.paused ? (
          <Waiting emoji="⏸" title="استراحة قصيرة" sub="المضيف أوقف اللعبة مؤقتاً" />
        ) : (
          <Controller game={game} me={player} team={team} send={send} now={now} onLeave={() => { local.del(key); setMe(null); }} />
        )}
      </section>

      {toast && (
        <div className="anim-rise fixed inset-x-4 bottom-6 z-50 rounded-2xl bg-danger px-4 py-3 text-center font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

// ─── Join ───────────────────────────────────────────────────────────────────

function JoinForm({
  game,
  removed,
  onJoined,
}: {
  game: PublicGame;
  removed: boolean;
  onJoined: (id: Identity, state: PublicGame) => void;
}) {
  // iOS Safari may reload the page after using the camera, so keep the draft.
  const draftKey = `96:join-draft:${game.code}`;
  const draft = useRef(
    (() => {
      try {
        return JSON.parse(sessionStorage.getItem(draftKey) || "{}") as { name?: string; gender?: Gender; teamId?: string | null };
      } catch {
        return {};
      }
    })(),
  ).current;
  const [name, setName] = useState(draft.name ?? "");
  const [gender, setGender] = useState<Gender>(draft.gender ?? null);
  const [teamId, setTeamId] = useState<string | null>(draft.teamId ?? null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState("");

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, gender, teamId }));
    } catch {}
  }, [draftKey, name, gender, teamId]);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;
    setPhotoBusy(true);
    setPhotoNote("");
    try {
      // Copy the bytes right away: on iPhone a fresh camera capture is a temporary
      // file that can become unreadable once the input is reset or re-rendered.
      const bytes = await f.arrayBuffer();
      const blob = new Blob([bytes], { type: f.type || "image/jpeg" });
      setPhoto(await fileToDataUrl(blob, { size: 256, square: true }));
    } catch {
      setPhotoNote("ما قدرنا نقرأ الصورة — جرّب «اختيار من الصور» أو ادخل بدونها");
    } finally {
      input.value = ""; // allow picking again, only after we're done reading
      setPhotoBusy(false);
    }
  };

  if (game.phase.name === "GAME_OVER") {
    return (
      <FullScreenMessage title="انتهت هذه اللعبة">
        <p className="text-cream/60">اطلب من المضيف يبدأ جولة جديدة</p>
      </FullScreenMessage>
    );
  }

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      let avatarUrl: string | null = null;
      if (photo) {
        // The photo is optional: if the upload fails, join without it.
        avatarUrl = await api<{ url: string }>("/api/media", { json: { dataUrl: photo } })
          .then((r) => r.url)
          .catch(() => null);
      }
      const res = await api<Identity & { state: PublicGame }>(`/api/sessions/${game.code}/join`, {
        json: { name, gender, avatarUrl, teamId },
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      onJoined({ playerId: res.playerId, token: res.token }, res.state);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const preview: PublicPlayer = { id: "me", name: name || "؟", gender, avatarUrl: photo, teamId, online: true };
  const color = teamById(game.teams, teamId)?.color ?? "#22A06B";

  return (
    <main className="bg-majlis flex min-h-dvh flex-col items-center gap-5 px-5 py-8">
      <Logo96 size={56} />
      <div className="text-center">
        {game.name !== "خيمة الفنتوخ" && <div className="text-sm text-cream/60">{game.name}</div>}
        <div className="num text-lg font-bold tracking-widest text-goldlight">{game.code}</div>
      </div>
      {removed && <p className="rounded-xl bg-cream/10 px-4 py-2 text-sm">خرجت من الجلسة — ادخل من جديد</p>}

      <div className="flex flex-col items-center gap-3">
        <Character player={preview} color={color} size={110} showName={false} />
        <div className="grid w-full max-w-sm grid-cols-2 gap-2">
          <label className="btn btn-ghost cursor-pointer px-2 py-3 text-sm">
            📷 التقاط صورة
            <input type="file" accept="image/*" capture="user" className="sr-only" onChange={onPhoto} />
          </label>
          <label className="btn btn-ghost cursor-pointer px-2 py-3 text-sm">
            🖼️ اختيار من الصور
            <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
          </label>
        </div>
        {photoBusy && <span className="text-sm text-cream/60">جارٍ تجهيز الصورة…</span>}
        {photo && !photoBusy && (
          <button className="text-sm text-cream/50 underline" onClick={() => setPhoto(null)}>
            إزالة الصورة
          </button>
        )}
        {photoNote && <span className="text-center text-sm text-[#ffb3b0]">{photoNote}</span>}
        <span className="text-xs text-cream/40">الصورة اختيارية</span>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <input
          className="field text-center text-xl font-bold"
          placeholder="اكتب اسمك"
          value={name}
          maxLength={24}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              className={`btn py-3 ${gender === g ? "btn-gold" : "btn-ghost"}`}
              onClick={() => setGender(gender === g ? null : g)}
            >
              {g === "male" ? "👨 ذكر" : "👩 أنثى"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-center text-sm text-cream/60">اختر فريقك</span>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${game.teams.length + 1}, 1fr)` }}>
            <button className={`btn px-2 py-3 text-sm ${teamId === null ? "btn-gold" : "btn-ghost"}`} onClick={() => setTeamId(null)}>
              🎲 وزّعني
            </button>
            {game.teams.map((t) => (
              <button
                key={t.id}
                className="btn px-2 py-3 text-sm"
                style={{
                  background: teamId === t.id ? t.color : `${t.color}22`,
                  boxShadow: `inset 0 0 0 2px ${t.color}`,
                  color: "#f6f0e1",
                }}
                onClick={() => setTeamId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-center text-[#ffb3b0]">{err}</p>}

        <button className="btn btn-gold py-4 text-xl" disabled={busy || photoBusy || !name.trim()} onClick={submit}>
          {busy ? "لحظة…" : "ادخل اللعبة"}
        </button>
      </div>
    </main>
  );
}

// ─── Controller ─────────────────────────────────────────────────────────────

function Controller({
  game,
  me,
  team,
  send,
  now,
  onLeave,
}: {
  game: PublicGame;
  me: PublicPlayer;
  team: Team | undefined;
  send: Send;
  now: () => number;
  onLeave: () => void;
}) {
  const p = game.phase;
  const color = team?.color ?? "#22A06B";
  switch (p.name) {
    case "LOBBY":
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="anim-float">
            <Character player={me} color={color} size={130} showName={false} />
          </div>
          <div>
            <div className="text-2xl font-bold">أهلاً {me.name}!</div>
            <div className="mt-1 text-cream/60">انتظر المضيف يبدأ اللعبة</div>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <span className="text-sm text-cream/60">فريقك</span>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${game.teams.length}, 1fr)` }}>
              {game.teams.map((t) => (
                <button
                  key={t.id}
                  className="btn px-2 py-3"
                  style={{ background: me.teamId === t.id ? t.color : `${t.color}22`, boxShadow: `inset 0 0 0 2px ${t.color}` }}
                  onClick={() => me.teamId !== t.id && send({ type: "choose_team", teamId: t.id })}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <button
            className="text-sm text-cream/40 underline"
            onClick={async () => {
              if (confirm("تبي تطلع من اللعبة؟") && (await send({ type: "leave" }))) onLeave();
            }}
          >
            خروج
          </button>
        </div>
      );
    case "CATEGORY_VOTE":
      return me.teamId === p.teamId ? (
        <VoteView game={game} phase={p} me={me} send={send} now={now} />
      ) : (
        <Waiting emoji="🗳️" title={`${teamById(game.teams, p.teamId)?.name} يختارون الفئة`} sub="انتظر دور فريقك" />
      );
    case "CARD_PICK":
      return me.teamId === p.teamId ? (
        <CardView key={`${p.categoryId}-${game.turn.questionsPlayed}`} game={game} phase={p} send={send} />
      ) : (
        <Waiting emoji="🃏" title={`${teamById(game.teams, p.teamId)?.name} يختارون الكرت`} sub="انتظر دور فريقك" />
      );
    case "QUESTION":
      if (p.buzzer) return <BuzzerView key={p.question.id} game={game} phase={p} me={me} send={send} now={now} />;
      return me.teamId === p.teamId ? (
        <AnswerView key={`q-${p.question.id}`} game={game} phase={p} me={me} send={send} now={now} />
      ) : (
        <Waiting emoji="👀" title="انتظر دور فريقك" sub="ركّز… يمكن تجيكم فرصة سرقة!" />
      );
    case "STEAL":
      return me.teamId === p.teamId ? (
        <AnswerView key={`s-${p.question.id}`} game={game} phase={p} me={me} send={send} now={now} />
      ) : (
        <Waiting emoji="⚡" title={`${teamById(game.teams, p.teamId)?.name} يحاولون السرقة`} sub="انتظر دور فريقك" />
      );
    case "RESULT":
      return <ResultView game={game} phase={p} me={me} />;
    case "GAME_OVER":
      return <OverView game={game} phase={p} me={me} />;
  }
}

function Waiting({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="anim-fade flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="anim-float text-7xl">{emoji}</span>
      <div className="text-2xl font-bold">{title}</div>
      {sub && <div className="text-cream/60">{sub}</div>}
    </div>
  );
}

function MiniTimer({ phase, now }: { phase: { timer: Phase<"QUESTION">["timer"] }; now: () => number }) {
  const { left } = useCountdown(phase.timer, now);
  if (phase.timer.stopped) return null;
  return (
    <span className={`num rounded-full px-3 py-1 text-lg font-bold ${left <= 5 ? "bg-danger" : "bg-ink/60"}`}>{left}</span>
  );
}

function VoteView({
  game,
  phase,
  me,
  send,
  now,
}: {
  game: PublicGame;
  phase: Phase<"CATEGORY_VOTE">;
  me: PublicPlayer;
  send: Send;
  now: () => number;
}) {
  const [mine, setMine] = useState<string | null>(null);
  const voted = phase.voters.includes(me.id);
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">صوّت للفئة</h2>
        <MiniTimer phase={phase} now={now} />
      </div>
      {phase.tie && <div className="anim-stamp rounded-xl bg-gold px-3 py-2 text-center font-bold text-ink">تعادل! غيّروا صوتاً واحداً</div>}
      <div className="grid flex-1 grid-cols-2 content-start gap-3">
        {phase.options.map((id) => {
          const c = game.categories.find((x) => x.id === id)!;
          const on = voted && mine === id;
          return (
            <button
              key={id}
              className="relative flex min-h-24 flex-col items-start justify-end rounded-2xl p-3 text-right text-lg leading-tight font-bold transition active:scale-95"
              style={{
                backgroundColor: c.color,
                backgroundImage: patternBg(c.pattern, "rgba(255,255,255,.18)"),
                boxShadow: on ? "0 0 0 4px #f6f0e1" : "none",
                opacity: voted && !on ? 0.6 : 1,
              }}
              onClick={async () => {
                buzz();
                setMine(id);
                await send({ type: "vote_category", categoryId: id });
              }}
            >
              {c.name}
              {c.mode === "buzzer" && <span className="text-xs font-normal">⚡ أسرع إصبع</span>}
              {on && <span className="anim-pop absolute top-2 left-2 text-xl">✓</span>}
            </button>
          );
        })}
      </div>
      {voted && <p className="text-center text-sm text-cream/60">تم التصويت — تقدر تغيّر رأيك</p>}
    </div>
  );
}

/** Big 3-2-1 shown while answers are locked. */
function Prep({ left, title, sub, go }: { left: number; title: string; sub?: string; go: string }) {
  const n = Math.ceil(left / 1000);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center select-none" style={{ pointerEvents: "none" }}>
      <div className="text-2xl font-bold text-goldlight">{title}</div>
      {sub && <div className="text-cream/70">{sub}</div>}
      <div className="text-xl font-bold">استعدوا…</div>
      <span key={n} className="num anim-count text-[9rem] leading-none font-black text-goldlight">
        {n > 0 ? n : go}
      </span>
    </div>
  );
}

/**
 * Carry-over tap protection: a tap only counts if the finger went down AFTER the
 * controls became active, so the touch that picked a category/card can't answer.
 */
function useFreshTap(active: boolean) {
  const since = useRef<number>(Infinity);
  const downAt = useRef<number>(0);
  useEffect(() => {
    since.current = active ? performance.now() : Infinity;
  }, [active]);
  return {
    onPointerDown: () => {
      downAt.current = performance.now();
    },
    fresh: () => active && downAt.current >= since.current,
  };
}

function CardView({ game, phase, send }: { game: PublicGame; phase: Phase<"CARD_PICK">; send: Send }) {
  const c = game.categories.find((x) => x.id === phase.categoryId)!;
  const cards = game.boards[phase.categoryId] ?? [];
  // brief lock so the category-vote tap can't pick a card
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 700);
    return () => clearTimeout(t);
  }, []);
  const tap = useFreshTap(armed);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="text-center">
        <div className="text-sm text-cream/60">تم اختيار الفئة</div>
        <div className="text-xl font-bold" style={{ color: c.color }}>{c.name}</div>
        <h2 className="mt-1 text-2xl font-bold">اختر كرت!</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <button
            key={i}
            disabled={card.used || !armed}
            className="anim-deal aspect-[5/7] transition active:scale-95 disabled:pointer-events-none"
            style={{ animationDelay: `${i * 50}ms` }}
            onPointerDown={tap.onPointerDown}
            onClick={() => {
              if (!tap.fresh()) return;
              buzz(40);
              void send({ type: "pick_card", index: i });
            }}
          >
            {card.used ? <UsedCard outcome={card.outcome} /> : <CardBack color={c.color} pattern={c.pattern} label={<span className="num">{i + 1}</span>} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnswerView({
  game,
  phase,
  me,
  send,
  now,
}: {
  game: PublicGame;
  phase: Phase<"QUESTION"> | Phase<"STEAL">;
  me: PublicPlayer;
  send: Send;
  now: () => number;
}) {
  const q = phase.question;
  const steal = phase.name === "STEAL";
  const attempt = phase.attempt;
  const vote = phase.teamVote;
  const left = useUntil(phase.readyAt, now);
  const ready = left <= 0;
  const [goFlash, setGoFlash] = useState(false);
  const [mine, setMine] = useState<number | null>(null);
  const sentRef = useRef<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = !!attempt;
  const stuck = !!vote?.stuck;
  const tap = useFreshTap(ready && !locked && !stuck);
  const cat = game.categories.find((c) => c.id === q.categoryId);

  useEffect(() => {
    if (!ready || !phase.readyAt) return;
    setGoFlash(true);
    buzz(60);
    const t = setTimeout(() => setGoFlash(false), 1200);
    return () => clearTimeout(t);
  }, [ready, phase.readyAt]);
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);

  if (!ready) {
    return (
      <Prep
        left={left}
        title={steal ? "⚡ فرصة سرقة!" : `تم اختيار الفئة: ${cat?.name ?? ""}`}
        sub={q.options ? "السؤال على الشاشة — اقرأوه زين" : undefined}
        go="جاوب الآن!"
      />
    );
  }
  if (!q.options) {
    return <Waiting emoji="🎤" title="جاوبوا بصوت عالي!" sub="السؤال على الشاشة — المضيف هو الحكم" />;
  }

  const castVote = (i: number) => {
    if (locked || stuck || sentRef.current === i) return; // debounce repeats
    setMine(i);
    buzz(40);
    if (pending.current) clearTimeout(pending.current);
    const submit = () => {
      pending.current = null;
      sentRef.current = i;
      void send({ type: "answer", option: i }).then((ok) => {
        if (!ok && sentRef.current === i) sentRef.current = null;
      });
    };
    // one connected player: show the choice briefly before it becomes final
    if ((vote?.total ?? 1) <= 1) pending.current = setTimeout(submit, 700);
    else submit();
  };

  const voted = vote?.voters.includes(me.id) ?? false;
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{steal ? "⚡ فرصة سرقة!" : "دوركم!"}</h2>
        <MiniTimer phase={phase} now={now} />
      </div>
      {goFlash && !locked && <div className="anim-stamp rounded-2xl bg-gold py-2 text-center text-2xl font-black text-ink">جاوب الآن!</div>}
      {locked ? (
        <div className="anim-pop rounded-2xl bg-leaf/30 px-3 py-3 text-center text-lg font-bold ring-1 ring-leaf">تم اعتماد إجابة الفريق ✓</div>
      ) : stuck ? (
        <div className="rounded-2xl bg-gold/20 px-3 py-3 text-center font-bold text-goldlight">تعادل في تصويت الفريق — المضيف يحسم</div>
      ) : vote?.tie ? (
        <div className="anim-stamp rounded-2xl bg-gold px-3 py-2 text-center font-bold text-ink">تعادل! عندكم ٣ ثواني للحسم</div>
      ) : null}
      <div className={`grid flex-1 content-start gap-3 ${q.options.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {q.options.map((o, i) => {
          const final = attempt?.option === i;
          const chosen = !locked && mine === i;
          const excluded = steal && phase.excludedOption === i;
          return (
            <button
              key={i}
              disabled={locked || stuck || excluded}
              onPointerDown={tap.onPointerDown}
              onClick={() => tap.fresh() && castVote(i)}
              className={`flex items-center gap-3 rounded-2xl px-4 text-start text-lg font-bold transition active:scale-95 ${
                q.options!.length === 2 ? "min-h-40 flex-col justify-center text-3xl" : "min-h-16 py-3"
              } ${
                final
                  ? attempt?.correct
                    ? "bg-leaf"
                    : "bg-danger"
                  : chosen
                    ? "bg-gold text-ink ring-4 ring-cream"
                    : excluded
                      ? "bg-ink/40 line-through opacity-40"
                      : locked
                        ? "bg-cream/5 opacity-50"
                        : "bg-cream/10 ring-1 ring-cream/20"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-deep text-base text-cream">
                {q.type === "TRUE_FALSE" ? (i === 0 ? "✓" : "✕") : OPTION_LETTERS[i]}
              </span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {!locked && vote && (
        <div className="rounded-2xl bg-ink/50 px-4 py-3 text-center">
          {mine !== null ? (
            <div className="text-lg font-bold">
              اختيارك: {q.type === "TRUE_FALSE" ? q.options[mine] : OPTION_LETTERS[mine]}
            </div>
          ) : voted ? (
            <div className="text-lg font-bold">تم تسجيل صوتك</div>
          ) : (
            <div className="text-cream/70">صوتك يحدد إجابة الفريق — الأغلبية تُعتمد</div>
          )}
          <div className="num text-cream/70">
            صوّت {vote.voters.length} من {vote.total}
          </div>
        </div>
      )}
    </div>
  );
}

function BuzzerView({
  game,
  phase,
  me,
  send,
  now,
}: {
  game: PublicGame;
  phase: Phase<"QUESTION">;
  me: PublicPlayer;
  send: Send;
  now: () => number;
}) {
  const b = phase.buzzer!;
  const [pressed, setPressed] = useState(false);
  const left = useUntil(phase.readyAt, now);
  useEffect(() => setPressed(false), [b.lockedBy, b.excludedTeamIds.length]);
  if (b.lockedBy) {
    const winner = game.players.find((x) => x.id === b.lockedBy!.playerId);
    return b.lockedBy.playerId === me.id ? (
      <Waiting emoji="🎉" title="أنت الأسرع!" sub="جاوب بصوت عالي الحين" />
    ) : (
      <Waiting emoji="🔔" title={`سبقك ${winner?.name ?? "لاعب"}`} sub={teamById(game.teams, b.lockedBy.teamId)?.name} />
    );
  }
  if (me.teamId && b.excludedTeamIds.includes(me.teamId)) {
    return <Waiting emoji="🙈" title="فريقك خارج هذه المحاولة" sub="الفرق الثانية تحاول الحين" />;
  }
  if (left > 0) return <Prep left={left} title="⚡ أسرع إصبع" sub="السؤال على الشاشة" go="انطلق!" />;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="anim-stamp text-center text-3xl font-black text-goldlight">انطلق!</div>
      <button
        disabled={pressed}
        className="anim-pulse flex aspect-square w-[72vw] max-w-80 items-center justify-center rounded-full bg-danger text-5xl font-black shadow-[0_18px_0_#8f2a27] transition active:translate-y-3 active:shadow-[0_6px_0_#8f2a27] disabled:opacity-70"
        onPointerDown={async () => {
          if (pressed) return;
          setPressed(true);
          buzz(80);
          if (!(await send({ type: "buzz" }))) setPressed(false);
        }}
      >
        اضغط أولاً
      </button>
    </div>
  );
}

function ResultView({ game, phase, me }: { game: PublicGame; phase: Phase<"RESULT">; me: PublicPlayer }) {
  const scored = phase.teamId === me.teamId && phase.points > 0;
  const failed = !scored && phase.activeTeamId === me.teamId && phase.outcome !== "skipped";
  const team = teamById(game.teams, me.teamId);
  useEffect(() => {
    if (scored) buzz(120);
    else if (failed) buzz(40);
  }, [scored, failed]);
  return (
    <>
      {(scored || failed) && team && (
        <GameReaction
          kind={scored ? (phase.outcome === "steal" ? "steal" : "correct") : "wrong"}
          seed={`${phase.question.id}:${phase.outcome}`}
          players={[me]}
          team={team}
          points={phase.points}
          surface="phone"
          durationMs={2600}
        />
      )}
      {scored ? (
        <Waiting emoji="🎉" title={`+${phase.points}`} sub={`الإجابة: ${phase.answer}`} />
      ) : failed ? (
        <Waiting emoji="😅" title="هاردلك!" sub={`الإجابة: ${phase.answer}`} />
      ) : (
        <Waiting emoji="✨" title={`الإجابة: ${phase.answer}`} sub="الجولة الجاية قريب" />
      )}
    </>
  );
}

function OverView({ game, phase, me }: { game: PublicGame; phase: Phase<"GAME_OVER">; me: PublicPlayer }) {
  const won = !!me.teamId && phase.winners.includes(me.teamId);
  const tie = phase.winners.length > 1;
  useEffect(() => {
    if (won) setTimeout(() => confettiBurst(1), 4000);
  }, [won]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <span className="text-7xl">{won ? "🏆" : "👏"}</span>
      <div className="text-3xl font-bold">{won ? (tie ? "تعادل! مبروك" : "فزتم! مبروك") : "حظ أوفر المرة الجاية"}</div>
      <div className="flex flex-col gap-2">
        {[...game.teams]
          .sort((a, b) => b.score - a.score)
          .map((t) => (
            <div key={t.id} className="flex min-w-60 items-center justify-between gap-6 rounded-full px-5 py-2 text-lg font-bold" style={{ background: `${t.color}33`, boxShadow: `inset 0 0 0 2px ${t.color}` }}>
              <span>{t.name}</span>
              <span className="num">{t.score}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
