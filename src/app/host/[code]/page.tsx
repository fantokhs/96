"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { patternBg } from "@/components/patterns";
import {
  APP_VERSION,
  Avatar,
  FullScreenMessage,
  Logo96,
  OPTION_LETTERS,
  QR,
  Spinner,
  TeamBadge,
  teamById,
  TimerRing,
} from "@/components/ui";
import { api, local } from "@/lib/client/api";
import { useGame, useTickDriver, useUntil } from "@/lib/client/useGame";
import type { HostAction, HostView, PublicPhase, SoundboardSfx } from "@/lib/game/types";

type Phase<N extends PublicPhase["name"]> = Extract<PublicPhase, { name: N }>;
type Send = (a: HostAction) => Promise<void>;

const PHASE_LABEL: Record<PublicPhase["name"], string> = {
  LOBBY: "الانتظار",
  CATEGORY_VOTE: "تصويت الفئة",
  CARD_PICK: "اختيار الكرت",
  QUESTION: "السؤال",
  STEAL: "سرقة",
  RESULT: "النتيجة",
  GAME_OVER: "انتهت اللعبة",
};

export default function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const code = use(params).code.toUpperCase();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const m = /[#&]k=([\w-]+)/.exec(window.location.hash);
    if (m) {
      local.set(`96:host:${code}`, m[1]);
      history.replaceState(null, "", window.location.pathname);
      setToken(m[1]);
    } else {
      setToken(local.get<string>(`96:host:${code}`) ?? "");
    }
  }, [code]);

  if (token === null) return <Center><Spinner /></Center>;
  if (!token) {
    return (
      <PinLogin
        code={code}
        onOk={(pin) => {
          local.set(`96:host:${code}`, pin);
          setToken(pin);
        }}
      />
    );
  }
  return (
    <HostConsole
      code={code}
      token={token}
      onUnauthorized={() => {
        local.del(`96:host:${code}`);
        setToken("");
      }}
    />
  );
}

/** /control/CODE on any device: enter the shared control PIN once. */
function PinLogin({ code, onOk }: { code: string; onOk: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/sessions/${code}`, { headers: { "x-host-token": pin.trim() } });
      onOk(pin.trim());
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <main className="bg-majlis flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <Logo96 size={90} />
      <div className="text-center">
        <div className="text-sm text-cream/60">جهاز التحكم · الجلسة</div>
        <div className="num text-3xl font-bold tracking-[0.2em] text-goldlight">{code}</div>
      </div>
      <form
        className="flex w-full max-w-xs flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="text-center font-bold" htmlFor="pin">
          رمز التحكم
        </label>
        <input
          id="pin"
          className="field num text-center text-3xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <button className="btn btn-gold py-3 text-xl" disabled={busy || !pin.trim()}>
          {busy ? "لحظة…" : "دخول"}
        </button>
        {err && <p className="text-center text-[#ffb3b0]">{err}</p>}
      </form>
    </main>
  );
}

/** Opens the TV screen in its own window (easy to cast from a laptop). */
function openTv(url: string, code: string) {
  const w = window.open(url, `tv-${code}`, "popup,width=1280,height=720");
  if (!w) window.open(url, "_blank"); // popup blocked → plain new tab
  else w.focus();
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center">{children}</main>;
}

function HostConsole({ code, token, onUnauthorized }: { code: string; token: string; onUnauthorized: () => void }) {
  const { game, setGame, error, online, now } = useGame<HostView>(code, token);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [origin, setOrigin] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  useTickDriver(game, now);

  const send: Send = useCallback(
    async (action) => {
      setBusy(true);
      try {
        setGame(await api<HostView>(`/api/sessions/${code}/act`, { json: { role: "host", token, action } }));
      } catch (e) {
        setToast((e as Error).message);
        setTimeout(() => setToast(""), 2500);
      } finally {
        setBusy(false);
      }
    },
    [code, token, setGame],
  );

  useEffect(() => {
    if (error?.status === 401) onUnauthorized();
  }, [error, onUnauthorized]);
  if (error?.status === 401) return <Center><Spinner /></Center>;
  if (error?.status === 404) {
    return (
      <FullScreenMessage title="الجلسة غير موجودة">
        <Link href="/admin" className="btn btn-gold">
          لعبة جديدة
        </Link>
      </FullScreenMessage>
    );
  }
  if (!game) return <Center><Spinner /></Center>;

  const p = game.phase;
  const links = {
    play: `${origin}/play/${code}`,
    screen: `${origin}/screen/${code}`,
    control: `${origin}/control/${code}`,
  };

  return (
    <main className="bg-majlis mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Logo96 size={34} sub={false} />
          <div className="leading-tight">
            <div className="font-bold">{game.name}</div>
            <div className="text-sm text-cream/60">
              <span className="num font-bold text-goldlight">{code}</span>
              {" · "}
              {p.name === "LOBBY" || p.name === "GAME_OVER" ? (
                PHASE_LABEL[p.name]
              ) : (
                <>
                  {game.settings.totalQuestions ? (
                    <>
                      سؤال <span className="num">{Math.min(game.turn.questionsPlayed + 1, game.settings.totalQuestions)}</span> من{" "}
                      <span className="num">{game.settings.totalQuestions}</span>
                    </>
                  ) : (
                    <>
                      الهدف <span className="num">{game.settings.targetScore}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {p.name !== "LOBBY" && (
            <button className="btn btn-ghost px-3 py-2" title="فتح شاشة التلفزيون" aria-label="فتح شاشة التلفزيون" onClick={() => openTv(links.screen, code)}>
              📺
            </button>
          )}
          {p.name !== "LOBBY" && p.name !== "GAME_OVER" && (
            <button className="btn btn-ghost px-3 py-2" onClick={() => send({ type: game.paused ? "resume" : "pause" })}>
              {game.paused ? "▶︎ استئناف" : "⏸ إيقاف"}
            </button>
          )}
          <button
            className="btn btn-ghost px-3 py-2"
            onClick={() => send({ type: "toggle_sound" })}
            aria-label="صوت التلفزيون"
            title="صوت التلفزيون"
          >
            {game.settings.soundOn ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {!online && <div className="rounded-xl bg-danger/30 px-3 py-2 text-sm">جاري إعادة الاتصال...</div>}

      {p.name !== "LOBBY" && <Scores game={game} send={send} />}

      {p.name !== "LOBBY" && (
        <details className="panel px-4 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-cream/70">🎛️ مؤثرات (على التلفزيون)</summary>
          <div className="grid grid-cols-3 gap-2 py-2">
            {SOUNDS.map(([name, label]) => (
              <button key={name} className="btn btn-ghost px-2 py-2 text-sm" onClick={() => send({ type: "sfx", name })}>
                {label}
              </button>
            ))}
          </div>
        </details>
      )}

      {p.name !== "LOBBY" && p.name !== "GAME_OVER" && (
        <details className="panel px-4 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-cream/70">🧰 أدوات المضيف</summary>
          <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-4">
            <button className="btn btn-ghost px-2 py-3 text-sm" disabled={!game.host.canUndo || busy} onClick={() => send({ type: "undo" })}>
              ↩︎ تراجع عن آخر حركة
            </button>
            <button className="btn btn-ghost px-2 py-3 text-sm" disabled={busy} onClick={() => send({ type: game.paused ? "resume" : "pause" })}>
              {game.paused ? "▶︎ استكمال الوقت" : "⏸ إيقاف الوقت"}
            </button>
            <button className="btn btn-ghost px-2 py-3 text-sm" disabled={busy} onClick={() => send({ type: "add_time", seconds: 5 })}>
              ⏱ +5 ثواني
            </button>
            <button className="btn btn-ghost px-2 py-3 text-sm" disabled={busy} onClick={() => send({ type: "skip" })}>
              ⏭ تخطي السؤال
            </button>
          </div>
        </details>
      )}

      <section className="panel flex flex-col gap-4 p-4">
        {p.name === "LOBBY" && <LobbyPanel game={game} send={send} links={links} busy={busy} />}
        {p.name === "CATEGORY_VOTE" && <VotePanel game={game} phase={p} send={send} now={now} />}
        {p.name === "CARD_PICK" && <CardPanel game={game} phase={p} send={send} now={now} />}
        {(p.name === "QUESTION" || p.name === "STEAL") && <QuestionPanel game={game} phase={p} send={send} now={now} busy={busy} />}
        {p.name === "RESULT" && <ResultPanel game={game} phase={p} send={send} />}
        {p.name === "GAME_OVER" && <OverPanel game={game} phase={p} send={send} />}
      </section>

      {p.name !== "LOBBY" && (
        <details className="panel p-4">
          <summary className="cursor-pointer font-semibold text-cream/80">🔗 الروابط واللاعبون</summary>
          <div className="mt-4 flex flex-col gap-4">
            <LinksPanel game={game} links={links} compact />
            <PlayersEditor game={game} send={send} />
          </div>
        </details>
      )}

      {p.name !== "GAME_OVER" && p.name !== "LOBBY" && (
        <div className="flex justify-center">
          {confirmEnd ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">متأكد؟</span>
              <button className="btn btn-red px-4 py-2" onClick={() => { setConfirmEnd(false); void send({ type: "end_game" }); }}>
                نعم، أنهِ اللعبة
              </button>
              <button className="btn btn-ghost px-4 py-2" onClick={() => setConfirmEnd(false)}>
                إلغاء
              </button>
            </div>
          ) : (
            <button className="text-sm text-cream/50 underline" onClick={() => setConfirmEnd(true)}>
              إنهاء اللعبة
            </button>
          )}
        </div>
      )}

      <footer className="mt-auto text-center text-xs text-cream/35">
        <span className="num">{APP_VERSION}</span>
      </footer>

      {toast && (
        <div className="anim-rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-danger px-5 py-2 font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function Scores({ game, send }: { game: HostView; send: Send }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${game.teams.length}, 1fr)` }}>
      {game.teams.map((t) => (
        <div key={t.id} className="panel flex flex-col items-center gap-1 p-3" style={{ boxShadow: `inset 0 3px 0 ${t.color}` }}>
          <span className="truncate font-bold" style={{ color: t.color }}>
            {t.name}
          </span>
          <span className="num text-3xl font-bold">{t.score}</span>
          <div className="flex gap-1">
            <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => send({ type: "adjust_score", teamId: t.id, delta: -50 })}>
              −50
            </button>
            <button className="btn btn-ghost px-3 py-1 text-sm" onClick={() => send({ type: "adjust_score", teamId: t.id, delta: 50 })}>
              +50
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const SOUNDS: [SoundboardSfx, string][] = [
  ["laugh", "😂 ضحكة"],
  ["whistle", "📣 صفارة"],
  ["crackers", "🎆 طراطيع"],
  ["drums", "🥁 طبول"],
  ["ooh", "😮 أوووه!"],
  ["applause", "👏 تصفيق"],
];

type Links = { play: string; screen: string; control: string };

function LinkCard({
  title,
  icon,
  url,
  note,
  onOpen,
  children,
}: {
  title: string;
  icon: string;
  url: string;
  note?: React.ReactNode;
  onOpen?: () => void;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `خيمة الفنتوخ — ${title}`, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    void copy();
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-ink/50 p-4 ring-1 ring-cream/10">
      <div className="flex items-center gap-2 text-lg font-bold">
        <span className="text-2xl">{icon}</span>
        {title}
      </div>
      {children}
      <div className="num truncate text-sm text-cream/60" dir="ltr">
        {url.replace(/^https?:\/\//, "")}
      </div>
      {note}
      <div className="grid grid-cols-3 gap-2">
        {onOpen ? (
          <button className="btn btn-ghost px-2 py-2.5 text-sm" onClick={onOpen}>
            فتح
          </button>
        ) : (
          <a className="btn btn-ghost px-2 py-2.5 text-sm" href={url} target="_blank" rel="noreferrer">
            فتح
          </a>
        )}
        <button className="btn btn-ghost px-2 py-2.5 text-sm" onClick={copy}>
          {copied ? "✓ نُسخ" : "نسخ"}
        </button>
        <button className="btn btn-gold px-2 py-2.5 text-sm" onClick={share}>
          مشاركة
        </button>
      </div>
    </div>
  );
}

/** The three links a party needs: players (QR), TV screen, control device. */
function LinksPanel({ game, links, compact = false }: { game: HostView; links: Links; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? "md:grid-cols-3" : "md:grid-cols-3"}`}>
      <LinkCard title="اللاعبون" icon="📱" url={links.play}>
        {!compact && links.play.startsWith("http") && (
          <div className="flex justify-center">
            <QR value={links.play} size={170} />
          </div>
        )}
      </LinkCard>
      <LinkCard
        title="شاشة العرض"
        icon="📺"
        url={links.screen}
        onOpen={() => openTv(links.screen, game.code)}
        note={<p className="text-xs text-cream/50">افتحها على اللابتوب واعرضها على التلفزيون (Cast tab)</p>}
      />
      <LinkCard
        title="جهاز التحكم"
        icon="🎮"
        url={links.control}
        note={
          <p className="text-sm">
            رمز الدخول: <span className="num font-bold text-goldlight">{game.host.pin}</span>
          </p>
        }
      />
    </div>
  );
}

function LobbyPanel({ game, send, links, busy }: { game: HostView; send: Send; links: Links; busy: boolean }) {
  return (
    <>
      <div className="text-center">
        <div className="text-lg font-bold">{game.name}</div>
        <div className="text-sm text-cream/60">كود الجلسة</div>
        <div className="num text-5xl font-bold tracking-[0.2em] text-goldlight">{game.code}</div>
      </div>
      <LinksPanel game={game} links={links} />
      <PlayersEditor game={game} send={send} />
      <button className="btn btn-gold py-4 text-xl" disabled={busy} onClick={() => send({ type: "start" })}>
        ابدأ اللعبة
      </button>
      {game.players.length === 0 && <p className="text-center text-sm text-cream/50">لم ينضم أحد بعد — يمكنك البدء للتجربة</p>}
    </>
  );
}

function PlayersEditor({ game, send }: { game: HostView; send: Send }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          اللاعبون <span className="num text-cream/60">({game.players.length})</span>
        </h3>
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => send({ type: "balance" })}>
          ⚖️ وزّع بالتساوي
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${game.teams.length}, minmax(0,1fr))` }}>
        {game.teams.map((t) => (
          <div key={t.id} className="flex flex-col gap-2 rounded-xl bg-ink/40 p-2" style={{ boxShadow: `inset 0 3px 0 ${t.color}` }}>
            <div className="text-center text-sm font-bold" style={{ color: t.color }}>
              {t.name}
            </div>
            {game.players
              .filter((pl) => pl.teamId === t.id)
              .map((pl) => (
                <div key={pl.id} className="flex flex-col gap-1.5 rounded-lg bg-cream/5 p-2">
                  <div className="flex items-center gap-2">
                    <Avatar player={pl} color={t.color} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{pl.name}</span>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${pl.online ? "bg-leaf" : "bg-cream/25"}`}
                      title={pl.online ? "متصل" : "غير متصل"}
                    />
                    <button
                      className="px-1 text-cream/40 hover:text-[#ff8a85]"
                      aria-label="إزالة"
                      onClick={() => {
                        if (confirm(`إزالة ${pl.name}؟`)) void send({ type: "remove_player", playerId: pl.id });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {game.teams
                      .filter((o) => o.id !== t.id)
                      .map((o) => (
                        <button
                          key={o.id}
                          className="flex-1 truncate rounded-md px-1 py-1 text-xs font-semibold"
                          style={{ background: `${o.color}33` }}
                          onClick={() => send({ type: "move_player", playerId: pl.id, teamId: o.id })}
                        >
                          ← {o.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function VotePanel({ game, phase, send, now }: { game: HostView; phase: Phase<"CATEGORY_VOTE">; send: Send; now: () => number }) {
  const team = teamById(game.teams, phase.teamId)!;
  const members = game.players.filter((pl) => pl.teamId === team.id);
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <TeamBadge team={team} />
          <div className="mt-1 text-sm text-cream/60">
            صوّت <span className="num">{phase.voters.length}</span> من <span className="num">{members.length}</span>
            {phase.tie && <span className="ms-2 font-bold text-gold">· تعادل!</span>}
          </div>
        </div>
        <TimerRing timer={phase.timer} now={now} size={64} />
      </div>
      <div className="text-sm font-semibold text-cream/70">اختيار الفئة يدوياً</div>
      <div className="grid grid-cols-2 gap-2">
        {phase.options.map((id) => {
          const c = game.categories.find((x) => x.id === id)!;
          return (
            <button
              key={id}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-right font-bold"
              style={{ backgroundColor: c.color, backgroundImage: patternBg(c.pattern, "rgba(255,255,255,.14)") }}
              onClick={() => send({ type: "override_category", categoryId: id })}
            >
              <span>
                {c.name}
                <span className="block text-xs font-normal opacity-80">
                  متبقي <span className="num">{game.host.remaining[id]}</span>
                </span>
              </span>
              <span className="num rounded-full bg-ink/40 px-2.5 py-0.5">{phase.counts[id] ?? 0}</span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost" onClick={() => send({ type: "skip" })}>
        تخطي الدور
      </button>
    </>
  );
}

function CardPanel({ game, phase, send, now }: { game: HostView; phase: Phase<"CARD_PICK">; send: Send; now: () => number }) {
  const team = teamById(game.teams, phase.teamId)!;
  const c = game.categories.find((x) => x.id === phase.categoryId)!;
  const cards = game.boards[phase.categoryId] ?? [];
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <TeamBadge team={team} />
          <div className="mt-1 font-bold">{c.name}</div>
        </div>
        <TimerRing timer={phase.timer} now={now} size={64} />
      </div>
      <p className="text-sm text-cream/60">الفريق يختار من جواله — أو اختر عنهم:</p>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((card, i) => (
          <button
            key={i}
            disabled={card.used}
            className="num aspect-[5/6] rounded-xl text-2xl font-bold disabled:opacity-25"
            style={{ backgroundColor: c.color, backgroundImage: patternBg(c.pattern, "rgba(255,255,255,.18)") }}
            onClick={() => send({ type: "pick_card", index: i })}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-ghost flex-1" onClick={() => send({ type: "skip" })}>
          تخطي الدور
        </button>
      </div>
    </>
  );
}

function QuestionPanel({
  game,
  phase,
  send,
  now,
  busy,
}: {
  game: HostView;
  phase: Phase<"QUESTION"> | Phase<"STEAL">;
  send: Send;
  now: () => number;
  busy: boolean;
}) {
  const q = phase.question;
  const c = game.categories.find((x) => x.id === q.categoryId)!;
  const team = teamById(game.teams, phase.teamId)!;
  const steal = phase.name === "STEAL";
  const buzzer = phase.name === "QUESTION" ? phase.buzzer : null;
  const locked = buzzer?.lockedBy;
  const lockedPlayer = locked ? game.players.find((pl) => pl.id === locked.playerId) : null;
  const stealTargets = game.teams.filter((t) => t.id !== phase.teamId);
  const attempt = phase.attempt;
  const pts = steal || (buzzer && buzzer.excludedTeamIds.length > 0) ? game.settings.stealPoints : q.points || game.settings.correctPoints;
  const vote = phase.teamVote;
  const counts = game.host.voteCounts;
  const prepLeft = useUntil(phase.readyAt, now);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ background: c.color }}>
              {c.name}
            </span>
            {steal ? (
              <span className="font-bold text-gold">⚡ سرقة: {team.name}</span>
            ) : (
              <TeamBadge team={team} className="text-sm" />
            )}
          </div>
          <p className="mt-2 text-lg leading-snug font-semibold">{q.question}</p>
        </div>
        {!phase.timer.stopped && <TimerRing timer={phase.timer} now={now} size={64} />}
      </div>

      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" className="max-h-40 self-center rounded-lg object-contain" />
      )}

      <div className="rounded-2xl border-2 border-gold/60 bg-gold/10 p-4 text-center">
        <div className="text-xs font-semibold text-gold">الإجابة (لك فقط)</div>
        <div className="text-2xl font-bold text-goldlight">{game.host.answer}</div>
      </div>

      {prepLeft > 0 && (
        <div className="rounded-xl bg-ink/50 px-3 py-2 text-center font-bold text-goldlight">
          استعدوا… <span className="num">{Math.ceil(prepLeft / 1000)}</span>
        </div>
      )}

      {q.options && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {q.options.map((o, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${i === game.host.correctOption ? "bg-leaf/40 font-bold" : "bg-cream/5"} ${
                attempt?.option === i ? (attempt.correct ? "ring-2 ring-leaf" : "ring-2 ring-danger") : ""
              }`}
            >
              <span>
                {q.type === "TRUE_FALSE" ? "" : `${OPTION_LETTERS[i]}. `}
                {o}
              </span>
              {counts && (counts[i] ?? 0) > 0 && <span className="num rounded-full bg-ink/60 px-2 text-xs">{counts[i]}</span>}
            </div>
          ))}
        </div>
      )}

      {vote && !attempt && (
        <div className="rounded-xl bg-ink/50 px-3 py-2 text-center text-sm">
          🗳️ الفريق يتشاور — صوّت <span className="num font-bold">{vote.voters.length}</span> من{" "}
          <span className="num font-bold">{vote.total}</span>
          <span className="text-cream/50"> (الأغلبية تُعتمد تلقائياً)</span>
        </div>
      )}
      {vote?.tie && !vote.stuck && !attempt && (
        <div className="rounded-xl bg-gold/20 px-3 py-2 text-center font-semibold text-goldlight">تعادل — جولة حسم ٣ ثواني</div>
      )}
      {vote?.stuck && !attempt && q.options && (
        <div className="flex flex-col gap-2 rounded-xl bg-gold/15 p-3 ring-1 ring-gold/50">
          <div className="text-center font-bold text-goldlight">تعادل في تصويت الفريق</div>
          <button className="btn btn-gold py-2" disabled={busy} onClick={() => send({ type: "tiebreak" })}>
            ٣ ثواني إضافية للحسم
          </button>
          <div className="text-center text-xs text-cream/60">أو اختيار الإجابة يدوياً:</div>
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((o, i) => (
              <button key={i} className="btn btn-ghost px-2 py-2 text-sm" disabled={busy} onClick={() => send({ type: "team_answer", option: i })}>
                {q.type === "TRUE_FALSE" ? "" : `${OPTION_LETTERS[i]}. `}
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {attempt && !attempt.correct && (
        <div className="rounded-xl bg-danger/25 px-3 py-2 text-center font-semibold">
          اختاروا إجابة خاطئة — {stealTargets.length ? "فعّل السرقة أو انتقل" : "انتقل"}
        </div>
      )}
      {buzzer && (
        <div className="rounded-xl bg-ink/50 px-3 py-2 text-center">
          {locked ? (
            <span className="font-bold">
              🔔 الأسرع: {lockedPlayer?.name ?? "لاعب"} ({teamById(game.teams, locked.teamId)?.name})
            </span>
          ) : (
            <span className="text-cream/70">بانتظار أول ضغطة…</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-green py-4 text-lg" disabled={busy} onClick={() => send({ type: "correct" })}>
          ✓ إجابة صحيحة <span className="num">+{pts}</span>
        </button>
        <button className="btn btn-red py-4 text-lg" disabled={busy} onClick={() => send({ type: "wrong" })}>
          ✕ {buzzer && locked ? "خطأ — افتح للباقين" : "إجابة خاطئة"}
        </button>
      </div>

      {!steal && !buzzer && (
        <div className="flex flex-wrap gap-2">
          {stealTargets.map((t) => (
            <button
              key={t.id}
              className="btn flex-1 py-3 text-lg font-bold text-ink"
              style={{ background: "#d6a63a" }}
              disabled={busy}
              onClick={() => send({ type: "steal", teamId: t.id })}
            >
              ⚡ سرقة ← {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn btn-ghost flex-1 text-sm" onClick={() => send({ type: "cancel_question" })}>
          إلغاء السؤال
        </button>
        <button className="btn btn-ghost flex-1 text-sm" onClick={() => send({ type: "skip" })}>
          تخطي
        </button>
      </div>
    </>
  );
}

function ResultPanel({ game, phase, send }: { game: HostView; phase: Phase<"RESULT">; send: Send }) {
  const team = teamById(game.teams, phase.teamId);
  const label =
    phase.outcome === "correct" ? "إجابة صحيحة" : phase.outcome === "steal" ? "سرقة ناجحة" : phase.outcome === "wrong" ? "إجابة خاطئة" : "تم التخطي";
  return (
    <>
      <div className="text-center">
        <div className="text-2xl font-bold">{label}</div>
        {team && (
          <div className="mt-1">
            <TeamBadge team={team} /> <span className="num font-bold text-goldlight">+{phase.points}</span>
          </div>
        )}
        <div className="mt-3 text-cream/70">الإجابة: {phase.answer}</div>
      </div>
      <button className="btn btn-gold py-4 text-xl" onClick={() => send({ type: "next" })}>
        التالي ←
      </button>
      <p className="text-center text-xs text-cream/40">ينتقل تلقائياً بعد ثوانٍ</p>
    </>
  );
}

function OverPanel({ game, phase, send }: { game: HostView; phase: Phase<"GAME_OVER">; send: Send }) {
  const router = useRouter();
  const winners = phase.winners.map((id) => teamById(game.teams, id)!).filter(Boolean);
  return (
    <>
      <div className="text-center">
        <div className="text-sm text-cream/60">{winners.length > 1 ? "تعادل" : "الفائز"}</div>
        <div className="text-4xl font-bold text-goldlight">{winners.map((w) => w.name).join(" و ")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-gold py-4 text-lg" onClick={() => send({ type: "replay" })}>
          إعادة اللعب
        </button>
        <button className="btn btn-ghost py-4 text-lg" onClick={() => router.push("/admin")}>
          لعبة جديدة
        </button>
      </div>
    </>
  );
}
