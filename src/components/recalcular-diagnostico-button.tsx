"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  examId: string;
  /** Texto do botão (padrão: refazer diagnóstico e plano) */
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
};

export function RecalcularDiagnosticoButton({
  examId,
  label = "Refazer diagnóstico e plano",
  variant = "primary",
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function recalcular() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/exams/${examId}/recalcular`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
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
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex w-full flex-col gap-1 sm:max-w-md ${className}`}>
      <Button
        type="button"
        variant={variant}
        disabled={loading}
        aria-busy={loading}
        className="w-full sm:w-auto"
        onClick={recalcular}
      >
        {loading ? "Atualizando..." : label}
      </Button>
      {success && <p className="text-xs text-teal-800">{success}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
