"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

export default function SolicitarSimuladoPage() {
  const [nome, setNome] = useState("");
  const [banca, setBanca] = useState("");
  const [observacao, setObservacao] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </form>
      )}
    </div>
  );
}
