// Runs the exact V1 success scenario against the pure engine.
// Usage: npm run test:engine
import assert from "node:assert/strict";
import { addPlayer, applyHost, applyPlayer, applyTick, createGame, PREP_MS, STEAL_PREP_MS, REOPEN_PREP_MS, TIEBREAK_MS } from "../src/lib/game/engine.ts";
import { SEED_CATEGORIES, SEED_QUESTIONS } from "../src/content/seed.ts";
import type { Game } from "../src/lib/game/types.ts";

let now = 1_000_000;
let seed = 42;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

let g: Game = createGame({
  code: "AB96",
  name: "خيمة الفنتوخ",
  themeId: "national-day-96",
  teams: [
    { name: "الصقور", color: "#22A06B" },
    { name: "الذيابة", color: "#D6A63A" },
  ],
  categoryIds: SEED_CATEGORIES.map((c) => c.id),
  settings: { totalQuestions: 4 },
  categories: SEED_CATEGORIES,
  questions: SEED_QUESTIONS,
  now,
});
assert.equal(SEED_QUESTIONS.length >= 96, true, "seed has at least 96 questions");

const players = ["سارة", "فهد", "نورة", "خالد"].map((name, i) => ({ id: `p${i}`, token: `tok${i}`, name }));
players.forEach((p, i) => {
  g = addPlayer(g, { ...p, gender: null, avatarUrl: null, teamId: i < 2 ? "t1" : "t2" }, now, rng);
});
assert.deepEqual(g.players.map((p) => p.teamId), ["t1", "t1", "t2", "t2"]);

g = applyHost(g, { type: "start" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.teamId, "t1");

// other team cannot vote
assert.throws(() => applyPlayer(g, "p2", { type: "vote_category", categoryId: "nd96-whois" }, now, rng));

// Team 1 votes: both pick "من هو؟" → resolves immediately
g = applyPlayer(g, "p0", { type: "vote_category", categoryId: "nd96-whois" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
g = applyPlayer(g, "p1", { type: "vote_category", categoryId: "nd96-whois" }, now, rng);
assert.equal(g.phase.name, "CARD_PICK");
assert.equal(g.boards["nd96-whois"].length, 6);

g = applyPlayer(g, "p1", { type: "pick_card", index: 3 }, now, rng);
assert.equal(g.phase.name, "QUESTION");
g = applyHost(g, { type: "correct" }, now, rng);
assert.equal(g.phase.name, "RESULT");
assert.equal(g.teams[0].score, 100);

// result auto-advances
now += 6000;
g = applyTick(g, now, rng)!;
assert.equal(g.phase.name, "CATEGORY_VOTE");
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.teamId, "t2");

// Tie: p2 → watani, p3 → truefalse
g = applyPlayer(g, "p2", { type: "vote_category", categoryId: "nd96-watani" }, now, rng);
g = applyPlayer(g, "p3", { type: "vote_category", categoryId: "nd96-truefalse" }, now, rng);
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.tie, false);
now += 21_000;
g = applyTick(g, now, rng)!;
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.tie, true, "tie flagged");
g = applyPlayer(g, "p3", { type: "vote_category", categoryId: "nd96-watani" }, now, rng);
assert.equal(g.phase.name, "CARD_PICK");
assert.equal(g.phase.name === "CARD_PICK" && g.phase.categoryId, "nd96-watani");

g = applyPlayer(g, "p2", { type: "pick_card", index: 0 }, now, rng);
assert.equal(g.phase.name, "QUESTION");
// MCQ: answers are rejected during the 3-2-1 prep (carry-over tap protection)
const q = g.phase.name === "QUESTION" ? g.content.questions[g.phase.questionId] : null;
const wrong = (q!.correctOption! + 1) % q!.options!.length;
assert.throws(() => applyPlayer(g, "p2", { type: "answer", option: wrong }, now, rng), /استعدوا/);
now += PREP_MS;
// Team consensus: with 2 connected players one vote is NOT the team answer…
g = applyPlayer(g, "p2", { type: "answer", option: wrong }, now, rng);
assert.equal(g.phase.name === "QUESTION" && g.phase.attempt, null, "single vote does not lock");
// …votes can change, and a majority (2 of 2) locks it
g = applyPlayer(g, "p2", { type: "answer", option: q!.correctOption! }, now, rng);
g = applyPlayer(g, "p3", { type: "answer", option: wrong }, now, rng);
assert.equal(g.phase.name === "QUESTION" && g.phase.attempt, null, "split vote does not lock");
g = applyPlayer(g, "p2", { type: "answer", option: wrong }, now, rng);
assert.equal(g.phase.name === "QUESTION" && g.phase.attempt?.option, wrong, "majority locks");
assert.throws(() => applyPlayer(g, "p3", { type: "answer", option: 0 }, now, rng), /اعتماد/);
assert.equal(g.phase.name, "QUESTION");
g = applyHost(g, { type: "steal" }, now, rng);
assert.equal(g.phase.name, "STEAL");
assert.equal(g.phase.name === "STEAL" && g.phase.teamId, "t1");
now += STEAL_PREP_MS;
assert.throws(() => applyPlayer(g, "p0", { type: "answer", option: wrong }, now, rng), /مستبعد/);
g = applyPlayer(g, "p0", { type: "answer", option: q!.correctOption! }, now, rng);
g = applyPlayer(g, "p1", { type: "answer", option: q!.correctOption! }, now, rng);
assert.equal(g.phase.name, "RESULT");
assert.equal(g.teams[0].score, 150);
assert.equal(g.teams[1].score, 0);

// pause/resume keeps remaining time
g = applyHost(g, { type: "next" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
g = applyHost(g, { type: "pause" }, now, rng);
now += 60_000;
assert.equal(applyTick(g, now, rng), null, "paused timers do not expire");
g = applyHost(g, { type: "resume" }, now, rng);

// Buzzer category
g = applyHost(g, { type: "override_category", categoryId: "nd96-speed" }, now, rng);
g = applyHost(g, { type: "pick_card", index: 1 }, now, rng);
assert.equal(g.phase.name === "QUESTION" && !!g.phase.buzzer, true);
assert.throws(() => applyPlayer(g, "p3", { type: "buzz" }, now, rng), /انطلق/, "buzz before انطلق is ignored");
now += PREP_MS;
g = applyPlayer(g, "p3", { type: "buzz" }, now, rng);
assert.throws(() => applyPlayer(g, "p0", { type: "buzz" }, now, rng), /سبقك/);
g = applyHost(g, { type: "wrong" }, now, rng); // reopens for team 1
assert.equal(g.phase.name === "QUESTION" && g.phase.buzzer?.lockedBy, null);
now += REOPEN_PREP_MS;
assert.throws(() => applyPlayer(g, "p2", { type: "buzz" }, now, rng), /خارج/);
g = applyPlayer(g, "p1", { type: "buzz" }, now, rng);
g = applyHost(g, { type: "correct" }, now, rng);
assert.equal(g.teams[0].score, 200, "buzzer rebound earns steal points");

// Last question → game over
g = applyHost(g, { type: "next" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
g = applyHost(g, { type: "override_category", categoryId: "nd96-whois" }, now, rng);
g = applyHost(g, { type: "pick_card", index: 0 }, now, rng);
g = applyHost(g, { type: "skip" }, now, rng);
g = applyHost(g, { type: "next" }, now, rng);
assert.equal(g.phase.name, "GAME_OVER");
assert.deepEqual(g.phase.name === "GAME_OVER" && g.phase.winners, ["t1"]);

// No question repeats
assert.equal(new Set(g.usedQuestionIds).size, g.usedQuestionIds.length);

// Replay keeps players, resets scores
g = applyHost(g, { type: "replay" }, now, rng);
assert.equal(g.phase.name, "LOBBY");
assert.equal(g.teams[0].score, 0);
assert.equal(g.players.length, 4);

// ─── V1.4: timer expiry plurality / tie, undo, presence ──────────────────────
{
  let h: Game = createGame({
    code: "TT96", name: "t", themeId: "national-day-96",
    teams: [{ name: "A", color: "#22A06B" }, { name: "B", color: "#D6A63A" }],
    categoryIds: ["nd96-saudi"], settings: { totalQuestions: 10 },
    categories: SEED_CATEGORIES, questions: SEED_QUESTIONS, now,
  });
  for (const [i, t] of ["t1", "t1", "t1", "t1", "t2"].entries())
    h = addPlayer(h, { id: `x${i}`, token: "t", name: `x${i}`, gender: null, avatarUrl: null, teamId: t }, now, rng);
  h = applyHost(h, { type: "start" }, now, rng);
  h = applyHost(h, { type: "pick_card", index: 0 }, now, rng);
  const qq = h.phase.name === "QUESTION" ? h.content.questions[h.phase.questionId] : null;
  const c = qq!.correctOption!, w = (c + 1) % qq!.options!.length;
  now += PREP_MS;
  // 4 connected: 3 matching votes needed; 2+1 split → no lock
  h = applyPlayer(h, "x0", { type: "answer", option: w }, now, rng);
  h = applyPlayer(h, "x1", { type: "answer", option: w }, now, rng);
  h = applyPlayer(h, "x2", { type: "answer", option: c }, now, rng);
  assert.equal(h.phase.name === "QUESTION" && h.phase.attempt, null, "2 of 4 is not a majority");
  // x3's phone went to sleep (no heartbeat for > 45s): denominator shrinks to 3 → 2 already enough? no: needs a new vote to re-check
  // timer expiry → plurality (w: 2 vs c: 1) is submitted
  now += 20_000;
  h = applyTick(h, now, rng)!;
  assert.equal(h.phase.name === "QUESTION" && h.phase.attempt?.option, w, "plurality submitted on expiry");
  // undo restores the unlocked question
  h = applyHost(h, { type: "undo" }, now, rng);
  assert.equal(h.phase.name === "QUESTION" && h.phase.attempt, null, "undo reverts auto-lock");
  // make it a tie: x2 switches? use a fresh tie: w:2 c:2
  h = applyPlayer(h, "x3", { type: "answer", option: c }, now, rng);
  assert.equal(h.phase.name === "QUESTION" && h.phase.attempt, null);
  now += 25_000;
  h = applyTick(h, now, rng)!;
  assert.equal(h.phase.name === "QUESTION" && h.phase.tie, true, "tie → 3s tie-break round, no random pick");
  now += TIEBREAK_MS + 10;
  h = applyTick(h, now, rng)!;
  assert.equal(h.phase.name === "QUESTION" && h.phase.stuck, true, "still tied → waits for host");
  assert.equal(h.phase.name === "QUESTION" && h.phase.attempt, null);
  assert.equal(applyTick(h, now + 5000, rng), null, "stuck state does not auto-resolve");
  h = applyHost(h, { type: "team_answer", option: c }, now, rng);
  assert.equal(h.phase.name, "RESULT");
  assert.equal(h.teams[0].score, 100);
  // host double-tap: second "correct" in RESULT is rejected (no double scoring)
  assert.throws(() => applyHost(h, { type: "correct" }, now, rng));
  // undo the scoring
  h = applyHost(h, { type: "undo" }, now, rng);
  assert.equal(h.teams[0].score, 0, "undo reverts score");
  assert.throws(() => applyHost(h, { type: "undo" }, now, rng), /تراجع/, "one level of undo");
  // +5s
  const before = h.phase.name === "QUESTION" ? h.phase.stuck : null;
  h = applyHost(h, { type: "add_time", seconds: 5 }, now, rng);
  assert.equal(before, true);
  assert.equal(h.phase.name === "QUESTION" && h.phase.stuck, false, "+5s reopens voting");
  // presence: single connected player → 1 vote locks
  h = applyHost(h, { type: "skip" }, now, rng);
  h = applyHost(h, { type: "next" }, now, rng); // team B turn (only x4)
  if (h.phase.name === "CATEGORY_VOTE") h = applyHost(h, { type: "override_category", categoryId: "nd96-saudi" }, now, rng);
  h = applyHost(h, { type: "pick_card", index: 1 }, now, rng);
  now += PREP_MS;
  const q2 = h.phase.name === "QUESTION" ? h.content.questions[h.phase.questionId] : null;
  h = applyPlayer(h, "x4", { type: "answer", option: q2!.correctOption! }, now, rng);
  assert.equal(h.phase.name, "RESULT", "1 connected player: 1 vote locks");
  assert.equal(h.streaks?.t2, 1);
}

console.log("engine: all scenario checks passed ✓", `(${SEED_QUESTIONS.length} seed questions)`);
