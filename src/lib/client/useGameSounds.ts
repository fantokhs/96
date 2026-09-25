"use client";
import { useEffect, useRef } from "react";
import type { PublicGame } from "../game/types";
import { sfx, type SfxName } from "./sound";
import { useCountdown } from "./useGame";

const EVENT_SOUND: Partial<Record<PublicGame["event"]["kind"], SfxName>> = {
  join: "join",
  start: "drum",
  tie: "whoosh",
  category: "whoosh",
  flip: "flip",
  correct: "correct",
  wrong: "wrong",
  steal: "steal",
  buzz: "buzz",
  skip: "whoosh",
  score: "score",
  intro: "drums",
  go: "whistle",
  voted: "tap",
};

/** V1.7: one follow-up per reaction, timed to its stages (never two at once). */
const FOLLOW_UP: Partial<Record<PublicGame["event"]["kind"], [SfxName, number]>> = {
  correct: ["applause", 2800],
  wrong: ["laugh", 2700],
  steal: ["whoosh", 1500],
};

/** Plays a sound for each new game event plus the last-5-seconds countdown. */
export function useGameSounds(game: PublicGame | null, now: () => number, enabled: boolean) {
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    if (!game) return;
    const seq = game.event.seq;
    if (lastSeq.current === null) {
      lastSeq.current = seq; // don't replay history on first load
      return;
    }
    if (seq === lastSeq.current) return;
    lastSeq.current = seq;
    if (!enabled || !game.settings.soundOn) return;
    const name = game.event.kind === "sfx" ? game.event.sfx : EVENT_SOUND[game.event.kind];
    if (name) sfx?.play(name);
    if ((game.event.kind === "correct" || game.event.kind === "steal") && (game.event.points ?? 0) > 0) {
      setTimeout(() => sfx?.play("score"), 650);
    }
    const follow = FOLLOW_UP[game.event.kind];
    // only when the event really ended the question (a wrong vote during the question isn't a reaction)
    if (follow && game.phase.name === "RESULT") {
      const at = game.event.seq;
      setTimeout(() => {
        if (lastSeq.current === at) sfx?.play(follow[0]);
      }, follow[1]);
    }
  }, [game, enabled]);

  const p = game?.phase;
  const timer = p && (p.name === "QUESTION" || p.name === "STEAL") ? p.timer : null;
  const { left, running } = useCountdown(timer, now);
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!running || !enabled || !game?.settings.soundOn) return;
    if (left <= 5 && left > 0 && left !== lastTick.current) {
      lastTick.current = left;
      sfx?.play("tick");
    }
  }, [left, running, enabled, game?.settings.soundOn]);
}
