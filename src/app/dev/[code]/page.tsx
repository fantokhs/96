"use client";
// Test bench: TV + 4 phones on one screen. Open the host console in another tab.
import { use } from "react";

export default function DevBench({ params }: { params: Promise<{ code: string }> }) {
  const code = use(params).code.toUpperCase();
  const phones = [1, 2, 3, 4];
  return (
    <main className="flex h-dvh flex-col gap-2 bg-ink p-2">
      <iframe title="tv" src={`/screen/${code}`} className="h-[52%] w-full rounded-lg border border-cream/10" />
      <div className="grid flex-1 grid-cols-4 gap-2">
        {phones.map((n) => (
          <iframe key={n} title={`p${n}`} src={`/play/${code}?slot=${n}`} className="h-full w-full rounded-lg border border-cream/10" />
        ))}
      </div>
    </main>
  );
}
