// Host review of «وش تعرف عنه؟ 👀» data (control PIN / host token).
import { GameError } from "@/lib/game/engine";
import { body, handle, json } from "@/lib/server/http";
import { loadKnow, mutateKnow } from "@/lib/server/know";
import { assertHost, loadSession } from "@/lib/server/sessions";
import { applyHostKnow, hostSummary, PersonalError, type HostKnowAction } from "@/lib/personal";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    assertHost(await loadSession(code), req.headers.get("x-host-token"));
    const { doc } = await loadKnow(code);
    return json(hostSummary(doc));
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    assertHost(await loadSession(code), req.headers.get("x-host-token"));
    const a = await body<HostKnowAction>(req);
    const summary = await mutateKnow(code, (doc) => {
      try {
        const next = applyHostKnow(doc, a);
        return { doc: next, result: hostSummary(next) };
      } catch (e) {
        if (e instanceof PersonalError) throw new GameError(e.message, e.status);
        throw e;
      }
    });
    return json(summary);
  });
}
