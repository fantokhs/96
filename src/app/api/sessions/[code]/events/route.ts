// Server-sent "version changed" pings for the in-memory store (local play).
// With Supabase, clients use Supabase Realtime instead.
import { bus, normalizeCode } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await ctx.params).code);
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (v: number) => {
        try {
          controller.enqueue(enc.encode(`data: ${v}\n\n`));
        } catch {
          cleanup();
        }
      };
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
      bus.on(code, send);
      cleanup = () => {
        clearInterval(ping);
        bus.off(code, send);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
      controller.enqueue(enc.encode(`retry: 2000\n\n`));
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
