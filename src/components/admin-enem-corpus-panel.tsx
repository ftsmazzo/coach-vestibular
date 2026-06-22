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
  natureza: {
    total: number;
    triagem: { biologia: number; quimica: number; fisica: number; indefinida: number };
    bioClassificadas: number;
    pctBioClassificadas: number;
    bioFila: number;
  };
  porDisciplina: Array<{ disciplina: string; count: number }>;
  porAno: Array<{ ano: number; count: number }>;
  topEscopos: Array<{ escopoId: string; count: number }>;
};

type FilaItem = {
  id: string;
  fonteId: string;
  ano: number;
  numero: number;
  materia: string | null;
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
  const [iaDisponivel, setIaDisponivel] = useState(false);

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
      setIaDisponivel(Boolean(data.iaDisponivel));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function rodarClassificacao(triagemOnly = false, modo: "ia" | "heuristica" = "ia") {
    setClassificando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/enem-corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 700,
          soTriagem: triagemOnly,
          modo: iaDisponivel && modo === "ia" ? "ia" : "heuristica",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classificação falhou");
      setStats(data.stats);
      const r = data.resultado;
      if (triagemOnly) {
        setUltimoRun(
          `Triagem: Bio ${r.triagem.biologia} · Quím ${r.triagem.quimica} · Fís ${r.triagem.fisica} · ? ${r.triagem.indefinida}` +
            (r.triagemIa ? ` · +${r.triagemIa} via IA` : "")
        );
      } else {
        setUltimoRun(
          `Bio: ${r.classified}/${r.bioProcessadas ?? r.triagem.biologia} novas com N2 (${r.pctClassified}%) · triagem B ${r.triagem.biologia}` +
            (r.triagemIa ? ` · +${r.triagemIa} triagem IA` : "")
        );
      }
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

      <Card className="border-sky-200 bg-sky-50/60">
        <p className="text-sm text-sky-900">
          <strong>Natureza ≠ Biologia.</strong> O bloco Ciências da Natureza do ENEM mistura ~⅓ Bio, ⅓
          Química e ⅓ Física. Com IA, questões indefinidas (`?`) são triadas antes da classificação N2.
          A fila abaixo mostra só Biologia sem N2.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Questões no corpus</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</p>
          <p className="text-xs text-slate-500">
            {stats?.importCompleto ? "Import completo" : `${stats?.pctImport ?? 0}% da meta (~${stats?.metaCorpus})`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Bio com N2</p>
          <p className="text-3xl font-bold text-teal-700">{stats?.natureza?.bioClassificadas ?? 0}</p>
          <p className="text-xs text-slate-500">
            {stats?.natureza?.pctBioClassificadas ?? 0}% das {stats?.natureza?.triagem.biologia ?? 0}{" "}
            triadas Bio
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Fila Bio (sem N2)</p>
          <p className="text-3xl font-bold text-amber-700">{stats?.natureza?.bioFila ?? 0}</p>
          <p className="text-xs text-slate-500">buracos no catálogo Bio</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Triagem Natureza</p>
          <p className="text-lg font-bold text-slate-900">
            B {stats?.natureza?.triagem.biologia ?? 0} · Q {stats?.natureza?.triagem.quimica ?? 0} · F{" "}
            {stats?.natureza?.triagem.fisica ?? 0}
          </p>
          <p className="text-xs text-slate-500">
            ? {stats?.natureza?.triagem.indefinida ?? 0} · total Natureza {stats?.natureza?.total ?? 0}
          </p>
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
        <Button
          onClick={() => rodarClassificacao(false, "ia")}
          disabled={classificando || !stats?.total}
        >
          {classificando
            ? "Processando…"
            : iaDisponivel
              ? "Classificar Biologia com IA (recomendado)"
              : "Classificar Biologia (heurística)"}
        </Button>
        {iaDisponivel && (
          <Button
            variant="secondary"
            onClick={() => rodarClassificacao(false, "heuristica")}
            disabled={classificando || !stats?.total}
          >
            Só heurística (rápido)
          </Button>
        )}
        <Button variant="secondary" onClick={() => rodarClassificacao(true, "ia")} disabled={classificando || !stats?.total}>
          {iaDisponivel ? "Triagem IA (Bio/Quím/Fís)" : "Só triagem heurística"}
        </Button>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {ultimoRun && (
        <p className="text-sm text-slate-600">
          Última execução: <strong>{ultimoRun}</strong>
          {ultimoRun.startsWith("Triagem:") && !iaDisponivel && (
            <span className="block text-amber-800">
              Triagem heurística — configure OPENAI_API_KEY para triagem IA nos itens indefinidos.
            </span>
          )}
        </p>
      )}

      {catalogo && (
        <Card>
          <h2 className="font-semibold text-slate-900">
            Catálogo {catalogo.materia} — {catalogo.totalN2} N2 ({catalogo.versao})
          </h2>
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
        <h2 className="font-semibold text-slate-900">Fila Biologia (sem N2 — amostra)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Só questões triadas como Biologia. Indica buracos no catálogo ou confiança baixa no match.
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
