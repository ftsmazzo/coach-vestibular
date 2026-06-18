"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";

export function GerarMicroPlanoConjuntoButton({ conjuntoExamId }: { conjuntoExamId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function gerar() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/provas/conjunto/${encodeURIComponent(conjuntoExamId)}/micro-plano`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? "Erro");
      return;
    }
    setMsg(data.mensagem ?? "Micro-plano criado!");
    router.refresh();
  }

  const questsHref = `/quests?conjuntoId=${encodeURIComponent(conjuntoExamId)}`;

  return (
    <div className="space-y-3">
      <Button type="button" onClick={gerar} disabled={loading} className="w-full sm:w-auto">
        {loading ? "Analisando prova completa…" : "Gerar análise + micro-plano (180 questões)"}
      </Button>
      {msg && <p className="text-sm font-medium text-teal-800">{msg}</p>}
      <p className="text-xs text-teal-800">
        Depois de gerar, abra{" "}
        <Link href={questsHref} className="font-medium underline">
          Quests desta prova (180q)
        </Link>
        .
      </p>
    </div>
  );
}
