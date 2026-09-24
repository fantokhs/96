import { addPlayer, GameError } from "@/lib/game/engine";
import type { Gender } from "@/lib/game/types";
import { body, handle, json, view } from "@/lib/server/http";
import { mutate, newId, newToken } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

interface JoinBody {
  name?: string;
  gender?: Gender;
  avatarUrl?: string | null;
  teamId?: string | null;
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body<JoinBody>(req);
    const name = String(b.name ?? "").trim();
    if (!name) throw new GameError("اكتب اسمك");
    const avatarUrl = typeof b.avatarUrl === "string" && /^\/api\/media\/[\w-]+$/.test(b.avatarUrl) ? b.avatarUrl : null;
    const gender: Gender = b.gender === "male" || b.gender === "female" ? b.gender : null;
    const playerId = newId("p_");
    const token = newToken();
    const res = await mutate(code, (game) =>
      addPlayer(game, { id: playerId, token, name, gender, avatarUrl, teamId: b.teamId ?? null }, Date.now()),
    );
    return json({ playerId, token, state: view(res.game, res.version, "public") });
  });
}
