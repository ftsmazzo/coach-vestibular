"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";

type MateriaCorpusId =
  | "biologia"
  | "quimica"
  | "fisica"
  | "matematica"
  | "humanas"
  | "linguagens";

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
  linguagens: {
    total: number;
    trilhas: { portugues: number; ingles: number; espanhol: number };
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

const MATERIA_TAB: Array<{ id: MateriaCorpusId; label: string; grupo?: string }> = [
  { id: "biologia", label: "Biologia", grupo: "Natureza" },
  { id: "quimica", label: "Química", grupo: "Natureza" },
  { id: "fisica", label: "Física", grupo: "Natureza" },
  { id: "matematica", label: "Matemática" },
  { id: "humanas", label: "Humanas" },
  { id: "linguagens", label: "Linguagens" },
];

const NATUREZA_IDS = new Set<MateriaCorpusId>(["biologia", "quimica", "fisica"]);

const DISCIPLINA_LABEL: Record<string, string> = {
  linguagens: "Linguagens",
  ciencias_humanas: "Humanas",
  ciencias_natureza: "Natureza",
  matematica: "Matemática",
};

export function AdminEnemCorpusPanel() {
  const [materiaId, setMateriaId] = useState<MateriaCorpusId>("matematica");
  const [stats, setStats] = useState<Stats | null>(null);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [classificando, setClassificando] = useState(false);
  const [ultimoRun, setUltimoRun] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [catalogoErro, setCatalogoErro] = useState<string | null>(null);
  const [iaDisponivel, setIaDisponivel] = useState(false);
  const [linguagensRotaVersion, setLinguagensRotaVersion] = useState<number | null>(null);

  const materiaLabel = MATERIA_TAB.find((t) => t.id === materiaId)?.label ?? materiaId;
  const ehNatureza = NATUREZA_IDS.has(materiaId);
  const ehLinguagens = materiaId === "linguagens";

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setCatalogoErro(null);
    try {
      const res = await fetch(`/api/admin/enem-corpus?materiaId=${materiaId}`);
      if (!res.ok) throw new Error("Falha ao carregar corpus");
      const data = await res.json();
      setStats(data.stats);
      setFila(data.fila);
      setCatalogo(data.catalogo);
      setCatalogoErro(data.catalogoErro ?? null);
      setIaDisponivel(Boolean(data.iaDisponivel));
      setLinguagensRotaVersion(
        typeof data.linguagensRotaVersion === "number" ? data.linguagensRotaVersion : null
      );
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
    opts: {
      triagemOnly?: boolean;
      retriagem?: boolean;
      modo?: "ia" | "heuristica";
      repairLinguagensIdioma?: boolean;
      soRepararIdioma?: boolean;
      importarLinguagensIngles?: boolean;
    } = {}
  ) {
    setClassificando(true);
    setErro(null);
    const inicio = Date.now();
    try {
      const res = await fetch("/api/admin/enem-corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materiaId,
          limit: 900,
          soTriagem: opts.triagemOnly ?? false,
          retriagem: opts.retriagem ?? false,
          modo: iaDisponivel && (opts.modo ?? "ia") === "ia" ? "ia" : "heuristica",
          repairLinguagensIdioma: opts.repairLinguagensIdioma ?? false,
          soRepararIdioma: opts.soRepararIdioma ?? false,
          importarLinguagensIngles: opts.importarLinguagensIngles ?? false,
        }),
      });
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Resposta inválida do servidor"
            : `Falha HTTP ${res.status} — tente de novo ou veja logs do servidor`
        );
      }
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `Classificação falhou (HTTP ${res.status})`
        );
      }

      if (data.stats) setStats(data.stats as Stats);

      const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

      if (opts.soRepararIdioma || opts.importarLinguagensIngles) {
        const repair = data.repair as
          | { corrigidas: number; n2Limpos: number; ignoradas: number }
          | null
          | undefined;
        const importL2 = data.importL2 as
          | {
              processadas: number;
              criadas: number;
              atualizadas: number;
              anos: number[];
              avisos?: string[];
            }
          | null
          | undefined;
        if (opts.importarLinguagensIngles) {
          const avisoTxt =
            importL2?.avisos?.length ? ` · ${importL2.avisos.join(" ")}` : "";
          setUltimoRun(
            `Import L2 EN (${segundos}s): ${importL2?.criadas ?? 0} novas · ${importL2?.atualizadas ?? 0} atualizadas · ${importL2?.processadas ?? 0} Q1–5${avisoTxt}` +
              (importL2?.criadas ? " — agora Classificar com IA" : "")
          );
          if ((importL2?.processadas ?? 0) === 0) {
            setErro(
              "Import inglês não trouxe questões. Confira logs do servidor e acesso a api.enem.dev."
            );
          }
        } else {
          setUltimoRun(
            `Repair idioma (${segundos}s): ${repair?.corrigidas ?? 0} corrigidas · ${repair?.n2Limpos ?? 0} N2 limpos`
          );
        }
        return;
      }

      const r = data.resultado as {
        classified: number;
        materiaProcessadas: number;
        pctClassified: number;
        processadas: number;
        triagem: {
          biologia: number;
          quimica: number;
          fisica: number;
          indefinida?: number;
        };
        triagemIa?: number;
      } | null;

      if (!r) {
        throw new Error("Servidor não retornou resultado da classificação");
      }

      const matNome = catalogo?.materia ?? materiaLabel;
      if (opts.triagemOnly) {
        setUltimoRun(
          `Triagem (${segundos}s): Bio ${r.triagem.biologia} · Quím ${r.triagem.quimica} · Fís ${r.triagem.fisica} · ? ${r.triagem.indefinida ?? 0}` +
            (r.triagemIa ? ` · +${r.triagemIa} via IA` : "")
        );
      } else if (ehLinguagens) {
        const repair = data.repair as
          | { corrigidas: number; n2Limpos: number; ignoradas: number }
          | null
          | undefined;
        const importL2 = data.importL2 as
          | { criadas: number; atualizadas: number; processadas: number }
          | null
          | undefined;
        const importTxt = importL2
          ? ` · import EN +${importL2.criadas} novas (${importL2.processadas} Q1–5)`
          : "";
        const repairTxt = repair
          ? ` · repair ${repair.corrigidas} idioma, ${repair.n2Limpos} N2 limpos`
          : "";
        const vazio =
          r.materiaProcessadas === 0
            ? " · nada na fila (todas já têm N2 válido — use Importar EN ou retriagem)"
            : "";
        setUltimoRun(
          `${matNome} (${segundos}s): ${r.classified}/${r.materiaProcessadas} novas com N2 (${r.pctClassified}%) · PT ${r.triagem.biologia} · EN ${r.triagem.quimica} · ES ${r.triagem.fisica}${importTxt}${repairTxt}${vazio}`
        );
      } else if (ehNatureza) {
        const triKey =
          materiaId === "biologia" ? "biologia" : materiaId === "quimica" ? "quimica" : "fisica";
        const vazio =
          r.materiaProcessadas === 0 ? " · nada na fila (já classificadas)" : "";
        setUltimoRun(
          `${matNome} (${segundos}s): ${r.classified}/${r.materiaProcessadas} novas com N2 (${r.pctClassified}%) · triadas ${r.triagem[triKey]}${vazio}` +
            (r.triagemIa ? ` · triagem IA +${r.triagemIa}` : "")
        );
      } else {
        const vazio =
          r.materiaProcessadas === 0
            ? ` · nada na fila (fila admin: ${mat?.fila ?? "?"})`
            : "";
        setUltimoRun(
          `${matNome} (${segundos}s): ${r.classified}/${r.materiaProcessadas} novas com N2 (${r.pctClassified}%) · ${r.processadas} no bloco${vazio}`
        );
      }

      if (data.fila) setFila(data.fila as FilaItem[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setClassificando(false);
    }
  }

  const mat = stats?.materiaAtiva;
  const validacaoE0Ok = catalogo?.validacao.filter((v) => v.nivel === "E0").every((v) => v.ok) ?? false;
  const validacaoE1Ok = catalogo?.validacao.filter((v) => v.nivel === "E1").every((v) => v.ok) ?? false;
  const catalogoOk = validacaoE0Ok && validacaoE1Ok;
  const podeClassificar =
    Boolean(catalogo) && validacaoE0Ok && !classificando && (stats?.total ?? 0) > 0;

  if (loading && !stats) {
    return <p className="text-slate-500">Carregando corpus ENEM…</p>;
  }

  return (
    <div className="space-y-6">
      {erro && (
        <Card className="border-red-200 bg-red-50/80">
          <p className="text-sm font-medium text-red-800">Erro: {erro}</p>
        </Card>
      )}

      {classificando && (
        <Card className="border-teal-200 bg-teal-50/80">
          <p className="text-sm text-teal-900">
            <strong>Processando…</strong> Classificação com IA pode levar vários minutos (até 10 min).
            Não feche esta aba.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {MATERIA_TAB.map((t) => (
          <Button
            key={t.id}
            variant={materiaId === t.id ? "primary" : "secondary"}
            onClick={() => setMateriaId(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {ehNatureza ? (
        <Card className="border-sky-200 bg-sky-50/60">
          <p className="text-sm text-sky-900">
            <strong>Natureza ≠ uma matéria.</strong> Triagem Bio/Quím/Fís concluída (~619). Cada aba
            classifica só a matéria selecionada — não sobrescreve N2 de outras.
          </p>
        </Card>
      ) : ehLinguagens ? (
        <>
          <Card className="border-indigo-200 bg-indigo-50/60">
            <p className="text-sm text-indigo-900">
              <strong>3 trilhas ortogonais.</strong> enem.dev: espanhol na listagem padrão (Q1–5),{" "}
              <strong>inglês só com</strong> <code>?language=ingles</code> (import separado). Q6+ =
              português (<code>idioma:COMUM</code>). A IA só vê N2 da trilha.
              {linguagensRotaVersion != null && (
                <span className="ml-1 text-xs text-indigo-700">· rota v{linguagensRotaVersion}</span>
              )}
            </p>
          </Card>
          {linguagensRotaVersion !== 3 && (
            <Card className="border-amber-300 bg-amber-50/90">
              <p className="text-sm text-amber-950">
                <strong>Deploy desatualizado (rota v3).</strong> Falta importar inglês via enem.dev.
                Use <strong>Importar inglês Q1–5</strong> e depois Classificar com IA.
              </p>
            </Card>
          )}
          {(stats?.linguagens?.trilhas.ingles ?? 0) === 0 && linguagensRotaVersion === 3 && (
            <Card className="border-amber-300 bg-amber-50/90">
              <p className="text-sm text-amber-950">
                <strong>EN = 0 no banco.</strong> Clique <strong>Importar inglês Q1–5</strong> (~75
                questões, leva ~2 min por rate limit da API).
              </p>
            </Card>
          )}
        </>
      ) : (
        <Card className="border-violet-200 bg-violet-50/60">
          <p className="text-sm text-violet-900">
            <strong>Disciplina única.</strong> Todo o bloco ENEM {materiaLabel} usa um catálogo só (
            {catalogo?.totalN2 ?? "…"} N2). Classificação direta, sem triagem B/Q/F.
          </p>
        </Card>
      )}

      <div
        className={`grid gap-4 sm:grid-cols-2 ${ehNatureza || ehLinguagens ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
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
            {mat?.pctClassificadas ?? 0}% das {mat?.triadas ?? 0} no bloco
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Fila {mat?.materiaLabel ?? ""} (sem N2)</p>
          <p className="text-3xl font-bold text-amber-700">{mat?.fila ?? 0}</p>
          <p className="text-xs text-slate-500">buracos no catálogo</p>
        </Card>
        {ehLinguagens && (
          <Card>
            <p className="text-sm text-slate-500">Trilhas (efetivas)</p>
            <p className="text-lg font-bold text-slate-900">
              PT {stats?.linguagens?.trilhas.portugues ?? 0} · EN{" "}
              {stats?.linguagens?.trilhas.ingles ?? 0} · ES{" "}
              {stats?.linguagens?.trilhas.espanhol ?? 0}
            </p>
            <p className="text-xs text-slate-500">total {stats?.linguagens?.total ?? 0}</p>
          </Card>
        )}
        {ehNatureza && (
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
        )}
      </div>

      {catalogoErro && (
        <Card className="border-red-200 bg-red-50/80">
          <p className="text-sm text-red-800">
            Catálogo {materiaLabel} não carregou: {catalogoErro}. Verifique deploy{" "}
            <code className="text-xs">data/conhecimento-catalog/{materiaId}.json</code>
          </p>
        </Card>
      )}

      {!validacaoE1Ok && catalogo && validacaoE0Ok && (
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-900">
            Catálogo {catalogo.materia} com avisos E1 (hierarquia) — classificação permitida, mas
            corrija para produção madura.
          </p>
        </Card>
      )}

      {!validacaoE0Ok && catalogo && (
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-900">
            Catálogo {catalogo.materia} com falhas E0 — corrija IDs/teto antes de classificar.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => rodarClassificacao({ modo: "ia" })}
          disabled={!podeClassificar}
        >
          {classificando
            ? "Processando…"
            : iaDisponivel
              ? `Classificar ${materiaLabel} com IA`
              : `Classificar ${materiaLabel} (heurística)`}
        </Button>
        {ehLinguagens && (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => rodarClassificacao({ importarLinguagensIngles: true })}
              disabled={classificando || linguagensRotaVersion !== 3}
            >
              Importar inglês Q1–5
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                rodarClassificacao({
                  importarLinguagensIngles: true,
                  repairLinguagensIdioma: true,
                  retriagem: true,
                  modo: "ia",
                })
              }
              disabled={!podeClassificar || linguagensRotaVersion !== 3}
            >
              Importar EN + classificar
            </Button>
          </>
        )}
        {iaDisponivel && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => rodarClassificacao({ modo: "heuristica" })}
            disabled={!podeClassificar}
          >
            Só heurística (rápido)
          </Button>
        )}
        {ehNatureza && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => rodarClassificacao({ triagemOnly: true, retriagem: true, modo: "ia" })}
            disabled={classificando || !stats?.total}
          >
            Retriagem Natureza (IA)
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={load} disabled={loading || classificando}>
          Atualizar
        </Button>
      </div>

      {ultimoRun && (
        <p className="text-sm text-slate-600">
          Última execução: <strong>{ultimoRun}</strong>
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
        Scripts: <code>npm run catalog:validate {materiaId}</code>,{" "}
        <code>npm run enem:benchmark -- --materia={materiaId}</code>
      </p>
    </div>
  );
}
