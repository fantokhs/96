// Runs the exact V1 success scenario against the pure engine.
// Usage: npm run test:engine
import assert from "node:assert/strict";
import { addPlayer, applyHost, applyPlayer, applyTick, createGame } from "../src/lib/game/engine.ts";
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
// MCQ wrong answer from team 2
const q = g.phase.name === "QUESTION" ? g.content.questions[g.phase.questionId] : null;
const wrong = (q!.correctOption! + 1) % q!.options!.length;
g = applyPlayer(g, "p2", { type: "answer", option: wrong }, now, rng);
assert.equal(g.phase.name, "QUESTION");
g = applyHost(g, { type: "steal" }, now, rng);
assert.equal(g.phase.name, "STEAL");
assert.equal(g.phase.name === "STEAL" && g.phase.teamId, "t1");
assert.throws(() => applyPlayer(g, "p0", { type: "answer", option: wrong }, now, rng), /مستبعد/);
g = applyPlayer(g, "p0", { type: "answer", option: q!.correctOption! }, now, rng);
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
g = applyPlayer(g, "p3", { type: "buzz" }, now, rng);
assert.throws(() => applyPlayer(g, "p0", { type: "buzz" }, now, rng), /سبقك/);
g = applyHost(g, { type: "wrong" }, now, rng); // reopens for team 1
assert.equal(g.phase.name === "QUESTION" && g.phase.buzzer?.lockedBy, null);
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

console.log("engine: all scenario checks passed ✓", `(${SEED_QUESTIONS.length} seed questions)`);
