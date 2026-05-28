"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function RegenerarPlanoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  async function regenerar() {
    if (
      !confirm(
        "Apagar planos e tarefas antigos do copiloto e recriar tudo com os dados atuais? (Provas e gabaritos não são apagados.)"
      )
    ) {
      return;
    }
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch("/api/plano/regenerar", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          tipo: "erro",
          texto: data.error ?? "Não foi possível atualizar o plano.",
        });
        return;
      }
      setFeedback({
        tipo: "ok",
        texto: data.mensagem ?? "Plano atualizado.",
      });
      router.refresh();
    } catch {
      setFeedback({
        tipo: "erro",
        texto: "Falha de rede — verifique a conexão e tente de novo.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" disabled={loading} onClick={regenerar}>
        {loading ? "Atualizando…" : "Atualizar plano pela jornada"}
      </Button>

      {feedback && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.tipo === "ok"
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.texto}
          {feedback.tipo === "ok" && (
            <>
              {" "}
              <Link href="/quests#agora" className="font-medium underline">
                Ver tarefas →
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
