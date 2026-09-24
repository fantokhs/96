"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { patternBg, TEAM_COLORS } from "@/components/patterns";
import { APP_VERSION, Logo96, Spinner } from "@/components/ui";
import { api, local } from "@/lib/client/api";
import type { PatternId } from "@/lib/game/types";

interface CatInfo {
  id: string;
  name: string;
  description: string | null;
  color: string;
  pattern: PatternId;
  mode: "normal" | "buzzer";
  count: number;
}

interface RecentGame {
  code: string;
  name: string;
  at: number;
}

const DEFAULT_TEAMS = [
  { name: "الصقور", color: TEAM_COLORS[0] },
  { name: "الذيابة", color: TEAM_COLORS[1] },
  { name: "الشواهين", color: TEAM_COLORS[2] },
];

export default function AdminCreate() {
  const router = useRouter();
  const [content, setContent] = useState<{ themes: { id: string; name: string }[]; categories: CatInfo[] } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("تحدي المجلس");
  const [themeId, setThemeId] = useState("national-day-96");
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [length, setLength] = useState<{ kind: "q" | "score"; n: number }>({ kind: "q", n: 10 });
  const [voteEvery, setVoteEvery] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [adv, setAdv] = useState({ questionSeconds: 20, stealSeconds: 10, correctPoints: 100, stealPoints: 50 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<RecentGame[]>([]);

  useEffect(() => {
    setRecent((local.get<RecentGame[]>("96:recent") ?? []).slice(0, 5));
    api<{ themes: { id: string; name: string }[]; categories: CatInfo[] }>(`/api/content?themeId=${themeId}`)
      .then((c) => {
        setContent(c);
        setSelected(c.categories.filter((x) => x.count > 0).map((x) => x.id));
      })
      .catch((e) => setLoadError(e.message));
  }, [themeId]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ code: string; hostToken: string }>("/api/sessions", {
        json: {
          name,
          themeId,
          teams: teams.slice(0, teamCount),
          categoryIds: selected,
          settings: {
            totalQuestions: length.kind === "q" ? length.n : null,
            targetScore: length.kind === "score" ? length.n : null,
            voteEvery,
            ...adv,
          },
        },
      });
      local.set(`96:host:${res.code}`, res.hostToken);
      local.set("96:recent", [{ code: res.code, name, at: Date.now() }, ...recent].slice(0, 8));
      router.push(`/host/${res.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const toggleCat = (id: string) =>
    setSelected((s) => (s?.includes(id) ? s.filter((x) => x !== id) : [...(s ?? []), id]));

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

      <h1 className="text-3xl font-bold">إنشاء لعبة</h1>

      {recent.length > 0 && (
        <section className="panel flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-cream/60">ألعابك الأخيرة</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <Link key={r.code} href={`/host/${r.code}`} className="btn btn-ghost px-3 py-2 text-sm">
                <span className="num">{r.code}</span> · {r.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Section title="اسم اللعبة">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </Section>

      <Section title="الثيم">
        <div className="flex flex-wrap gap-2">
          {(content?.themes ?? [{ id: "national-day-96", name: "اليوم الوطني 96" }]).map((t) => (
            <Chip key={t.id} on={themeId === t.id} onClick={() => setThemeId(t.id)}>
              🇸🇦 {t.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="الفرق">
        <div className="mb-3 flex gap-2">
          {[2, 3].map((n) => (
            <Chip key={n} on={teamCount === n} onClick={() => setTeamCount(n)}>
              {n === 2 ? "فريقان" : "3 فرق"}
            </Chip>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {teams.slice(0, teamCount).map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                className="field flex-1"
                value={t.name}
                maxLength={20}
                onChange={(e) => setTeams((ts) => ts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <div className="flex gap-1.5">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label="لون"
                    className="h-8 w-8 rounded-full transition"
                    style={{ background: c, boxShadow: t.color === c ? "0 0 0 3px #072a1d, 0 0 0 5px #f6f0e1" : undefined }}
                    onClick={() => setTeams((ts) => ts.map((x, j) => (j === i ? { ...x, color: c } : x)))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="الفئات">
        {!content && !loadError && <Spinner />}
        {loadError && <p className="text-[#ff8a85]">{loadError}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {content?.categories.map((c) => {
            const on = selected?.includes(c.id) ?? false;
            return (
              <button
                key={c.id}
                disabled={c.count === 0}
                onClick={() => toggleCat(c.id)}
                className="relative flex h-20 flex-col items-start justify-end overflow-hidden rounded-2xl p-3 text-right transition disabled:opacity-40"
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
          {[10, 15, 20].map((n) => (
            <Chip key={n} on={length.kind === "q" && length.n === n} onClick={() => setLength({ kind: "q", n })}>
              {n} سؤال
            </Chip>
          ))}
          {[500, 1000, 1500].map((n) => (
            <Chip key={n} on={length.kind === "score" && length.n === n} onClick={() => setLength({ kind: "score", n })}>
              أول فريق يوصل {n}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="تصويت الفئة">
        <div className="flex gap-2">
          <Chip on={voteEvery === 1} onClick={() => setVoteEvery(1)}>
            كل جولة
          </Chip>
          <Chip on={voteEvery === 3} onClick={() => setVoteEvery(3)}>
            كل 3 جولات
          </Chip>
        </div>
      </Section>

      <button className="self-start text-sm text-cream/60 underline" onClick={() => setAdvanced((a) => !a)}>
        {advanced ? "إخفاء" : "إعدادات"} الوقت والنقاط
      </button>
      {advanced && (
        <div className="panel grid grid-cols-2 gap-3 p-4">
          <Num label="وقت السؤال (ث)" v={adv.questionSeconds} set={(n) => setAdv({ ...adv, questionSeconds: n })} />
          <Num label="وقت السرقة (ث)" v={adv.stealSeconds} set={(n) => setAdv({ ...adv, stealSeconds: n })} />
          <Num label="نقاط الإجابة الصحيحة" v={adv.correctPoints} set={(n) => setAdv({ ...adv, correctPoints: n })} />
          <Num label="نقاط السرقة" v={adv.stealPoints} set={(n) => setAdv({ ...adv, stealPoints: n })} />
        </div>
      )}

      {error && <p className="rounded-xl bg-danger/20 p-3 text-[#ffb3b0]">{error}</p>}

      <button
        className="btn btn-gold sticky bottom-4 py-4 text-xl shadow-2xl"
        disabled={busy || !selected?.length || teams.slice(0, teamCount).some((t) => !t.name.trim())}
        onClick={create}
      >
        {busy ? "جارٍ الإنشاء…" : "إنشاء الجلسة"}
      </button>

      <footer className="pt-4 text-center text-xs text-cream/35">
        <span className="num">{APP_VERSION}</span>
      </footer>
    </main>
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

function Num({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-cream/70">
      {label}
      <input className="field num" type="number" inputMode="numeric" value={v} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}
