import "server-only";
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
  getMedia(id: string): Promise<Media | null>;
}

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const g = globalThis as unknown as { __store96?: Store };

export function getStore(): Store {
  if (!g.__store96) {
    g.__store96 = supabaseConfigured()
      ? new SupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : new MemoryStore();
  }
  return g.__store96;
}
