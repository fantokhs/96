"use client";
// «وش تعرف عنه؟ 👀» — pre-game questionnaire. No login; one device can fill for many people.
import { use, useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION, FullScreenMessage, Logo96, Spinner } from "@/components/ui";
import { api, local } from "@/lib/client/api";
import { FIELDS, MAX_CUSTOM } from "@/lib/personal";

type Mode = "self" | "other";
interface Mine {
  contributionId: string;
  token: string;
  name: string;
}
interface Custom {
  question: string;
  answer: string;
  wrong: string[];
}
type Screen =
  | { s: "home" }
  | { s: "name"; mode: Mode }
  | { s: "exists"; mode: Mode; name: string; answeredKeys: string[]; customLeft: number }
  | { s: "q"; i: number }
  | { s: "customPrompt" }
  | { s: "custom" }
  | { s: "done"; name: string; mine: Mine | null }
  | { s: "finished" };

interface Draft {
  mode: Mode;
  name: string;
  merge: boolean;
  keys: string[]; // fields to ask
  answers: Record<string, string>;
  custom: Custom[];
  customLeft: number;
  nonce: string;
  edit: Mine | null;
}

const newNonce = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function KnowPage({ params }: { params: Promise<{ code: string }> }) {
  const code = use(params).code.toUpperCase();
  const storeKey = `96:know:${code}`;
  const [game, setGame] = useState<{ name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [screen, setScreen] = useState<Screen>({ s: "home" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setMine(local.get<Mine[]>(storeKey) ?? []);
    api<{ name: string }>(`/api/know/${code}`)
      .then(setGame)
      .catch((e) => (e.status === 404 ? setNotFound(true) : setErr(e.message)));
  }, [code, storeKey]);

  if (notFound)
    return (
      <FullScreenMessage title="ما لقينا هذه الجلسة">
        <p className="text-cream/60">تأكد من الرابط اللي وصلك</p>
      </FullScreenMessage>
    );
  if (!game)
    return (
      <main className="flex min-h-dvh items-center justify-center">
        {err ? <p className="text-[#ffb3b0]">{err}</p> : <Spinner />}
      </main>
    );

  const startFresh = (mode: Mode, name: string, extra: Partial<Draft> = {}) => {
    const d: Draft = {
      mode,
      name,
      merge: false,
      keys: FIELDS.map((f) => f.key),
      answers: {},
      custom: [],
      customLeft: MAX_CUSTOM,
      nonce: newNonce(),
      edit: null,
      ...extra,
    };
    setDraft(d);
    setScreen(d.keys.length ? { s: "q", i: 0 } : { s: "customPrompt" });
  };

  const checkName = async (mode: Mode, name: string) => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ exists: boolean; name?: string; answeredKeys?: string[]; customLeft?: number }>(`/api/know/${code}`, {
        json: { action: "check", name },
      });
      if (r.exists) setScreen({ s: "exists", mode, name: r.name!, answeredKeys: r.answeredKeys ?? [], customLeft: r.customLeft ?? 0 });
      else startFresh(mode, name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (m: Mine) => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ name: string; mode: Mode; answers: Record<string, string>; custom: Custom[] }>(`/api/know/${code}`, {
        json: { action: "mine", contributionId: m.contributionId, token: m.token },
      });
      startFresh(r.mode, r.name, { answers: r.answers, custom: r.custom, edit: m, customLeft: MAX_CUSTOM });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ name: string; contributionId: string; token: string | null }>(`/api/know/${code}`, {
        json: {
          action: "submit",
          name: draft.name,
          mode: draft.mode,
          merge: draft.merge,
          answers: draft.answers,
          custom: draft.custom,
          nonce: draft.nonce,
          edit: draft.edit ? { contributionId: draft.edit.contributionId, token: draft.edit.token } : undefined,
        },
      });
      let entry: Mine | null = draft.edit;
      if (r.token) {
        entry = { contributionId: r.contributionId, token: r.token, name: r.name };
        const next = [...mine.filter((x) => x.contributionId !== r.contributionId), entry];
        setMine(next);
        local.set(storeKey, next);
      }
      setDraft(null);
      setScreen({ s: "done", name: r.name, mine: entry });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-majlis mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
      <div className="flex justify-center">
        <Logo96 size={screen.s === "home" || screen.s === "done" || screen.s === "finished" ? 64 : 34} />
      </div>
      <div className="mt-5 flex flex-1 flex-col">
        {screen.s === "home" && (
          <Home
            mine={mine}
            busy={busy}
            onSelf={() => setScreen({ s: "name", mode: "self" })}
            onOther={() => setScreen({ s: "name", mode: "other" })}
            onEdit={openEdit}
          />
        )}
        {screen.s === "name" && (
          <NameStep mode={screen.mode} busy={busy} onBack={() => setScreen({ s: "home" })} onNext={(n) => checkName(screen.mode, n)} />
        )}
        {screen.s === "exists" && (
          <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <span className="text-6xl">👀</span>
            <h2 className="text-2xl font-bold">{screen.name} موجود مسبقاً 👀</h2>
            <p className="text-cream/70">تقدر تضيف معلومات ما أحد كتبها عنه</p>
            <button
              className="btn btn-gold w-full py-4 text-lg"
              onClick={() => {
                const keys = FIELDS.map((f) => f.key).filter((k) => !screen.answeredKeys.includes(k));
                startFresh(screen.mode, screen.name, { merge: true, keys, customLeft: screen.customLeft });
              }}
            >
              أكمل معلوماته
            </button>
            <button className="btn btn-ghost w-full py-3" onClick={() => setScreen({ s: "name", mode: screen.mode })}>
              رجوع
            </button>
          </div>
        )}
        {screen.s === "q" && draft && (
          <QuestionStep
            key={draft.keys[screen.i]}
            draft={draft}
            i={screen.i}
            busy={busy}
            onChange={(v) => setDraft({ ...draft, answers: { ...draft.answers, [draft.keys[screen.i]]: v } })}
            onBack={() => (screen.i > 0 ? setScreen({ s: "q", i: screen.i - 1 }) : setScreen({ s: "home" }))}
            onNext={() => setScreen(screen.i + 1 < draft.keys.length ? { s: "q", i: screen.i + 1 } : { s: "customPrompt" })}
            onCustom={() => setScreen({ s: "custom" })}
            onSubmit={submit}
          />
        )}
        {screen.s === "customPrompt" && draft && (
          <div className="anim-rise flex flex-1 flex-col justify-center gap-4 text-center">
            <span className="text-5xl">😄</span>
            <h2 className="text-2xl font-bold">عندك سؤال عن {draft.name} يورّطهم؟</h2>
            <p className="text-cream/60">ورّطهم بسؤال من عندك — اختياري</p>
            {draft.custom.length > 0 && <p className="text-goldlight">أضفت {draft.custom.length} سؤال</p>}
            {draft.custom.length < draft.customLeft && (
              <button className="btn btn-ghost w-full py-4 text-lg" onClick={() => setScreen({ s: "custom" })}>
                ＋ أضف سؤال من عندك
              </button>
            )}
            <button className="btn btn-gold w-full py-4 text-lg" disabled={busy || !hasContent(draft)} onClick={submit}>
              {busy ? "لحظة…" : "إرسال"}
            </button>
            {!hasContent(draft) && <p className="text-sm text-cream/50">جاوب سؤال واحد على الأقل أو أضف سؤال</p>}
            {draft.keys.length > 0 && (
              <button className="text-sm text-cream/50 underline" onClick={() => setScreen({ s: "q", i: draft.keys.length - 1 })}>
                رجوع للأسئلة
              </button>
            )}
          </div>
        )}
        {screen.s === "custom" && draft && (
          <CustomStep
            name={draft.name}
            onCancel={() => setScreen({ s: "customPrompt" })}
            onSave={(c) => {
              setDraft({ ...draft, custom: [...draft.custom, c] });
              setScreen({ s: "customPrompt" });
            }}
          />
        )}
        {screen.s === "done" && (
          <div className="anim-pop flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="text-7xl">👀</span>
            <h2 className="text-3xl font-black">تم 👀</h2>
            <p className="text-lg">
              حفظنا معلومات: <span className="font-bold text-goldlight">{screen.name}</span>
            </p>
            <p className="text-cream/60">الحين لا تعلمهم وش كتبت 🤫</p>
            <div className="mt-2 grid w-full gap-2">
              <a className="btn btn-gold py-4 text-xl" href={`/play/${code}`}>
                انضم للعبة 🎮
              </a>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-ghost py-3" onClick={() => setScreen({ s: "home" })}>
                  أضف شخص ثاني
                </button>
                <button className="btn btn-ghost py-3" onClick={() => setScreen({ s: "name", mode: "other" })}>
                  بعبي عن أحد
                </button>
              </div>
              {screen.mine && (
                <button className="btn btn-ghost py-3" disabled={busy} onClick={() => openEdit(screen.mine!)}>
                  تعديل المعلومات
                </button>
              )}
            </div>
          </div>
        )}
        {screen.s === "finished" && (
          <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="text-7xl">🏕️</span>
            <h2 className="text-2xl font-bold">شكراً! نشوفكم في الخيمة 👀</h2>
            <p className="text-cream/60">كل إجابة تزيد الحماس — وتقدر ترجع لهذا الرابط أي وقت</p>
            <button className="btn btn-ghost mt-2 px-6 py-3" onClick={() => setScreen({ s: "home" })}>
              رجوع
            </button>
          </div>
        )}
        {err && <p className="mt-4 rounded-xl bg-danger/20 p-3 text-center text-[#ffb3b0]">{err}</p>}
      </div>
      <footer className="pt-6 text-center text-xs text-cream/30">
        <span className="num">{APP_VERSION}</span>
      </footer>
    </main>
  );
}

function hasContent(d: Draft) {
  return Object.values(d.answers).some((v) => v.trim()) || d.custom.length > 0;
}

function Home({
  mine,
  busy,
  onSelf,
  onOther,
  onEdit,
}: {
  mine: Mine[];
  busy: boolean;
  onSelf: () => void;
  onOther: () => void;
  onEdit: (m: Mine) => void;
}) {
  return (
    <div className="anim-rise flex flex-1 flex-col gap-5">
      <div className="text-center">
        <h1 className="text-3xl leading-snug font-black">وش تعرف عنكم العائلة؟ 👀</h1>
        <p className="mt-2 text-cream/70">عبّ عن نفسك أو عن أي شخص تعرفه… ويمكن تطلع الإجابات في اللعبة</p>
      </div>
      <button className="btn btn-gold py-5 text-xl" onClick={onSelf}>
        بعبي عن نفسي
      </button>
      <button className="btn btn-ghost py-5 text-xl" onClick={onOther}>
        بعبي عن أحد
      </button>
      <p className="text-center text-sm text-cream/50">جاوب اللي تعرفه بس — مو لازم تكمل كل الأسئلة</p>
      {mine.length > 0 && (
        <div className="panel mt-2 flex flex-col gap-2 p-4">
          <div className="text-sm font-semibold text-cream/70">عبّيت عن:</div>
          {mine.map((m) => (
            <div key={m.contributionId} className="flex items-center justify-between gap-2">
              <span className="font-bold">{m.name}</span>
              <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={busy} onClick={() => onEdit(m)}>
                تعديل
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NameStep({ mode, busy, onBack, onNext }: { mode: Mode; busy: boolean; onBack: () => void; onNext: (name: string) => void }) {
  const [name, setName] = useState("");
  const ok = name.trim().length > 0;
  return (
    <form
      className="anim-rise flex flex-1 flex-col justify-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) onNext(name.trim());
      }}
    >
      <label className="text-center text-2xl font-bold" htmlFor="kname">
        {mode === "self" ? "اسمك" : "مين الشخص؟"}
      </label>
      <input
        id="kname"
        className="field py-4 text-center text-2xl font-bold"
        value={name}
        maxLength={30}
        autoFocus
        autoComplete={mode === "self" ? "given-name" : "off"}
        enterKeyHint="next"
        onChange={(e) => setName(e.target.value)}
      />
      {mode === "other" && <p className="text-center text-sm text-cream/60">طفل، كبير، أو أي شخص تعرفه وتبي تدخل معلوماته في اللعبة</p>}
      <button className="btn btn-gold py-4 text-xl" disabled={!ok || busy}>
        {busy ? "لحظة…" : mode === "self" ? "يلا نبدأ" : "ابدأ"}
      </button>
      <button type="button" className="text-sm text-cream/50 underline" onClick={onBack}>
        رجوع
      </button>
    </form>
  );
}

function QuestionStep({
  draft,
  i,
  busy,
  onChange,
  onBack,
  onNext,
  onCustom,
  onSubmit,
}: {
  draft: Draft;
  i: number;
  busy: boolean;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onCustom: () => void;
  onSubmit: () => void;
}) {
  const key = draft.keys[i];
  const field = FIELDS.find((f) => f.key === key)!;
  const value = draft.answers[key] ?? "";
  const answered = useMemo(() => Object.values(draft.answers).filter((v) => v.trim()).length, [draft.answers]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const text = draft.mode === "self" ? field.self : field.other(draft.name);
  const canSend = hasContent(draft);
  return (
    <div className="anim-rise flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <button className="text-cream/60" onClick={onBack}>
          → رجوع
        </button>
        <span className="rounded-full bg-gold/15 px-3 py-1 font-bold text-goldlight">
          {answered > 0 ? `جاوبت ${answered}` : `سؤال ${i + 1}`}
        </span>
      </div>
      <form
        className="flex flex-1 flex-col justify-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <h2 className="text-center text-2xl leading-snug font-bold">{text}</h2>
        <input
          ref={inputRef}
          className="field py-4 text-center text-xl"
          value={value}
          maxLength={120}
          placeholder="اكتب هنا…"
          enterKeyHint="next"
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-ghost py-3" onClick={onNext}>
            تخطي
          </button>
          <button className="btn btn-gold py-3" disabled={!value.trim()}>
            التالي
          </button>
        </div>
      </form>
      {canSend && (
        <div className="flex flex-col gap-2 rounded-2xl bg-ink/50 p-3 text-center">
          <span className="text-sm text-cream/60">كمل إذا ودك، أو أرسل الآن — كل إجابة تزيد الحماس 👀</span>
          <button className="btn btn-green py-3" disabled={busy} onClick={onSubmit}>
            {busy ? "لحظة…" : "إرسال الآن"}
          </button>
          {draft.custom.length < draft.customLeft && (
            <button className="text-sm text-goldlight underline" onClick={onCustom}>
              عندك سؤال عن {draft.name} يورّطهم؟ 😄
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CustomStep({ name, onSave, onCancel }: { name: string; onSave: (c: Custom) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(["", "", ""]);
  const ok = question.trim().length > 3 && answer.trim().length > 0;
  return (
    <form
      className="anim-rise flex flex-1 flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave({ question: question.trim(), answer: answer.trim(), wrong: wrong.map((w) => w.trim()).filter(Boolean) });
      }}
    >
      <h2 className="text-center text-xl font-bold">سؤال من عندك عن {name} 😄</h2>
      <label className="text-sm font-semibold text-cream/70">السؤال</label>
      <input className="field" value={question} maxLength={160} placeholder={`مثال: وش أول سيارة كانت مع ${name}؟`} onChange={(e) => setQuestion(e.target.value)} />
      <label className="text-sm font-semibold text-cream/70">الإجابة الصحيحة</label>
      <input className="field" value={answer} maxLength={120} onChange={(e) => setAnswer(e.target.value)} />
      <label className="text-sm font-semibold text-cream/70">خيارات خاطئة (اختياري)</label>
      {wrong.map((w, i) => (
        <input
          key={i}
          className="field"
          value={w}
          maxLength={60}
          placeholder={`خيار خاطئ ${i + 1}`}
          onChange={(e) => setWrong(wrong.map((x, j) => (j === i ? e.target.value : x)))}
        />
      ))}
      <p className="text-xs text-cream/50">بدون خيارات؟ يصير سؤال شفهي والمضيف يحكم</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-ghost py-3" onClick={onCancel}>
          إلغاء
        </button>
        <button className="btn btn-gold py-3" disabled={!ok}>
          حفظ السؤال
        </button>
      </div>
    </form>
  );
}
