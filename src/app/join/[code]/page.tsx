"use client";
import { use, useEffect, useState } from "react";
import { APP_VERSION, FullScreenMessage, Logo96, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";

/** Universal family link (one QR): join the game, or fill «وش تعرف عنه؟ 👀». Works any time. */
export default function JoinHub({ params }: { params: Promise<{ code: string }> }) {
  const code = use(params).code.toUpperCase();
  const [info, setInfo] = useState<{ name: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<{ name: string }>(`/api/know/${code}`)
      .then(setInfo)
      .catch((e) => setErr(e.message));
  }, [code]);

  if (err) return <FullScreenMessage title={err} />;
  if (!info)
    return (
      <main className="bg-majlis flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    );

  return (
    <main className="bg-majlis mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <Logo96 size={96} />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black">{info.name}</h1>
        <p className="text-cream/60">
          كود اللعبة: <span className="num font-bold tracking-widest text-goldlight">{code}</span>
        </p>
      </div>
      <div className="grid w-full gap-3">
        <a className="btn btn-gold py-5 text-2xl" href={`/play/${code}`}>
          انضم للعبة 🎮
        </a>
        <a className="btn btn-ghost py-4 text-xl" href={`/know/${code}`}>
          وش تعرف عنه؟ 👀
        </a>
      </div>
      <p className="text-sm text-cream/50">عبّ عن نفسك أو عن أي أحد من العائلة — ولا تعلم أحد وش كتبت 🤫</p>
      <footer className="pt-4 text-xs text-cream/30">
        <span className="num">{APP_VERSION}</span>
      </footer>
    </main>
  );
}
