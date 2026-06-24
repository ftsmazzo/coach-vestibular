"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type Fase = "N1" | "N2" | "N3";

interface Props {
  provaId: string;
  totalQuestoes: number;
  comN1: number;
  comN2Real: number;
  comN2Fallback: number;
  comN3: number;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

type ResultadoFase = {
  ok?: boolean;
  fase?: string;
  total?: number;
  processadas?: number;
  avisos?: string[];
  etapas?: string[];
  mensagem?: string;
  error?: string;
};

export function AdminClassificacaoProva({
  provaId,
  totalQuestoes,
  comN1,
  comN2Real,
  comN2Fallback,
  comN3,
  onMensagem,
  onAtualizado,
}: Props) {
  const [rodando, setRodando] = useState<Fase | null>(null);
  const [ultimo, setUltimo] = useState<ResultadoFase | null>(null);

  const n1CompletoTodas = totalQuestoes > 0 && comN1 === totalQuestoes;
  const n2CompletoTodas =
    totalQuestoes > 0 && comN2Real + comN2Fallback === totalQuestoes;
  const faltamN1 = totalQuestoes - comN1;

  async function rodarFase(fase: Fase) {
    setRodando(fase);
    setUltimo(null);
    onMensagem("");
    const path =
      fase === "N1"
        ? "classificar-n1"
        : fase === "N2"
          ? "classificar-n2"
          : "classificar-n3";

    try {
      const res = await fetch(`/api/admin/provas/${provaId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as ResultadoFase;
      setUltimo(data);
      if (!res.ok) {
        onMensagem(data.error ?? `Erro na fase ${fase}.`);
        return;
      }
      onMensagem(data.mensagem ?? `Fase ${fase} concluída.`);
      onAtualizado();
    } catch {
      onMensagem(`Falha de rede na fase ${fase}.`);
    } finally {
      setRodando(null);
    }
  }

  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <h2 className="mb-2 font-semibold text-violet-900">Passo 5 — Classificação em 3 fases</h2>
      <p className="text-sm text-violet-800">
        Fluxo sequencial: <strong>N1</strong> define o catálogo destino (mat, bio, hist…) em{" "}
        <em>todas</em> as questões → você valida → <strong>N2</strong> classifica o escopo dentro
        desse catálogo → valida → <strong>N3</strong> conhecimento exigido. Uma fase por vez; 1
        questão = 1 chamada IA por fase.
      </p>

      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-5">
        <span>
          Total: <strong>{totalQuestoes}</strong>
        </span>
        <span>
          N1 ok:{" "}
          <strong className={n1CompletoTodas ? "text-emerald-700" : "text-violet-700"}>
            {comN1}/{totalQuestoes}
          </strong>
        </span>
        <span>
          N2 real: <strong className="text-emerald-700">{comN2Real}</strong>
        </span>
        <span>
          N2 fallback: <strong className="text-amber-700">{comN2Fallback}</strong>
        </span>
        <span>
          N3: <strong className="text-sky-700">{comN3}</strong>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={rodando !== null || totalQuestoes === 0}
          onClick={() => rodarFase("N1")}
        >
          {rodando === "N1" ? "N1 rodando…" : "1 · Rodar N1 (roteamento)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={rodando !== null || totalQuestoes === 0 || !n1CompletoTodas}
          onClick={() => rodarFase("N2")}
        >
          {rodando === "N2" ? "N2 rodando…" : "2 · Rodar N2 (escopo)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={rodando !== null || totalQuestoes === 0 || !n2CompletoTodas}
          onClick={() => rodarFase("N3")}
        >
          {rodando === "N3" ? "N3 rodando…" : "3 · Rodar N3 (conhecimento)"}
        </Button>
      </div>

      {faltamN1 > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Fase atual: <strong>N1</strong>. Faltam {faltamN1} questão(ões) — use «Sem N1» na tabela
          ou edite manualmente. Só libera N2 quando {comN1}/{totalQuestoes} tiverem catálogo destino.
        </p>
      )}
      {n1CompletoTodas && !n2CompletoTodas && (
        <p className="mt-2 text-xs text-emerald-800">
          N1 completo em todas. Revise a coluna «N1 catálogo» e rode N2 — a IA já sabe se é mat,
          bio, hist… e classifica o escopo dentro desse catálogo.
        </p>
      )}
      {n2CompletoTodas && comN3 < totalQuestoes && (
        <p className="mt-2 text-xs text-emerald-800">
          N2 completo. Revise escopos na tabela e rode N3.
        </p>
      )}

      {ultimo?.etapas && ultimo.etapas.length > 0 && (
        <details className="mt-4 rounded-lg border border-slate-200 bg-white/80 p-3" open>
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            Log da fase {ultimo.fase ?? ""}
          </summary>
          <ul className="mt-2 max-h-64 overflow-y-auto list-inside list-disc text-xs text-slate-600">
            {ultimo.etapas.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
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
