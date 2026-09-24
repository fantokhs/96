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
    const name = EVENT_SOUND[game.event.kind];
    if (name) sfx?.play(name);
    if ((game.event.kind === "correct" || game.event.kind === "steal") && (game.event.points ?? 0) > 0) {
      setTimeout(() => sfx?.play("score"), 650);
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
