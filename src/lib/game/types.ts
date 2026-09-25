// Core data model shared by server and client.

export type QuestionType =
  | "TEXT"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "IMAGE"
  | "COMPLETE_PHRASE";

export const QUESTION_TYPES: { id: QuestionType; label: string }[] = [
  { id: "TEXT", label: "سؤال نصي" },
  { id: "MULTIPLE_CHOICE", label: "اختيار من متعدد" },
  { id: "TRUE_FALSE", label: "صح أو خطأ" },
  { id: "IMAGE", label: "سؤال بصورة" },
  { id: "COMPLETE_PHRASE", label: "أكمل العبارة" },
];

/** normal = active team answers; buzzer = fastest finger across all teams */
export type CategoryMode = "normal" | "buzzer";

/** V1.7: question difficulty (selection only — scoring is unchanged) */
export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

export type PatternId = "star" | "lattice" | "arches" | "chevron" | "dots" | "waves";

export interface Theme {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  themeId: string;
  name: string;
  description: string | null;
  color: string;
  pattern: PatternId;
  mode: CategoryMode;
  sort: number;
  active: boolean;
}

export interface Question {
  id: string;
  themeId: string;
  categoryId: string;
  question: string;
  answer: string;
  type: QuestionType;
  points: number;
  imageUrl: string | null;
  options: string[] | null;
  correctOption: number | null;
  active: boolean;
  /** personalized «وش تعرف عنه؟» question: who it is about */
  about?: { profileId: string; name: string } | null;
  /** V1.7 — null/undefined is treated as medium */
  difficulty?: Difficulty | null;
}

export type Gender = "male" | "female" | null;

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  avatarUrl: string | null;
  teamId: string | null;
  joinedAt: number;
  /** last heartbeat from the player's phone (presence for team voting) */
  lastSeen?: number;
  /** linked «وش تعرف عنه؟» profile (same normalized name) */
  profileId?: string | null;
  /** private — never sent to clients */
  token: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

/** A countdown. Paused when endsAt is null (remainingMs holds what is left). */
export interface Timer {
  durationMs: number;
  endsAt: number | null;
  remainingMs: number | null;
  /** stopped for good (answer locked) — pause/resume leaves it alone */
  stopped?: boolean;
  /** V1.7: waiting for the host («ابدأ الوقت») — not running, pause/resume leaves it alone */
  held?: boolean;
}

export interface Settings {
  totalQuestions: number | null;
  targetScore: number | null;
  /** 1 = vote every turn, 3 = vote every 3 turns */
  voteEvery: number;
  questionSeconds: number;
  stealSeconds: number;
  correctPoints: number;
  stealPoints: number;
  cardsPerCategory: number;
  soundOn: boolean;
  /** «وش تعرف عنه؟ 👀» category enabled (used when enough answers exist) */
  personalEnabled?: boolean;
}

export interface Card {
  questionId: string;
  used: boolean;
  outcome: Outcome | null;
}

export type Outcome = "correct" | "steal" | "wrong" | "skipped";

export interface Attempt {
  playerId: string;
  option: number;
  correct: boolean;
}

export interface Buzzer {
  lockedBy: { playerId: string; teamId: string; at: number } | null;
  excludedTeamIds: string[];
}

export type Phase =
  | { name: "LOBBY" }
  /** V1.7: opening screen after «ابدأ اللعبة» — waits for the host («ابدأ الجولة») */
  | { name: "INTRO" }
  | {
      name: "CATEGORY_VOTE";
      teamId: string;
      options: string[];
      votes: Record<string, string>;
      tie: boolean;
      timer: Timer;
      /** every team member voted — waiting for the host («اعرض النتيجة») */
      complete?: boolean;
    }
  | {
      name: "CARD_PICK";
      teamId: string;
      categoryId: string;
      timer: Timer;
      /** «تم اختيار …» 3-2-1: card taps rejected before this */
      readyAt?: number;
    }
  | {
      name: "QUESTION";
      teamId: string;
      categoryId: string;
      cardIndex: number;
      questionId: string;
      timer: Timer;
      buzzer: Buzzer | null;
      attempt: Attempt | null;
      /** answers/buzzes are rejected before this time (3-2-1 prep) */
      readyAt?: number;
      /** team consensus votes: playerId → option (private) */
      votes?: Record<string, number>;
      /** tie-break round running */
      tie?: boolean;
      /** tie persisted after the tie-break: waiting for the host */
      stuck?: boolean;
      /** V1.7: question shown, waiting for the host to start the time */
      hold?: boolean;
    }
  | {
      name: "STEAL";
      fromTeamId: string;
      teamId: string;
      categoryId: string;
      cardIndex: number;
      questionId: string;
      timer: Timer;
      attempt: Attempt | null;
      excludedOption: number | null;
      readyAt?: number;
      votes?: Record<string, number>;
      tie?: boolean;
      stuck?: boolean;
    }
  | {
      name: "RESULT";
      outcome: Outcome;
      /** team that scored (null when nobody did) */
      teamId: string | null;
      points: number;
      activeTeamId: string;
      categoryId: string;
      questionId: string;
      /** long safety fallback only — the host advances with «التالي» */
      timer: Timer;
      /** «التالي» is rejected before this (the reaction must be seen) */
      lockUntil?: number;
    }
  | { name: "GAME_OVER"; winners: string[] };

export type PhaseName = Phase["name"];

export interface GameEvent {
  seq: number;
  kind:
    | "join"
    | "start"
    | "tie"
    | "category"
    | "flip"
    | "correct"
    | "wrong"
    | "steal"
    | "buzz"
    | "skip"
    | "turn"
    | "score"
    | "gameover"
    | "pause"
    | "resume"
    | "sfx"
    | "undo"
    | "intro"
    | "go"
    | "voted";
  teamId?: string | null;
  playerId?: string | null;
  points?: number;
  /** host soundboard effect (kind "sfx") */
  sfx?: SoundboardSfx;
}

export type SoundboardSfx = "laugh" | "whistle" | "crackers" | "drums" | "ooh" | "applause";
export const SOUNDBOARD: SoundboardSfx[] = ["laugh", "whistle", "crackers", "drums", "ooh", "applause"];

/** One-level undo: the parts of the game a host action can change. */
export interface UndoSnapshot {
  at: number;
  teams: Team[];
  turn: Game["turn"];
  boards: Record<string, Card[]>;
  usedQuestionIds: string[];
  phase: Phase;
  paused: boolean;
  streaks: Record<string, number>;
}

export interface Game {
  code: string;
  name: string;
  themeId: string;
  createdAt: number;
  settings: Settings;
  teams: Team[];
  players: Player[];
  categoryIds: string[];
  turn: {
    activeTeamIndex: number;
    questionsPlayed: number;
    currentCategoryId: string | null;
    categoryUsesLeft: number;
  };
  boards: Record<string, Card[]>;
  usedQuestionIds: string[];
  /** Snapshot of the content used by this session (private: contains answers). */
  content: { categories: Category[]; questions: Record<string, Question> };
  phase: Phase;
  paused: boolean;
  event: GameEvent;
  /** consecutive correct answers per team */
  streaks?: Record<string, number>;
  /** one-level undo (private) */
  undo?: UndoSnapshot | null;
  /** session created early (e.g. to share «وش تعرف عنه؟») and not configured yet */
  draft?: boolean;
  /** current game run number within this session (1-based) */
  run?: number;
  /** finished/abandoned runs of this session */
  history?: RunSummary[];
}

export interface RunSummary {
  run: number;
  endedAt: number;
  finished: boolean;
  questionsPlayed: number;
  teams: { name: string; score: number }[];
  winners: string[];
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type HostAction =
  | { type: "start" }
  | { type: "move_player"; playerId: string; teamId: string }
  | { type: "remove_player"; playerId: string }
  | { type: "balance" }
  | { type: "override_category"; categoryId: string }
  | { type: "pick_card"; index: number }
  | { type: "correct" }
  | { type: "wrong" }
  | { type: "steal"; teamId?: string }
  | { type: "cancel_question" }
  | { type: "skip" }
  | { type: "next" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "adjust_score"; teamId: string; delta: number }
  | { type: "end_game" }
  | { type: "replay" }
  | { type: "toggle_sound" }
  | { type: "sfx"; name: SoundboardSfx }
  | { type: "undo" }
  | { type: "add_time"; seconds: number }
  | { type: "tiebreak" }
  | { type: "team_answer"; option: number }
  | { type: "toggle_personal" }
  | { type: "refresh_personal" }
  /** V1.7 host pacing */
  | { type: "begin_round" }
  | { type: "close_vote" }
  | { type: "reveal_card" }
  | { type: "start_timer" };

export type PlayerAction =
  | { type: "choose_team"; teamId: string | null }
  | { type: "vote_category"; categoryId: string }
  | { type: "pick_card"; index: number }
  | { type: "answer"; option: number }
  | { type: "buzz" }
  | { type: "leave" }
  | { type: "ping" };

export type SystemAction = { type: "tick" };

// ─── Views sent to clients ──────────────────────────────────────────────────

export interface PublicPlayer {
  id: string;
  name: string;
  gender: Gender;
  avatarUrl: string | null;
  teamId: string | null;
  online: boolean;
}

/** Team voting progress — never reveals which option anyone chose. */
export interface PublicTeamVote {
  voters: string[];
  total: number;
  tie: boolean;
  stuck: boolean;
}

export interface PublicCategory {
  id: string;
  name: string;
  color: string;
  pattern: PatternId;
  mode: CategoryMode;
}

export interface PublicCard {
  used: boolean;
  outcome: Outcome | null;
}

export interface PublicQuestion {
  id: string;
  categoryId: string;
  question: string;
  type: QuestionType;
  points: number;
  imageUrl: string | null;
  options: string[] | null;
  /** personalized question: who it is about (+ linked live player for the photo) */
  about?: { name: string; playerId: string | null } | null;
}

export type PublicPhase =
  | { name: "LOBBY" }
  | { name: "INTRO" }
  | {
      name: "CATEGORY_VOTE";
      teamId: string;
      options: string[];
      counts: Record<string, number>;
      voters: string[];
      tie: boolean;
      timer: Timer;
      complete: boolean;
    }
  | { name: "CARD_PICK"; teamId: string; categoryId: string; timer: Timer; readyAt: number }
  | {
      name: "QUESTION";
      teamId: string;
      categoryId: string;
      cardIndex: number;
      question: PublicQuestion;
      timer: Timer;
      buzzer: Buzzer | null;
      attempt: { playerId: string; option: number; correct: boolean } | null;
      readyAt: number;
      teamVote: PublicTeamVote | null;
      hold: boolean;
    }
  | {
      name: "STEAL";
      fromTeamId: string;
      teamId: string;
      categoryId: string;
      cardIndex: number;
      question: PublicQuestion;
      timer: Timer;
      attempt: { playerId: string; option: number; correct: boolean } | null;
      excludedOption: number | null;
      readyAt: number;
      teamVote: PublicTeamVote | null;
    }
  | {
      name: "RESULT";
      outcome: Outcome;
      teamId: string | null;
      points: number;
      activeTeamId: string;
      categoryId: string;
      question: PublicQuestion;
      answer: string;
      correctOption: number | null;
      timer: Timer;
      lockUntil: number;
    }
  | { name: "GAME_OVER"; winners: string[] };

export interface PublicGame {
  code: string;
  name: string;
  themeId: string;
  settings: Settings;
  teams: Team[];
  players: PublicPlayer[];
  categories: PublicCategory[];
  turn: Game["turn"];
  boards: Record<string, PublicCard[]>;
  phase: PublicPhase;
  paused: boolean;
  event: GameEvent;
  streaks: Record<string, number>;
  draft: boolean;
  run: number;
  history: RunSummary[];
  version: number;
  serverNow: number;
  /** how this client should listen for changes */
  rt?: "supabase" | "sse";
}

export interface HostView extends PublicGame {
  host: {
    answer: string | null;
    correctOption: number | null;
    /** remaining unused questions per category */
    remaining: Record<string, number>;
    canUndo: boolean;
    /** control PIN shown on the host's link card */
    pin: string;
    /** host-only: team vote distribution (option → votes) */
    voteCounts: Record<number, number> | null;
    /** host-only: current question difficulty (subtle badge) */
    difficulty: Difficulty | null;
  };
}
