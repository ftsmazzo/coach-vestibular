"use client";

import { Button } from "@/components/ui";

interface Props {
  totalQuestoes: number;
  cadastradas: number;
  faltando: number[];
  onAdicionar: (numero: number) => void;
  onEditar: (numero: number) => void;
  numerosExistentes: Set<number>;
}

export function AdminProvaCobertura({
  totalQuestoes,
  cadastradas,
  faltando,
  onAdicionar,
  onEditar,
  numerosExistentes,
}: Props) {
  const pct = totalQuestoes > 0 ? Math.round((cadastradas / totalQuestoes) * 100) : 0;
  const completo = faltando.length === 0 && cadastradas >= totalQuestoes;

  return (
    <div
      className={`rounded-xl border p-4 ${
        completo ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Cobertura do banco</h3>
          <p className="mt-1 text-sm text-slate-600">
            <strong>{cadastradas}</strong> de <strong>{totalQuestoes}</strong> questões lógicas
            {totalQuestoes > 0 && ` (${pct}%)`}
          </p>
          {!completo && faltando.length > 0 && (
            <p className="mt-1 text-sm text-amber-800">
              Faltam: {faltando.slice(0, 24).join(", ")}
              {faltando.length > 24 ? ` (+${faltando.length - 24})` : ""}
            </p>
          )}
          {completo && (
            <p className="mt-1 text-sm text-emerald-800">Todas as questões estão no banco.</p>
          )}
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 sm:w-48">
          <div
            className={`h-full transition-all ${completo ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {totalQuestoes > 0 && totalQuestoes <= 120 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {Array.from({ length: totalQuestoes }, (_, i) => i + 1).map((n) => {
            const tem = numerosExistentes.has(n);
            const falta = faltando.includes(n);
            return (
              <button
                key={n}
                type="button"
                title={tem ? `Editar questão ${n}` : `Adicionar questão ${n}`}
                onClick={() => (tem ? onEditar(n) : onAdicionar(n))}
                className={`min-w-[2rem] rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  tem
                    ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                    : falta
                      ? "bg-amber-200 text-amber-950 ring-1 ring-amber-400 hover:bg-amber-300"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}

      {faltando.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {faltando.slice(0, 8).map((n) => (
            <Button key={n} type="button" variant="secondary" className="text-xs" onClick={() => onAdicionar(n)}>
              + Questão {n}
            </Button>
          ))}
          {faltando.length > 8 && (
            <span className="self-center text-xs text-slate-500">
              + {faltando.length - 8} — use a grade acima
            </span>
          )}
        </div>
      )}
    </div>
  );
}
