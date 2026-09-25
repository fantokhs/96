import "server-only";
import { GameError } from "../game/engine";
import type { Game } from "../game/types";
import { emptyDoc, type PersonalDoc } from "../personal";
import { normalizeCode } from "./sessions";
import { getStore } from "./store";

// «وش تعرف عنه؟» data lives in its own session-scoped document (a separate row in the
// existing sessions table, keyed KNOW:<CODE>) — isolated from the game state and from the
// global questions table, and no schema migration needed.
const key = (code: string) => `KNOW:${normalizeCode(code)}`;

export async function loadKnow(code: string): Promise<{ doc: PersonalDoc; version: number }> {
  const rec = await getStore().getSession(key(code));
  return rec ? { doc: rec.game as unknown as PersonalDoc, version: rec.version } : { doc: emptyDoc(), version: 0 };
}

export async function mutateKnow<T>(code: string, fn: (doc: PersonalDoc) => { doc: PersonalDoc; result: T }): Promise<T> {
  const store = getStore();
  const k = key(code);
  for (let attempt = 0; attempt < 10; attempt++) {
    const rec = await store.getSession(k);
    const { doc, result } = fn(rec ? (rec.game as unknown as PersonalDoc) : emptyDoc());
    const ok = rec
      ? await store.updateSession(k, rec.version, doc as unknown as Game)
      : await store.createSession(k, doc as unknown as Game, "-");
    if (ok) return result;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
  }
  throw new GameError("الخادم مشغول، حاول مرة أخرى", 503);
}
