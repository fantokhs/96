// Setup screen → existing session: finish a draft, or replay with (possibly) new settings.
import { GameError, normalizeLength, reconfigure } from "@/lib/game/engine";
import { body, handle, json, view } from "@/lib/server/http";
import { assertHost, loadSession, mutate } from "@/lib/server/sessions";
import { readyStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

interface ConfigureBody {
  token: string;
  name?: string;
  teamNames?: string[];
  categoryIds?: string[];
  totalQuestions?: number;
  personalEnabled?: boolean;
  /** new game run (replay / restart); otherwise only before the game starts */
  reset?: boolean;
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body<ConfigureBody>(req);
    const store = await readyStore();
    const total = normalizeLength(b.totalQuestions); // 10 / 16 / 22 (old 15 → 16, 20 → 22)
    const rec = await loadSession(code);
    assertHost(rec, b.token);
    const categories = await store.listCategories({ themeId: rec.game.themeId });
    const wanted = (b.categoryIds ?? []).filter((id) => categories.some((c) => c.id === id));
    const ids = wanted.length ? wanted : categories.map((c) => c.id);
    const questions = await store.listQuestions({ themeId: rec.game.themeId, categoryIds: ids });
    const defaults = ["الصقور", "الذيابة"];
    const out = await mutate(code, (game, rec) => {
      assertHost(rec, b.token);
      return reconfigure(game, {
        name: String(b.name || game.name).trim().slice(0, 40) || game.name,
        teamNames: [0, 1].map((i) => String(b.teamNames?.[i] || game.teams[i]?.name || defaults[i]).trim().slice(0, 20)) as [string, string],
        categoryIds: ids,
        totalQuestions: total,
        personalEnabled: b.personalEnabled !== false,
        categories,
        questions,
        reset: !!b.reset,
        now: Date.now(),
      });
    });
    if (!out.changed) throw new GameError("ما تغيّر شيء");
    return json(view(out.game, out.version, "host"));
  });
}
