"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function GerarPlanoJornadaButton({ label = "Gerar plano da semana" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  async function gerar() {
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch("/api/jornada/plano/gerar", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setFeedback({
          tipo: "erro",
          texto: data.error ?? "Não foi possível gerar o plano da semana.",
        });
        return;
      }
      setFeedback({
        tipo: "ok",
        texto: data.mensagem ?? "Plano da semana pronto.",
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
      <Button type="button" disabled={loading} onClick={gerar}>
        {loading ? "Gerando…" : label}
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
              <Link href="/quests#jornada" className="font-medium underline">
                Ver quests →
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
