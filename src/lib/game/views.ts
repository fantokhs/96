// Project the private game state into what each role may see.
import { isOnline, optionsOf, questionOf, remainingInCategory, voteCounts, votingPool } from "./engine";
import type { Game, HostView, PublicGame, PublicPhase, PublicQuestion, PublicTeamVote, Question } from "./types";

function teamVote(
  g: Game,
  p: { teamId: string; votes?: Record<string, number>; tie?: boolean; stuck?: boolean; questionId: string },
  now: number,
): PublicTeamVote | null {
  if (!optionsOf(questionOf(g, p.questionId))) return null;
  return {
    voters: Object.keys(p.votes ?? {}),
    total: votingPool(g, p.teamId, p.votes, now),
    tie: !!p.tie,
    stuck: !!p.stuck,
  };
}

function publicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    categoryId: q.categoryId,
    question: q.question,
    type: q.type,
    points: q.points,
    imageUrl: q.imageUrl,
    options: optionsOf(q),
  };
}

function publicPhase(g: Game, now: number): PublicPhase {
  const p = g.phase;
  switch (p.name) {
    case "CATEGORY_VOTE": {
      const counts: Record<string, number> = {};
      for (const c of Object.values(p.votes)) counts[c] = (counts[c] ?? 0) + 1;
      return {
        name: p.name,
        teamId: p.teamId,
        options: p.options,
        counts,
        voters: Object.keys(p.votes),
        tie: p.tie,
        timer: p.timer,
      };
    }
    case "QUESTION":
      return {
        name: p.name,
        teamId: p.teamId,
        categoryId: p.categoryId,
        cardIndex: p.cardIndex,
        question: publicQuestion(questionOf(g, p.questionId)),
        timer: p.timer,
        buzzer: p.buzzer,
        attempt: p.attempt,
        readyAt: p.readyAt ?? 0,
        teamVote: p.buzzer ? null : teamVote(g, p, now),
      };
    case "STEAL":
      return {
        name: p.name,
        fromTeamId: p.fromTeamId,
        teamId: p.teamId,
        categoryId: p.categoryId,
        cardIndex: p.cardIndex,
        question: publicQuestion(questionOf(g, p.questionId)),
        timer: p.timer,
        attempt: p.attempt,
        excludedOption: p.excludedOption,
        readyAt: p.readyAt ?? 0,
        teamVote: teamVote(g, p, now),
      };
    case "RESULT": {
      const q = questionOf(g, p.questionId);
      return {
        name: p.name,
        outcome: p.outcome,
        teamId: p.teamId,
        points: p.points,
        activeTeamId: p.activeTeamId,
        categoryId: p.categoryId,
        question: publicQuestion(q),
        answer: q.answer,
        correctOption: optionsOf(q) ? q.correctOption : null,
        timer: p.timer,
      };
    }
    default:
      return p;
  }
}

export function toPublic(g: Game, version: number, now: number): PublicGame {
  const boards: PublicGame["boards"] = {};
  for (const [cid, cards] of Object.entries(g.boards)) {
    boards[cid] = cards.map((c) => ({ used: c.used, outcome: c.outcome }));
  }
  return {
    code: g.code,
    name: g.name,
    themeId: g.themeId,
    settings: g.settings,
    teams: g.teams,
    players: g.players.map((pl) => ({
      id: pl.id,
      name: pl.name,
      gender: pl.gender,
      avatarUrl: pl.avatarUrl,
      teamId: pl.teamId,
      online: isOnline(pl, now),
    })),
    categories: g.categoryIds.map((id) => {
      const c = g.content.categories.find((x) => x.id === id)!;
      return { id: c.id, name: c.name, color: c.color, pattern: c.pattern, mode: c.mode };
    }),
    turn: g.turn,
    boards,
    phase: publicPhase(g, now),
    paused: g.paused,
    event: g.event,
    streaks: g.streaks ?? {},
    version,
    serverNow: now,
  };
}

export function toHost(g: Game, version: number, now: number, pin = ""): HostView {
  const p = g.phase;
  let answer: string | null = null;
  let correctOption: number | null = null;
  if (p.name === "QUESTION" || p.name === "STEAL" || p.name === "RESULT") {
    const q = questionOf(g, p.questionId);
    answer = q.answer;
    correctOption = optionsOf(q) ? q.correctOption : null;
  }
  const remaining: Record<string, number> = {};
  for (const id of g.categoryIds) remaining[id] = remainingInCategory(g, id);
  const counts = (p.name === "QUESTION" && !p.buzzer) || p.name === "STEAL" ? voteCounts(p) : null;
  return {
    ...toPublic(g, version, now),
    host: { answer, correctOption, remaining, canUndo: !!g.undo, pin, voteCounts: counts },
  };
}
