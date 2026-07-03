"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import { LABEL_TEXTO_INCOMPLETO } from "@/lib/prova-pendencias-admin";

interface Props {
  totalQuestoes: number;
  cadastradas: number;
  faltando: number[];
  revisaoImagem: number[];
  onAdicionar: (numero: number) => void;
  onEditar: (numero: number) => void;
  numerosExistentes: Set<number>;
}

export function AdminProvaCobertura({
  totalQuestoes,
  cadastradas,
  faltando,
  revisaoImagem,
  onAdicionar,
  onEditar,
  numerosExistentes,
}: Props) {
  const [buscaNumero, setBuscaNumero] = useState("");
  const pct = totalQuestoes > 0 ? Math.round((cadastradas / totalQuestoes) * 100) : 0;
  const revisaoSet = new Set(revisaoImagem);
  const completo =
    faltando.length === 0 && revisaoImagem.length === 0 && cadastradas >= totalQuestoes;

  const numerosVisiveis = useMemo(() => {
    const todos = Array.from({ length: totalQuestoes }, (_, i) => i + 1);
    const q = parseInt(buscaNumero.trim(), 10);
    if (Number.isFinite(q) && q >= 1 && q <= totalQuestoes) return [q];
    return todos;
  }, [totalQuestoes, buscaNumero]);

  const gradeGrande = totalQuestoes > 120;

  return (
    <div
      className={`rounded-xl border p-4 ${
        completo
          ? "border-emerald-200 bg-emerald-50/60"
          : faltando.length > 0
            ? "border-amber-200 bg-amber-50/40"
            : revisaoImagem.length > 0
              ? "border-violet-200 bg-violet-50/30"
              : "border-slate-200 bg-slate-50/50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">Cobertura do banco</h3>
          <p className="mt-1 text-sm text-slate-600">
            <strong>{cadastradas}</strong> de <strong>{totalQuestoes}</strong> questões esperadas
            {totalQuestoes > 0 && ` (${pct}%)`}
          </p>
          {!completo && faltando.length > 0 && (
            <p className="mt-1 text-sm text-amber-800">
              Ausentes: {faltando.slice(0, 20).join(", ")}
              {faltando.length > 20 ? ` (+${faltando.length - 20})` : ""}
            </p>
          )}
          {revisaoImagem.length > 0 && (
            <p className="mt-1 text-sm text-violet-800">
              {LABEL_TEXTO_INCOMPLETO}: {revisaoImagem.slice(0, 20).join(", ")}
              {revisaoImagem.length > 20 ? ` (+${revisaoImagem.length - 20})` : ""}
            </p>
          )}
          {completo && (
            <p className="mt-1 text-sm text-emerald-800">Cobertura completa e revisada.</p>
          )}
        </div>
        <div className="w-full max-w-[12rem] shrink-0 sm:w-40">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${completo ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-500">{pct}%</p>
        </div>
      </div>

      {totalQuestoes > 0 && (
        <>
          {gradeGrande && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[8rem] flex-1 sm:max-w-[10rem]">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Ir para questão
                </label>
                <Input
                  type="number"
                  min={1}
                  max={totalQuestoes}
                  placeholder={`1–${totalQuestoes}`}
                  value={buscaNumero}
                  onChange={(e) => setBuscaNumero(e.target.value)}
                />
              </div>
              {buscaNumero && (
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => setBuscaNumero("")}
                >
                  Ver todas
                </Button>
              )}
              <p className="w-full text-xs text-slate-500">
                Prova com {totalQuestoes} questões — use o campo acima ou role a grade.
              </p>
            </div>
          )}

          <div
            className={`mt-3 flex flex-wrap gap-1 ${gradeGrande && !buscaNumero ? "max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-white/60 p-2" : ""}`}
          >
            {numerosVisiveis.map((n) => {
              const tem = numerosExistentes.has(n);
              const falta = faltando.includes(n);
              const revisar = revisaoSet.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  title={
                    falta
                      ? `Adicionar questão ${n}`
                      : revisar
                        ? `Questão ${n} — ${LABEL_TEXTO_INCOMPLETO.toLowerCase()}`
                        : tem
                          ? `Editar questão ${n}`
                          : `Questão ${n}`
                  }
                  onClick={() => (falta ? onAdicionar(n) : onEditar(n))}
                  className={`min-w-[2rem] rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                    falta
                      ? "bg-amber-200 text-amber-950 ring-1 ring-amber-400 hover:bg-amber-300"
                      : revisar
                        ? "bg-violet-100 text-violet-950 ring-1 ring-violet-400 hover:bg-violet-200"
                        : tem
                          ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            <span className="inline-block rounded bg-emerald-100 px-1">verde</span> ok ·{" "}
            <span className="inline-block rounded bg-violet-100 px-1">roxo</span>{" "}
            {LABEL_TEXTO_INCOMPLETO.toLowerCase()} ·{" "}
            <span className="inline-block rounded bg-amber-200 px-1">âmbar</span> ausente
          </p>
        </>
      )}

      {faltando.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
          {faltando.slice(0, 8).map((n) => (
            <Button
              key={n}
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => onAdicionar(n)}
            >
              + Questão {n}
            </Button>
          ))}
          {faltando.length > 8 && (
            <span className="self-center text-xs text-slate-500">
              + {faltando.length - 8} ausentes
            </span>
          )}
        </div>
      )}

      {revisaoImagem.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-violet-200/60 pt-3">
          {revisaoImagem.slice(0, 6).map((n) => (
            <Button
              key={n}
              type="button"
              variant="secondary"
              className="border-violet-200 text-xs text-violet-900"
              onClick={() => onEditar(n)}
            >
              Completar Q{n}
            </Button>
          ))}
          {revisaoImagem.length > 6 && (
            <span className="self-center text-xs text-slate-500">
              + {revisaoImagem.length - 6} pendentes
            </span>
          )}
        </div>
      )}
    </div>
  );
}
