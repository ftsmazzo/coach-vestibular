"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function XpToastFromUrl() {
  const searchParams = useSearchParams();
  const [msgs, setMsgs] = useState<string[]>([]);

  useEffect(() => {
    const raw = searchParams.get("xp");
    if (!raw) return;
    const lista = raw.split("|").filter(Boolean);
    if (lista.length > 0) setMsgs(lista);
  }, [searchParams]);

  if (msgs.length === 0) return null;

  return (
    <div className="space-y-2">
      {msgs.map((m, i) => (
        <p
          key={i}
          className="animate-pulse rounded-xl border border-violet-300 bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm"
        >
          {m}
        </p>
      ))}
    </div>
  );
}
