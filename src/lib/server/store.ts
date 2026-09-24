import "server-only";
import { GameError } from "../game/engine";
import type { Category, Game, Question } from "../game/types";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";

export interface SessionRecord {
  game: Game;
  version: number;
  hostTokenHash: string;
}

export interface Media {
  contentType: string;
  data: string; // base64
}

export interface Store {
  readonly kind: "memory" | "supabase";
  createSession(code: string, game: Game, hostTokenHash: string): Promise<boolean>;
  getSession(code: string): Promise<SessionRecord | null>;
  /** Compare-and-set on version. Returns false when someone else wrote first. */
  updateSession(code: string, expectedVersion: number, game: Game): Promise<boolean>;

  listCategories(opts?: { themeId?: string; includeInactive?: boolean }): Promise<Category[]>;
  listQuestions(opts?: { themeId?: string; categoryIds?: string[]; includeInactive?: boolean }): Promise<Question[]>;
  saveCategory(c: Category): Promise<Category>;
  saveQuestion(q: Question): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;

  putMedia(id: string, media: Media): Promise<void>;
  /** Idempotent additive content import (Supabase only). */
  ensureContent?(): Promise<void>;
  getMedia(id: string): Promise<Media | null>;
}

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const g = globalThis as unknown as { __store96?: Store };

/** The in-memory store only works in a single process, so production requires Supabase. */
export function memoryStoreAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MEMORY_STORE === "1";
}

export function getStore(): Store {
  if (!g.__store96) {
    if (!supabaseConfigured() && !memoryStoreAllowed()) {
      throw new GameError("الخادم غير مربوط بقاعدة البيانات بعد (Supabase)", 503);
    }
    g.__store96 = supabaseConfigured()
      ? new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : new MemoryStore();
  }
  return g.__store96;
}

const r = globalThis as unknown as { __ready96?: Promise<void> };

/** getStore() plus the one-time additive seed import. Import failures never block the game. */
export async function readyStore(): Promise<Store> {
  const store = getStore();
  if (store.ensureContent) {
    r.__ready96 ??= store.ensureContent().catch((e) => {
      console.error("seed import failed", e);
      r.__ready96 = undefined; // retry on a later request
    });
    await r.__ready96;
  }
  return store;
}
