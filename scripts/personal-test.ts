// «وش تعرف عنه؟ 👀» — profile, generation and engine-integration checks.
// Usage: npm run test:personal
import assert from "node:assert/strict";
import {
  answerKey,
  applyHostKnow,
  applySubmission,
  canonical,
  emptyDoc,
  FIELDS,
  findByName,
  generatePersonal,
  hostSummary,
  isUsableAnswer,
  PERSONAL_CATEGORY,
  readiness,
  type PersonalDoc,
} from "../src/lib/personal.ts";
import { addPlayer, applyHost, applyPlayer, createGame, PREP_MS, withPersonal } from "../src/lib/game/engine.ts";
import { SEED_CATEGORIES, SEED_QUESTIONS } from "../src/content/seed.ts";

let n = 0;
const ids = (hash = "h") => ({ newId: () => `id${++n}`, tokenHash: hash });
let now = 1_000;
const submit = (doc: PersonalDoc, name: string, answers: Record<string, string>, extra: Partial<Parameters<typeof applySubmission>[1]> = {}, hash = "h") =>
  applySubmission(doc, { name, mode: "other", answers, custom: [], nonce: `n${++n}`, ...extra }, ++now, ids(hash));

// ─── Test 1: many people from one device ───────────────────────────────────
let doc = emptyDoc();
doc = submit(doc, "عزيز", { favorite_food: "شاورما", favorite_color: "أزرق", travel_destination: "اليابان" }).doc;
doc = submit(doc, "منيرة", { favorite_food: "سوشي" }).doc;
const ten = Object.fromEntries(FIELDS.slice(0, 10).map((f, i) => [f.key, ["كبسة", "أسود", "دبي", "الزحمة", "السفر", "قهوة", "القراءة", "القهوة", "العطور", "النوم"][i]]));
doc = submit(doc, "محمد", ten, { mode: "other" }).doc;
assert.equal(doc.profiles.length, 3, "3 profiles from the same device");
assert.equal(findByName(doc, "محمد")!.answers.length, 10);

// ─── Test 2: partial completion (1 / 5 / 15 answers) ────────────────────────
doc = submit(doc, "هلا", { favorite_food: "فول" }).doc;
const all15 = Object.fromEntries(FIELDS.map((f) => [f.key, f.pool[0]]));
doc = submit(doc, "الجوهرة", all15).doc;
assert.equal(findByName(doc, "الجوهره")!.answers.length, 15, "15 answers ok (and ة/ه normalized)");
assert.throws(() => submit(doc, "فارغ", {}), /سؤال واحد/, "needs at least one answer");

// ─── Test 3: same person from two devices merges, never overwrites ──────────
assert.throws(() => submit(doc, "  عزيز ", { favorite_drink: "قهوة" }), /موجود مسبقاً/, "same-name needs confirmation");
doc = submit(doc, "عزيز", { favorite_color: "أحمر", favorite_drink: "شاي" }, { merge: true }, "deviceB").doc;
const aziz = findByName(doc, "عزيز")!;
assert.equal(doc.profiles.filter((p) => p.normalized === aziz.normalized).length, 1, "no duplicate Aziz");
assert.equal(canonical(aziz, "favorite_color")!.text, "أزرق", "earliest answer stays canonical");
assert.equal(aziz.answers.filter((a) => a.key === "favorite_color").length, 2, "conflict kept as candidate");
assert.equal(canonical(aziz, "favorite_drink")!.text, "شاي", "missing field added");

// double-tap (same nonce) → same contribution, no duplicate
const once = applySubmission(doc, { name: "سلمان", mode: "self", answers: { favorite_food: "مندي" }, custom: [], nonce: "SAME" }, ++now, ids());
const twice = applySubmission(once.doc, { name: "سلمان", mode: "self", answers: { favorite_food: "مندي" }, custom: [], nonce: "SAME" }, ++now, ids());
assert.equal(twice.contribution.id, once.contribution.id);
assert.equal(twice.doc.profiles.filter((p) => p.name === "سلمان").length, 1);
doc = once.doc;

// edit own contribution only with its token
const c0 = once.contribution;
assert.throws(() => applySubmission(doc, { name: "", mode: "self", answers: { favorite_food: "x" }, custom: [], nonce: "e1", edit: { contributionId: c0.id, tokenHash: "WRONG" } }, ++now, ids()), /تعدل/);
doc = applySubmission(doc, { name: "", mode: "self", answers: { favorite_food: "برجر" }, custom: [], nonce: "e2", edit: { contributionId: c0.id, tokenHash: "h" } }, ++now, ids()).doc;
assert.equal(canonical(findByName(doc, "سلمان")!, "favorite_food")!.text, "برجر", "edit replaces own answers");

// quality filter
for (const bad of ["-", "مدري", "ما أدري", "أي شي", "ههههه", "؟؟"]) assert.equal(isUsableAnswer(bad), false, bad);
assert.equal(isUsableAnswer("شاورما"), true);
assert.equal(answerKey("الشاورما"), answerKey("شاورما"), "ال- normalized");

// ─── Test 4: generation uses family answers as distractors ──────────────────
let g4 = emptyDoc();
for (const [name, food, color, place] of [
  ["عزيز", "شاورما", "أزرق", "اليابان"],
  ["منيرة", "سوشي", "أخضر", "لندن"],
  ["محمد", "كبسة", "أسود", "دبي"],
  ["هلا", "فول", "أبيض", "باريس"],
])
  g4 = submit(g4, name, { favorite_food: food, favorite_color: color, travel_destination: place }).doc;
const gen = generatePersonal(g4);
const azizFood = gen.questions.find((q) => q.about?.name === "عزيز" && q.id.endsWith(":favorite_food"))!;
assert.ok(azizFood, "Aziz food question generated");
assert.equal(azizFood.type, "MULTIPLE_CHOICE");
assert.deepEqual([...azizFood.options!].sort(), ["سوشي", "شاورما", "فول", "كبسة"].sort(), "options are the family's real answers");
assert.equal(azizFood.options![azizFood.correctOption!], "شاورما");
assert.ok(azizFood.question.includes("عزيز"));
assert.equal(new Set(azizFood.options!.map(answerKey)).size, azizFood.options!.length, "no duplicate options");
assert.ok(readiness(gen).ready, "12 questions / 4 people → ready");
// correct answer position varies across questions
assert.ok(new Set(gen.questions.map((q) => q.correctOption)).size > 1, "correct option position is shuffled");
// readiness threshold
assert.equal(readiness(generatePersonal(submit(emptyDoc(), "أ", { favorite_food: "كبسة", favorite_color: "أزرق" }).doc)).ready, false);

// custom question: with wrong options → MCQ, without → host-judged
let g5 = submit(emptyDoc(), "محمد", { favorite_food: "كبسة" }, {
  custom: [
    { question: "وش أول سيارة كانت مع محمد؟", answer: "كامري", wrong: ["كابرس", "أكورد", "لاندكروزر"] },
    { question: "وش اسم أول مدرسة لمحمد؟", answer: "ابن خلدون" },
  ],
}).doc;
const gen5 = generatePersonal(g5);
const car = gen5.questions.find((q) => q.question.includes("سيارة"))!;
assert.equal(car.type, "MULTIPLE_CHOICE");
assert.deepEqual([...car.options!].sort(), ["أكورد", "كابرس", "كامري", "لاندكروزر"].sort());
assert.equal(gen5.questions.find((q) => q.question.includes("مدرسة"))!.type, "TEXT");

// host review: disable / primary / delete
const hs = hostSummary(doc);
assert.ok(hs.total >= 6 && hs.count > 0);
const colorAnswers = aziz.answers.filter((a) => a.key === "favorite_color");
doc = applyHostKnow(doc, { type: "set_primary", profileId: aziz.id, answerId: colorAnswers[1].id });
assert.equal(canonical(findByName(doc, "عزيز")!, "favorite_color")!.text, "أحمر", "host picks the intended answer");
doc = applyHostKnow(doc, { type: "delete_profile", profileId: findByName(doc, "هلا")!.id });
assert.equal(findByName(doc, "هلا"), undefined);

// ─── Test 6 + engine: balanced rotation, own-team avoidance ─────────────────
let bal = emptyDoc();
bal = submit(bal, "عزيز", all15).doc; // 15 answers
bal = submit(bal, "هلا", { favorite_food: "فول", favorite_color: "أبيض" }).doc; // 2
bal = submit(bal, "محمد", { favorite_food: "كبسة", favorite_color: "أسود", favorite_drink: "شاي", favorite_place: "البر" }).doc; // 4
const genB = generatePersonal(bal);
let game = createGame({
  code: "KN96", name: "t", themeId: "national-day-96",
  teams: [{ name: "الصقور", color: "#22A06B" }, { name: "الذيابة", color: "#D6A63A" }],
  categoryIds: ["nd96-watani"], settings: { totalQuestions: 20, cardsPerCategory: 6 },
  categories: SEED_CATEGORIES, questions: SEED_QUESTIONS, now,
});
game = addPlayer(game, { id: "pA", token: "t", name: "عزيز", gender: "male", avatarUrl: null, teamId: "t1" }, now);
game = addPlayer(game, { id: "pB", token: "t", name: "سارة", gender: "female", avatarUrl: null, teamId: "t2" }, now);
const links = { pA: findByName(bal, "عزيز")!.id, pB: null };
game = withPersonal(game, PERSONAL_CATEGORY, genB.questions, links, true);
assert.ok(game.categoryIds.includes("personal"), "category injected");
assert.equal(game.players[0].profileId, links.pA, "live player linked to profile");
game = applyHost(game, { type: "start" }, now);
game = applyHost(game, { type: "begin_round" }, now);
game = applyHost(game, { type: "override_category", categoryId: "personal" }, now);
const board = game.boards.personal.map((c) => game.content.questions[c.questionId].about!.name);
const counts = board.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
assert.ok((counts["عزيز"] ?? 0) <= 2, `balanced board: ${JSON.stringify(counts)}`);
assert.equal(Object.keys(counts).length, 3, "all three people on the first board");
// team الصقور (with Aziz) should not get a question about Aziz when others exist
const azizCard = game.boards.personal.findIndex((c) => game.content.questions[c.questionId].about!.name === "عزيز");
game = applyHost(game, { type: "pick_card", index: azizCard }, now);
const asked = game.phase.name === "QUESTION" ? game.content.questions[game.phase.questionId] : null;
assert.notEqual(asked!.about!.name, "عزيز", "own-team question swapped for another person");
// personal questions play exactly like normal ones (prep + team vote)
game = applyHost(game, { type: "start_timer" }, now);
now += PREP_MS;
game = applyPlayer(game, "pA", { type: "answer", option: asked!.correctOption! }, now);
assert.equal(game.phase.name, "RESULT");
assert.equal(game.teams[0].score, 100);
// old sessions / feature off: no personal category
const off = withPersonal(game, PERSONAL_CATEGORY, [], {}, false);
assert.ok(!off.categoryIds.includes("personal"));

console.log(`personal: all checks passed ✓ (${genB.questions.length} generated for the balance set, ${gen.questions.length} for test 4)`);
