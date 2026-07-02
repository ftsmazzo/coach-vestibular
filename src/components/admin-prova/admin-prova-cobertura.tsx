"use client";

import { Button } from "@/components/ui";

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
  const pct = totalQuestoes > 0 ? Math.round((cadastradas / totalQuestoes) * 100) : 0;
  const revisaoSet = new Set(revisaoImagem);
  const completo =
    faltando.length === 0 && revisaoImagem.length === 0 && cadastradas >= totalQuestoes;

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
          {revisaoImagem.length > 0 && (
            <p className="mt-1 text-sm text-violet-800">
              Revisar imagem: {revisaoImagem.slice(0, 24).join(", ")}
              {revisaoImagem.length > 24 ? ` (+${revisaoImagem.length - 24})` : ""}
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
        <>
          <div className="mt-4 flex flex-wrap gap-1">
            {Array.from({ length: totalQuestoes }, (_, i) => i + 1).map((n) => {
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
                        ? `Questão ${n} — revisar alternativas em imagem`
                        : tem
                          ? `Editar questão ${n}`
                          : `Questão ${n}`
                  }
                  onClick={() => (tem ? onEditar(n) : onAdicionar(n))}
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
            <span className="inline-block rounded bg-violet-100 px-1">roxo</span> revisar imagem ·{" "}
            <span className="inline-block rounded bg-amber-200 px-1">âmbar</span> faltando
          </p>
        </>
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

      {revisaoImagem.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {revisaoImagem.slice(0, 6).map((n) => (
            <Button
              key={n}
              type="button"
              variant="secondary"
              className="border-violet-200 text-xs text-violet-900"
              onClick={() => onEditar(n)}
            >
              Revisar Q{n}
            </Button>
          ))}
          {revisaoImagem.length > 6 && (
            <span className="self-center text-xs text-slate-500">
              + {revisaoImagem.length - 6} — use a grade roxa
            </span>
          )}
        </div>
      )}
    </div>
  );
}
