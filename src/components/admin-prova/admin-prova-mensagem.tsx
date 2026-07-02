"use client";

interface Props {
  mensagem: string;
  onFechar: () => void;
}

export function AdminProvaMensagem({ mensagem, onFechar }: Props) {
  const erro = mensagem.includes("Erro") || mensagem.includes("Falha") || mensagem.includes("Não foi");

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${
        erro ? "bg-rose-50 text-rose-900 ring-1 ring-rose-100" : "bg-teal-50 text-teal-950 ring-1 ring-teal-100"
      }`}
      role="status"
    >
      <p className="min-w-0 flex-1">{mensagem}</p>
      <button
        type="button"
        onClick={onFechar}
        className="shrink-0 rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-white/60 hover:text-slate-800"
        aria-label="Fechar mensagem"
      >
        ✕
      </button>
    </div>
  );
}
