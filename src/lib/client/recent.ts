"use client";
import { local } from "./api";

export interface RecentGame {
  code: string;
  name: string;
  at: number;
}

const KEY = "96:recent";

export function recentGames(): RecentGame[] {
  const list = local.get<RecentGame[]>(KEY) ?? [];
  return list.filter((r) => r && typeof r.code === "string").sort((a, b) => b.at - a.at);
}

/** Remember (or bump) a session in this device's recent list. */
export function rememberGame(code: string, name: string) {
  const rest = recentGames().filter((r) => r.code !== code);
  local.set(KEY, [{ code, name, at: Date.now() }, ...rest].slice(0, 12));
}

export function forgetGame(code: string) {
  local.set(KEY, recentGames().filter((r) => r.code !== code));
}
