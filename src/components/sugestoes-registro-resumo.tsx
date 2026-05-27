"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

type Sugestao = {
  numero: number;
  status: string;
  xpConcedido: number;
};

export function SugestoesRegistroResumo({ examId }: { examId: string }) {
  const [lista, setLista] = useState<Sugestao[]>([]);

  useEffect(() => {
    fetch(`/api/exams/${examId}/sugestoes-classificacao`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLista(data);
      });
  }, [examId]);

  if (lista.length === 0) return null;

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2">
      <p className="text-xs font-medium text-violet-900">Suas sugestões neste registro</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {lista.map((s) => (
          <li key={s.numero}>
            <Badge
              tone={
                s.status === "ACEITA"
                  ? "success"
                  : s.status === "PENDENTE"
                    ? "warning"
                    : "neutral"
              }
            >
              Q{s.numero}:{" "}
              {s.status === "ACEITA"
                ? `aceita (+${s.xpConcedido} XP)`
                : s.status === "PENDENTE"
                  ? "em revisão"
                  : "não aplicada"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
