import "server-only";
import { NextResponse } from "next/server";
import { GameError } from "../game/engine";
import type { Game } from "../game/types";
import { toHost, toPublic } from "../game/views";
import { getStore } from "./store";

export const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "صار خطأ غير متوقع، حاول مرة ثانية" }, 500);
  }
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new GameError("طلب غير صالح");
  }
}

export function view(game: Game, version: number, role: "host" | "public") {
  const now = Date.now();
  const rt = getStore().kind === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "supabase" : "sse";
  const v = role === "host" ? toHost(game, version, now) : toPublic(game, version, now);
  return { ...v, rt } as const;
}
