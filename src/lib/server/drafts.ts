import "server-only";
import type { PersonalDoc } from "../personal";
import type { Store } from "./store";

const WEEK = 7 * 24 * 3600 * 1000;
const g = globalThis as unknown as { __draftSweep96?: number };

/**
 * Best-effort, throttled sweep of abandoned draft sessions: a draft is removed only when it
 * has been idle for 7 days, has no players, never left the lobby, and nobody submitted any
 * «وش تعرف عنه؟» info. Anything with personal submissions is kept forever.
 */
export async function cleanupDrafts(store: Store, now = Date.now()) {
  if (g.__draftSweep96 && now - g.__draftSweep96 < 3600_000) return 0;
  g.__draftSweep96 = now;
  let removed = 0;
  for (const code of await store.staleDrafts(now - WEEK, 25)) {
    const rec = await store.getSession(code);
    const game = rec?.game;
    if (!game || !game.draft || game.players.length || game.phase.name !== "LOBBY") continue;
    const know = await store.getSession(`KNOW:${code}`);
    const doc = know?.game as unknown as PersonalDoc | undefined;
    if (doc && ((doc.profiles?.length ?? 0) > 0 || (doc.contributions?.length ?? 0) > 0)) continue;
    if (know) await store.deleteSession(`KNOW:${code}`);
    await store.deleteSession(code);
    removed++;
  }
  return removed;
}
