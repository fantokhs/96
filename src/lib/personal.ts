// «وش تعرف عنه؟ 👀» — session-scoped personal profiles and deterministic question generation.
// Pure module (no I/O, no AI): used by the API routes, the host panel and the tests.
import type { Category, Question } from "./game/types";

export const PERSONAL_CATEGORY_ID = "personal";
export const PERSONAL_CATEGORY: Category = {
  id: PERSONAL_CATEGORY_ID,
  themeId: "national-day-96",
  name: "وش تعرف عنه؟ 👀",
  description: "أسئلة عن العائلة نفسها",
  color: "#C2410C",
  pattern: "dots",
  mode: "normal",
  sort: 0,
  active: true,
};

/** Category becomes playable at ≥ 6 questions about ≥ 2 different people. */
export const READY_MIN_QUESTIONS = 6;
export const READY_MIN_PEOPLE = 2;
export const MAX_CUSTOM = 3;
export const MAX_PROFILES = 120;
const MAX_ANSWER = 120;
const MCQ_MAX_LEN = 32;

// ─── Fields ─────────────────────────────────────────────────────────────────

export interface Field {
  key: string;
  /** asking the person about themselves */
  self: string;
  /** asking about someone else (gender-neutral phrasing) */
  other: (n: string) => string;
  /** in-game wordings (2–4 variants) */
  game: ((n: string) => string)[];
  /** believable fallback distractors */
  pool: string[];
}

export const FIELDS: Field[] = [
  {
    key: "favorite_food",
    self: "وش أكثر أكلة تحبها؟",
    other: (n) => `وش أكلة ${n} المفضلة؟`,
    game: [(n) => `وش أكلة ${n} المفضلة؟`, (n) => `وش أكثر أكلة على قلب ${n}؟`, (n) => `وش الطبق المفضل عند ${n}؟`],
    pool: ["كبسة", "شاورما", "برجر", "سوشي", "فول", "بيتزا", "مكرونة", "مندي", "مطبق"],
  },
  {
    key: "favorite_color",
    self: "وش لونك المفضل؟",
    other: (n) => `وش لون ${n} المفضل؟`,
    game: [(n) => `وش لون ${n} المفضل؟`, (n) => `أي لون هو المفضل عند ${n}؟`],
    pool: ["أخضر", "أزرق", "أسود", "أبيض", "أحمر", "بنفسجي", "أصفر", "وردي"],
  },
  {
    key: "travel_destination",
    self: "لو تقدر تسافر بكرة، وين بتروح؟",
    other: (n) => `لو ${n} يقدر يسافر بكرة، وين الوجهة؟`,
    game: [(n) => `لو تذكرة مجانية بكرة، وين بتكون وجهة ${n}؟`, (n) => `وين وجهة السفر اللي يحلم فيها ${n}؟`, (n) => `لو ${n} يسافر بكرة، وين بيروح؟`],
    pool: ["لندن", "باريس", "طوكيو", "دبي", "اسطنبول", "نيويورك", "المالديف", "سويسرا"],
  },
  {
    key: "annoyance",
    self: "وش أكثر شيء ينرفزك؟",
    other: (n) => `وش أكثر شيء ينرفز ${n}؟`,
    game: [(n) => `وش أكثر شيء ينرفز ${n}؟`, (n) => `وش الشيء اللي يطلّع ${n} من طوره؟`, (n) => `وش أكثر شيء يضايق ${n}؟`],
    pool: ["الزحمة", "التأخير", "الإزعاج", "الانتظار", "الفوضى", "الجوع", "النت البطيء", "الحر"],
  },
  {
    key: "happiness",
    self: "وش أكثر شيء يفرحك؟",
    other: (n) => `وش أكثر شيء يفرّح ${n}؟`,
    game: [(n) => `وش أكثر شيء يفرّح ${n}؟`, (n) => `وش الشيء اللي يعدّل مزاج ${n}؟`],
    pool: ["السفر", "الهدايا", "العائلة", "الأكل", "النوم", "الطلعات", "القهوة", "المفاجآت"],
  },
  {
    key: "favorite_drink",
    self: "وش مشروبك المفضل؟",
    other: (n) => `وش مشروب ${n} المفضل؟`,
    game: [(n) => `وش مشروب ${n} المفضل؟`, (n) => `وش المشروب اللي دايم مع ${n}؟`],
    pool: ["قهوة", "شاي", "ماء", "عصير", "كولا", "قهوة سعودية", "لاتيه", "موهيتو"],
  },
  {
    key: "free_time",
    self: "وش أكثر شيء تسويه بوقت فراغك؟",
    other: (n) => `وش أكثر شيء يسويه ${n} بوقت الفراغ؟`,
    game: [(n) => `وقت الفراغ عند ${n} يروح في وش؟`, (n) => `وش هواية ${n} بوقت الفراغ؟`],
    pool: ["الجوال", "القراءة", "الرياضة", "النوم", "الألعاب", "الطبخ", "المشي", "المسلسلات"],
  },
  {
    key: "daily_must",
    self: "وش الشيء اللي ما تبدأ يومك بدونه؟",
    other: (n) => `وش الشيء اللي ما يبدأ يوم ${n} بدونه؟`,
    game: [(n) => `وش الشيء اللي ما يبدأ يوم ${n} بدونه؟`, (n) => `صباح ${n} ما يكتمل بدون وش؟`],
    pool: ["القهوة", "الشاي", "الفطور", "الجوال", "الرياضة", "الماء", "المشي", "الأخبار"],
  },
  {
    key: "spending",
    self: "وش أكثر شيء ممكن تصرف عليه بدون ندم؟",
    other: (n) => `وين تروح فلوس ${n} بدون ندم؟`,
    game: [(n) => `وين تروح فلوس ${n} بدون ندم؟`, (n) => `وش الشيء اللي ما يغلى على ${n}؟`],
    pool: ["السفر", "الأكل", "الملابس", "العطور", "الأجهزة", "القهوة", "الألعاب", "السيارات"],
  },
  {
    key: "free_day",
    self: "لو عندك يوم كامل فاضي، وش غالباً بتسوي؟",
    other: (n) => `لو عند ${n} يوم كامل فاضي، وش غالباً بيصير فيه؟`,
    game: [(n) => `وش خطة ${n} ليوم كامل فاضي؟`, (n) => `يوم كامل فاضي عند ${n}… وش غالباً بيصير فيه؟`],
    pool: ["النوم", "السفر", "الطلعات", "الأفلام", "البحر", "الرياضة", "التسوق", "زيارة الأهل"],
  },
  {
    key: "favorite_dessert",
    self: "وش أكثر حلى تحبه؟",
    other: (n) => `وش حلى ${n} المفضل؟`,
    game: [(n) => `وش حلى ${n} المفضل؟`, (n) => `وش أكثر حلى على قلب ${n}؟`],
    pool: ["كنافة", "تشيز كيك", "بسبوسة", "آيسكريم", "شوكولاتة", "لقيمات", "كيك", "دونات"],
  },
  {
    key: "favorite_place",
    self: "وش أكثر مكان تحب تروح له؟",
    other: (n) => `وش مكان ${n} المفضل؟`,
    game: [(n) => `وش المكان المفضل عند ${n}؟`, (n) => `لو تدوّرون على ${n}، وين بتلقونه غالباً؟`],
    pool: ["البحر", "البر", "المول", "الكوفي", "الاستراحة", "البيت", "الحديقة", "النادي"],
  },
  {
    key: "favorite_app",
    self: "وش أكثر تطبيق تستخدمه؟",
    other: (n) => `وش التطبيق اللي ما يفارق جوال ${n}؟`,
    game: [(n) => `وش التطبيق اللي ما يفارق جوال ${n}؟`, (n) => `وش أكثر تطبيق مفتوح بجوال ${n}؟`],
    pool: ["واتساب", "سناب شات", "تيك توك", "إنستقرام", "يوتيوب", "إكس", "نتفليكس", "قوقل ماب"],
  },
  {
    key: "common_phrase",
    self: "وش أكثر كلمة أو عبارة تكررها؟",
    other: (n) => `وش الكلمة أو العبارة اللي يكررها ${n}؟`,
    game: [(n) => `وش العبارة اللي ما تفارق لسان ${n}؟`, (n) => `لو قلنا عبارة ${n} المشهورة، وش هي؟`],
    pool: ["يعني", "طيب", "خلاص", "يا رجال", "أكيد", "ولا يهمك", "تمام", "أبشر"],
  },
  {
    key: "million_action",
    self: "لو فزت بمليون، وش أول شيء بتسويه؟",
    other: (n) => `لو ${n} فاز بمليون، وش أول شيء بيسويه؟`,
    game: [(n) => `لو المليون صار عند ${n}، وش أول شيء بيسويه؟`, (n) => `مليون ريال بيد ${n}… وين أول ريال بيروح؟`],
    pool: ["سفر", "سيارة", "بيت", "استثمار", "يوزعه على العائلة", "ساعة", "مشروع", "يحطه بالبنك"],
  },
];

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

// ─── Normalization / quality ────────────────────────────────────────────────

/** Same person detection: trim, spaces, tatweel/diacritics, alef/ya/ta-marbuta forms, Latin case. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Comparison key for answers: also drops a leading «ال» and punctuation. */
export function answerKey(s: string): string {
  return normalizeName(s)
    .replace(/[.,،!؟?؛:"'«»()\-_/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w))
    .join(" ");
}

export function cleanText(s: unknown, max = MAX_ANSWER): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const JUNK = new Set(
  ["مدري", "ما ادري", "مادري", "لا ادري", "ما اعرف", "مااعرف", "لا اعرف", "اي شي", "اي شيء", "ايشي", "شي", "لا شي", "ولا شي", "مافي", "ما في", "لا", "نعم", "ok", "idk", "no", "yes", "test"].map(answerKey),
);

/** Usable as game content? (junk answers are stored but never played) */
export function isUsableAnswer(s: string): boolean {
  const k = answerKey(s);
  if (k.length < 2) return false;
  if (JUNK.has(k)) return false;
  if (/^[\d\s\p{P}\p{S}]+$/u.test(k)) return false;
  if (/^(ه|ها|هه|خ|ك|ل)+$/.test(k.replace(/\s/g, ""))) return false; // هههه / خخخ
  if (/^(.)\1{2,}$/.test(k.replace(/\s/g, ""))) return false;
  return true;
}

// ─── Document ───────────────────────────────────────────────────────────────

export interface PAnswer {
  id: string;
  key: string;
  text: string;
  contributionId: string;
  createdAt: number;
  disabled?: boolean;
  /** host picked this one among conflicting answers */
  primary?: boolean;
}
export interface PCustom {
  id: string;
  question: string;
  answer: string;
  wrong: string[];
  contributionId: string;
  createdAt: number;
  active: boolean;
}
export interface PProfile {
  id: string;
  name: string;
  normalized: string;
  createdAt: number;
  updatedAt: number;
  answers: PAnswer[];
  custom: PCustom[];
}
export interface PContribution {
  id: string;
  profileId: string;
  tokenHash: string;
  mode: "self" | "other";
  nonce: string;
  createdAt: number;
}
export interface PersonalDoc {
  v: 1;
  profiles: PProfile[];
  contributions: PContribution[];
}

export const emptyDoc = (): PersonalDoc => ({ v: 1, profiles: [], contributions: [] });

export function findByName(doc: PersonalDoc, name: string): PProfile | undefined {
  const n = normalizeName(name);
  return doc.profiles.find((p) => p.normalized === n);
}

/** Canonical answer per field: host's pick, else the earliest usable enabled answer. */
export function canonical(p: PProfile, key: string): PAnswer | undefined {
  const list = p.answers.filter((a) => a.key === key && !a.disabled && isUsableAnswer(a.text));
  return list.find((a) => a.primary) ?? list.sort((a, b) => a.createdAt - b.createdAt)[0];
}

export interface SubmitInput {
  name: string;
  mode: "self" | "other";
  /** merge into an existing same-name profile (the client confirmed «أكمل معلوماته») */
  merge?: boolean;
  answers: Record<string, string>;
  custom: { question: string; answer: string; wrong?: string[] }[];
  nonce: string;
  /** editing a previous contribution from this browser */
  edit?: { contributionId: string; tokenHash: string };
}
export interface SubmitIds {
  newId: () => string;
  tokenHash: string;
}
export class PersonalError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(message: string, status = 400, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Apply a questionnaire submission. Never overwrites another contributor's answers. */
export function applySubmission(
  prev: PersonalDoc,
  input: SubmitInput,
  now: number,
  ids: SubmitIds,
): { doc: PersonalDoc; profile: PProfile; contribution: PContribution; created: boolean } {
  const doc: PersonalDoc = structuredClone(prev);
  const answers = Object.entries(input.answers ?? {})
    .filter(([k]) => FIELD_BY_KEY.has(k))
    .map(([k, v]) => [k, cleanText(v)] as const)
    .filter(([, v]) => v.length > 0);
  const custom = (input.custom ?? [])
    .slice(0, MAX_CUSTOM)
    .map((c) => ({
      question: cleanText(c.question, 160),
      answer: cleanText(c.answer),
      wrong: (c.wrong ?? []).map((w) => cleanText(w)).filter(Boolean).slice(0, 3),
    }))
    .filter((c) => c.question.length > 3 && c.answer.length > 0);

  // editing my own earlier contribution: replace only what I wrote
  if (input.edit) {
    const c = doc.contributions.find((x) => x.id === input.edit!.contributionId);
    if (!c || c.tokenHash !== input.edit.tokenHash) throw new PersonalError("ما تقدر تعدل هذي المعلومات", 403);
    const profile = doc.profiles.find((p) => p.id === c.profileId);
    if (!profile) throw new PersonalError("الشخص غير موجود", 404);
    if (answers.length === 0 && custom.length === 0) throw new PersonalError("جاوب سؤال واحد على الأقل");
    profile.answers = profile.answers.filter((a) => a.contributionId !== c.id);
    profile.custom = profile.custom.filter((q) => q.contributionId !== c.id);
    addContent(profile, c.id, answers, custom, now, ids);
    profile.updatedAt = now;
    return { doc, profile, contribution: c, created: false };
  }

  // double-tap on «إرسال» → same contribution back
  const dup = doc.contributions.find((x) => x.nonce === input.nonce && input.nonce);
  if (dup) {
    const profile = doc.profiles.find((p) => p.id === dup.profileId)!;
    return { doc: prev, profile, contribution: dup, created: false };
  }

  const name = cleanText(input.name, 30);
  if (!name) throw new PersonalError("اكتب الاسم");
  if (answers.length === 0 && custom.length === 0) throw new PersonalError("جاوب سؤال واحد على الأقل");
  let profile = findByName(doc, name);
  let created = false;
  if (profile && !input.merge) {
    throw new PersonalError(`${profile.name} موجود مسبقاً 👀`, 409, { exists: true, name: profile.name });
  }
  if (!profile) {
    if (doc.profiles.length >= MAX_PROFILES) throw new PersonalError("وصلنا الحد الأقصى للأشخاص في هذه الجلسة");
    profile = { id: ids.newId(), name, normalized: normalizeName(name), createdAt: now, updatedAt: now, answers: [], custom: [] };
    doc.profiles.push(profile);
    created = true;
  }
  const room = MAX_CUSTOM - profile.custom.length;
  const contribution: PContribution = {
    id: ids.newId(),
    profileId: profile.id,
    tokenHash: ids.tokenHash,
    mode: input.mode === "self" ? "self" : "other",
    nonce: input.nonce,
    createdAt: now,
  };
  doc.contributions.push(contribution);
  addContent(profile, contribution.id, answers, custom.slice(0, Math.max(0, room)), now, ids);
  profile.updatedAt = now;
  return { doc, profile, contribution, created };
}

function addContent(
  profile: PProfile,
  contributionId: string,
  answers: (readonly [string, string])[],
  custom: { question: string; answer: string; wrong: string[] }[],
  now: number,
  ids: SubmitIds,
) {
  for (const [key, text] of answers) {
    // an existing identical answer adds nothing; a different one is kept as a candidate
    if (profile.answers.some((a) => a.key === key && answerKey(a.text) === answerKey(text))) continue;
    profile.answers.push({ id: ids.newId(), key, text, contributionId, createdAt: now });
  }
  for (const c of custom) {
    profile.custom.push({ id: ids.newId(), ...c, contributionId, createdAt: now, active: true });
  }
}

/** Fields that already have a usable answer (so «أكمل معلوماته» asks only the rest). */
export function answeredKeys(p: PProfile): string[] {
  return FIELDS.filter((f) => canonical(p, f.key)).map((f) => f.key);
}

// ─── Question generation ────────────────────────────────────────────────────

type Rng = () => number;

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function seeded(seed: string): Rng {
  let x = hashStr(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrong options: other family members' answers to the same field first, then the curated pool. */
export function distractors(doc: PersonalDoc, field: Field, profileId: string, correct: string, rng: Rng, want = 3): string[] {
  const seen = new Set([answerKey(correct)]);
  const out: string[] = [];
  const family = shuffle(
    doc.profiles
      .filter((p) => p.id !== profileId)
      .map((p) => canonical(p, field.key)?.text)
      .filter((t): t is string => !!t && t.length <= MCQ_MAX_LEN),
    rng,
  );
  for (const t of [...family, ...shuffle(field.pool, rng)]) {
    const k = answerKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= want) break;
  }
  return out;
}

export interface Generated {
  questions: Question[];
  perPerson: Record<string, number>;
}

/**
 * Deterministic generation (stable IDs, so used questions never repeat in a session).
 * - default fields → multiple choice with family-answer distractors; long answers → host-judged
 * - custom questions → multiple choice with the submitter's wrong options, else host-judged
 */
export function generatePersonal(doc: PersonalDoc, themeId = PERSONAL_CATEGORY.themeId): Generated {
  const questions: Question[] = [];
  const perPerson: Record<string, number> = {};
  for (const p of doc.profiles) {
    let n = 0;
    for (const f of FIELDS) {
      const a = canonical(p, f.key);
      if (!a) continue;
      const rng = seeded(`${p.id}:${f.key}:${a.id}`);
      const wording = f.game[Math.floor(rng() * f.game.length)](p.name);
      const base = {
        id: `personal:${p.id}:${f.key}`,
        themeId,
        categoryId: PERSONAL_CATEGORY_ID,
        question: wording,
        answer: a.text,
        points: 100,
        imageUrl: null,
        active: true,
        about: { profileId: p.id, name: p.name },
      };
      if (a.text.length > MCQ_MAX_LEN) {
        if (a.text.length > 80) continue; // too long to judge aloud either
        questions.push({ ...base, type: "TEXT", options: null, correctOption: null });
        n++;
        continue;
      }
      const wrong = distractors(doc, f, p.id, a.text, rng);
      if (wrong.length < 2) continue;
      const options = shuffle([a.text, ...wrong], rng);
      questions.push({ ...base, type: "MULTIPLE_CHOICE", options, correctOption: options.indexOf(a.text) });
      n++;
    }
    for (const c of p.custom) {
      if (!c.active || !isUsableAnswer(c.answer)) continue;
      const rng = seeded(`${p.id}:c:${c.id}`);
      const base = {
        id: `personal:${p.id}:c:${c.id}`,
        themeId,
        categoryId: PERSONAL_CATEGORY_ID,
        question: c.question,
        answer: c.answer,
        points: 100,
        imageUrl: null,
        active: true,
        about: { profileId: p.id, name: p.name },
      };
      const seen = new Set([answerKey(c.answer)]);
      const wrong = c.wrong.filter((w) => {
        const k = answerKey(w);
        if (!isUsableAnswer(w) || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (wrong.length >= 2) {
        const options = shuffle([c.answer, ...wrong], rng);
        questions.push({ ...base, type: "MULTIPLE_CHOICE", options, correctOption: options.indexOf(c.answer) });
      } else {
        // no believable wrong options → spoken answer, host judges
        questions.push({ ...base, type: "TEXT", options: null, correctOption: null });
      }
      n++;
    }
    if (n) perPerson[p.id] = n;
  }
  return { questions, perPerson };
}

export function readiness(gen: Generated) {
  const people = Object.keys(gen.perPerson).length;
  const count = gen.questions.length;
  return { count, people, ready: count >= READY_MIN_QUESTIONS && people >= READY_MIN_PEOPLE };
}

/** Public summary for the host panel (no tokens). */
export function hostSummary(doc: PersonalDoc) {
  const gen = generatePersonal(doc);
  const r = readiness(gen);
  return {
    ...r,
    total: doc.profiles.length,
    profiles: doc.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      playable: gen.perPerson[p.id] ?? 0,
      answers: FIELDS.map((f) => {
        const all = p.answers.filter((a) => a.key === f.key);
        if (!all.length) return null;
        const c = canonical(p, f.key);
        return {
          key: f.key,
          label: f.self,
          items: all.map((a) => ({ id: a.id, text: a.text, disabled: !!a.disabled, usable: isUsableAnswer(a.text), canonical: c?.id === a.id })),
        };
      }).filter(Boolean),
      custom: p.custom.map((c) => ({ id: c.id, question: c.question, answer: c.answer, wrong: c.wrong, active: c.active })),
    })),
  };
}

export type HostKnowAction =
  | { type: "toggle_answer"; profileId: string; answerId: string }
  | { type: "set_primary"; profileId: string; answerId: string }
  | { type: "toggle_custom"; profileId: string; customId: string }
  | { type: "delete_profile"; profileId: string }
  | { type: "delete_all" };

export function applyHostKnow(prev: PersonalDoc, a: HostKnowAction): PersonalDoc {
  const doc: PersonalDoc = structuredClone(prev);
  if (a.type === "delete_all") return emptyDoc();
  const p = doc.profiles.find((x) => x.id === a.profileId);
  if (!p) throw new PersonalError("الشخص غير موجود", 404);
  switch (a.type) {
    case "toggle_answer": {
      const ans = p.answers.find((x) => x.id === a.answerId);
      if (ans) ans.disabled = !ans.disabled;
      break;
    }
    case "set_primary": {
      const ans = p.answers.find((x) => x.id === a.answerId);
      if (!ans) break;
      for (const x of p.answers) if (x.key === ans.key) x.primary = x.id === ans.id;
      ans.disabled = false;
      break;
    }
    case "toggle_custom": {
      const c = p.custom.find((x) => x.id === a.customId);
      if (c) c.active = !c.active;
      break;
    }
    case "delete_profile":
      doc.profiles = doc.profiles.filter((x) => x.id !== p.id);
      doc.contributions = doc.contributions.filter((c) => c.profileId !== p.id);
      break;
  }
  return doc;
}

export const INVITE_TEXT = (url: string) =>
  `خيمة الفنتوخ 👀\nعبّ عن نفسك أو عن أي شخص من العائلة، جاوب اللي تعرفه بس ولا تعلم أحد وش كتبت:\n${url}`;
