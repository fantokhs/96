import { GameError } from "@/lib/game/engine";
import { body, handle, json } from "@/lib/server/http";
import { newId } from "@/lib/server/sessions";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const MAX_BYTES = 600 * 1024;

/** Accepts an already-resized image as a data URL (the browser does the cropping). */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ dataUrl?: string }>(req);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl ?? "");
    if (!m) throw new GameError("صيغة الصورة غير مدعومة");
    if ((m[2].length * 3) / 4 > MAX_BYTES) throw new GameError("الصورة كبيرة جداً");
    const id = newId("m_");
    await getStore().putMedia(id, { contentType: m[1], data: m[2] });
    return json({ url: `/api/media/${id}` });
  });
}
