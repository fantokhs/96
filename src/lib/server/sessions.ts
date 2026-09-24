import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { GameError } from "../game/engine";
import type { Game } from "../game/types";
import { getStore, type SessionRecord } from "./store";

// Easy to read aloud / type: no 0/O, 1/I/L.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newCode(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newId(prefix = ""): string {
  return prefix + randomBytes(9).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function normalizeCode(code: string) {
  return decodeURIComponent(code).trim().toUpperCase();
}

export async function loadSession(code: string): Promise<SessionRecord> {
  const rec = await getStore().getSession(normalizeCode(code));
  if (!rec) throw new GameError("الجلسة غير موجودة — تأكد من الكود", 404);
  return rec;
}

/** Host access: the creator's token, or the shared control PIN (/control/CODE). */
export function assertHost(rec: SessionRecord, token: string | null | undefined) {
  if (!token) throw new GameError("غير مصرح", 401);
  if (safeEqual(hashToken(token), rec.hostTokenHash)) return;
  const pin = process.env.HOST_PIN || "9696";
  if (safeEqual(token, pin)) return;
  throw new GameError("الرمز غير صحيح", 401);
}

export function assertPlayer(game: Game, playerId: string, token: string) {
  const p = game.players.find((x) => x.id === playerId);
  if (!p || !token || !safeEqual(p.token, token)) throw new GameError("لست ضمن هذه الجلسة", 403);
}

/**
 * Read-modify-write with optimistic concurrency. `fn` returns the next game,
 * or null for "no change". Retries when another request wrote first.
 */
export async function mutate(
  code: string,
  fn: (game: Game, rec: SessionRecord) => Game | null,
  opts: { silent?: boolean } = {},
): Promise<{ game: Game; version: number; changed: boolean }> {
  const store = getStore();
  const c = normalizeCode(code);
  for (let attempt = 0; attempt < 12; attempt++) {
    const rec = await loadSession(c);
    const next = fn(rec.game, rec);
    if (!next) return { game: rec.game, version: rec.version, changed: false };
    if (await store.updateSession(c, rec.version, next)) {
      // silent writes (heartbeats) don't make every screen refetch
      if (!opts.silent) await notify(c, rec.version + 1);
      return { game: next, version: rec.version + 1, changed: true };
    }
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 40 * (attempt + 1)));
  }
  throw new GameError("الخادم مشغول، حاول مرة أخرى", 503);
}

// ─── Change notifications ───────────────────────────────────────────────────

const g = globalThis as unknown as { __bus96?: EventEmitter };
export const bus: EventEmitter = g.__bus96 ?? (g.__bus96 = new EventEmitter().setMaxListeners(0));

export async function notify(code: string, version: number) {
  bus.emit(code, version);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  // Supabase Realtime broadcast over REST: clients only get a "version changed" ping
  // and re-fetch their own view from the API, so nothing secret goes over the channel.
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        // New-format keys (sb_secret_…) are not JWTs and must not be sent as Bearer tokens.
        ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic: `game-${code}`, event: "v", payload: { v: version } }] }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Clients also poll, so a missed ping only delays an update by a few seconds.
  }
}
