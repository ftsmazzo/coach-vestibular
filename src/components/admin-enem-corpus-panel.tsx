"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";

type MateriaCorpusId = "biologia" | "quimica" | "fisica";

type MateriaStats = {
  materiaId: MateriaCorpusId;
  materiaLabel: string;
  triadas: number;
  classificadas: number;
  pctClassificadas: number;
  fila: number;
  topEscopos: Array<{ escopoId: string; count: number }>;
};

type Stats = {
  total: number;
  importCompleto: boolean;
  metaCorpus: number;
  pctImport: number;
  natureza: {
    total: number;
    triagem: { biologia: number; quimica: number; fisica: number; indefinida: number };
  };
  materiaAtiva: MateriaStats;
  porDisciplina: Array<{ disciplina: string; count: number }>;
  porAno: Array<{ ano: number; count: number }>;
};

type FilaItem = {
  id: string;
  fonteId: string;
  ano: number;
  numero: number;
  materia: string | null;
  escopoId: string | null;
  confianca: number | null;
  trecho: string | null;
};

type Catalogo = {
  materia: string;
  versao: string;
  totalN2: number;
  validacao: Array<{ nivel: string; ok: boolean; mensagem: string }>;
};

const MATERIA_TAB: Array<{ id: MateriaCorpusId; label: string }> = [
  { id: "biologia", label: "Biologia" },
  { id: "quimica", label: "Química" },
  { id: "fisica", label: "Física" },
];

const DISCIPLINA_LABEL: Record<string, string> = {
  linguagens: "Linguagens",
  ciencias_humanas: "Humanas",
  ciencias_natureza: "Natureza",
  matematica: "Matemática",
};

export function AdminEnemCorpusPanel() {
  const [materiaId, setMateriaId] = useState<MateriaCorpusId>("fisica");
  const [materiasDisponiveis, setMateriasDisponiveis] = useState<MateriaCorpusId[]>([
    "biologia",
    "quimica",
    "fisica",
  ]);
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
      const res = await fetch(`/api/admin/enem-corpus?materiaId=${materiaId}`);
      if (!res.ok) throw new Error("Falha ao carregar corpus");
      const data = await res.json();
      setStats(data.stats);
      setFila(data.fila);
      setCatalogo(data.catalogo);
      setIaDisponivel(Boolean(data.iaDisponivel));
      if (Array.isArray(data.materiasDisponiveis)) {
        setMateriasDisponiveis(data.materiasDisponiveis);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [materiaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function rodarClassificacao(
    opts: { triagemOnly?: boolean; retriagem?: boolean; modo?: "ia" | "heuristica" } = {}
  ) {
    setClassificando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/enem-corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materiaId,
          limit: 700,
          soTriagem: opts.triagemOnly ?? false,
          retriagem: opts.retriagem ?? false,
          modo: iaDisponivel && (opts.modo ?? "ia") === "ia" ? "ia" : "heuristica",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classificação falhou");
      setStats(data.stats);
      const r = data.resultado;
      const mat = catalogo?.materia ?? materiaId;
      if (opts.triagemOnly) {
        setUltimoRun(
          `Triagem: Bio ${r.triagem.biologia} · Quím ${r.triagem.quimica} · Fís ${r.triagem.fisica} · ? ${r.triagem.indefinida}` +
            (r.triagemIa ? ` · +${r.triagemIa} via IA` : "")
        );
      } else {
        setUltimoRun(
          `${mat}: ${r.classified}/${r.materiaProcessadas} novas com N2 (${r.pctClassified}%) · triadas ${r.triagem[materiaId === "biologia" ? "biologia" : materiaId === "quimica" ? "quimica" : "fisica"]}` +
            (r.triagemIa ? ` · triagem IA +${r.triagemIa}` : "")
        );
      }
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setClassificando(false);
    }
  }

  const mat = stats?.materiaAtiva;
  const catalogoOk = catalogo?.validacao.every((v) => v.ok) ?? false;

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

      <div className="flex flex-wrap gap-2">
        {MATERIA_TAB.map((t) => {
          const disponivel = materiasDisponiveis.includes(t.id);
          return (
            <Button
              key={t.id}
              variant={materiaId === t.id ? "primary" : "secondary"}
              disabled={!disponivel}
              onClick={() => setMateriaId(t.id)}
            >
              {t.label}
              {!disponivel && " (em breve)"}
            </Button>
          );
        })}
      </div>

      <Card className="border-sky-200 bg-sky-50/60">
        <p className="text-sm text-sky-900">
          <strong>Natureza ≠ uma matéria.</strong> Triagem Bio/Quím/Fís já feita (~619). Cada aba
          classifica só a matéria selecionada — não sobrescreve N2 de outras matérias.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Questões no corpus</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</p>
          <p className="text-xs text-slate-500">
            {stats?.importCompleto ? "Import completo" : `${stats?.pctImport ?? 0}% da meta`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">{mat?.materiaLabel ?? "Matéria"} com N2</p>
          <p className="text-3xl font-bold text-teal-700">{mat?.classificadas ?? 0}</p>
          <p className="text-xs text-slate-500">
            {mat?.pctClassificadas ?? 0}% das {mat?.triadas ?? 0} triadas
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Fila {mat?.materiaLabel ?? ""} (sem N2)</p>
          <p className="text-3xl font-bold text-amber-700">{mat?.fila ?? 0}</p>
          <p className="text-xs text-slate-500">buracos no catálogo</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Triagem Natureza</p>
          <p className="text-lg font-bold text-slate-900">
            B {stats?.natureza?.triagem.biologia ?? 0} · Q {stats?.natureza?.triagem.quimica ?? 0} · F{" "}
            {stats?.natureza?.triagem.fisica ?? 0}
          </p>
          <p className="text-xs text-slate-500">
            ? {stats?.natureza?.triagem.indefinida ?? 0} · total {stats?.natureza?.total ?? 0}
          </p>
        </Card>
      </div>

      {!catalogoOk && catalogo && (
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-900">
            Catálogo {catalogo.materia} com falhas de validação — corrija antes de classificar em
            produção.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => rodarClassificacao({ modo: "ia" })}
          disabled={classificando || !stats?.total || !catalogoOk}
        >
          {classificando
            ? "Processando…"
            : iaDisponivel
              ? `Classificar ${catalogo?.materia ?? "matéria"} com IA`
              : `Classificar ${catalogo?.materia ?? "matéria"} (heurística)`}
        </Button>
        {iaDisponivel && (
          <Button
            variant="secondary"
            onClick={() => rodarClassificacao({ modo: "heuristica" })}
            disabled={classificando || !stats?.total || !catalogoOk}
          >
            Só heurística (rápido)
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => rodarClassificacao({ triagemOnly: true, retriagem: true, modo: "ia" })}
          disabled={classificando || !stats?.total}
        >
          Retriagem Natureza (IA)
        </Button>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {ultimoRun && <p className="text-sm text-slate-600">Última execução: <strong>{ultimoRun}</strong></p>}

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

      {mat && mat.topEscopos.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-900">Top N2 — {mat.materiaLabel}</h2>
          <ul className="mt-3 space-y-1 font-mono text-sm text-slate-700">
            {mat.topEscopos.map((t) => (
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
            {stats?.porDisciplina?.map((d) => (
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
            {stats?.porAno?.map((a) => (
              <li key={a.ano} className="flex justify-between">
                <span>ENEM {a.ano}</span>
                <span className="font-medium">{a.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">
          Fila {mat?.materiaLabel ?? "matéria"} (sem N2 — amostra)
        </h2>
        {fila.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum item na fila.</p>
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
                    <span className="text-xs text-slate-500">conf. {(f.confianca * 100).toFixed(0)}%</span>
                  )}
                </div>
                {f.trecho && <p className="mt-2 text-slate-600">{f.trecho}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Scripts: <code>npm run catalog:validate fisica</code>,{" "}
        <code>npm run enem:benchmark -- --materia=fisica</code>
      </p>
    </div>
  );
}
