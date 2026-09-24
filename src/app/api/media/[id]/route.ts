import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const media = /^[\w-]+$/.test(id) ? await getStore().getMedia(id) : null;
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(media.data, "base64"), {
    headers: { "Content-Type": media.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
