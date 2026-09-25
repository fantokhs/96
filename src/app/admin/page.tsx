"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { patternBg } from "@/components/patterns";
import { APP_VERSION, Logo96, Spinner } from "@/components/ui";
import { api, ApiError, local } from "@/lib/client/api";
import { forgetGame, recentGames, rememberGame, type RecentGame } from "@/lib/client/recent";
import type { HostView, PatternId } from "@/lib/game/types";

interface CatInfo {
  id: string;
  name: string;
  description: string | null;
  color: string;
  pattern: PatternId;
  mode: "normal" | "buzzer";
  count: number;
}

interface KnowCounts {
  people: number;
  count: number;
  ready: boolean;
}

const THEME_ID = "national-day-96";
const DEFAULT_NAMES = ["الصقور", "الذيابة"];
const TEAM_COLORS = ["#22A06B", "#D6A63A"];
const LENGTHS = [10, 15, 20];

export default function AdminCreate() {
  const router = useRouter();
  const [content, setContent] = useState<CatInfo[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("خيمة الفنتوخ");
  const [teamNames, setTeamNames] = useState(DEFAULT_NAMES);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [length, setLength] = useState(15);
  const [personal, setPersonal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<RecentGame[]>([]);
  /** "" = new game, otherwise the selected/draft session code */
  const [code, setCode] = useState("");
  const [hv, setHv] = useState<HostView | null>(null);
  const [know, setKnow] = useState<KnowCounts | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRecent(recentGames().slice(0, 5));
    api<{ categories: CatInfo[] }>(`/api/content?themeId=${THEME_ID}`)
      .then((c) => {
        setContent(c.categories);
        setSelected((s) => s ?? c.categories.filter((x) => x.count > 0).map((x) => x.id));
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const token = code ? local.get<string>(`96:host:${code}`) : null;

  // live «وش تعرف عنه؟» counts for the selected / draft session
  useEffect(() => {
    if (!code) return setKnow(null);
    let alive = true;
    const load = () =>
      api<KnowCounts>(`/api/know/${code}`)
        .then((k) => alive && setKnow(k))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

  const loadSession = useCallback(
    async (c: string, fillForm: boolean) => {
      const tok = local.get<string>(`96:host:${c}`);
      if (!tok) throw new ApiError("ما عندنا صلاحية هذه الجلسة على هذا الجهاز — افتحها من رابط التحكم", 401);
      const g = await api<HostView>(`/api/sessions/${c}`, { headers: { "x-host-token": tok } });
      setHv(g);
      if (fillForm) {
        setName(g.name);
        setTeamNames([0, 1].map((i) => g.teams[i]?.name ?? DEFAULT_NAMES[i]));
        const ids = g.categories.map((x) => x.id).filter((id) => id !== "personal");
        if (!g.draft && ids.length) setSelected(ids);
        setLength(LENGTHS.includes(g.settings.totalQuestions ?? 0) ? g.settings.totalQuestions! : 15);
        setPersonal(g.settings.personalEnabled !== false);
      }
      return g;
    },
    [],
  );

  const pick = async (c: string) => {
    setError("");
    setShowResults(false);
    setCode(c);
    setHv(null);
    if (!c) {
      setName("خيمة الفنتوخ");
      setTeamNames(DEFAULT_NAMES);
      setLength(15);
      setPersonal(true);
      setSelected(content ? content.filter((x) => x.count > 0).map((x) => x.id) : null);
      return;
    }
    try {
      await loadSession(c, true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        forgetGame(c);
        setRecent(recentGames().slice(0, 5));
      }
      setError((e as Error).message);
      setCode("");
    }
  };

  const form = () => ({
    name: name.trim() || "خيمة الفنتوخ",
    teamNames: teamNames.map((n, i) => n.trim() || DEFAULT_NAMES[i]),
    // null = content list still loading → server uses every active category
    categoryIds: selected ?? undefined,
    totalQuestions: length,
    personalEnabled: personal,
  });

  const createSession = async (draft: boolean) => {
    setBusy(true);
    setError("");
    try {
      const f = form();
      const res = await api<{ code: string; hostToken: string }>("/api/sessions", {
        json: {
          name: f.name,
          themeId: THEME_ID,
          teams: f.teamNames.map((n, i) => ({ name: n, color: TEAM_COLORS[i] })),
          categoryIds: f.categoryIds,
          settings: { totalQuestions: f.totalQuestions, personalEnabled: f.personalEnabled },
          draft,
        },
      });
      local.set(`96:host:${res.code}`, res.hostToken);
      rememberGame(res.code, f.name);
      if (draft) {
        setRecent(recentGames().slice(0, 5));
        setCode(res.code);
        await loadSession(res.code, false);
        setBusy(false);
      } else router.push(`/control/${res.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const configure = async (reset: boolean) => {
    if (!code || !token) return;
    setBusy(true);
    setError("");
    try {
      const f = form();
      await api(`/api/sessions/${code}/configure`, { json: { token, reset, ...f } });
      rememberGame(code, f.name);
      router.push(`/control/${code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const resume = () => {
    rememberGame(code, hv?.name ?? name);
    router.push(`/control/${code}`);
  };

  const joinUrl = () => `${location.origin}/join/${code}`;
  const shareJoin = async () => {
    const url = joinUrl();
    const text = `${name} 👀\nادخل اللعبة أو عبّ «وش تعرف عنه؟» عن نفسك أو عن أي أحد من العائلة:\n${url}`;
    try {
      if (navigator.share) return await navigator.share({ title: name, text });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const toggleCat = (id: string) =>
    setSelected((s) => {
      const cur = s ?? content?.filter((x) => x.count > 0).map((x) => x.id) ?? [];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });

  // ─── what the main button does for the current selection ─────────────────
  const phase = hv?.phase.name;
  const state: "new" | "loading" | "setup" | "running" | "over" = !code
    ? "new"
    : !hv
      ? "loading"
      : hv.draft || (phase === "LOBBY" && hv.turn.questionsPlayed === 0)
        ? "setup"
        : phase === "GAME_OVER"
          ? "over"
          : "running";
  const lastRun = hv?.history?.[hv.history.length - 1];
  const invalid = (selected !== null && selected.length === 0) || busy;

  return (
    <main className="bg-majlis mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Logo96 size={44} />
        </Link>
        <Link href="/admin/content" className="btn btn-ghost px-3 py-2 text-sm">
          إدارة الأسئلة
        </Link>
      </header>

      <h1 className="text-3xl font-bold">{state === "new" ? "إنشاء لعبة" : "الجلسة"}</h1>

      <Section title="اسم اللعبة">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="field flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label="اسم اللعبة"
          />
          <select
            className="field sm:w-56"
            value={code}
            onChange={(e) => pick(e.target.value)}
            aria-label="الألعاب الأخيرة"
          >
            <option value="">لعبة جديدة</option>
            {recent.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} • {r.code}
              </option>
            ))}
            {code && !recent.some((r) => r.code === code) && <option value={code}>{name} • {code}</option>}
          </select>
        </div>
        {code && (
          <p className="text-sm text-cream/70" data-testid="draft-line">
            كود الجلسة: <b className="num text-goldlight">{code}</b>
            {know && (
              <>
                {" · "}وش تعرف عنه؟: <span className="num">{know.people}</span> أشخاص •{" "}
                <span className="num">{know.count}</span> سؤال جاهز
              </>
            )}
          </p>
        )}
      </Section>

      {state === "loading" && <Spinner />}

      {state === "running" && hv && (
        <section className="panel flex flex-col gap-3 p-4">
          <p className="font-bold">
            اللعبة ما خلصت — وصلتوا سؤال <span className="num">{hv.turn.questionsPlayed}</span>
            {hv.settings.totalQuestions ? (
              <>
                {" "}من <span className="num">{hv.settings.totalQuestions}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {hv.teams.map((t) => (
              <span key={t.id} className="rounded-full px-3 py-1 font-semibold" style={{ background: `${t.color}33` }}>
                {t.name}: <span className="num">{t.score}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {state === "over" && hv && (
        <section className="panel flex flex-col gap-3 p-4">
          <p className="font-bold">اللعبة خلصت 🏁 — الكود نفسه، والفرق والإعدادات جاهزة لجولة جديدة</p>
          <button className="self-start text-sm text-cream/70 underline" onClick={() => setShowResults((x) => !x)}>
            {showResults ? "إخفاء النتائج" : "عرض النتائج السابقة"}
          </button>
          {showResults && (
            <div className="flex flex-wrap gap-2">
              {[...hv.teams]
                .sort((a, b) => b.score - a.score)
                .map((t) => (
                  <span key={t.id} className="rounded-full px-3 py-1 font-semibold" style={{ background: `${t.color}33` }}>
                    {t.name}: <span className="num">{t.score}</span>
                  </span>
                ))}
              {lastRun && (
                <span className="w-full text-xs text-cream/50">
                  جولات سابقة: <span className="num">{hv.history.length}</span>
                </span>
              )}
            </div>
          )}
        </section>
      )}

      <Section title="الفرق">
        <div className="flex flex-col gap-3">
          {teamNames.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: TEAM_COLORS[i] }} aria-hidden />
              <input
                className="field flex-1"
                value={t}
                maxLength={20}
                aria-label={`اسم الفريق ${i + 1}`}
                onChange={(e) => setTeamNames((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="الفئات">
        {!content && !loadError && <Spinner />}
        {loadError && <p className="text-[#ff8a85]">{loadError}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <PersonalCard
            code={code}
            know={know}
            on={personal}
            busy={busy}
            copied={copied}
            onToggle={() => setPersonal((x) => !x)}
            onPrepare={() => createSession(true)}
            onShare={shareJoin}
          />
          {content?.map((c) => {
            const on = selected ? selected.includes(c.id) : c.count > 0;
            return (
              <button
                key={c.id}
                disabled={c.count === 0}
                onClick={() => toggleCat(c.id)}
                className="relative flex h-24 flex-col items-start justify-end overflow-hidden rounded-2xl p-3 text-right transition disabled:opacity-40"
                style={{
                  backgroundColor: on ? c.color : "rgba(4,26,18,.6)",
                  backgroundImage: on ? patternBg(c.pattern, "rgba(255,255,255,.18)") : undefined,
                  boxShadow: on ? "none" : `inset 0 0 0 1.5px ${c.color}66`,
                }}
              >
                <span className="font-bold leading-tight">{c.name}</span>
                <span className="text-xs text-cream/75">
                  {c.count} سؤال{c.mode === "buzzer" ? " · أسرع إصبع" : ""}
                </span>
                {on && <span className="absolute top-2 left-2 text-lg">✓</span>}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="طول اللعبة">
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map((n) => (
            <Chip key={n} on={length === n} onClick={() => setLength(n)}>
              {n} {n === 10 ? "أسئلة" : "سؤال"}
            </Chip>
          ))}
        </div>
      </Section>

      {error && <p className="rounded-xl bg-danger/20 p-3 text-[#ffb3b0]">{error}</p>}

      <div className="sticky bottom-4 flex flex-col gap-2">
        {state === "new" && (
          <button className="btn btn-gold py-4 text-xl shadow-2xl" disabled={invalid} onClick={() => createSession(false)}>
            {busy ? "جارٍ الإنشاء…" : "إنشاء الجلسة"}
          </button>
        )}
        {state === "setup" && (
          <button className="btn btn-gold py-4 text-xl shadow-2xl" disabled={invalid} onClick={() => configure(false)}>
            {busy ? "جارٍ الحفظ…" : "اكمل إنشاء اللعبة"}
          </button>
        )}
        {state === "running" && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-gold py-4 text-lg shadow-2xl" disabled={busy} onClick={resume}>
              استكمال اللعبة
            </button>
            <button className="btn btn-ghost py-4 text-lg shadow-2xl" disabled={invalid} onClick={() => configure(true)}>
              إعادة من البداية
            </button>
          </div>
        )}
        {state === "over" && (
          <button className="btn btn-gold py-4 text-xl shadow-2xl" disabled={invalid} onClick={() => configure(true)}>
            {busy ? "جارٍ التجهيز…" : "إعادة اللعب"}
          </button>
        )}
      </div>

      <footer className="pt-4 text-center text-xs text-cream/35">
        <span className="num">{APP_VERSION}</span>
      </footer>
    </main>
  );
}

function PersonalCard({
  code,
  know,
  on,
  busy,
  copied,
  onToggle,
  onPrepare,
  onShare,
}: {
  code: string;
  know: KnowCounts | null;
  on: boolean;
  busy: boolean;
  copied: boolean;
  onToggle: () => void;
  onPrepare: () => void;
  onShare: () => void;
}) {
  const ready = !!know?.ready;
  const lit = ready && on;
  return (
    <div
      role={ready ? "button" : undefined}
      tabIndex={ready ? 0 : undefined}
      onClick={ready ? onToggle : undefined}
      data-testid="personal-card"
      className={`relative flex min-h-24 flex-col items-start justify-end gap-1.5 overflow-hidden rounded-2xl p-3 text-right transition ${ready ? "cursor-pointer" : ""}`}
      style={{
        backgroundColor: lit ? "#C2410C" : "rgba(4,26,18,.6)",
        backgroundImage: lit ? patternBg("dots", "rgba(255,255,255,.18)") : undefined,
        boxShadow: lit ? "none" : "inset 0 0 0 1.5px #C2410C99",
      }}
    >
      <span className="font-bold leading-tight">وش تعرف عنه؟ 👀</span>
      {!code && (
        <button
          className="rounded-full bg-[#C2410C] px-3 py-1 text-xs font-bold"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onPrepare();
          }}
        >
          جهّز الرابط
        </button>
      )}
      {code && !ready && (
        <>
          <span className="text-xs text-cream/75">
            <span className="num">{know?.count ?? 0}</span> أسئلة جاهزة
          </span>
          <button
            className="rounded-full bg-[#C2410C] px-3 py-1 text-xs font-bold"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
          >
            {copied ? "تم النسخ ✓" : "مشاركة الرابط"}
          </button>
        </>
      )}
      {code && ready && (
        <span className="text-xs text-cream/85">
          <span className="num">{know!.count}</span> سؤال جاهز
        </span>
      )}
      {lit && <span className="absolute top-2 left-2 text-lg">✓</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold text-cream/85">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 font-semibold transition ${
        on ? "bg-gold text-ink" : "bg-cream/8 text-cream ring-1 ring-cream/15 hover:bg-cream/15"
      }`}
    >
      {children}
    </button>
  );
}
