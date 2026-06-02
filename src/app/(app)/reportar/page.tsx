"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

type Tipo = "BUG" | "SUGESTAO" | "DUVIDA";

const TIPOS: { id: Tipo; label: string; emoji: string }[] = [
  { id: "BUG", label: "Erro / bug", emoji: "🐞" },
  { id: "SUGESTAO", label: "Sugestão", emoji: "💡" },
  { id: "DUVIDA", label: "Dúvida", emoji: "❓" },
];

const SEVERIDADES = [
  { id: "baixa", label: "Leve" },
  { id: "media", label: "Atrapalha" },
  { id: "alta", label: "Trava o uso" },
];

export default function ReportarPage() {
  const [tipo, setTipo] = useState<Tipo>("BUG");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [esperado, setEsperado] = useState("");
  const [severidade, setSeveridade] = useState("media");
  const [pagina, setPagina] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    // Pré-preenche com a página de onde o aluno veio (sem quebrar se vazio).
    const ref = document.referrer;
    if (ref) {
      try {
        setPagina(new URL(ref).pathname);
      } catch {
        /* ignore */
      }
    }
  }, []);

  function montarContexto() {
    if (typeof window === "undefined") return {};
    return {
      paginaOrigem: pagina || document.referrer || null,
      userAgent: navigator.userAgent,
      idioma: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      tela: `${window.screen.width}x${window.screen.height}`,
      quando: new Date().toISOString(),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSucesso("");
    if (titulo.trim().length < 3) {
      setError("Dê um título curto ao report.");
      return;
    }
    if (descricao.trim().length < 5) {
      setError("Conta um pouco mais do que aconteceu.");
      return;
    }
    setLoading(true);

    const fd = new FormData();
    fd.append("tipo", tipo);
    fd.append("titulo", titulo);
    fd.append("descricao", descricao);
    if (tipo === "BUG") {
      fd.append("esperado", esperado);
      fd.append("severidade", severidade);
    }
    fd.append("pagina", pagina);
    fd.append("contexto", JSON.stringify(montarContexto()));
    if (anexo) fd.append("anexo", anexo);

    const res = await fetch("/api/feedback", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível enviar.");
      return;
    }
    setSucesso(data.mensagem ?? "Report enviado!");
    setTitulo("");
    setDescricao("");
    setEsperado("");
    setAnexo(null);
  }

  const ehBug = tipo === "BUG";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-teal-700 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Reportar erro ou sugestão</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Estamos em beta e seu retorno vale ouro. Conte o que aconteceu — coletamos automaticamente
          os detalhes técnicos (página, navegador, versão) para a equipe resolver rápido.
        </p>
      </div>

      {sucesso ? (
        <Card className="border-teal-200 bg-teal-50">
          <p className="text-sm text-teal-900">{sucesso}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setSucesso("")} variant="secondary">
              Enviar outro
            </Button>
            <Link href="/dashboard" className="self-center text-sm font-medium text-teal-700 underline">
              Voltar à Home
            </Link>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="space-y-4">
            <div>
              <Label>O que é?</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipo(t.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition ${
                      tipo === t.id
                        ? "border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-100"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {t.emoji}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={ehBug ? "Ex.: Botão Concluir não some" : "Ex.: Queria filtrar por matéria"}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label>{ehBug ? "O que aconteceu?" : "Sua ideia / dúvida"}</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={
                  ehBug
                    ? "Descreva o passo a passo: o que você clicou, o que apareceu..."
                    : "Conte com suas palavras — quanto mais detalhe, melhor."
                }
                rows={4}
                required
                className="mt-1"
              />
            </div>

            {ehBug && (
              <>
                <div>
                  <Label>O que você esperava que acontecesse? (opcional)</Label>
                  <Textarea
                    value={esperado}
                    onChange={(e) => setEsperado(e.target.value)}
                    placeholder="Ex.: esperava que a tarefa saísse da lista ao concluir."
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>O quanto atrapalha?</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEVERIDADES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSeveridade(s.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          severidade === s.id
                            ? "border-teal-500 bg-teal-50 text-teal-800"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <Label>Em qual página? (preenchemos automaticamente)</Label>
              <Input
                value={pagina}
                onChange={(e) => setPagina(e.target.value)}
                placeholder="Ex.: /quests"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label>Print do erro (opcional, ajuda muito)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,.pdf"
                onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
            </div>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Enviando..." : "Enviar report"}
          </Button>
        </form>
      )}
    </div>
  );
}
