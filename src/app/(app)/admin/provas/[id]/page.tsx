"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

interface ProvaQuestao {
  id: string;
  numero: number;
  caderno: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido: string | null;
  gabarito: string | null;
}

interface Prova {
  id: string;
  nome: string;
  banca: string;
  publicada: boolean;
  gabaritoCompleto: boolean;
  totalQuestoes: number;
  questoes: ProvaQuestao[];
}

export default function AdminProvaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [prova, setProva] = useState<Prova | null>(null);
  const [gabaritoLote, setGabaritoLote] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/provas/${id}`);
    if (res.ok) setProva(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublicada() {
    if (!prova) return;
    await fetch(`/api/admin/provas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicada: !prova.publicada }),
    });
    load();
  }

  async function importCsv() {
    if (!csvFile) return;
    const fd = new FormData();
    fd.append("file", csvFile);
    const res = await fetch(`/api/admin/provas/${id}/questoes`, { method: "POST", body: fd });
    const data = await res.json();
    setMsg(res.ok ? `Importadas ${data.imported} questões` : data.error);
    load();
  }

  async function salvarGabaritoLote() {
    const linhas = gabaritoLote.trim().split(/\n/).filter(Boolean);
    const itens = linhas.map((l) => {
      const [num, gab] = l.split(/[,;\s]+/);
      return { numero: parseInt(num, 10), gabarito: gab.trim() };
    });
    const res = await fetch(`/api/admin/provas/${id}/gabarito`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Gabarito atualizado (${data.updated} itens)` : "Erro");
    load();
  }

  if (!prova) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Link href="/admin/provas" className="text-sm text-teal-700 hover:underline">
        ← Voltar
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{prova.nome}</h1>
          <p className="text-slate-600">
            {prova.questoes.length} questões · Gabarito{" "}
            {prova.gabaritoCompleto ? "completo" : "pendente"}
          </p>
        </div>
        <Button variant="secondary" onClick={togglePublicada}>
          {prova.publicada ? "Despublicar" : "Publicar para alunos"}
        </Button>
      </div>

      {msg && <p className="text-sm text-teal-700">{msg}</p>}

      <Card>
        <h2 className="mb-2 font-semibold">Importar questões (CSV)</h2>
        <p className="mb-3 text-sm text-slate-600">
          Colunas: numero, caderno, materia, assunto, conhecimento_exigido, gabarito. Template em{" "}
          <code className="text-xs">docs/templates/prova-questoes.csv</code>
        </p>
        <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
        <Button className="mt-3" onClick={importCsv} disabled={!csvFile}>
          Importar CSV (substitui todas as questões)
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Atualizar gabarito em lote</h2>
        <p className="mb-2 text-sm text-slate-600">Uma linha por questão: número e letra. Ex: 1,C</p>
        <textarea
          className="w-full rounded-xl border p-3 font-mono text-sm"
          rows={6}
          placeholder={"1,C\n2,A\n3,B"}
          value={gabaritoLote}
          onChange={(e) => setGabaritoLote(e.target.value)}
        />
        <Button className="mt-2" onClick={salvarGabaritoLote}>
          Salvar gabarito
        </Button>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Tabela de questões</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="p-2">#</th>
                <th className="p-2">Caderno</th>
                <th className="p-2">Matéria</th>
                <th className="p-2">Assunto</th>
                <th className="p-2">Conhecimento</th>
                <th className="p-2">Gabarito</th>
              </tr>
            </thead>
            <tbody>
              {prova.questoes.map((q) => (
                <tr key={q.id} className="border-b border-slate-100">
                  <td className="p-2 font-medium">{q.numero}</td>
                  <td className="p-2">{q.caderno ?? "—"}</td>
                  <td className="p-2">{q.materia}</td>
                  <td className="p-2">{q.assunto}</td>
                  <td className="p-2 max-w-xs truncate" title={q.conhecimentoExigido ?? ""}>
                    {q.conhecimentoExigido ?? "—"}
                  </td>
                  <td className="p-2 font-mono font-bold">{q.gabarito ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prova.questoes.length === 0 && (
          <p className="mt-4 text-slate-500">Importe um CSV ou peça ao GPT a tabela e cole aqui.</p>
        )}
      </Card>
    </div>
  );
}
