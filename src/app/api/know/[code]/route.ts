// Public «وش تعرف عنه؟ 👀» questionnaire API: /know/CODE (no login).
import { GameError } from "@/lib/game/engine";
import { body, handle, json } from "@/lib/server/http";
import { loadKnow, mutateKnow } from "@/lib/server/know";
import { hashToken, loadSession, newId, newToken } from "@/lib/server/sessions";
import { answeredKeys, applySubmission, findByName, generatePersonal, readiness, PersonalError, type SubmitInput } from "@/lib/personal";

export const dynamic = "force-dynamic";

function wrap(e: unknown): never {
  if (e instanceof PersonalError) throw Object.assign(new GameError(e.message, e.status), { extra: e.extra });
  throw e;
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const rec = await loadSession(code);
    // public, non-sensitive counts (setup card, TV lobby, /join)
    const { doc } = await loadKnow(code);
    const r = readiness(generatePersonal(doc));
    return json({ code: rec.game.code, name: rec.game.name, people: doc.profiles.length, count: r.count, ready: r.ready });
  });
}

type Body =
  | { action: "check"; name: string }
  | ({ action: "submit"; edit?: { contributionId: string; token: string } } & Omit<SubmitInput, "edit">)
  | { action: "mine"; contributionId: string; token: string };

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    await loadSession(code); // the game session must exist
    const b = await body<Body>(req);

    if (b.action === "check") {
      const { doc } = await loadKnow(code);
      const p = findByName(doc, String(b.name ?? ""));
      return json(p ? { exists: true, name: p.name, answeredKeys: answeredKeys(p), customLeft: 3 - p.custom.length } : { exists: false });
    }

    if (b.action === "mine") {
      const { doc } = await loadKnow(code);
      const c = doc.contributions.find((x) => x.id === b.contributionId);
      if (!c || c.tokenHash !== hashToken(String(b.token ?? ""))) throw new GameError("ما تقدر تعدل هذي المعلومات", 403);
      const p = doc.profiles.find((x) => x.id === c.profileId);
      if (!p) throw new GameError("الشخص غير موجود", 404);
      const answers: Record<string, string> = {};
      for (const a of p.answers) if (a.contributionId === c.id) answers[a.key] = a.text;
      const custom = p.custom.filter((x) => x.contributionId === c.id).map((x) => ({ question: x.question, answer: x.answer, wrong: x.wrong }));
      return json({ name: p.name, mode: c.mode, answers, custom });
    }

    if (b.action === "submit") {
      const token = newToken();
      try {
        const res = await mutateKnow(code, (doc) => {
          try {
            const r = applySubmission(
              doc,
              {
                name: b.name,
                mode: b.mode,
                merge: !!b.merge,
                answers: b.answers ?? {},
                custom: b.custom ?? [],
                nonce: String(b.nonce ?? "").slice(0, 64),
                edit: b.edit ? { contributionId: b.edit.contributionId, tokenHash: hashToken(String(b.edit.token ?? "")) } : undefined,
              },
              Date.now(),
              { newId: () => newId(), tokenHash: hashToken(token) },
            );
            return { doc: r.doc, result: r };
          } catch (e) {
            wrap(e);
          }
        });
        // brand-new contribution → hand its edit token to this browser (only once)
        const fresh = !b.edit && res.contribution.tokenHash === hashToken(token);
        return json({
          profileId: res.profile.id,
          name: res.profile.name,
          contributionId: res.contribution.id,
          token: fresh ? token : null,
        });
      } catch (e) {
        const extra = (e as { extra?: Record<string, unknown> }).extra;
        if (e instanceof GameError && extra) return json({ error: e.message, ...extra }, e.status);
        throw e;
      }
    }
    throw new GameError("طلب غير صالح");
  });
}
