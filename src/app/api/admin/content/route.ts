// Lightweight content manager API, protected by ADMIN_PIN.
import { GameError } from "@/lib/game/engine";
import type { Category, CategoryMode, PatternId, Question, QuestionType } from "@/lib/game/types";
import { body, handle, json } from "@/lib/server/http";
import { newId } from "@/lib/server/sessions";
import { readyStore } from "@/lib/server/store";
import { THEME } from "@/content/seed";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

function assertPin(req: Request) {
  const expected = process.env.ADMIN_PIN || (process.env.NODE_ENV === "production" ? "" : "9696");
  if (!expected) throw new GameError("لم يتم ضبط ADMIN_PIN على الخادم", 503);
  const got = Buffer.from(req.headers.get("x-admin-pin") ?? "");
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new GameError("الرمز غير صحيح", 401);
}

const TYPES: QuestionType[] = ["TEXT", "MULTIPLE_CHOICE", "TRUE_FALSE", "IMAGE", "COMPLETE_PHRASE"];
const PATTERNS: PatternId[] = ["star", "lattice", "arches", "chevron", "dots", "waves"];

export async function GET(req: Request) {
  return handle(async () => {
    assertPin(req);
    const store = await readyStore();
    const [categories, questions] = await Promise.all([
      store.listCategories({ includeInactive: true }),
      store.listQuestions({ includeInactive: true }),
    ]);
    return json({ categories, questions, store: store.kind });
  });
}

type SaveBody = { kind: "category"; item: Partial<Category> } | { kind: "question"; item: Partial<Question> };

export async function POST(req: Request) {
  return handle(async () => {
    assertPin(req);
    const b = await body<SaveBody>(req);
    const store = await readyStore();
    if (b.kind === "category") {
      const c = b.item;
      const name = String(c.name ?? "").trim();
      if (!name) throw new GameError("اسم الفئة مطلوب");
      const saved = await store.saveCategory({
        id: c.id || newId("c_"),
        themeId: c.themeId || THEME.id,
        name: name.slice(0, 40),
        description: c.description ? String(c.description).slice(0, 120) : null,
        color: /^#[0-9a-f]{6}$/i.test(c.color ?? "") ? c.color! : "#22A06B",
        pattern: PATTERNS.includes(c.pattern as PatternId) ? (c.pattern as PatternId) : "star",
        mode: (c.mode === "buzzer" ? "buzzer" : "normal") as CategoryMode,
        sort: Number.isFinite(Number(c.sort)) ? Number(c.sort) : 100,
        active: c.active !== false,
      });
      return json({ item: saved });
    }
    if (b.kind === "question") {
      const q = b.item;
      const text = String(q.question ?? "").trim();
      const type = TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "TEXT";
      if (!text) throw new GameError("نص السؤال مطلوب");
      if (!q.categoryId) throw new GameError("اختر الفئة");
      let options: string[] | null = null;
      let correctOption: number | null = null;
      let answer = String(q.answer ?? "").trim();
      if (type === "MULTIPLE_CHOICE") {
        options = (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 4);
        if (options.length < 2) throw new GameError("أضف خيارين على الأقل");
        correctOption = Number(q.correctOption);
        if (!(correctOption >= 0 && correctOption < options.length)) throw new GameError("حدد الخيار الصحيح");
        answer = answer || options[correctOption];
      } else if (type === "TRUE_FALSE") {
        correctOption = Number(q.correctOption) === 1 ? 1 : 0;
        answer = answer || (correctOption === 0 ? "صح" : "خطأ");
      }
      if (!answer) throw new GameError("الإجابة مطلوبة");
      const imageUrl = typeof q.imageUrl === "string" && q.imageUrl.trim() ? q.imageUrl.trim().slice(0, 500) : null;
      if (imageUrl && !/^(\/api\/media\/[\w-]+|https:\/\/)/.test(imageUrl)) throw new GameError("رابط الصورة غير صالح");
      const saved = await store.saveQuestion({
        id: q.id || newId("q_"),
        themeId: q.themeId || THEME.id,
        categoryId: q.categoryId,
        question: text.slice(0, 400),
        answer: answer.slice(0, 200),
        type,
        points: Number.isFinite(Number(q.points)) && Number(q.points) > 0 ? Math.round(Number(q.points)) : 100,
        imageUrl,
        options,
        correctOption,
        active: q.active !== false,
      });
      return json({ item: saved });
    }
    throw new GameError("طلب غير صالح");
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    assertPin(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new GameError("طلب غير صالح");
    await (await readyStore()).deleteQuestion(id);
    return json({ ok: true });
  });
}
