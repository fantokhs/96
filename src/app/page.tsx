"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo96 } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return (
    <main className="bg-majlis flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="anim-rise flex flex-col items-center gap-3 text-center">
        <Logo96 size={110} />
        <p className="max-w-sm text-cream/70">لعبة العائلة والمجلس — التلفزيون مسرح، والجوال يدك في اللعبة</p>
      </div>

      <form
        className="anim-rise panel flex w-full max-w-sm flex-col gap-3 p-5"
        style={{ animationDelay: "80ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (clean.length >= 4) router.push(`/play/${clean}`);
        }}
      >
        <label className="text-sm font-semibold text-cream/70" htmlFor="code">
          عندك كود؟ ادخل اللعبة
        </label>
        <input
          id="code"
          className="field num text-center text-3xl font-bold tracking-[0.3em] uppercase"
          placeholder="AB96"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          value={clean}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn btn-gold text-lg" disabled={clean.length < 4}>
          دخول
        </button>
      </form>

      <div className="anim-rise flex flex-col items-center gap-3" style={{ animationDelay: "160ms" }}>
        <Link href="/admin" className="btn btn-ghost">
          إنشاء لعبة جديدة
        </Link>
      </div>
    </main>
  );
}
