import { applyHost, applyPlayer, applyTick, GameError, needsPing, withPersonal } from "@/lib/game/engine";
import { findByName, generatePersonal, PERSONAL_CATEGORY, readiness } from "@/lib/personal";
import { loadKnow } from "@/lib/server/know";
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
      // «وش تعرف عنه؟ 👀»: (re)generate the session's personal questions when the game
      // starts, when the host toggles the category, or on an explicit refresh.
      const personalDoc = ["start", "toggle_personal", "refresh_personal"].includes(b.action.type)
        ? (await loadKnow(code)).doc
        : null;
      const personal = personalDoc ? generatePersonal(personalDoc) : null;
      const res = await mutate(code, (game, rec) => {
        assertHost(rec, b.token);
        let g = game;
        if (personal && personalDoc) {
          const enabledAfter =
            b.action.type === "toggle_personal" ? game.settings.personalEnabled === false : game.settings.personalEnabled !== false;
          const links: Record<string, string | null> = {};
          for (const p of game.players) links[p.id] = findByName(personalDoc, p.name)?.id ?? null;
          g = withPersonal(g, PERSONAL_CATEGORY, readiness(personal).ready ? personal.questions : [], links, enabledAfter);
        }
        return applyHost(g, b.action, now());
      });
      return json(view(res.game, res.version, "host"));
    }

    if (b.role === "player" && b.action.type === "ping") {
      // presence heartbeat: write at most every ~20s per player, without a broadcast
      const res = await mutate(
        code,
        (game) => {
          assertPlayer(game, b.playerId, b.token);
          return needsPing(game, b.playerId, now()) ? applyPlayer(game, b.playerId, b.action, now()) : null;
        },
        { silent: true },
      );
      return json({ ok: true, version: res.version });
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
