"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { labelEscopo } from "@/lib/escopo-display";

type EscopoOpcao = { id: string; label: string; areaEnem?: string };

type Props = {
  examId: string;
  numero: number;
  escopoAtualId?: string | null;
  escopoLabelAtual?: string | null;
  onEnviado?: () => void;
};

export function SugerirClassificacao({
  examId,
  numero,
  escopoAtualId,
  escopoLabelAtual,
  onEnviado,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<EscopoOpcao[]>([]);
  const [escopoSugeridoId, setEscopoSugeridoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const labelAtual =
    escopoLabelAtual?.trim() ||
    labelEscopo(escopoAtualId) ||
    "Sem escopo N2 (admin precisa classificar)";

  useEffect(() => {
    if (!aberto || busca.trim().length < 2) {
      setOpcoes([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/escopos/busca?q=${encodeURIComponent(busca.trim())}`);
      const data = await res.json();
      if (Array.isArray(data.escopos)) setOpcoes(data.escopos);
    }, 280);
    return () => clearTimeout(t);
  }, [busca, aberto]);

  async function enviar() {
    setLoading(true);
    setErro("");
    setMsg("");
    const res = await fetch(`/api/exams/${examId}/sugestoes-classificacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero,
        texto,
        escopoSugeridoId: escopoSugeridoId || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setErro(data.error ?? "Erro ao enviar");
      return;
    }
    setMsg(data.mensagem ?? "Sugestão enviada!");
    setTexto("");
    setBusca("");
    setEscopoSugeridoId("");
    setAberto(false);
    onEnviado?.();
  }

  if (!aberto) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-violet-700 hover:underline"
        onClick={() => setAberto(true)}
      >
        Classificação errada?
      </button>
    );
  }

  return (
    <Card className="mt-2 border-violet-200 bg-violet-50/50 p-3">
      <p className="text-xs font-semibold text-violet-900">Sugerir correção — Q{numero}</p>
      <p className="mt-0.5 text-xs text-violet-800">
        Escopo atual (N2): <strong>{labelAtual}</strong>
        {escopoAtualId && (
          <span className="ml-1 font-mono text-[10px] text-violet-600">{escopoAtualId}</span>
        )}
      </p>
      <div className="mt-2 space-y-2">
        <textarea
          className="w-full rounded-lg border border-violet-200 p-2 text-sm"
          rows={3}
          placeholder="Explique por que o escopo N2 não bate com o enunciado..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <label className="block text-xs text-slate-600">
          Escopo correto (busca no catálogo)
          <input
            type="search"
            className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
            placeholder="Ex.: funções, genética, interpretação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        {opcoes.length > 0 && (
          <ul className="max-h-36 overflow-y-auto rounded-lg border border-violet-100 bg-white text-sm">
            {opcoes.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`w-full px-2 py-1.5 text-left hover:bg-violet-50 ${
                    escopoSugeridoId === o.id ? "bg-violet-100 font-medium" : ""
                  }`}
                  onClick={() => {
                    setEscopoSugeridoId(o.id);
                    setBusca(o.label);
                  }}
                >
                  {o.label}
                  <span className="ml-1 text-[10px] text-slate-400">{o.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-violet-700">
          A equipe mapeia sua sugestão para o catálogo N2. Se aceita, você ganha XP e o motor
          recalcula seus focos.
        </p>
        {erro && <p className="text-xs text-rose-600">{erro}</p>}
        {msg && <p className="text-xs text-teal-700">{msg}</p>}
        <div className="flex gap-2">
          <Button type="button" disabled={loading || texto.length < 10} onClick={enviar}>
            {loading ? "Enviando..." : "Enviar sugestão"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}
