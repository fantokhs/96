// Pure game engine: (game, action, now) → next game. No I/O here.
import type {
  Card,
  Category,
  Game,
  GameEvent,
  HostAction,
  Outcome,
  Phase,
  Player,
  PlayerAction,
  Question,
  Settings,
  Team,
  Timer,
  UndoSnapshot,
} from "./types";

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const VOTE_MS = 20_000;
export const TIE_MS = 10_000;
export const PICK_MS = 20_000;
export const RESULT_MS = 5_500;
/** 3-2-1 before answers/buzzes are accepted (protects against carry-over taps) */
export const PREP_MS = 3_000;
export const STEAL_PREP_MS = 2_000;
export const REOPEN_PREP_MS = 1_500;
export const TIEBREAK_MS = 3_000;
/** a player counts as connected if their phone pinged within this window */
export const ONLINE_MS = 45_000;
/** heartbeat writes are skipped if the last one is fresher than this */
export const PING_WRITE_MS = 20_000;

export type Rng = () => number;

export const DEFAULT_SETTINGS: Settings = {
  totalQuestions: 10,
  targetScore: null,
  voteEvery: 1,
  questionSeconds: 20,
  stealSeconds: 10,
  correctPoints: 100,
  stealPoints: 50,
  cardsPerCategory: 6,
  soundOn: true,
};

export const TRUE_FALSE_OPTIONS = ["صح", "خطأ"];

// ─── Timers ─────────────────────────────────────────────────────────────────

export function newTimer(ms: number, now: number, paused: boolean): Timer {
  return paused
    ? { durationMs: ms, endsAt: null, remainingMs: ms }
    : { durationMs: ms, endsAt: now + ms, remainingMs: null };
}

export function timerLeft(t: Timer, now: number): number {
  if (t.endsAt === null) return t.remainingMs ?? 0;
  return Math.max(0, t.endsAt - now);
}

function stopTimer(t: Timer, now: number): Timer {
  return { ...t, endsAt: null, remainingMs: timerLeft(t, now), stopped: true };
}

function expired(t: Timer, now: number) {
  return t.endsAt !== null && now >= t.endsAt;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emit(g: Game, e: Omit<GameEvent, "seq">) {
  g.event = { ...e, seq: g.event.seq + 1 };
}

function team(g: Game, id: string): Team {
  const t = g.teams.find((x) => x.id === id);
  if (!t) throw new GameError("الفريق غير موجود");
  return t;
}

function activeTeam(g: Game): Team {
  return g.teams[g.turn.activeTeamIndex % g.teams.length];
}

function category(g: Game, id: string): Category {
  const c = g.content.categories.find((x) => x.id === id);
  if (!c) throw new GameError("الفئة غير موجودة");
  return c;
}

export function questionOf(g: Game, id: string): Question {
  const q = g.content.questions[id];
  if (!q) throw new GameError("السؤال غير موجود");
  return q;
}

export function optionsOf(q: Question): string[] | null {
  if (q.type === "TRUE_FALSE") return TRUE_FALSE_OPTIONS;
  if (q.type === "MULTIPLE_CHOICE" && q.options && q.options.length >= 2) return q.options;
  return null;
}

export function teamMembers(g: Game, teamId: string): Player[] {
  return g.players.filter((p) => p.teamId === teamId);
}

export function isOnline(p: Player, now: number): boolean {
  return !!p.lastSeen && now - p.lastSeen < ONLINE_MS;
}

/** True when a heartbeat should be written for this player. */
export function needsPing(g: Game, playerId: string, now: number): boolean {
  const p = g.players.find((x) => x.id === playerId);
  return !!p && (!p.lastSeen || now - p.lastSeen >= PING_WRITE_MS);
}

function smallestTeam(g: Game, rng: Rng): Team {
  const min = Math.min(...g.teams.map((t) => teamMembers(g, t.id).length));
  const candidates = g.teams.filter((t) => teamMembers(g, t.id).length === min);
  return candidates[Math.floor(rng() * candidates.length)];
}

function unusedQuestionIds(g: Game, categoryId: string): string[] {
  const used = new Set(g.usedQuestionIds);
  const onBoard = new Set((g.boards[categoryId] ?? []).map((c) => c.questionId));
  return Object.values(g.content.questions)
    .filter((q) => q.categoryId === categoryId && q.active && !used.has(q.id) && !onBoard.has(q.id))
    .map((q) => q.id);
}

/** Unused questions remaining (on the board or not yet dealt). */
export function remainingInCategory(g: Game, categoryId: string): number {
  const board = g.boards[categoryId] ?? [];
  return board.filter((c) => !c.used).length + unusedQuestionIds(g, categoryId).length;
}

function availableCategories(g: Game): string[] {
  return g.categoryIds.filter((id) => remainingInCategory(g, id) > 0);
}

const PERSONAL = "personal";

/**
 * «وش تعرف عنه؟»: deal cards round-robin across people, starting with whoever has
 * been asked about least, so one well-filled profile can't dominate the category.
 */
function balancedPersonal(g: Game, ids: string[], n: number, rng: Rng): string[] {
  const asked: Record<string, number> = {};
  for (const id of g.usedQuestionIds) {
    const pid = g.content.questions[id]?.about?.profileId;
    if (pid) asked[pid] = (asked[pid] ?? 0) + 1;
  }
  const byPerson = new Map<string, string[]>();
  for (const id of shuffle(ids, rng)) {
    const pid = g.content.questions[id]?.about?.profileId ?? id;
    byPerson.set(pid, [...(byPerson.get(pid) ?? []), id]);
  }
  const people = shuffle([...byPerson.keys()], rng).sort((a, b) => (asked[a] ?? 0) - (asked[b] ?? 0));
  const out: string[] = [];
  while (out.length < n && people.some((p) => byPerson.get(p)!.length)) {
    for (const p of people) {
      const next = byPerson.get(p)!.shift();
      if (next) out.push(next);
      if (out.length >= n) break;
    }
  }
  return out;
}

/** Make sure the category has a board with at least one face-down card. */
function ensureBoard(g: Game, categoryId: string, rng: Rng) {
  const board = g.boards[categoryId];
  if (board && board.some((c) => !c.used)) return;
  const unused = unusedQuestionIds(g, categoryId);
  const ids =
    categoryId === PERSONAL
      ? balancedPersonal(g, unused, g.settings.cardsPerCategory, rng)
      : shuffle(unused, rng).slice(0, g.settings.cardsPerCategory);
  g.boards[categoryId] = ids.map<Card>((questionId) => ({ questionId, used: false, outcome: null }));
}

// ─── Creation / joining ─────────────────────────────────────────────────────

export interface CreateGameInput {
  code: string;
  name: string;
  themeId: string;
  teams: { name: string; color: string }[];
  categoryIds: string[];
  settings: Partial<Settings>;
  categories: Category[];
  questions: Question[];
  now: number;
}

export function createGame(input: CreateGameInput): Game {
  const cats = input.categories.filter((c) => input.categoryIds.includes(c.id));
  const questions: Record<string, Question> = {};
  for (const q of input.questions) if (q.active && input.categoryIds.includes(q.categoryId)) questions[q.id] = q;
  const categoryIds = cats
    .sort((a, b) => a.sort - b.sort)
    .map((c) => c.id)
    .filter((id) => Object.values(questions).some((q) => q.categoryId === id));
  if (categoryIds.length === 0) throw new GameError("لا توجد أسئلة في الفئات المختارة");
  if (input.teams.length < 2 || input.teams.length > 3) throw new GameError("عدد الفرق يجب أن يكون 2 أو 3");
  return {
    code: input.code,
    name: input.name,
    themeId: input.themeId,
    createdAt: input.now,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    teams: input.teams.map((t, i) => ({ id: `t${i + 1}`, name: t.name, color: t.color, score: 0 })),
    players: [],
    categoryIds,
    turn: { activeTeamIndex: 0, questionsPlayed: 0, currentCategoryId: null, categoryUsesLeft: 0 },
    boards: {},
    usedQuestionIds: [],
    content: { categories: cats, questions },
    phase: { name: "LOBBY" },
    paused: false,
    event: { seq: 0, kind: "join" },
  };
}

export interface JoinInput {
  id: string;
  token: string;
  name: string;
  gender: Player["gender"];
  avatarUrl: string | null;
  teamId: string | null;
  profileId?: string | null;
}

export function addPlayer(prev: Game, input: JoinInput, now: number, rng: Rng = Math.random): Game {
  const g = structuredClone(prev);
  if (g.phase.name === "GAME_OVER") throw new GameError("انتهت هذه اللعبة");
  if (g.players.length >= 40) throw new GameError("الجلسة ممتلئة");
  const name = input.name.trim().slice(0, 24);
  if (!name) throw new GameError("اكتب اسمك");
  const teamId =
    input.teamId && g.teams.some((t) => t.id === input.teamId) ? input.teamId : smallestTeam(g, rng).id;
  g.players.push({
    id: input.id,
    token: input.token,
    name,
    gender: input.gender,
    avatarUrl: input.avatarUrl,
    teamId,
    joinedAt: now,
    lastSeen: now,
    profileId: input.profileId ?? null,
  });
  emit(g, { kind: "join", playerId: input.id, teamId });
  return g;
}

// ─── Turn flow ──────────────────────────────────────────────────────────────

function isOver(g: Game): boolean {
  const s = g.settings;
  if (s.totalQuestions && g.turn.questionsPlayed >= s.totalQuestions) return true;
  if (s.targetScore && g.teams.some((t) => t.score >= s.targetScore!)) return true;
  return false;
}

function gameOver(g: Game) {
  const max = Math.max(...g.teams.map((t) => t.score));
  g.phase = { name: "GAME_OVER", winners: g.teams.filter((t) => t.score === max).map((t) => t.id) };
  emit(g, { kind: "gameover" });
}

function startTurn(g: Game, now: number, rng: Rng) {
  if (isOver(g)) return gameOver(g);
  const available = availableCategories(g);
  if (available.length === 0) return gameOver(g);
  const t = activeTeam(g);
  const cur = g.turn.currentCategoryId;
  if (g.settings.voteEvery > 1 && cur && g.turn.categoryUsesLeft > 0 && available.includes(cur)) {
    return enterCardPick(g, t.id, cur, now, rng);
  }
  if (available.length === 1) return selectCategory(g, t.id, available[0], now, rng);
  g.phase = {
    name: "CATEGORY_VOTE",
    teamId: t.id,
    options: available,
    votes: {},
    tie: false,
    timer: newTimer(VOTE_MS, now, g.paused),
  };
  emit(g, { kind: "turn", teamId: t.id });
}

function selectCategory(g: Game, teamId: string, categoryId: string, now: number, rng: Rng) {
  g.turn.currentCategoryId = categoryId;
  g.turn.categoryUsesLeft = g.settings.voteEvery;
  emit(g, { kind: "category", teamId });
  enterCardPick(g, teamId, categoryId, now, rng);
}

function enterCardPick(g: Game, teamId: string, categoryId: string, now: number, rng: Rng) {
  ensureBoard(g, categoryId, rng);
  g.phase = { name: "CARD_PICK", teamId, categoryId, timer: newTimer(PICK_MS, now, g.paused) };
}

function advanceTurn(g: Game, now: number, rng: Rng, counted: boolean) {
  if (counted) g.turn.questionsPlayed += 1;
  g.turn.activeTeamIndex = (g.turn.activeTeamIndex + 1) % g.teams.length;
  startTurn(g, now, rng);
}

function flipCard(g: Game, index: number, now: number) {
  if (g.phase.name !== "CARD_PICK") throw new GameError("ليس وقت اختيار الكرت");
  const { teamId, categoryId } = g.phase;
  const card = g.boards[categoryId]?.[index];
  if (!card || card.used) throw new GameError("هذا الكرت مستخدم");
  if (categoryId === PERSONAL) avoidOwnTeam(g, card, teamId);
  card.used = true;
  g.usedQuestionIds.push(card.questionId);
  g.turn.categoryUsesLeft = Math.max(0, g.turn.categoryUsesLeft - 1);
  const buzzer = category(g, categoryId).mode === "buzzer";
  g.phase = {
    name: "QUESTION",
    teamId,
    categoryId,
    cardIndex: index,
    questionId: card.questionId,
    // the clock starts after the 3-2-1 prep
    timer: newTimer(g.settings.questionSeconds * 1000, now + PREP_MS, g.paused),
    buzzer: buzzer ? { lockedBy: null, excludedTeamIds: [] } : null,
    attempt: null,
    readyAt: now + PREP_MS,
    votes: {},
    tie: false,
    stuck: false,
  };
  emit(g, { kind: "flip", teamId });
}

/** Prefer not to ask a team about one of its own live players (when another question exists). */
function avoidOwnTeam(g: Game, card: Card, teamId: string) {
  const aboutTeam = (qid: string) => {
    const pid = g.content.questions[qid]?.about?.profileId;
    return !!pid && g.players.some((p) => p.profileId === pid && p.teamId === teamId);
  };
  if (!aboutTeam(card.questionId)) return;
  const board = g.boards[PERSONAL] ?? [];
  const onBoard = new Set(board.map((c) => c.questionId));
  const offBoard = unusedQuestionIds(g, PERSONAL).find((id) => !aboutTeam(id));
  if (offBoard) {
    card.questionId = offBoard;
    return;
  }
  // otherwise swap with another face-down card on the board
  const other = board.find((c) => !c.used && c !== card && onBoard.has(c.questionId) && !aboutTeam(c.questionId));
  if (other) [card.questionId, other.questionId] = [other.questionId, card.questionId];
}

function finish(g: Game, outcome: Outcome, scorer: string | null, points: number, now: number) {
  const p = g.phase;
  if (p.name !== "QUESTION" && p.name !== "STEAL") throw new GameError("لا يوجد سؤال");
  const activeTeamId = p.name === "QUESTION" ? p.teamId : p.fromTeamId;
  const card = g.boards[p.categoryId]?.[p.cardIndex];
  if (card) card.outcome = outcome;
  if (scorer && points > 0) team(g, scorer).score += points;
  const streaks = (g.streaks ??= {});
  if (scorer && points > 0) streaks[scorer] = (streaks[scorer] ?? 0) + 1;
  if (activeTeamId !== scorer) streaks[activeTeamId] = 0;
  g.phase = {
    name: "RESULT",
    outcome,
    teamId: scorer,
    points: scorer ? points : 0,
    activeTeamId,
    categoryId: p.categoryId,
    questionId: p.questionId,
    timer: newTimer(RESULT_MS, now, g.paused),
  };
  emit(g, {
    kind: outcome === "steal" ? "steal" : outcome === "correct" ? "correct" : outcome === "skipped" ? "skip" : "wrong",
    teamId: scorer ?? activeTeamId,
    points: scorer ? points : 0,
  });
}

function questionPoints(g: Game, q: Question) {
  return q.points > 0 ? q.points : g.settings.correctPoints;
}

function markCorrect(g: Game, now: number) {
  const p = g.phase;
  if (p.name === "QUESTION") {
    const q = questionOf(g, p.questionId);
    if (p.buzzer) {
      const scorer = p.buzzer.lockedBy?.teamId ?? p.teamId;
      const reopened = p.buzzer.excludedTeamIds.length > 0;
      return finish(g, reopened ? "steal" : "correct", scorer, reopened ? g.settings.stealPoints : questionPoints(g, q), now);
    }
    return finish(g, "correct", p.teamId, questionPoints(g, q), now);
  }
  if (p.name === "STEAL") return finish(g, "steal", p.teamId, g.settings.stealPoints, now);
  throw new GameError("لا يوجد سؤال");
}

function markWrong(g: Game, now: number) {
  const p = g.phase;
  if (p.name === "QUESTION" && p.buzzer) {
    const locked = p.buzzer.lockedBy;
    if (!locked) return finish(g, "wrong", null, 0, now);
    const excluded = [...p.buzzer.excludedTeamIds, locked.teamId];
    const eligible = g.teams.filter((t) => !excluded.includes(t.id));
    if (eligible.length === 0) return finish(g, "wrong", null, 0, now);
    p.buzzer = { lockedBy: null, excludedTeamIds: excluded };
    p.readyAt = now + REOPEN_PREP_MS;
    p.timer = newTimer(g.settings.stealSeconds * 1000, now + REOPEN_PREP_MS, g.paused);
    emit(g, { kind: "wrong", teamId: locked.teamId });
    return;
  }
  if (p.name === "QUESTION" || p.name === "STEAL") return finish(g, "wrong", null, 0, now);
  throw new GameError("لا يوجد سؤال");
}

function startSteal(g: Game, now: number, teamId?: string) {
  const p = g.phase;
  if (p.name !== "QUESTION") throw new GameError("السرقة متاحة أثناء السؤال فقط");
  if (p.buzzer) return markWrong(g, now);
  const eligible = g.teams.filter((t) => t.id !== p.teamId);
  const target = eligible.length === 1 ? eligible[0] : eligible.find((t) => t.id === teamId);
  if (!target) throw new GameError("اختر الفريق الذي سيسرق");
  g.phase = {
    name: "STEAL",
    fromTeamId: p.teamId,
    teamId: target.id,
    categoryId: p.categoryId,
    cardIndex: p.cardIndex,
    questionId: p.questionId,
    timer: newTimer(g.settings.stealSeconds * 1000, now + STEAL_PREP_MS, g.paused),
    attempt: null,
    excludedOption: p.attempt ? p.attempt.option : null,
    readyAt: now + STEAL_PREP_MS,
    votes: {},
    tie: false,
    stuck: false,
  };
  emit(g, { kind: "steal", teamId: target.id, points: 0 });
}

// ─── Team consensus answering ───────────────────────────────────────────────

type AnswerPhase = Extract<Phase, { name: "QUESTION" | "STEAL" }>;

function answerPhase(g: Game): AnswerPhase {
  const p = g.phase;
  if ((p.name !== "QUESTION" && p.name !== "STEAL") || (p.name === "QUESTION" && p.buzzer))
    throw new GameError("لا يوجد تصويت على إجابة الآن");
  return p;
}

/** Lock the team's answer (once) and judge it like before. */
function lockAnswer(g: Game, option: number, playerId: string, now: number) {
  const p = answerPhase(g);
  if (p.attempt) throw new GameError("تم اعتماد إجابة الفريق");
  const q = questionOf(g, p.questionId);
  const correct = option === q.correctOption;
  p.attempt = { playerId, option, correct };
  p.timer = stopTimer(p.timer, now);
  p.tie = false;
  p.stuck = false;
  if (correct) {
    finish(g, p.name === "STEAL" ? "steal" : "correct", p.teamId, p.name === "STEAL" ? g.settings.stealPoints : questionPoints(g, q), now);
  } else if (p.name === "STEAL") {
    finish(g, "wrong", null, 0, now);
  } else {
    emit(g, { kind: "wrong", teamId: p.teamId, playerId });
  }
}

export function voteCounts(p: { votes?: Record<string, number> }): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const o of Object.values(p.votes ?? {})) counts[o] = (counts[o] ?? 0) + 1;
  return counts;
}

/** Connected active-team players (voters always count as connected). */
export function votingPool(g: Game, teamId: string, votes: Record<string, number> | undefined, now: number): number {
  const members = teamMembers(g, teamId);
  const n = members.filter((m) => isOnline(m, now) || (votes && m.id in votes)).length;
  return Math.max(1, n);
}

/** Majority = more than half of connected active-team players. */
export function majorityNeeded(pool: number) {
  return Math.floor(pool / 2) + 1;
}

function checkMajority(g: Game, now: number, lastVoter: string) {
  const p = answerPhase(g);
  const need = majorityNeeded(votingPool(g, p.teamId, p.votes, now));
  for (const [opt, n] of Object.entries(voteCounts(p))) {
    if (n >= need) return lockAnswer(g, Number(opt), lastVoter, now);
  }
}

/** Timer ran out without a majority: plurality wins, a tie gets 3 more seconds, then waits for the host. */
function resolveTeamVote(g: Game, now: number) {
  const p = answerPhase(g);
  const counts = voteCounts(p);
  const max = Math.max(0, ...Object.values(counts));
  if (max === 0) return false; // nobody voted: host decides
  const leaders = Object.keys(counts).filter((o) => counts[Number(o)] === max);
  if (leaders.length === 1) {
    const voter = Object.keys(p.votes ?? {}).find((id) => p.votes![id] === Number(leaders[0])) ?? "";
    lockAnswer(g, Number(leaders[0]), voter, now);
    return true;
  }
  if (!p.tie) {
    p.tie = true;
    p.timer = newTimer(TIEBREAK_MS, now, g.paused);
    emit(g, { kind: "tie", teamId: p.teamId });
  } else {
    p.stuck = true;
    p.timer = stopTimer(p.timer, now);
  }
  return true;
}

// ─── Undo ───────────────────────────────────────────────────────────────────

function snapshot(prev: Game, now: number): UndoSnapshot {
  return structuredClone({
    at: now,
    teams: prev.teams,
    turn: prev.turn,
    boards: prev.boards,
    usedQuestionIds: prev.usedQuestionIds,
    phase: prev.phase,
    paused: prev.paused,
    streaks: prev.streaks ?? {},
  });
}

function restore(g: Game, snap: UndoSnapshot, now: number) {
  const delta = now - snap.at;
  const phase = structuredClone(snap.phase) as Phase & { timer?: Timer; readyAt?: number };
  // shift running clocks so the restored step gets the time it had left
  if (phase.timer && phase.timer.endsAt !== null) phase.timer.endsAt += delta;
  if (typeof phase.readyAt === "number") phase.readyAt += delta;
  g.teams = snap.teams;
  g.turn = snap.turn;
  g.boards = snap.boards;
  g.usedQuestionIds = snap.usedQuestionIds;
  g.phase = phase;
  g.paused = snap.paused;
  g.streaks = snap.streaks;
  g.undo = null;
  emit(g, { kind: "undo" });
}

const UNDOABLE = new Set<HostAction["type"]>([
  "correct",
  "wrong",
  "steal",
  "skip",
  "next",
  "cancel_question",
  "adjust_score",
  "end_game",
  "team_answer",
  "override_category",
  "pick_card",
]);

function resolveVote(g: Game, now: number, rng: Rng, force: boolean) {
  const p = g.phase;
  if (p.name !== "CATEGORY_VOTE") return;
  const counts: Record<string, number> = {};
  for (const c of Object.values(p.votes)) if (p.options.includes(c)) counts[c] = (counts[c] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const leaders = max === 0 ? p.options : p.options.filter((o) => counts[o] === max);
  if (leaders.length === 1) return selectCategory(g, p.teamId, leaders[0], now, rng);
  if (!force) return;
  // Deadline hit: first time with a tie → ask to change votes; otherwise pick randomly.
  if (!p.tie && max > 0) {
    p.tie = true;
    p.timer = newTimer(TIE_MS, now, g.paused);
    emit(g, { kind: "tie", teamId: p.teamId });
    return;
  }
  selectCategory(g, p.teamId, leaders[Math.floor(rng() * leaders.length)], now, rng);
}

function allVoted(g: Game): boolean {
  const p = g.phase;
  if (p.name !== "CATEGORY_VOTE") return false;
  const members = teamMembers(g, p.teamId);
  return members.length > 0 && members.every((m) => p.votes[m.id]);
}

function pauseAll(g: Game, now: number) {
  if (g.paused) return;
  g.paused = true;
  const p = g.phase as Phase & { timer?: Timer };
  if (p.timer && !p.timer.stopped && p.timer.endsAt !== null) {
    p.timer = { ...p.timer, endsAt: null, remainingMs: timerLeft(p.timer, now) };
  }
  emit(g, { kind: "pause" });
}

function resumeAll(g: Game, now: number) {
  if (!g.paused) return;
  g.paused = false;
  const p = g.phase as Phase & { timer?: Timer };
  if (p.timer && !p.timer.stopped && p.timer.endsAt === null) {
    p.timer = { ...p.timer, endsAt: now + (p.timer.remainingMs ?? 0), remainingMs: null };
  }
  emit(g, { kind: "resume" });
}

function balanceTeams(g: Game) {
  for (let guard = 0; guard < 100; guard++) {
    const sizes = g.teams.map((t) => ({ t, n: teamMembers(g, t.id).length }));
    sizes.sort((a, b) => b.n - a.n);
    const big = sizes[0];
    const small = sizes[sizes.length - 1];
    if (big.n - small.n <= 1) break;
    const mover = teamMembers(g, big.t.id).sort((a, b) => b.joinedAt - a.joinedAt)[0];
    mover.teamId = small.t.id;
  }
}

// ─── Public reducers ────────────────────────────────────────────────────────

export function applyHost(prev: Game, action: HostAction, now: number, rng: Rng = Math.random): Game {
  const g = structuredClone(prev);
  const p = g.phase;
  switch (action.type) {
    case "start": {
      if (p.name !== "LOBBY") throw new GameError("اللعبة بدأت");
      for (const pl of g.players) if (!pl.teamId) pl.teamId = smallestTeam(g, rng).id;
      g.turn = { activeTeamIndex: 0, questionsPlayed: 0, currentCategoryId: null, categoryUsesLeft: 0 };
      g.draft = false; // a started session is never a draft
      emit(g, { kind: "start" });
      startTurn(g, now, rng);
      break;
    }
    case "move_player": {
      const pl = g.players.find((x) => x.id === action.playerId);
      if (!pl) throw new GameError("اللاعب غير موجود");
      pl.teamId = team(g, action.teamId).id;
      if (p.name === "CATEGORY_VOTE") delete p.votes[pl.id];
      break;
    }
    case "remove_player": {
      g.players = g.players.filter((x) => x.id !== action.playerId);
      if (p.name === "CATEGORY_VOTE") delete p.votes[action.playerId];
      break;
    }
    case "balance":
      balanceTeams(g);
      break;
    case "override_category": {
      if (p.name !== "CATEGORY_VOTE" && p.name !== "CARD_PICK") throw new GameError("ليس وقت اختيار الفئة");
      if (!g.categoryIds.includes(action.categoryId) || remainingInCategory(g, action.categoryId) === 0)
        throw new GameError("لا توجد أسئلة متبقية في هذه الفئة");
      selectCategory(g, p.teamId, action.categoryId, now, rng);
      break;
    }
    case "pick_card":
      flipCard(g, action.index, now);
      break;
    case "correct":
      markCorrect(g, now);
      break;
    case "wrong":
      markWrong(g, now);
      break;
    case "steal":
      startSteal(g, now, action.teamId);
      break;
    case "cancel_question": {
      if (p.name !== "QUESTION" && p.name !== "STEAL") throw new GameError("لا يوجد سؤال");
      const teamId = p.name === "QUESTION" ? p.teamId : p.fromTeamId;
      const card = g.boards[p.categoryId]?.[p.cardIndex];
      if (card) card.outcome = "skipped";
      g.turn.categoryUsesLeft += 1;
      if (remainingInCategory(g, p.categoryId) > 0) enterCardPick(g, teamId, p.categoryId, now, rng);
      else startTurn(g, now, rng);
      emit(g, { kind: "skip", teamId });
      break;
    }
    case "skip": {
      if (p.name === "QUESTION" || p.name === "STEAL") finish(g, "skipped", null, 0, now);
      else if (p.name === "CATEGORY_VOTE" || p.name === "CARD_PICK") advanceTurn(g, now, rng, false);
      else throw new GameError("لا يمكن التخطي الآن");
      break;
    }
    case "next": {
      if (p.name === "RESULT") advanceTurn(g, now, rng, true);
      else if (p.name === "QUESTION" || p.name === "STEAL") finish(g, "skipped", null, 0, now);
      else if (p.name === "CATEGORY_VOTE" || p.name === "CARD_PICK") advanceTurn(g, now, rng, false);
      else throw new GameError("لا يمكن الانتقال الآن");
      break;
    }
    case "pause":
      pauseAll(g, now);
      break;
    case "resume":
      resumeAll(g, now);
      break;
    case "adjust_score": {
      const t = team(g, action.teamId);
      t.score = Math.max(0, t.score + Math.round(action.delta));
      emit(g, { kind: "score", teamId: t.id, points: action.delta });
      break;
    }
    case "end_game":
      if (p.name === "GAME_OVER") break;
      gameOver(g);
      break;
    case "replay":
      resetRun(g, now);
      break;
    case "toggle_sound":
      g.settings.soundOn = !g.settings.soundOn;
      break;
    case "sfx":
      // Soundboard only: emits an event for the TV, no game-state change.
      if (!["laugh", "whistle", "crackers", "drums", "ooh", "applause"].includes(action.name))
        throw new GameError("مؤثر غير معروف");
      emit(g, { kind: "sfx", sfx: action.name });
      break;
    case "undo": {
      if (!prev.undo) throw new GameError("لا توجد حركة للتراجع عنها");
      restore(g, prev.undo, now);
      return g;
    }
    case "add_time": {
      const t = (p as Phase & { timer?: Timer }).timer;
      if (!t || p.name === "RESULT") throw new GameError("لا يوجد وقت لإضافته");
      const ms = Math.max(1, Math.min(60, Math.round(action.seconds))) * 1000;
      const ph = p as Phase & { timer: Timer; stuck?: boolean };
      if (t.stopped) {
        if (!ph.stuck) throw new GameError("تم اعتماد الإجابة");
        ph.stuck = false;
        ph.timer = newTimer(ms, now, g.paused);
      } else if (t.endsAt !== null) {
        ph.timer = { ...t, endsAt: Math.max(t.endsAt, now) + ms, durationMs: Math.max(t.durationMs, Math.max(t.endsAt, now) + ms - now) };
      } else {
        ph.timer = { ...t, remainingMs: (t.remainingMs ?? 0) + ms, durationMs: t.durationMs + ms };
      }
      break;
    }
    case "refresh_personal":
      // content is injected by the API before this runs; nothing else changes
      break;
    case "toggle_personal":
      g.settings.personalEnabled = g.settings.personalEnabled === false;
      break;
    case "tiebreak": {
      const ap = answerPhase(g);
      if (ap.attempt) throw new GameError("تم اعتماد إجابة الفريق");
      ap.tie = true;
      ap.stuck = false;
      ap.timer = newTimer(TIEBREAK_MS, now, g.paused);
      emit(g, { kind: "tie", teamId: ap.teamId });
      break;
    }
    case "team_answer": {
      const q = questionOf(g, answerPhase(g).questionId);
      const opts = optionsOf(q);
      if (!opts || action.option < 0 || action.option >= opts.length) throw new GameError("خيار غير صالح");
      lockAnswer(g, action.option, "", now);
      break;
    }
    default:
      throw new GameError("أمر غير معروف");
  }
  if (UNDOABLE.has(action.type)) g.undo = snapshot(prev, now);
  return g;
}

export function applyPlayer(prev: Game, playerId: string, action: PlayerAction, now: number, rng: Rng = Math.random): Game {
  const g = structuredClone(prev);
  const me = g.players.find((x) => x.id === playerId);
  if (!me) throw new GameError("لست ضمن هذه الجلسة", 403);
  me.lastSeen = now;
  const p = g.phase;
  switch (action.type) {
    case "ping":
      break;
    case "choose_team": {
      if (p.name !== "LOBBY") throw new GameError("لا يمكن تغيير الفريق بعد بدء اللعبة");
      me.teamId = action.teamId ? team(g, action.teamId).id : smallestTeam(g, rng).id;
      break;
    }
    case "vote_category": {
      if (p.name !== "CATEGORY_VOTE") throw new GameError("التصويت مغلق");
      if (me.teamId !== p.teamId) throw new GameError("ليس دور فريقك");
      if (!p.options.includes(action.categoryId)) throw new GameError("فئة غير متاحة");
      p.votes[me.id] = action.categoryId;
      if (allVoted(g)) resolveVote(g, now, rng, false);
      break;
    }
    case "pick_card": {
      if (p.name !== "CARD_PICK") throw new GameError("ليس وقت اختيار الكرت");
      if (me.teamId !== p.teamId) throw new GameError("ليس دور فريقك");
      flipCard(g, action.index, now);
      break;
    }
    case "answer": {
      // A tap is this player's VOTE; the team answer locks on a majority.
      if (p.name !== "QUESTION" && p.name !== "STEAL") throw new GameError("لا يوجد سؤال");
      if (p.name === "QUESTION" && p.buzzer) throw new GameError("اضغط الزر أولاً");
      if (me.teamId !== p.teamId) throw new GameError("ليس دور فريقك");
      if (p.attempt) throw new GameError("تم اعتماد إجابة الفريق");
      if (g.paused) throw new GameError("اللعبة متوقفة");
      if (p.readyAt && now < p.readyAt) throw new GameError("استعدوا… انتظر «جاوب الآن»");
      if (p.stuck) throw new GameError("المضيف يحسم التعادل");
      const q = questionOf(g, p.questionId);
      const opts = optionsOf(q);
      if (!opts || action.option < 0 || action.option >= opts.length) throw new GameError("خيار غير صالح");
      if (p.name === "STEAL" && p.excludedOption === action.option) throw new GameError("هذا الخيار مستبعد");
      (p.votes ??= {})[me.id] = action.option;
      checkMajority(g, now, me.id);
      const cur = g.phase as Phase & { attempt?: unknown };
      if (g.phase.name !== p.name || cur.attempt) g.undo = snapshot(prev, now);
      break;
    }
    case "buzz": {
      if (p.name !== "QUESTION" || !p.buzzer) throw new GameError("الزر غير متاح");
      if (g.paused) throw new GameError("اللعبة متوقفة");
      if (p.buzzer.lockedBy) throw new GameError("سبقك أحد!");
      if (p.readyAt && now < p.readyAt) throw new GameError("انتظر «انطلق!»");
      if (!me.teamId || p.buzzer.excludedTeamIds.includes(me.teamId)) throw new GameError("فريقك خارج هذه المحاولة");
      p.buzzer.lockedBy = { playerId: me.id, teamId: me.teamId, at: now };
      p.timer = stopTimer(p.timer, now);
      emit(g, { kind: "buzz", teamId: me.teamId, playerId: me.id });
      break;
    }
    case "leave": {
      g.players = g.players.filter((x) => x.id !== me.id);
      if (p.name === "CATEGORY_VOTE") delete p.votes[me.id];
      break;
    }
    default:
      throw new GameError("أمر غير معروف");
  }
  return g;
}

/** Time-based transitions. Returns null when nothing is due. */
export function applyTick(prev: Game, now: number, rng: Rng = Math.random): Game | null {
  const p = prev.phase;
  if (prev.paused) return null;
  if (p.name === "CATEGORY_VOTE" && expired(p.timer, now)) {
    const g = structuredClone(prev);
    resolveVote(g, now, rng, true);
    return g;
  }
  if (p.name === "CARD_PICK" && expired(p.timer, now)) {
    const g = structuredClone(prev);
    const board = g.boards[p.categoryId] ?? [];
    const free = board.map((c, i) => (c.used ? -1 : i)).filter((i) => i >= 0);
    if (free.length === 0) startTurn(g, now, rng);
    else flipCard(g, free[Math.floor(rng() * free.length)], now);
    return g;
  }
  if (
    (p.name === "QUESTION" || p.name === "STEAL") &&
    !(p.name === "QUESTION" && p.buzzer) &&
    !p.attempt &&
    !p.stuck &&
    expired(p.timer, now) &&
    optionsOf(questionOf(prev, p.questionId))
  ) {
    const g = structuredClone(prev);
    if (!resolveTeamVote(g, now)) return null;
    const cur = g.phase as Phase & { attempt?: unknown };
    if (g.phase.name !== p.name || cur.attempt) g.undo = snapshot(prev, now);
    return g;
  }
  if (p.name === "RESULT" && expired(p.timer, now)) {
    const g = structuredClone(prev);
    advanceTurn(g, now, rng, true);
    return g;
  }
  return null;
}

// ─── «وش تعرف عنه؟ 👀» injection ────────────────────────────────────────────

/**
 * Replace the session's personalized questions (called by the API at game start /
 * host refresh). Questions already on the board or in play keep their object, used
 * ones stay used, and players are linked to profiles by exact normalized name.
 */
export function withPersonal(
  prev: Game,
  category: Category,
  questions: Question[],
  links: Record<string, string | null>,
  enabled: boolean,
): Game {
  const g = structuredClone(prev);
  for (const p of g.players) if (p.id in links) p.profileId = links[p.id];
  const keep = new Set<string>([...(g.boards[PERSONAL] ?? []).map((c) => c.questionId)]);
  const ph = g.phase as Phase & { questionId?: string };
  if (ph.questionId) keep.add(ph.questionId);
  for (const [id, q] of Object.entries(g.content.questions)) {
    if (q.categoryId === PERSONAL && !keep.has(id)) delete g.content.questions[id];
  }
  const active = enabled && questions.length > 0;
  if (active) for (const q of questions) if (!g.content.questions[q.id]) g.content.questions[q.id] = q;
  g.content.categories = g.content.categories.filter((c) => c.id !== PERSONAL);
  const hasAny = Object.values(g.content.questions).some((q) => q.categoryId === PERSONAL);
  if (active || hasAny) g.content.categories.push(category);
  g.categoryIds = g.categoryIds.filter((id) => id !== PERSONAL);
  if (active) g.categoryIds.push(PERSONAL);
  return g;
}

// ─── Session vs. game run ────────────────────────────────────────────────────

/** Start a fresh run in the same session: scores, turn, board, used questions reset. */
export function resetRun(g: Game, now: number) {
  const p = g.phase;
  const played = g.turn.questionsPlayed > 0 || (p.name !== "LOBBY" && p.name !== "GAME_OVER");
  if (played || p.name === "GAME_OVER") {
    g.history = [
      ...(g.history ?? []),
      {
        run: g.run ?? 1,
        endedAt: now,
        finished: p.name === "GAME_OVER",
        questionsPlayed: g.turn.questionsPlayed,
        teams: g.teams.map((t) => ({ name: t.name, score: t.score })),
        winners: p.name === "GAME_OVER" ? p.winners.map((id) => g.teams.find((t) => t.id === id)?.name ?? id) : [],
      },
    ].slice(-20);
    g.run = (g.run ?? 1) + 1;
  }
  for (const t of g.teams) t.score = 0;
  g.turn = { activeTeamIndex: 0, questionsPlayed: 0, currentCategoryId: null, categoryUsesLeft: 0 };
  g.boards = {};
  g.usedQuestionIds = [];
  g.paused = false;
  g.streaks = {};
  g.undo = null;
  g.phase = { name: "LOBBY" };
  emit(g, { kind: "join" });
}

export interface ReconfigureInput {
  name: string;
  teamNames: [string, string];
  categoryIds: string[];
  totalQuestions: number;
  personalEnabled: boolean;
  categories: Category[];
  questions: Question[];
  /** start a new run (otherwise only allowed before the game starts) */
  reset: boolean;
  now: number;
}

/** Apply setup-screen settings to an existing session (draft → ready, or replay). */
export function reconfigure(prev: Game, input: ReconfigureInput): Game {
  const g = structuredClone(prev);
  const inProgress = g.phase.name !== "LOBBY" && g.phase.name !== "GAME_OVER";
  if (inProgress && !input.reset) throw new GameError("اللعبة شغالة — استكملها أو ابدأ من جديد");
  const fresh = createGame({
    code: g.code,
    name: input.name,
    themeId: g.themeId,
    teams: input.teamNames.map((n, i) => ({ name: n, color: g.teams[i]?.color ?? DEFAULT_TEAM_COLORS[i] })),
    categoryIds: input.categoryIds,
    settings: {},
    categories: input.categories,
    questions: input.questions,
    now: input.now,
  });
  g.name = fresh.name;
  g.teams = g.teams.slice(0, 2).map((t, i) => ({ ...t, name: fresh.teams[i].name }));
  for (const p of g.players) if (!g.teams.some((t) => t.id === p.teamId)) p.teamId = g.teams[0].id;
  g.content = fresh.content;
  g.categoryIds = fresh.categoryIds;
  g.settings = {
    ...g.settings,
    totalQuestions: input.totalQuestions,
    targetScore: null,
    voteEvery: 1,
    personalEnabled: input.personalEnabled,
  };
  g.draft = false;
  if (input.reset || g.phase.name === "GAME_OVER") resetRun(g, input.now);
  return g;
}

export const DEFAULT_TEAM_COLORS = ["#22A06B", "#D6A63A"];
