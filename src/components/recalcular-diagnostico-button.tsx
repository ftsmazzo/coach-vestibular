"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function RecalcularDiagnosticoButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function recalcular() {
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/exams/${examId}/recalcular`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setSuccess(
        typeof data.mensagem === "string"
          ? data.mensagem
          : "Diagnóstico e plano atualizados. Confira em Plano."
      );
      router.refresh();
      return;
    }
    setError(data.error ?? "Erro ao atualizar");
  }

  return (
    <div className="inline-flex flex-col items-start gap-1 max-w-md">
      <Button type="button" variant="secondary" disabled={loading} onClick={recalcular}>
        {loading ? "Atualizando..." : "Atualizar diagnóstico e plano"}
      </Button>
      {success && <p className="text-xs text-teal-800">{success}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
