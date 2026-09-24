// Public category list for the create-game screen (no answers).
import { handle, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { THEME } from "@/content/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const themeId = new URL(req.url).searchParams.get("themeId") || THEME.id;
    const store = getStore();
    const [categories, questions] = await Promise.all([
      store.listCategories({ themeId }),
      store.listQuestions({ themeId }),
    ]);
    const counts: Record<string, number> = {};
    for (const q of questions) counts[q.categoryId] = (counts[q.categoryId] ?? 0) + 1;
    return json({
      themes: [THEME],
      store: store.kind,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
        pattern: c.pattern,
        mode: c.mode,
        count: counts[c.id] ?? 0,
      })),
    });
  });
}
