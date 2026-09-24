import { handle, json, view } from "@/lib/server/http";
import { assertHost, loadSession } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const rec = await loadSession(code);
    const hostToken = req.headers.get("x-host-token");
    if (hostToken) {
      assertHost(rec, hostToken);
      return json(view(rec.game, rec.version, "host"));
    }
    return json(view(rec.game, rec.version, "public"));
  });
}
