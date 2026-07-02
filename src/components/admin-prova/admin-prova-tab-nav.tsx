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
}

export function AdminProvaTabNav({ aba, onChange, alertaQuestoes, alertaPedagogia }: Props) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
      {ABAS.map((item) => {
        const ativo = aba === item.id;
        const alerta =
          (item.id === "questoes" && alertaQuestoes) ||
          (item.id === "pedagogia" && alertaPedagogia);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`relative rounded-t-xl px-4 py-2.5 text-left transition-colors ${
              ativo
                ? "bg-white border border-b-white border-slate-200 -mb-px shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className={`block text-sm font-semibold ${ativo ? "text-slate-900" : ""}`}>
              {item.label}
              {alerta && !ativo && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" title="Ação pendente" />
              )}
            </span>
            <span className="block text-xs text-slate-500">{item.descricao}</span>
          </button>
        );
      })}
    </nav>
  );
}
