"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

export default function SolicitarSimuladoPage() {
  const [nome, setNome] = useState("");
  const [banca, setBanca] = useState("");
  const [observacao, setObservacao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [gabaritoTexto, setGabaritoTexto] = useState("");
  const [gabaritoFile, setGabaritoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Anexe o PDF ou foto da prova.");
      return;
    }
    setLoading(true);
    setError("");
    setSucesso("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("nome", nome);
    fd.append("banca", banca);
    fd.append("observacao", observacao);
    fd.append("gabaritoTexto", gabaritoTexto);
    if (gabaritoFile) fd.append("gabaritoFile", gabaritoFile);

    const res = await fetch("/api/listas/solicitacoes", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar");
      return;
    }
    setSucesso(data.mensagem);
    setNome("");
    setBanca("");
    setObservacao("");
    setFile(null);
    setGabaritoTexto("");
    setGabaritoFile(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/simulados" className="text-sm text-teal-700 hover:underline">
          ← Minhas listas
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Solicitar simulado no catálogo</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Envie o material do simulado que você fez. A equipe analisa e, se possível, publica em{" "}
          <strong>Atividades</strong> para você registrar o resultado com gabarito confiável.
        </p>
      </div>

      {sucesso ? (
        <Card className="border-teal-200 bg-teal-50">
          <p className="text-sm text-teal-900">{sucesso}</p>
          <Link href="/provas" className="mt-3 inline-block text-sm font-medium text-teal-700 underline">
            Ir para Atividades
          </Link>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="space-y-4">
            <div>
              <Label>Nome do simulado</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Simulado 4 — Cursinho X"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cursinho / banca (opcional)</Label>
              <Input
                id="banca"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex.: Poliedro, Bernoulli"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ano, número de questões, cor do caderno..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label>PDF ou foto da prova</Label>
              <Input
                id="arquivo"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                className="mt-1"
              />
            </div>
          </Card>

          <Card className="space-y-4 border-teal-200 bg-teal-50/40">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-teal-950">Tem o gabarito oficial?</h2>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                  Opcional · acelera a publicação
                </span>
              </div>
              <p className="mt-1 text-sm text-teal-900">
                Se você já tem as respostas certas, mande junto — assim a equipe não precisa procurar
                e seu simulado entra mais rápido no catálogo. Escolha o jeito mais fácil pra você:
              </p>
            </div>

            <div>
              <Label>Jeito 1 — Colar o gabarito (mais rápido)</Label>
              <Textarea
                id="gabaritoTexto"
                value={gabaritoTexto}
                onChange={(e) => setGabaritoTexto(e.target.value)}
                placeholder={"Ex.:\n1-A  2-C  3-B  4-D  5-E\n6-A  7-B ..."}
                rows={4}
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-xs text-teal-800/80">
                Pode colar em qualquer formato (1-A, 1 A, 1) A...). A equipe organiza.
              </p>
            </div>

            <div>
              <Label>Jeito 2 — Anexar o gabarito (PDF ou foto)</Label>
              <Input
                id="gabaritoArquivo"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setGabaritoFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-teal-800/80">
                Vale a folha de respostas oficial do cursinho, print ou foto nítida.
              </p>
            </div>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </form>
      )}
    </div>
  );
}
