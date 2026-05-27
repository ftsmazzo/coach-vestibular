"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div>
      <Button type="button" onClick={gerar} disabled={loading}>
        {loading ? "Gerando..." : "Gerar micro-plano + quests desta prova"}
      </Button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  );
}
