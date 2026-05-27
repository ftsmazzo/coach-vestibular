"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { opcoesAreaBlocoAdmin } from "@/lib/areas-bloco";
import { taxonomy } from "@/lib/taxonomy";

type Props = {
  examId: string;
  numero: number;
  materiaAtual: string;
  assuntoAtual: string;
  onEnviado?: () => void;
};

export function SugerirClassificacao({ examId, numero, materiaAtual, assuntoAtual, onEnviado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [materiaSugerida, setMateriaSugerida] = useState("");
  const [assuntoSugerido, setAssuntoSugerido] = useState("");
  const [areaBloco, setAreaBloco] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const materias = taxonomy.materias.map((m) => m.label);
  const temas =
    taxonomy.materias.find((m) => m.label === materiaSugerida)?.temas.map((t) => t.label) ?? [];

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
        materiaSugerida: materiaSugerida || undefined,
        assuntoSugerido: assuntoSugerido || undefined,
        areaBlocoSugerida: areaBloco || undefined,
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
      <p className="text-xs font-semibold text-violet-900">
        Sugerir correção — Q{numero}
      </p>
      <p className="mt-0.5 text-xs text-violet-800">
        Atual: {materiaAtual} / {assuntoAtual}
      </p>
      <div className="mt-2 space-y-2">
        <textarea
          className="w-full rounded-lg border border-violet-200 p-2 text-sm"
          rows={3}
          placeholder="Explique por que a matéria ou assunto não bate com o enunciado..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            Matéria sugerida (opcional)
            <select
              className="mt-0.5 w-full rounded-lg border px-2 py-1 text-sm"
              value={materiaSugerida}
              onChange={(e) => {
                setMateriaSugerida(e.target.value);
                setAssuntoSugerido("");
              }}
            >
              <option value="">—</option>
              {materias.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Assunto sugerido
            <select
              className="mt-0.5 w-full rounded-lg border px-2 py-1 text-sm"
              value={assuntoSugerido}
              onChange={(e) => setAssuntoSugerido(e.target.value)}
              disabled={!materiaSugerida}
            >
              <option value="">—</option>
              {temas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs text-slate-600">
          Área (opcional)
          <select
            className="mt-0.5 w-full rounded-lg border px-2 py-1 text-sm"
            value={areaBloco}
            onChange={(e) => setAreaBloco(e.target.value)}
          >
            <option value="">—</option>
            {opcoesAreaBlocoAdmin().map((o) => (
              <option key={o.id} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[10px] text-violet-700">
          Se a equipe aceitar, você ganha XP na sua conta (ranking em breve).
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
