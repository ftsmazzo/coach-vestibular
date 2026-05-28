"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";

export function GerarMicroPlanoButton({ provaId }: { provaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function gerar() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/provas/${provaId}/micro-plano`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? "Erro");
      return;
    }
    setMsg(data.mensagem ?? "Micro-plano criado!");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={gerar} disabled={loading} className="w-full sm:w-auto">
        {loading ? "Analisando esta prova…" : "Gerar análise + micro-plano (IA)"}
      </Button>
      {msg && <p className="text-sm font-medium text-teal-800">{msg}</p>}
      <p className="text-xs text-teal-800">
        Depois de gerar, abra{" "}
        <Link href={`/quests?provaId=${provaId}`} className="font-medium underline">
          Quests desta prova
        </Link>
        .
      </p>
    </div>
  );
}
