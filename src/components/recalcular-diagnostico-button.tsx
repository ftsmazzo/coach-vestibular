"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function RecalcularDiagnosticoButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function recalcular() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/exams/${examId}/recalcular`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = await res.json();
    setError(data.error ?? "Erro ao atualizar");
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" disabled={loading} onClick={recalcular}>
        {loading ? "Atualizando..." : "Atualizar diagnóstico e plano"}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
