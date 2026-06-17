"use client";

import type { ConfiancaExtracao, LinhaRevisaoGabarito } from "@/lib/extrair-gabarito-aluno";

export type { LinhaRevisaoGabarito };

const LETRAS = ["A", "B", "C", "D", "E"] as const;

function classeConfianca(confianca: ConfiancaExtracao, temLetra: boolean): string {
  if (!temLetra) return "ring-1 ring-amber-300 bg-amber-50/80";
  if (confianca === "baixa") return "ring-1 ring-amber-200 bg-amber-50/50";
  if (confianca === "media") return "ring-1 ring-slate-200 bg-slate-50";
  return "bg-white";
}

function linhaPreenchida(linha: LinhaRevisaoGabarito, dual: boolean): boolean {
  if (dual && linha.letraEn !== undefined) {
    return Boolean(linha.letraEn || linha.letraEs);
  }
  return Boolean(linha.letra);
}

export function GabaritoRevisaoGrid({
  linhas,
  onChange,
  avisos = [],
  lidas,
  faixaIdiomaDual,
}: {
  linhas: LinhaRevisaoGabarito[];
  onChange: (linhas: LinhaRevisaoGabarito[]) => void;
  avisos?: string[];
  lidas?: number;
  /** Admin: questões 1–5 (ou faixa) com gabarito EN e ES separados */
  faixaIdiomaDual?: { inicio: number; fim: number } | null;
}) {
  const preenchidas = linhas.filter((l) =>
    linhaPreenchida(l, Boolean(faixaIdiomaDual && l.numero >= faixaIdiomaDual.inicio && l.numero <= faixaIdiomaDual.fim))
  ).length;

  function atualizar(numero: number, letra: string) {
    onChange(
      linhas.map((l) =>
        l.numero === numero
          ? { ...l, letra: letra.toUpperCase(), confianca: letra ? "alta" : l.confianca }
          : l
      )
    );
  }

  function atualizarDual(numero: number, trilha: "En" | "Es", letra: string) {
    onChange(
      linhas.map((l) => {
        if (l.numero !== numero) return l;
        const key = trilha === "En" ? "letraEn" : "letraEs";
        const atual = l[key] ?? "";
        return {
          ...l,
          [key]: atual === letra.toUpperCase() ? "" : letra.toUpperCase(),
          confianca: "alta" as const,
        };
      })
    );
  }

  function renderBotoes(letraAtual: string, onPick: (L: string) => void, prefix: string) {
    return LETRAS.map((L) => (
      <button
        key={`${prefix}-${L}`}
        type="button"
        onClick={() => onPick(letraAtual === L ? "" : L)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
          letraAtual === L
            ? "bg-teal-600 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
        aria-label={`Questão ${prefix} alternativa ${L}`}
      >
        {L}
      </button>
    ));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <p>
          <strong>{preenchidas}</strong> de {linhas.length} questões com resposta.
          {lidas != null && (
            <span className="text-slate-500"> · IA leu ~{lidas} marcação(ões)</span>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Revise linhas em destaque (amarelo) antes de confirmar. Toque na letra correta.
          {faixaIdiomaDual && (
            <span>
              {" "}
              Na faixa {faixaIdiomaDual.inicio}–{faixaIdiomaDual.fim}, marque inglês e espanhol
              separadamente.
            </span>
          )}
        </p>
      </div>

      {avisos.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}

      <div className="max-h-[min(420px,55vh)] overflow-y-auto rounded-lg border border-slate-200">
        <ul className="divide-y divide-slate-100">
          {linhas.map((linha) => {
            const dual =
              faixaIdiomaDual &&
              linha.numero >= faixaIdiomaDual.inicio &&
              linha.numero <= faixaIdiomaDual.fim;

            if (dual) {
              const temAlguma = Boolean(linha.letraEn || linha.letraEs);
              return (
                <li
                  key={linha.numero}
                  className={`space-y-2 px-2 py-3 sm:px-3 ${classeConfianca(linha.confianca, temAlguma)}`}
                >
                  <span className="text-sm font-semibold tabular-nums text-slate-800">
                    {linha.numero}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-medium text-slate-600">Inglês</span>
                    <div className="flex flex-wrap gap-1">
                      {renderBotoes(linha.letraEn ?? "", (L) => atualizarDual(linha.numero, "En", L), `${linha.numero}-en`)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-medium text-slate-600">Espanhol</span>
                    <div className="flex flex-wrap gap-1">
                      {renderBotoes(linha.letraEs ?? "", (L) => atualizarDual(linha.numero, "Es", L), `${linha.numero}-es`)}
                    </div>
                  </div>
                </li>
              );
            }

            const temLetra = Boolean(linha.letra);
            return (
              <li
                key={linha.numero}
                className={`flex flex-wrap items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 ${classeConfianca(
                  linha.confianca,
                  temLetra
                )}`}
              >
                <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                  {linha.numero}
                </span>
                <div className="flex flex-1 flex-wrap gap-1">
                  {renderBotoes(linha.letra, (L) => atualizar(linha.numero, L), String(linha.numero))}
                </div>
                {!temLetra && (
                  <span className="text-[10px] text-amber-700 sm:ml-auto">vazio</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
