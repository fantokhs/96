// Deployment check: open /api/health after deploying.
import { readyStore, memoryStoreAllowed, supabaseConfigured } from "@/lib/server/store";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PIN: !!process.env.ADMIN_PIN,
  };
  if (!supabaseConfigured() && !memoryStoreAllowed()) {
    return json({ ok: false, version: "V1.5", store: "none", env, error: "Supabase environment variables are missing" }, 503);
  }
  try {
    const store = await readyStore();
    const [categories, questions] = await Promise.all([store.listCategories(), store.listQuestions()]);
    const ok = categories.length > 0 && questions.length > 0 && (store.kind === "memory" || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    return json({ ok, version: "V1.5", store: store.kind, env, categories: categories.length, questions: questions.length, personalFeature: true }, ok ? 200 : 503);
  } catch (e) {
    return json({ ok: false, version: "V1.5", env, error: (e as Error).message }, 503);
  }
}
