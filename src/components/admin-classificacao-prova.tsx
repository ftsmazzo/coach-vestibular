"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type Fase = "N1" | "N2" | "N3";

type ModoN1 = "faltantes" | "reprocessarAuto" | "forcarTudo";

interface Props {
  provaId: string;
  totalQuestoes: number;
  extracaoValidada: boolean;
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
  modo?: string;
  total?: number;
  processadas?: number;
  puladas?: number;
  manuaisPreservadas?: number;
  n1Alterados?: number;
  n1Inalterados?: number;
  avisos?: string[];
  etapas?: string[];
  mensagem?: string;
  error?: string;
};

function bodyModoN1(modo: ModoN1): Record<string, boolean> {
  if (modo === "faltantes") return { apenasFaltantes: true };
  if (modo === "reprocessarAuto") return { reprocessarTodas: true, preservarManuais: true };
  return { forcarTudo: true };
}

export function AdminClassificacaoProva({
  provaId,
  totalQuestoes,
  extracaoValidada,
  comN1,
  comN2Real,
  comN2Fallback,
  comN3,
  onMensagem,
  onAtualizado,
}: Props) {
  const [rodando, setRodando] = useState<Fase | null>(null);
  const [ultimo, setUltimo] = useState<ResultadoFase | null>(null);
  const [n2QuestoesInput, setN2QuestoesInput] = useState("");

  const n1CompletoTodas = totalQuestoes > 0 && comN1 === totalQuestoes;
  const n2CompletoTodas =
    totalQuestoes > 0 && comN2Real + comN2Fallback === totalQuestoes;
  const faltamN1 = totalQuestoes - comN1;
  const faltamN2Real = totalQuestoes - comN2Real;

  function parseNumerosQuestao(texto: string): number[] {
    const nums = texto
      .split(/[,;\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(nums)].sort((a, b) => a - b);
  }

  function rodarN2Selecionadas() {
    const numeros = parseNumerosQuestao(n2QuestoesInput);
    if (numeros.length === 0) {
      onMensagem("Informe ao menos um número de questão (ex.: 37, 47, 49).");
      return;
    }
    void rodarFase("N2", { numerosQuestao: numeros });
  }

  async function rodarFase(
    fase: Fase,
    opts?: { apenasFaltantes?: boolean; modoN1?: ModoN1; numerosQuestao?: number[] }
  ) {
    if (fase === "N1" && opts?.modoN1 === "forcarTudo") {
      const ok = window.confirm(
        "Reprocessar N1 em TODAS as questões, inclusive as corrigidas manualmente?\n\n" +
          "Correções manuais serão sobrescritas. N2/N3 serão limpos quando o catálogo mudar."
      );
      if (!ok) return;
    }

    setRodando(fase);
    setUltimo(null);
    onMensagem("");
    const path =
      fase === "N1"
        ? "classificar-n1"
        : fase === "N2"
          ? "classificar-n2"
          : "classificar-n3";

    const body =
      fase === "N1" && opts?.modoN1
        ? bodyModoN1(opts.modoN1)
        : fase === "N2" && opts?.numerosQuestao?.length
          ? { numerosQuestao: opts.numerosQuestao }
          : opts?.apenasFaltantes
            ? { apenasFaltantes: true }
            : {};

    try {
      const res = await fetch(`/api/admin/provas/${provaId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        Fluxo sequencial: <strong>N1</strong> define o catálogo destino (mat, bio, hist…) → você
        valida → <strong>N2</strong> classifica o escopo dentro desse catálogo → valida →{" "}
        <strong>N3</strong> conhecimento exigido. Se o N1 mudar, N2 e N3 da questão são limpos
        automaticamente.
      </p>

      {!extracaoValidada && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Confirme a extração no <strong>Passo 3</strong> antes de rodar N1/N2/N3. Você pode corrigir
          enunciados a qualquer momento — a classificação já feita permanece visível na tabela abaixo.
        </p>
      )}

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

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-violet-900">N1 — escolha o modo antes de rodar</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={rodando !== null || totalQuestoes === 0 || !extracaoValidada || faltamN1 === 0}
            onClick={() => rodarFase("N1", { modoN1: "faltantes" })}
          >
            {rodando === "N1" ? "N1 rodando…" : `1a · N1 faltantes (${faltamN1})`}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={rodando !== null || totalQuestoes === 0 || !extracaoValidada}
            onClick={() => rodarFase("N1", { modoN1: "reprocessarAuto" })}
          >
            {rodando === "N1"
              ? "N1 rodando…"
              : "1b · Reprocessar N1 automático"}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={rodando !== null || totalQuestoes === 0 || !extracaoValidada}
            onClick={() => rodarFase("N1", { modoN1: "forcarTudo" })}
          >
            {rodando === "N1" ? "N1 rodando…" : "1c · N1 tudo (incl. manuais)"}
          </Button>
        </div>
        <p className="text-xs text-slate-600">
          <strong>Faltantes</strong> — só sem N1.{" "}
          <strong>Reprocessar automático</strong> — recalcula N1 já gravado (preserva manuais); limpa
          N2/N3 se o catálogo mudar.{" "}
          <strong>Tudo</strong> — sobrescreve inclusive correções manuais.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={rodando !== null || totalQuestoes === 0 || !extracaoValidada || !n1CompletoTodas}
            onClick={() => rodarFase("N2")}
          >
            {rodando === "N2" ? "N2 rodando…" : "2 · Rodar N2 (todas)"}
          </Button>
          {faltamN2Real > 0 && n1CompletoTodas && (
            <Button
              type="button"
              variant="secondary"
              disabled={rodando !== null || !extracaoValidada}
              onClick={() => rodarFase("N2", { apenasFaltantes: true })}
            >
              {rodando === "N2" ? "N2 rodando…" : `2b · N2 só faltantes (${faltamN2Real})`}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={rodando !== null || totalQuestoes === 0 || !extracaoValidada || !n2CompletoTodas}
            onClick={() => rodarFase("N3")}
          >
            {rodando === "N3" ? "N3 rodando…" : "3 · Rodar N3 (conhecimento)"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium text-violet-900">2c · N2 em questões específicas</span>
            <input
              type="text"
              value={n2QuestoesInput}
              onChange={(e) => setN2QuestoesInput(e.target.value)}
              placeholder="Ex.: 37, 47, 49, 58, 70"
              disabled={rodando !== null || !extracaoValidada || !n1CompletoTodas}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={
              rodando !== null ||
              totalQuestoes === 0 ||
              !extracaoValidada ||
              !n1CompletoTodas ||
              !n2QuestoesInput.trim()
            }
            onClick={rodarN2Selecionadas}
          >
            {rodando === "N2" ? "N2 rodando…" : "Rodar N2 selecionadas"}
          </Button>
        </div>
        <p className="text-xs text-slate-600">
          <strong>2c</strong> — reprocessa só os números informados, mesmo que já tenham escopo
          (útil após corrigir N1 ou atualizar catálogo). Separe por vírgula ou espaço.
        </p>
      </div>

      {faltamN1 > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Faltam {faltamN1} questão(ões) sem N1 — use «N1 faltantes» ou edite manualmente na tabela.
        </p>
      )}
      {n1CompletoTodas && !n2CompletoTodas && (
        <p className="mt-2 text-xs text-emerald-800">
          N1 completo em todas. Após refinamentos no código, use «Reprocessar N1 automático» antes de
          rodar N2 de novo.
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
            {ultimo.modo ? ` (${ultimo.modo})` : ""}
            {ultimo.n1Alterados != null ? ` · ${ultimo.n1Alterados} alterados` : ""}
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
