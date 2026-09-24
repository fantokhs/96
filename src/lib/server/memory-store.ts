// In-process store for local development / single-machine play.
import { SEED_CATEGORIES, SEED_QUESTIONS } from "../../content/seed";
import type { Category, Game, Question } from "../game/types";
import type { Media, SessionRecord, Store } from "./store";

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private sessions = new Map<string, SessionRecord>();
  private categories = new Map<string, Category>(SEED_CATEGORIES.map((c) => [c.id, c]));
  private questions = new Map<string, Question>(SEED_QUESTIONS.map((q) => [q.id, q]));
  private media = new Map<string, Media>();

  async createSession(code: string, game: Game, hostTokenHash: string) {
    if (this.sessions.has(code)) return false;
    this.sessions.set(code, { game: structuredClone(game), version: 1, hostTokenHash });
    return true;
  }

  async getSession(code: string) {
    const s = this.sessions.get(code);
    return s ? { ...s, game: structuredClone(s.game) } : null;
  }

  async updateSession(code: string, expectedVersion: number, game: Game) {
    const s = this.sessions.get(code);
    if (!s || s.version !== expectedVersion) return false;
    this.sessions.set(code, { ...s, game: structuredClone(game), version: expectedVersion + 1 });
    return true;
  }

  async listCategories(opts: { themeId?: string; includeInactive?: boolean } = {}) {
    return [...this.categories.values()]
      .filter((c) => (!opts.themeId || c.themeId === opts.themeId) && (opts.includeInactive || c.active))
      .sort((a, b) => a.sort - b.sort);
  }

  async listQuestions(opts: { themeId?: string; categoryIds?: string[]; includeInactive?: boolean } = {}) {
    return [...this.questions.values()].filter(
      (q) =>
        (!opts.themeId || q.themeId === opts.themeId) &&
        (!opts.categoryIds || opts.categoryIds.includes(q.categoryId)) &&
        (opts.includeInactive || q.active),
    );
  }

  async saveCategory(c: Category) {
    this.categories.set(c.id, c);
    return c;
  }

  async saveQuestion(q: Question) {
    this.questions.set(q.id, q);
    return q;
  }

  async deleteQuestion(id: string) {
    this.questions.delete(id);
  }

  async putMedia(id: string, media: Media) {
    this.media.set(id, media);
  }

  async getMedia(id: string) {
    return this.media.get(id) ?? null;
  }
}
