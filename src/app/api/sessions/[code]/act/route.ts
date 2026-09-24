import { applyHost, applyPlayer, applyTick, GameError } from "@/lib/game/engine";
import type { HostAction, PlayerAction } from "@/lib/game/types";
import { body, handle, json, view } from "@/lib/server/http";
import { assertHost, assertPlayer, mutate } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

type ActBody =
  | { role: "host"; token: string; action: HostAction }
  | { role: "player"; playerId: string; token: string; action: PlayerAction }
  | { role: "system"; action: { type: "tick" } };

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body<ActBody>(req);
    if (!b?.action?.type) throw new GameError("طلب غير صالح");
    const now = () => Date.now();

    if (b.role === "host") {
      const res = await mutate(code, (game, rec) => {
        assertHost(rec, b.token);
        return applyHost(game, b.action, now());
      });
      return json(view(res.game, res.version, "host"));
    }

    if (b.role === "player") {
      const res = await mutate(code, (game) => {
        assertPlayer(game, b.playerId, b.token);
        return applyPlayer(game, b.playerId, b.action, now());
      });
      return json(view(res.game, res.version, "public"));
    }

    if (b.role === "system" && b.action.type === "tick") {
      // Anyone may ask; only transitions whose deadline has passed on the server happen.
      const res = await mutate(code, (game) => applyTick(game, now()));
      return json({ changed: res.changed, version: res.version });
    }

    throw new GameError("طلب غير صالح");
  });
}
