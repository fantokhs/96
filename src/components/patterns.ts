// Original geometric motifs used for card backs and category tiles.
import type { PatternId } from "@/lib/game/types";

const TILES: Record<PatternId, { w: number; h: number; body: (s: string) => string }> = {
  // 8-point star made of two squares
  star: {
    w: 56,
    h: 56,
    body: (s) =>
      `<g fill="none" stroke="${s}" stroke-width="1.6"><rect x="16" y="16" width="24" height="24"/><rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)"/></g><circle cx="0" cy="0" r="3" fill="${s}"/><circle cx="56" cy="0" r="3" fill="${s}"/><circle cx="0" cy="56" r="3" fill="${s}"/><circle cx="56" cy="56" r="3" fill="${s}"/>`,
  },
  // diamond lattice
  lattice: {
    w: 36,
    h: 36,
    body: (s) =>
      `<path d="M18 0 36 18 18 36 0 18Z" fill="none" stroke="${s}" stroke-width="1.6"/><path d="M18 12 24 18 18 24 12 18Z" fill="${s}"/>`,
  },
  // Najdi triangular crenellations
  arches: {
    w: 40,
    h: 30,
    body: (s) =>
      `<path d="M0 22 10 8 20 22Z M20 22 30 8 40 22Z" fill="${s}" opacity=".55"/><path d="M0 26H40" stroke="${s}" stroke-width="1.6"/>`,
  },
  chevron: {
    w: 40,
    h: 22,
    body: (s) => `<path d="M0 16 10 6 20 16 30 6 40 16" fill="none" stroke="${s}" stroke-width="2"/>`,
  },
  dots: {
    w: 26,
    h: 26,
    body: (s) => `<circle cx="13" cy="13" r="2.4" fill="${s}"/><path d="M0 -3 3 0 0 3 -3 0Z M26 -3 29 0 26 3 23 0Z M0 23 3 26 0 29 -3 26Z M26 23 29 26 26 29 23 26Z" fill="${s}"/>`,
  },
  waves: {
    w: 60,
    h: 22,
    body: (s) => `<path d="M0 11 Q15 1 30 11 T60 11" fill="none" stroke="${s}" stroke-width="1.8"/>`,
  },
};

export function patternBg(id: PatternId, stroke = "rgba(255,255,255,0.28)"): string {
  const t = TILES[id] ?? TILES.star;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}">${t.body(stroke)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const PATTERN_IDS: PatternId[] = ["star", "lattice", "arches", "chevron", "dots", "waves"];

export const PALETTE = ["#22A06B", "#2F6FDE", "#7E57D8", "#E0548A", "#D6A63A", "#169C9C", "#E07A3A"];

export const TEAM_COLORS = ["#22A06B", "#D6A63A", "#2F6FDE", "#E0548A", "#7E57D8"];
