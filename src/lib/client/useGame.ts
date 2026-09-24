"use client";
// Keeps one role's view of a session in sync: initial fetch, realtime pings
// (Supabase broadcast or SSE), a polling safety net, and refetch on focus.
import { useCallback, useEffect, useRef, useState } from "react";
import type { HostView, PublicGame, Timer } from "../game/types";
import { api, ApiError } from "./api";

type View = PublicGame | HostView;

export function useGame<T extends View = PublicGame>(code: string, hostToken?: string | null) {
  const [game, setGame] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [online, setOnline] = useState(true);
  const versionRef = useRef(0);
  const offsetRef = useRef(0);
  const inflight = useRef(false);
  const again = useRef(false);

  const accept = useCallback((next: T) => {
    if (next.version < versionRef.current) return;
    versionRef.current = next.version;
    offsetRef.current = next.serverNow - Date.now();
    setGame(next);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (hostToken === null) return; // host page still resolving its token
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      const next = await api<T>(`/api/sessions/${code}`, {
        headers: hostToken ? { "x-host-token": hostToken } : {},
      });
      accept(next);
      setOnline(true);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 0) setOnline(false);
        else setError(e);
      }
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        void refresh();
      }
    }
  }, [code, hostToken, accept]);

  const onPing = useCallback(
    (v: number) => {
      if (v > versionRef.current) void refresh();
    },
    [refresh],
  );

  const rt = game?.rt;

  // Initial load + polling safety net + focus refresh
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), rt === "supabase" ? 5000 : 3000);
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [refresh, rt]);

  // Realtime pings
  useEffect(() => {
    if (!rt) return;
    if (rt === "sse") {
      const es = new EventSource(`/api/sessions/${code}/events`);
      es.onmessage = (e) => onPing(Number(e.data));
      return () => es.close();
    }
    let cleanup = () => {};
    let cancelled = false;
    void import("@supabase/supabase-js").then(({ createClient }) => {
      if (cancelled) return;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return;
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const ch = sb
        .channel(`game-${code}`)
        .on("broadcast", { event: "v" }, (msg) => onPing(Number((msg.payload as { v: number }).v)))
        .subscribe();
      cleanup = () => void sb.removeChannel(ch);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [rt, code, onPing]);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  return { game, setGame: accept, error, online, refresh, now };
}

/** Seconds (ceil) left on a server timer, re-rendering ~5×/s. */
export function useCountdown(timer: Timer | null | undefined, now: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!timer || timer.endsAt === null) return;
    const id = setInterval(() => force((x) => x + 1), 200);
    return () => clearInterval(id);
  }, [timer]);
  if (!timer) return { left: 0, ms: 0, fraction: 0, running: false };
  const ms = timer.endsAt === null ? (timer.remainingMs ?? 0) : Math.max(0, timer.endsAt - now());
  return {
    ms,
    left: Math.ceil(ms / 1000),
    fraction: timer.durationMs ? ms / timer.durationMs : 0,
    running: timer.endsAt !== null && ms > 0,
  };
}

/** Asks the server to run time-based transitions once our clock says a deadline passed. */
export function useTickDriver(game: PublicGame | null, now: () => number, jitterMs = 0) {
  useEffect(() => {
    if (!game || game.paused) return;
    const p = game.phase;
    if (p.name !== "CATEGORY_VOTE" && p.name !== "CARD_PICK" && p.name !== "RESULT") return;
    const endsAt = p.timer.endsAt;
    if (endsAt === null) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const fire = async () => {
      if (stop) return;
      try {
        await api(`/api/sessions/${game.code}/act`, { json: { role: "system", action: { type: "tick" } } });
      } catch {}
      if (!stop) t = setTimeout(fire, 1500); // keep nudging until the phase moves on
    };
    t = setTimeout(fire, Math.max(0, endsAt - now()) + 150 + Math.random() * jitterMs);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [game?.version, game?.paused, game?.code, game?.phase, now, jitterMs]); // eslint-disable-line react-hooks/exhaustive-deps
}
