"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";

type Stats = {
  total: number;
  importCompleto: boolean;
  metaCorpus: number;
  pctImport: number;
  ultimaImportacao: string | null;
  classificadas: number;
  pctClassificadas: number;
  filaRevisao: number;
  porDisciplina: Array<{ disciplina: string; count: number }>;
  porAno: Array<{ ano: number; count: number }>;
  topEscopos: Array<{ escopoId: string; count: number }>;
};

type FilaItem = {
  id: string;
  fonteId: string;
  ano: number;
  numero: number;
  escopoId: string | null;
  confianca: number | null;
  assunto: string | null;
  trecho: string | null;
};

type Catalogo = {
  materia: string;
  versao: string;
  totalN2: number;
  validacao: Array<{ nivel: string; ok: boolean; mensagem: string }>;
};

const DISCIPLINA_LABEL: Record<string, string> = {
  linguagens: "Linguagens",
  ciencias_humanas: "Humanas",
  ciencias_natureza: "Natureza",
  matematica: "Matemática",
};

export function AdminEnemCorpusPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [classificando, setClassificando] = useState(false);
  const [ultimoRun, setUltimoRun] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/enem-corpus");
      if (!res.ok) throw new Error("Falha ao carregar corpus");
      const data = await res.json();
      setStats(data.stats);
      setFila(data.fila);
      setCatalogo(data.catalogo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function rodarClassificacao() {
    setClassificando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/enem-corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assuntoId: "ecologia", limit: 200 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classificação falhou");
      setStats(data.stats);
      setUltimoRun(
        `${data.resultado.classified}/${data.resultado.processadas} classificadas (${data.resultado.pctClassified}%)`
      );
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setClassificando(false);
    }
  }

  if (loading && !stats) {
    return <p className="text-slate-500">Carregando corpus ENEM…</p>;
  }

  return (
    <div className="space-y-6">
      {erro && (
        <Card className="border-red-200 bg-red-50/80">
          <p className="text-sm text-red-800">{erro}</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Questões no corpus</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</p>
          <p className="text-xs text-slate-500">
            {stats?.importCompleto ? "Import completo" : `${stats?.pctImport ?? 0}% da meta (~${stats?.metaCorpus})`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Classificadas (N2)</p>
          <p className="text-3xl font-bold text-teal-700">{stats?.classificadas ?? 0}</p>
          <p className="text-xs text-slate-500">{stats?.pctClassificadas ?? 0}% do corpus</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Fila revisão</p>
          <p className="text-3xl font-bold text-amber-700">{stats?.filaRevisao ?? 0}</p>
          <p className="text-xs text-slate-500">sem N2 ou confiança baixa</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Catálogo Biologia</p>
          <p className="text-3xl font-bold text-slate-900">{catalogo?.totalN2 ?? "—"}</p>
          <p className="text-xs text-slate-500">N2 · {catalogo?.versao ?? "—"}</p>
        </Card>
      </div>

      {!stats?.importCompleto && stats && stats.total > 0 && (
        <Card className="border-sky-200 bg-sky-50/60">
          <p className="text-sm text-sky-900">
            Import ENEM em andamento em background (~1h na primeira vez). Atualize esta página para
            acompanhar.
          </p>
        </Card>
      )}

      {stats?.total === 0 && (
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-900">
            Corpus vazio. O import roda automaticamente no deploy. Aguarde ou verifique logs{" "}
            <code className="text-xs">/tmp/enem-import.log</code> no container.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={rodarClassificacao} disabled={classificando || !stats?.total}>
          {classificando ? "Classificando…" : "Classificar piloto Ecologia (200 questões)"}
        </Button>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {ultimoRun && (
        <p className="text-sm text-slate-600">
          Última classificação: <strong>{ultimoRun}</strong>
        </p>
      )}

      {catalogo && (
        <Card>
          <h2 className="font-semibold text-slate-900">Validação catálogo ({catalogo.materia})</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {catalogo.validacao.map((v) => (
              <li key={`${v.nivel}-${v.mensagem}`} className="flex gap-2">
                <Badge tone={v.ok ? "success" : "danger"}>{v.nivel}</Badge>
                <span className={v.ok ? "text-slate-600" : "text-red-700"}>{v.mensagem}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats && stats.topEscopos.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-900">Top N2 classificados</h2>
          <ul className="mt-3 space-y-1 font-mono text-sm text-slate-700">
            {stats.topEscopos.map((t) => (
              <li key={t.escopoId}>
                {t.count}× {t.escopoId}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">Por disciplina ENEM</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stats?.porDisciplina.map((d) => (
              <li key={d.disciplina} className="flex justify-between">
                <span>{DISCIPLINA_LABEL[d.disciplina] ?? d.disciplina}</span>
                <span className="font-medium">{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Por ano</h2>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
            {stats?.porAno.map((a) => (
              <li key={a.ano} className="flex justify-between">
                <span>ENEM {a.ano}</span>
                <span className="font-medium">{a.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">Fila de revisão (Natureza — amostra)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Questões sem N2 ou com confiança abaixo do limiar — indicam buracos no catálogo.
        </p>
        {fila.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum item na fila ou corpus ainda vazio.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {fila.map((f) => (
              <li key={f.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.fonteId}</span>
                  {f.escopoId ? (
                    <Badge tone="warning">{f.escopoId}</Badge>
                  ) : (
                    <Badge tone="neutral">unclassified</Badge>
                  )}
                  {f.confianca != null && (
                    <span className="text-xs text-slate-500">
                      conf. {(f.confianca * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {f.trecho && <p className="mt-2 text-slate-600">{f.trecho}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Import automático no deploy · Scripts: <code>npm run enem:import</code>,{" "}
        <code>npm run enem:benchmark-bio</code>
      </p>
    </div>
  );
}
