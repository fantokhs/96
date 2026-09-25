// Supabase-backed store. Uses the service role key on the server only;
// every table has RLS enabled with no public policies, so browsers can't touch data directly.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { THEME, V12_CATEGORIES, V12_QUESTIONS } from "../../content/seed";
import { isDifficulty, SEED_DIFFICULTY, withDifficulty } from "../../content/difficulty";
import type { Category, Difficulty, Game, Question } from "../game/types";
import type { Media, SessionRecord, Store } from "./store";

type CategoryRow = {
  id: string;
  theme_id: string;
  name: string;
  description: string | null;
  color: string;
  pattern: Category["pattern"];
  mode: Category["mode"];
  sort: number;
  active: boolean;
};

type QuestionRow = {
  id: string;
  theme_id: string;
  category_id: string;
  question: string;
  answer: string;
  type: Question["type"];
  points: number;
  image_url: string | null;
  options: string[] | null;
  correct_option: number | null;
  active: boolean;
  /** V1.7 column (nullable) — absent until the migration has run */
  difficulty?: string | null;
};

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  themeId: r.theme_id,
  name: r.name,
  description: r.description,
  color: r.color,
  pattern: r.pattern,
  mode: r.mode,
  sort: r.sort,
  active: r.active,
});

const fromCategory = (c: Category): CategoryRow => ({
  id: c.id,
  theme_id: c.themeId,
  name: c.name,
  description: c.description,
  color: c.color,
  pattern: c.pattern,
  mode: c.mode,
  sort: c.sort,
  active: c.active,
});

const toQuestion = (r: QuestionRow): Question => ({
  id: r.id,
  themeId: r.theme_id,
  categoryId: r.category_id,
  question: r.question,
  answer: r.answer,
  type: r.type,
  points: r.points,
  imageUrl: r.image_url,
  options: r.options,
  correctOption: r.correct_option,
  active: r.active,
  difficulty: isDifficulty(r.difficulty) ? r.difficulty : null,
});

const fromQuestion = (q: Question): QuestionRow => ({
  id: q.id,
  theme_id: q.themeId,
  category_id: q.categoryId,
  question: q.question,
  answer: q.answer,
  type: q.type,
  points: q.points,
  image_url: q.imageUrl,
  options: q.options,
  correct_option: q.correctOption,
  active: q.active,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

// Admin difficulty edits made before the V1.7 column exists are kept in a small document
// in the existing sessions table (no schema change needed), like «وش تعرف عنه؟».
const DIFF_META = "META:DIFFICULTY";
const missingColumn = (msg: string) => /difficulty/i.test(msg) && /(column|schema cache)/i.test(msg);

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;
  private hasDifficulty: boolean | null = null;
  private overrides: { at: number; map: Record<string, Difficulty> } | null = null;

  /** Does questions.difficulty exist? (checked once per process, re-checked if it was missing) */
  private async difficultyColumn(): Promise<boolean> {
    if (this.hasDifficulty) return true;
    const res = await this.db.from("questions").select("difficulty").limit(1);
    this.hasDifficulty = !res.error;
    if (this.hasDifficulty) await this.backfillDifficulty().catch((e) => console.error("difficulty backfill", e));
    return this.hasDifficulty;
  }

  /** Additive: fill NULL difficulty for known seed ids (never overwrites a value). */
  private async backfillDifficulty() {
    const marker = "_seed:v1.7-difficulty";
    const done = await this.db.from("themes").select("id").eq("id", marker).maybeSingle();
    if (done.error || done.data) return;
    const over = await this.difficultyOverrides();
    const byLevel: Record<Difficulty, string[]> = { easy: [], medium: [], hard: [] };
    for (const [id, d] of Object.entries({ ...SEED_DIFFICULTY, ...over })) byLevel[d].push(id);
    for (const [d, ids] of Object.entries(byLevel)) {
      if (ids.length) check(await this.db.from("questions").update({ difficulty: d }).in("id", ids).is("difficulty", null));
    }
    await this.db.from("themes").upsert({ id: marker, name: "seed marker V1.7 difficulty", active: false }, { onConflict: "id", ignoreDuplicates: true });
  }

  private async difficultyOverrides(): Promise<Record<string, Difficulty>> {
    if (this.overrides && Date.now() - this.overrides.at < 15_000) return this.overrides.map;
    const rec = await this.getSession(DIFF_META).catch(() => null);
    const map = ((rec?.game as unknown as { map?: Record<string, Difficulty> })?.map ?? {}) as Record<string, Difficulty>;
    this.overrides = { at: Date.now(), map };
    return map;
  }

  private async setOverride(id: string, d: Difficulty | null) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const rec = await this.getSession(DIFF_META);
      const map = { ...((rec?.game as unknown as { map?: Record<string, Difficulty> })?.map ?? {}) };
      if (d) map[id] = d;
      else delete map[id];
      const doc = { map } as unknown as Game;
      const ok = rec ? await this.updateSession(DIFF_META, rec.version, doc) : await this.createSession(DIFF_META, doc, "-");
      if (ok) {
        this.overrides = { at: Date.now(), map };
        return;
      }
    }
    throw new Error("difficulty override: busy");
  }

  async difficultyStorage() {
    return (await this.difficultyColumn()) ? ("column" as const) : ("fallback" as const);
  }

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /**
   * One-time additive import of the V1.2 seed into an existing production DB.
   * Inserts only rows whose IDs don't exist yet (never updates or deletes), then
   * records a marker row so questions the host later deletes are not re-added.
   */
  async ensureContent() {
    const marker = "_seed:v1.2";
    const done = await this.db.from("themes").select("id").eq("id", marker).maybeSingle();
    if (done.error) throw new Error(`Supabase: ${done.error.message}`);
    if (done.data) return;
    const insertNew = async (table: string, rows: object[]) => {
      const res = await this.db.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (!res.error) return;
      // e.g. a referenced category was removed: fall back to row-by-row so the rest still land
      for (const row of rows) await this.db.from(table).upsert(row, { onConflict: "id", ignoreDuplicates: true });
    };
    await insertNew("themes", [{ id: THEME.id, name: THEME.name }]);
    await insertNew("categories", V12_CATEGORIES.map(fromCategory));
    await insertNew("questions", V12_QUESTIONS.map(fromQuestion));
    await insertNew("themes", [{ id: marker, name: "seed marker V1.2", active: false }]);
  }

  async createSession(code: string, game: Game, hostTokenHash: string) {
    const res = await this.db.from("sessions").insert({ code, state: game, version: 1, host_token_hash: hostTokenHash });
    if (res.error) {
      if (res.error.code === "23505") return false; // duplicate code
      throw new Error(`Supabase: ${res.error.message}`);
    }
    return true;
  }

  async getSession(code: string): Promise<SessionRecord | null> {
    const data = check(
      await this.db.from("sessions").select("state, version, host_token_hash").eq("code", code).maybeSingle(),
    );
    if (!data) return null;
    return { game: data.state as Game, version: data.version, hostTokenHash: data.host_token_hash };
  }

  async updateSession(code: string, expectedVersion: number, game: Game) {
    const data = check(
      await this.db
        .from("sessions")
        .update({ state: game, version: expectedVersion + 1, updated_at: new Date().toISOString() })
        .eq("code", code)
        .eq("version", expectedVersion)
        .select("code"),
    );
    return (data?.length ?? 0) > 0;
  }

  async staleDrafts(before: number, limit: number) {
    const data = check(
      await this.db
        .from("sessions")
        .select("code")
        .eq("state->>draft", "true")
        .lt("updated_at", new Date(before).toISOString())
        .limit(limit),
    ) as { code: string }[];
    return data.map((r) => r.code);
  }

  async deleteSession(code: string) {
    check(await this.db.from("sessions").delete().eq("code", code));
  }

  async listCategories(opts: { themeId?: string; includeInactive?: boolean } = {}) {
    let q = this.db.from("categories").select("*").order("sort");
    if (opts.themeId) q = q.eq("theme_id", opts.themeId);
    if (!opts.includeInactive) q = q.eq("active", true);
    return (check(await q) as CategoryRow[]).map(toCategory);
  }

  async listQuestions(opts: { themeId?: string; categoryIds?: string[]; includeInactive?: boolean } = {}) {
    let q = this.db.from("questions").select("*").order("id").limit(5000);
    if (opts.themeId) q = q.eq("theme_id", opts.themeId);
    if (opts.categoryIds) q = q.in("category_id", opts.categoryIds);
    if (!opts.includeInactive) q = q.eq("active", true);
    const rows = (check(await q) as QuestionRow[]).map(toQuestion);
    if (this.hasDifficulty === null) void this.difficultyColumn().catch(() => {}); // one-time check + NULL back-fill
    // column value wins; otherwise admin override (pre-migration) or the V1.7 classification
    return withDifficulty(rows, await this.difficultyOverrides());
  }

  async saveCategory(c: Category) {
    const data = check(await this.db.from("categories").upsert(fromCategory(c)).select().single());
    return toCategory(data as CategoryRow);
  }

  async saveQuestion(q: Question) {
    const d = isDifficulty(q.difficulty) ? q.difficulty : null;
    const row = { ...fromQuestion(q), updated_at: new Date().toISOString() };
    if (await this.difficultyColumn()) {
      const res = await this.db.from("questions").upsert({ ...row, difficulty: d }).select().single();
      if (!res.error) return toQuestion(res.data as QuestionRow);
      if (!missingColumn(res.error.message)) throw new Error(`Supabase: ${res.error.message}`);
      this.hasDifficulty = false;
    }
    const data = check(await this.db.from("questions").upsert(row).select().single());
    await this.setOverride(q.id, d);
    return { ...toQuestion(data as QuestionRow), difficulty: d };
  }

  async deleteQuestion(id: string) {
    check(await this.db.from("questions").delete().eq("id", id));
  }

  async putMedia(id: string, media: Media) {
    check(await this.db.from("media").insert({ id, content_type: media.contentType, data: media.data }));
  }

  async getMedia(id: string) {
    const data = check(await this.db.from("media").select("content_type, data").eq("id", id).maybeSingle());
    return data ? { contentType: data.content_type as string, data: data.data as string } : null;
  }
}
