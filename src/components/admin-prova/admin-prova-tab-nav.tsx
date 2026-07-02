"use client";

import type { AbaProvaAdmin } from "./types";

const ABAS: { id: AbaProvaAdmin; label: string; descricao: string }[] = [
  { id: "prova", label: "Prova", descricao: "Cadastro e caderno" },
  { id: "questoes", label: "Questões", descricao: "Extrair e completar" },
  { id: "pedagogia", label: "Pedagogia", descricao: "Gabarito e classificação" },
];

interface Props {
  aba: AbaProvaAdmin;
  onChange: (aba: AbaProvaAdmin) => void;
  alertaQuestoes?: boolean;
  alertaPedagogia?: boolean;
  hintQuestoes?: string | null;
  hintPedagogia?: string | null;
}

export function AdminProvaTabNav({
  aba,
  onChange,
  alertaQuestoes,
  alertaPedagogia,
  hintQuestoes,
  hintPedagogia,
}: Props) {
  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1"
      aria-label="Seções da prova"
    >
      {ABAS.map((item) => {
        const ativo = aba === item.id;
        const alerta =
          (item.id === "questoes" && alertaQuestoes) ||
          (item.id === "pedagogia" && alertaPedagogia);
        const hint = item.id === "questoes" ? hintQuestoes : item.id === "pedagogia" ? hintPedagogia : null;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            title={hint ?? undefined}
            className={`min-w-[7.5rem] flex-1 rounded-lg px-3 py-2.5 text-left transition-colors sm:flex-none ${
              ativo
                ? "bg-white shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
          >
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${ativo ? "text-slate-900" : ""}`}>
              {item.label}
              {alerta && (
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500`}
                  aria-hidden
                />
              )}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {alerta && hint ? hint : item.descricao}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
