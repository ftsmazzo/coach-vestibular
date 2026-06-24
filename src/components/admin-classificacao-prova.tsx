"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

interface Props {
  provaId: string;
  totalQuestoes: number;
  classificadas: number;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

type ResultadoLote = {
  ok?: boolean;
  total?: number;
  classificadas?: number;
  processadas?: number;
  semTexto?: number;
  avisos?: string[];
  etapas?: string[];
  mensagem?: string;
  error?: string;
};

export function AdminClassificacaoProva({
  provaId,
  totalQuestoes,
  classificadas,
  onMensagem,
  onAtualizado,
}: Props) {
  const [rodando, setRodando] = useState(false);
  const [ultimo, setUltimo] = useState<ResultadoLote | null>(null);

  async function classificarTodas() {
    setRodando(true);
    setUltimo(null);
    onMensagem("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/reclassificar-lote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as ResultadoLote;
      setUltimo(data);
      if (!res.ok) {
        onMensagem(data.error ?? "Erro na classificação.");
        return;
      }
      onMensagem(data.mensagem ?? "Classificação concluída.");
      onAtualizado();
    } catch {
      onMensagem("Falha de rede ao classificar.");
    } finally {
      setRodando(false);
    }
  }

  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <h2 className="mb-2 font-semibold text-violet-900">Passo 5 — Classificação N2</h2>
      <p className="text-sm text-violet-800">
        Roteamento disciplinar (Humanas: hist/geo/fil/soc · Linguagens: pt/ing/esp) e escopo N2
        no catálogo correto. Requer extração validada e{" "}
        <code className="text-xs">OPENAI_API_KEY</code> no servidor.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <span>
          Questões no banco: <strong>{totalQuestoes}</strong>
        </span>
        <span>
          Com escopo N2: <strong>{classificadas}</strong>
        </span>
      </div>

      <Button
        type="button"
        className="mt-4"
        disabled={rodando || totalQuestoes === 0}
        onClick={classificarTodas}
      >
        {rodando ? "Classificando… (pode levar minutos)" : "Classificar todas as questões"}
      </Button>

      {ultimo?.etapas && ultimo.etapas.length > 0 && (
        <ul className="mt-4 list-inside list-disc text-xs text-slate-600">
          {ultimo.etapas.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {ultimo?.avisos && ultimo.avisos.length > 0 && (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <summary className="cursor-pointer text-sm font-medium text-amber-900">
            Avisos ({ultimo.avisos.length})
          </summary>
          <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-amber-900">
            {ultimo.avisos.map((a) => (
              <li key={a} className="mt-1">
                {a}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
