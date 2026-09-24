"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PALETTE, PATTERN_IDS, patternBg } from "@/components/patterns";
import { APP_VERSION, Logo96, Spinner } from "@/components/ui";
import { api, local } from "@/lib/client/api";
import { fileToDataUrl } from "@/lib/client/image";
import { QUESTION_TYPES, type Category, type Question, type QuestionType } from "@/lib/game/types";

const PIN_KEY = "96:admin-pin";

export default function ContentManager() {
  const [pin, setPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [data, setData] = useState<{ categories: Category[]; questions: Question[]; store: string } | null>(null);
  const [err, setErr] = useState("");
  const [catId, setCatId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [editingQ, setEditingQ] = useState<Partial<Question> | null>(null);

  const load = useCallback(async (p: string) => {
    try {
      const d = await api<{ categories: Category[]; questions: Question[]; store: string }>("/api/admin/content", {
        headers: { "x-admin-pin": p },
      });
      setData(d);
      setPin(p);
      local.set(PIN_KEY, p);
      setErr("");
      setCatId((c) => c ?? d.categories[0]?.id ?? null);
    } catch (e) {
      setErr((e as Error).message);
      setPin(null);
      local.del(PIN_KEY);
    }
  }, []);

  useEffect(() => {
    const saved = local.get<string>(PIN_KEY);
    if (saved) void load(saved);
    else setPin("");
  }, [load]);

  const save = async (kind: "category" | "question", item: object) => {
    try {
      await api("/api/admin/content", { json: { kind, item }, headers: { "x-admin-pin": pin! } });
      setEditingCat(null);
      setEditingQ(null);
      await load(pin!);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const del = async (id: string) => {
    if (!confirm("حذف السؤال نهائياً؟")) return;
    await api(`/api/admin/content?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-admin-pin": pin! } });
    await load(pin!);
  };

  const questions = useMemo(() => data?.questions.filter((q) => q.categoryId === catId) ?? [], [data, catId]);
  const cat = data?.categories.find((c) => c.id === catId);

  if (pin === null && !err) return <main className="flex min-h-dvh items-center justify-center"><Spinner /></main>;

  if (!data) {
    return (
      <main className="bg-majlis flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
        <Logo96 size={60} />
        <h1 className="text-2xl font-bold">إدارة الأسئلة</h1>
        <form
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void load(pinInput);
          }}
        >
          <input className="field num text-center text-2xl" type="password" inputMode="numeric" placeholder="الرمز" value={pinInput} onChange={(e) => setPinInput(e.target.value)} />
          <button className="btn btn-gold">دخول</button>
          {err && <p className="text-center text-[#ffb3b0]">{err}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="bg-majlis mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/admin"><Logo96 size={40} sub={false} /></Link>
        <h1 className="text-xl font-bold">إدارة الأسئلة</h1>
        <Link href="/admin" className="btn btn-ghost px-3 py-2 text-sm">إنشاء لعبة</Link>
      </header>
      {data.store === "memory" && (
        <p className="rounded-xl bg-gold/15 p-3 text-sm text-goldlight">
          وضع التجربة المحلي: التعديلات تُحفظ في الذاكرة فقط حتى يتم ربط Supabase.
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">الفئات</h2>
            <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setEditingCat({ color: PALETTE[0], pattern: "star", mode: "normal", active: true, sort: 100 })}>
              + فئة
            </button>
          </div>
          {data.categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-right font-bold"
              style={{
                backgroundColor: c.color,
                backgroundImage: patternBg(c.pattern, "rgba(255,255,255,.14)"),
                opacity: c.active ? 1 : 0.45,
                boxShadow: catId === c.id ? "0 0 0 3px #f6f0e1" : "none",
              }}
            >
              <span>{c.name}</span>
              <span className="num rounded-full bg-ink/40 px-2 text-sm">{data.questions.filter((q) => q.categoryId === c.id).length}</span>
            </button>
          ))}
        </aside>

        <section className="flex flex-col gap-3">
          {cat && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold">{cat.name}</h2>
                <p className="text-sm text-cream/60">
                  {cat.mode === "buzzer" ? "أسرع إصبع" : "عادي"} · {cat.active ? "مفعّلة" : "معطّلة"}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setEditingCat(cat)}>تعديل الفئة</button>
                <button
                  className="btn btn-gold px-3 py-2 text-sm"
                  onClick={() => setEditingQ({ categoryId: cat.id, themeId: cat.themeId, type: "TEXT", points: 100, active: true, options: ["", "", "", ""], correctOption: 0 })}
                >
                  + سؤال
                </button>
              </div>
            </div>
          )}
          {questions.map((q) => (
            <div key={q.id} className="panel flex items-start gap-3 p-3" style={{ opacity: q.active ? 1 : 0.5 }}>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-cream/50">{QUESTION_TYPES.find((t) => t.id === q.type)?.label} · <span className="num">{q.points}</span></div>
                <div className="font-semibold">{q.question}</div>
                <div className="text-sm text-goldlight">← {q.answer}</div>
              </div>
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
              )}
              <div className="flex flex-col gap-1">
                <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setEditingQ({ ...q, options: q.options ?? ["", "", "", ""] })}>تعديل</button>
                <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => save("question", { ...q, active: !q.active })}>{q.active ? "تعطيل" : "تفعيل"}</button>
                <button className="px-3 py-1 text-xs text-[#ff8a85]" onClick={() => del(q.id)}>حذف</button>
              </div>
            </div>
          ))}
          {cat && questions.length === 0 && <p className="text-cream/50">لا توجد أسئلة بعد.</p>}
        </section>
      </div>

      {editingCat && <CategoryForm value={editingCat} onClose={() => setEditingCat(null)} onSave={(c) => save("category", c)} />}
      {editingQ && data && (
        <QuestionForm value={editingQ} categories={data.categories} onClose={() => setEditingQ(null)} onSave={(q) => save("question", q)} />
      )}

      <footer className="pt-6 text-center text-xs text-cream/35"><span className="num">{APP_VERSION}</span></footer>
    </main>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-3 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cream/10 bg-deep p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">{title}</h3>
          <button className="text-2xl text-cream/60" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-cream/75">
      {t}
      {children}
    </label>
  );
}

function CategoryForm({ value, onSave, onClose }: { value: Partial<Category>; onSave: (c: Partial<Category>) => void; onClose: () => void }) {
  const [c, setC] = useState(value);
  return (
    <Modal title={c.id ? "تعديل الفئة" : "فئة جديدة"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Label t="الاسم"><input className="field" value={c.name ?? ""} onChange={(e) => setC({ ...c, name: e.target.value })} /></Label>
        <Label t="وصف قصير"><input className="field" value={c.description ?? ""} onChange={(e) => setC({ ...c, description: e.target.value })} /></Label>
        <Label t="اللون">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <button key={p} className="h-9 w-9 rounded-full" style={{ background: p, boxShadow: c.color === p ? "0 0 0 3px #072a1d, 0 0 0 5px #f6f0e1" : "" }} onClick={() => setC({ ...c, color: p })} />
            ))}
          </div>
        </Label>
        <Label t="النقشة">
          <div className="grid grid-cols-6 gap-2">
            {PATTERN_IDS.map((p) => (
              <button key={p} className="h-12 rounded-lg" style={{ backgroundColor: c.color, backgroundImage: patternBg(p), boxShadow: c.pattern === p ? "0 0 0 3px #f6f0e1" : "" }} onClick={() => setC({ ...c, pattern: p })} />
            ))}
          </div>
        </Label>
        <Label t="طريقة اللعب">
          <div className="grid grid-cols-2 gap-2">
            <button className={`btn ${c.mode !== "buzzer" ? "btn-gold" : "btn-ghost"}`} onClick={() => setC({ ...c, mode: "normal" })}>دور الفريق</button>
            <button className={`btn ${c.mode === "buzzer" ? "btn-gold" : "btn-ghost"}`} onClick={() => setC({ ...c, mode: "buzzer" })}>⚡ أسرع إصبع</button>
          </div>
        </Label>
        <Label t="الترتيب"><input className="field num" type="number" value={c.sort ?? 100} onChange={(e) => setC({ ...c, sort: Number(e.target.value) })} /></Label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={c.active !== false} onChange={(e) => setC({ ...c, active: e.target.checked })} /> مفعّلة</label>
        <button className="btn btn-gold" onClick={() => onSave(c)}>حفظ</button>
      </div>
    </Modal>
  );
}

function QuestionForm({
  value,
  categories,
  onSave,
  onClose,
}: {
  value: Partial<Question>;
  categories: Category[];
  onSave: (q: Partial<Question>) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(value);
  const [uploading, setUploading] = useState(false);
  const opts = q.options ?? ["", "", "", ""];
  const setType = (type: QuestionType) => setQ({ ...q, type });
  return (
    <Modal title={q.id ? "تعديل السؤال" : "سؤال جديد"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Label t="الفئة">
          <select className="field" value={q.categoryId} onChange={(e) => setQ({ ...q, categoryId: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Label>
        <Label t="نوع السؤال">
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <button key={t.id} className={`rounded-full px-3 py-1.5 text-sm ${q.type === t.id ? "bg-gold text-ink" : "bg-cream/10"}`} onClick={() => setType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </Label>
        <Label t="السؤال"><textarea className="field min-h-24" value={q.question ?? ""} onChange={(e) => setQ({ ...q, question: e.target.value })} /></Label>

        {q.type === "MULTIPLE_CHOICE" && (
          <Label t="الخيارات (اختر الصحيح)">
            {opts.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={q.correctOption === i} onChange={() => setQ({ ...q, correctOption: i })} />
                <input className="field" placeholder={`خيار ${i + 1}`} value={o} onChange={(e) => setQ({ ...q, options: opts.map((x, j) => (j === i ? e.target.value : x)) })} />
              </div>
            ))}
          </Label>
        )}
        {q.type === "TRUE_FALSE" && (
          <Label t="الإجابة الصحيحة">
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn ${q.correctOption !== 1 ? "btn-green" : "btn-ghost"}`} onClick={() => setQ({ ...q, correctOption: 0 })}>صح</button>
              <button className={`btn ${q.correctOption === 1 ? "btn-red" : "btn-ghost"}`} onClick={() => setQ({ ...q, correctOption: 1 })}>خطأ</button>
            </div>
          </Label>
        )}
        <Label t={q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE" ? "الإجابة / توضيح (اختياري)" : "الإجابة"}>
          <input className="field" value={q.answer ?? ""} onChange={(e) => setQ({ ...q, answer: e.target.value })} />
        </Label>
        <Label t="النقاط"><input className="field num" type="number" value={q.points ?? 100} onChange={(e) => setQ({ ...q, points: Number(e.target.value) })} /></Label>
        <Label t="صورة (اختياري)">
          <div className="flex items-center gap-2">
            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <label className="btn btn-ghost cursor-pointer px-3 py-2 text-sm">
              📷 {q.imageUrl ? "تغيير الصورة" : "رفع صورة"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  const dataUrl = await fileToDataUrl(f, { size: 1024, square: false, quality: 0.8 });
                  const { url } = await api<{ url: string }>("/api/media", { json: { dataUrl } });
                  setQ({ ...q, imageUrl: url });
                } catch (er) {
                  alert((er as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
            </label>
            {q.imageUrl && <button className="text-sm text-[#ff8a85]" onClick={() => setQ({ ...q, imageUrl: null })}>إزالة</button>}
          </div>
        </Label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={q.active !== false} onChange={(e) => setQ({ ...q, active: e.target.checked })} /> مفعّل</label>
        <button className="btn btn-gold" disabled={uploading} onClick={() => onSave(q)}>{uploading ? "جارٍ رفع الصورة…" : "حفظ"}</button>
      </div>
    </Modal>
  );
}
