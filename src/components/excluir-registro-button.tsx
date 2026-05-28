"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function ExcluirRegistroButton({
  examId,
  nome,
  variant = "ghost",
  redirectTo = "/simulados",
}: {
  examId: string;
  nome: string;
  variant?: "ghost" | "secondary" | "danger";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function excluir() {
    if (
      !confirm(
        `Excluir o registro "${nome}"? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push(redirectTo);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Erro ao excluir");
    }
  }

  return (
    <Button type="button" variant={variant} disabled={loading} onClick={excluir}>
      {loading ? "Removendo..." : "Remover registro"}
    </Button>
  );
}
