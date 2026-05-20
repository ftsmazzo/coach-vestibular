"use client";

interface GabaritoGridProps {
  total: number;
  acertos: Set<number>;
  onToggle: (numero: number) => void;
  onMarkAllCorrect: () => void;
}

export function GabaritoGrid({
  total,
  acertos,
  onToggle,
  onMarkAllCorrect,
}: GabaritoGridProps) {
  const erros = total - acertos.size;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">
          Clique para marcar <strong>erro</strong> (vermelho). Verde = acertou.
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
          {acertos.size} acertos
        </span>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">{erros} erros</span>
        <button
          type="button"
          className="text-teal-700 underline"
          onClick={onMarkAllCorrect}
        >
          Marcar todas certas
        </button>
      </div>
      <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-12">
        {Array.from({ length: total }, (_, i) => {
          const numero = i + 1;
          const certa = acertos.has(numero);
          return (
            <button
              key={numero}
              type="button"
              title={`Questão ${numero}`}
              onClick={() => onToggle(numero)}
              className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition ${
                certa
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                  : "bg-rose-100 text-rose-800 ring-1 ring-rose-300"
              }`}
            >
              {numero}
            </button>
          );
        })}
      </div>
    </div>
  );
}
