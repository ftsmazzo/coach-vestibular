"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function RegenerarPlanoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function regenerar() {
    if (
      !confirm(
        "Apagar planos e tarefas antigos do copiloto e recriar tudo com os registros atuais da jornada? (Provas e gabaritos não são apagados.)"
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/plano/regenerar", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Não foi possível atualizar o plano");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" disabled={loading} onClick={regenerar}>
      {loading ? "Atualizando…" : "Atualizar plano pela jornada"}
    </Button>
  );
}
