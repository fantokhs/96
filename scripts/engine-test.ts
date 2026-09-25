// Runs the exact V1 success scenario against the pure engine.
// Usage: npm run test:engine
import assert from "node:assert/strict";
import {
  addPlayer, applyHost, applyPlayer, applyTick, BUZZER_GO_MS, createGame, difficultyPlan, levelOf, normalizeLength,
  PREP_MS, RESULT_LOCK_MS, REVEAL_MS, STEAL_PREP_MS, REOPEN_PREP_MS, TIEBREAK_MS, VOTE_MS,
} from "../src/lib/game/engine.ts";
import { SEED_CATEGORIES, SEED_QUESTIONS } from "../src/content/seed.ts";
import type { Game, Question } from "../src/lib/game/types.ts";
import { withDifficulty } from "../src/content/difficulty.ts";

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
// V1.7: opening screen waits for the presenter — nothing is timed yet
assert.equal(g.phase.name, "INTRO");
assert.equal(applyTick(g, now + 600_000, rng), null, "intro never auto-advances");
assert.throws(() => applyPlayer(g, "p0", { type: "vote_category", categoryId: "nd96-whois" }, now, rng));
g = applyHost(g, { type: "begin_round" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.teamId, "t1");
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.timer.durationMs, 15_000, "15s voting window");

// other team cannot vote
assert.throws(() => applyPlayer(g, "p2", { type: "vote_category", categoryId: "nd96-whois" }, now, rng));

// Team 1 votes: both pick "من هو؟" → complete, but the presenter reveals it
g = applyPlayer(g, "p0", { type: "vote_category", categoryId: "nd96-whois" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
g = applyPlayer(g, "p1", { type: "vote_category", categoryId: "nd96-whois" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE", "all voted does not jump screens");
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.complete, true, "host sees اكتمل التصويت");
g = applyHost(g, { type: "close_vote" }, now, rng);
assert.equal(g.phase.name, "CARD_PICK");
assert.equal(g.boards["nd96-whois"].length, 6);
// «تم اختيار» 3-2-1: category taps can't become card taps
assert.throws(() => applyPlayer(g, "p1", { type: "pick_card", index: 3 }, now, rng), /استعدوا/);
now += REVEAL_MS;
g = applyPlayer(g, "p1", { type: "pick_card", index: 3 }, now, rng);
assert.equal(g.phase.name, "QUESTION");
// question waits for the presenter: timer not running, nothing expires
assert.equal(g.phase.name === "QUESTION" && g.phase.hold, true);
assert.equal(g.phase.name === "QUESTION" && g.phase.timer.endsAt, null, "answer timer not started");
assert.equal(applyTick(g, now + 600_000, rng), null, "question prep never auto-advances");
g = applyHost(g, { type: "start_timer" }, now, rng);
assert.equal(g.phase.name === "QUESTION" && g.phase.hold, false);
assert.equal(g.phase.name === "QUESTION" && g.phase.timer.endsAt! > now, true, "timer starts on ابدأ الوقت");
assert.throws(() => applyHost(g, { type: "start_timer" }, now, rng), /شغّال/);
g = applyHost(g, { type: "correct" }, now, rng);
assert.equal(g.phase.name, "RESULT");
assert.equal(g.teams[0].score, 100);

// V1.7: the result holds for the presenter (no 5s auto-advance), with a short skip lock
now += 6000;
assert.equal(applyTick(g, now, rng), null, "result does not auto-advance after a few seconds");
assert.throws(() => applyHost(g, { type: "next" }, g.phase.name === "RESULT" ? g.phase.lockUntil! - 1 : now, rng), /لحظة/);
g = applyHost(g, { type: "next" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.teamId, "t2");

// Tie: p2 → saudi, p3 → truefalse
g = applyPlayer(g, "p2", { type: "vote_category", categoryId: "nd96-saudi" }, now, rng);
g = applyPlayer(g, "p3", { type: "vote_category", categoryId: "nd96-truefalse" }, now, rng);
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.tie, false);
now += VOTE_MS + 1000;
g = applyTick(g, now, rng)!;
assert.equal(g.phase.name === "CATEGORY_VOTE" && g.phase.tie, true, "tie flagged");
g = applyPlayer(g, "p3", { type: "vote_category", categoryId: "nd96-saudi" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
g = applyHost(g, { type: "close_vote" }, now, rng); // اعتماد التصويت الآن
assert.equal(g.phase.name, "CARD_PICK");
assert.equal(g.phase.name === "CARD_PICK" && g.phase.categoryId, "nd96-saudi");

now += REVEAL_MS;
g = applyPlayer(g, "p2", { type: "pick_card", index: 0 }, now, rng);
assert.equal(g.phase.name, "QUESTION");
const q = g.phase.name === "QUESTION" ? g.content.questions[g.phase.questionId] : null;
const wrong = (q!.correctOption! + 1) % q!.options!.length;
assert.throws(() => applyPlayer(g, "p2", { type: "answer", option: wrong }, now, rng), /المقدم/, "answers locked before ابدأ الوقت");
g = applyHost(g, { type: "start_timer" }, now, rng);
// MCQ: answers are rejected during the «جاوب الآن!» flash (carry-over tap protection)
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
now += RESULT_LOCK_MS;
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
assert.throws(() => applyPlayer(g, "p3", { type: "buzz" }, now, rng), /المقدم/, "استعدوا: waits for ابدأ التحدي");
g = applyHost(g, { type: "start_timer" }, now, rng);
assert.throws(() => applyPlayer(g, "p3", { type: "buzz" }, now, rng), /انطلق/, "buzz before انطلق is ignored");
now += BUZZER_GO_MS;
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
now += RESULT_LOCK_MS;
g = applyHost(g, { type: "next" }, now, rng);
assert.equal(g.phase.name, "CATEGORY_VOTE");
g = applyHost(g, { type: "override_category", categoryId: "nd96-whois" }, now, rng);
g = applyHost(g, { type: "pick_card", index: 0 }, now, rng);
g = applyHost(g, { type: "skip" }, now, rng);
now += RESULT_LOCK_MS;
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
  h = applyHost(h, { type: "begin_round" }, now, rng); // one category → straight to the cards
  h = applyHost(h, { type: "pick_card", index: 0 }, now, rng);
  h = applyHost(h, { type: "start_timer" }, now, rng);
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
  now += RESULT_LOCK_MS;
  h = applyHost(h, { type: "next" }, now, rng); // team B turn (only x4)
  if (h.phase.name === "CATEGORY_VOTE") h = applyHost(h, { type: "override_category", categoryId: "nd96-saudi" }, now, rng);
  h = applyHost(h, { type: "pick_card", index: 1 }, now, rng);
  h = applyHost(h, { type: "start_timer" }, now, rng);
  now += PREP_MS;
  const q2 = h.phase.name === "QUESTION" ? h.content.questions[h.phase.questionId] : null;
  h = applyPlayer(h, "x4", { type: "answer", option: q2!.correctOption! }, now, rng);
  assert.equal(h.phase.name, "RESULT", "1 connected player: 1 vote locks");
  assert.equal(h.streaks?.t2, 1);
}

// ─── V1.7: fair lengths, difficulty curve, fallback, old lengths ─────────────
const QS: Question[] = withDifficulty(SEED_QUESTIONS);
assert.equal(QS.filter((x) => x.active).every((x) => ["easy", "medium", "hard"].includes(x.difficulty!)), true, "every seed question classified");
assert.deepEqual([15, 20, 10, 16, 22].map(normalizeLength), [16, 22, 10, 16, 22], "old 15 → 16, 20 → 22");
for (const [n, e, m, h] of [[10, 4, 4, 2], [16, 6, 6, 4], [22, 8, 8, 6]]) {
  const plan = difficultyPlan(n);
  assert.deepEqual(["easy", "medium", "hard"].map((d) => plan.filter((x) => x === d).length), [e, m, h], `plan ${n}`);
}
const curve = { early: [] as number[], late: [] as number[] };
for (const N of [10, 16, 22]) {
  for (let trial = 0; trial < 6; trial++) {
    let s: Game = createGame({
      code: "FA96", name: "t", themeId: "national-day-96",
      teams: [{ name: "A", color: "#22A06B" }, { name: "B", color: "#D6A63A" }],
      categoryIds: SEED_CATEGORIES.map((c) => c.id), settings: { totalQuestions: N },
      categories: SEED_CATEGORIES, questions: QS, now,
    });
    s = addPlayer(s, { id: "a", token: "t", name: "a", gender: null, avatarUrl: null, teamId: "t1" }, now, rng);
    s = addPlayer(s, { id: "b", token: "t", name: "b", gender: null, avatarUrl: null, teamId: "t2" }, now, rng);
    s = applyHost(s, { type: "start" }, now, rng);
    s = applyHost(s, { type: "begin_round" }, now, rng);
    const turns: Record<string, number> = { t1: 0, t2: 0 };
    for (let guard = 0; guard < 200 && s.phase.name !== "GAME_OVER"; guard++) {
      const ph = s.phase;
      if (ph.name === "CATEGORY_VOTE") s = applyHost(s, { type: "close_vote" }, now, rng);
      else if (ph.name === "CARD_PICK") s = applyHost(s, { type: "reveal_card" }, now, rng);
      else if (ph.name === "QUESTION") {
        turns[ph.teamId]++;
        const idx = s.turn.questionsPlayed;
        const lvl = { easy: 0, medium: 1, hard: 2 }[levelOf(s.content.questions[ph.questionId])];
        if (idx < N / 3) curve.early.push(lvl);
        else if (idx >= (2 * N) / 3) curve.late.push(lvl);
        s = applyHost(s, { type: trial % 2 ? "correct" : "wrong" }, now, rng);
      } else if (ph.name === "RESULT") {
        now += RESULT_LOCK_MS;
        s = applyHost(s, { type: "next" }, now, rng);
      } else if (ph.name === "STEAL") s = applyHost(s, { type: "wrong" }, now, rng);
    }
    assert.equal(s.phase.name, "GAME_OVER", `game of ${N} finishes`);
    assert.deepEqual(turns, { t1: N / 2, t2: N / 2 }, `${N} questions → ${N / 2} primary turns each`);
    assert.equal(s.turn.questionsPlayed, N);
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
assert.equal(avg(curve.early) < avg(curve.late), true, `curve rises (early ${avg(curve.early).toFixed(2)} → late ${avg(curve.late).toFixed(2)})`);
// fallback: target easy but the category only has hard questions left → still a question
{
  const cat = { ...SEED_CATEGORIES[0], id: "hardonly", mode: "normal" as const };
  const hq = [0, 1].map((i) => ({ ...QS[0], id: `h${i}`, categoryId: "hardonly", difficulty: "hard" as const }));
  let f: Game = createGame({
    code: "FB96", name: "t", themeId: "national-day-96",
    teams: [{ name: "A", color: "#22A06B" }, { name: "B", color: "#D6A63A" }],
    categoryIds: ["hardonly"], settings: { totalQuestions: 10 }, categories: [cat], questions: hq, now,
  });
  f = applyHost(f, { type: "start" }, now, rng);
  f = applyHost(f, { type: "begin_round" }, now, rng);
  f = applyHost(f, { type: "reveal_card" }, now, rng);
  assert.equal(f.phase.name, "QUESTION", "no matching difficulty → closest available question");
}
// old odd length rounds up at start (15 → 16) so turns stay equal
{
  let o: Game = createGame({
    code: "FC96", name: "t", themeId: "national-day-96",
    teams: [{ name: "A", color: "#22A06B" }, { name: "B", color: "#D6A63A" }],
    categoryIds: SEED_CATEGORIES.map((c) => c.id), settings: { totalQuestions: 15 },
    categories: SEED_CATEGORIES, questions: QS, now,
  });
  o = applyHost(o, { type: "start" }, now, rng);
  assert.equal(o.settings.totalQuestions, 16);
}
console.log(`difficulty curve: early avg ${avg(curve.early).toFixed(2)} → late avg ${avg(curve.late).toFixed(2)} (0=easy, 2=hard)`);

console.log("engine: all scenario checks passed ✓", `(${SEED_QUESTIONS.length} seed questions)`);
