import { createGame, DEFAULT_TEAM_COLORS, GameError } from "@/lib/game/engine";
import { cleanupDrafts } from "@/lib/server/drafts";
import type { Settings } from "@/lib/game/types";
import { body, handle, json } from "@/lib/server/http";
import { hashToken, newCode, newToken } from "@/lib/server/sessions";
import { readyStore } from "@/lib/server/store";
import { THEME } from "@/content/seed";

export const dynamic = "force-dynamic";

interface CreateBody {
  name?: string;
  themeId?: string;
  teams?: { name: string; color: string }[];
  categoryIds?: string[];
  settings?: Partial<Settings>;
  /** create an early "draft" session (for sharing /join + /know before setup is final) */
  draft?: boolean;
}

const int = (v: unknown, min: number, max: number, fallback: number | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<CreateBody>(req);
    const store = await readyStore();
    const themeId = b.themeId || THEME.id;
    // V1.6: always two teams with fixed identity colours (green / gold)
    const defaults = ["الصقور", "الذيابة"];
    const teams = [0, 1].map((i) => ({
      name: String(b.teams?.[i]?.name || defaults[i]).trim().slice(0, 20) || defaults[i],
      color: DEFAULT_TEAM_COLORS[i],
    }));
    void cleanupDrafts(store).catch(() => {});

    const categories = await store.listCategories({ themeId });
    const wanted = b.categoryIds?.length ? b.categoryIds : categories.map((c) => c.id);
    const questions = await store.listQuestions({ themeId, categoryIds: wanted });

    const s = b.settings ?? {};
    const settings: Partial<Settings> = {
      totalQuestions: int(s.totalQuestions, 1, 200, 15),
      targetScore: null,
      voteEvery: 1,
      questionSeconds: int(s.questionSeconds, 5, 120, 20)!,
      stealSeconds: int(s.stealSeconds, 3, 60, 10)!,
      correctPoints: int(s.correctPoints, 0, 10000, 100)!,
      stealPoints: int(s.stealPoints, 0, 10000, 50)!,
      personalEnabled: s.personalEnabled !== false,
    };

    const hostToken = newToken();
    for (let i = 0; i < 20; i++) {
      const code = newCode();
      const game = createGame({
        code,
        name: String(b.name || "خيمة الفنتوخ").trim().slice(0, 40),
        themeId,
        teams,
        categoryIds: wanted,
        settings,
        categories,
        questions,
        now: Date.now(),
      });
      if (b.draft) game.draft = true;
      if (await store.createSession(code, game, hashToken(hostToken))) {
        return json({ code, hostToken });
      }
    }
    throw new GameError("تعذر إنشاء كود للجلسة، حاول مرة أخرى", 503);
  });
}
