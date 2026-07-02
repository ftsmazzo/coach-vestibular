"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { inferirAreaBlocoPorMateria, normalizarAreaBloco, opcoesAreaBlocoAdmin } from "@/lib/areas-bloco";
import { taxonomy } from "@/lib/taxonomy";
import { parseClassificacaoN1, n1Completo } from "@/lib/classificacao-n1-types";
import { opcoesCatalogoN1, labelCatalogoN1, type OpcaoCatalogoN1 } from "@/lib/catalogos-n1-destino";
import {
  assuntoEhPlaceholderN1,
  resolverCatalogoN1Questao,
} from "@/lib/resolver-catalogo-n1-questao";
import {
  marcarObservacoesConferidas,
  questaoConferidaPeloRevisor,
} from "@/lib/prova-auditoria";
import { questaoPrecisaRevisaoImagem } from "@/lib/prova-revisao-imagem";
import { LABEL_TEXTO_INCOMPLETO } from "@/lib/prova-pendencias-admin";

export interface QuestaoRow {
  id: string;
  numero: number;
  idiomaVariante?: string;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido: string | null;
  conhecimentoEscopoId?: string | null;
  classificacaoN1Json?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoVersao?: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  alternativas?: string | null;
  gabarito: string | null;
}

const DIFICULDADES = ["", "Fácil", "Média", "Difícil"];

type FormEdicao = {
  catalogoN1: string;
  escopoN2: string;
  areaBloco: string;
  materia: string;
  assunto: string;
  conhecimento: string;
  dificuldade: string;
  observacoes: string;
};

type EscopoN2Opcao = {
  id: string;
  label: string;
  assuntoId: string;
  assuntoLabel: string;
  ehFallback?: boolean;
};

interface Props {
  provaId: string;
  questoes: QuestaoRow[];
  alertaChaves?: string[];
  abrirEdicao?: { numero: number; idiomaVariante?: string } | null;
  onEdicaoAberta?: () => void;
  onEditarTexto?: (numero: number) => void;
  onAtualizado: () => void;
  onMensagem?: (msg: string) => void;
}

function chaveAlerta(q: Pick<QuestaoRow, "numero" | "idiomaVariante">): string {
  return `${q.numero}:${q.idiomaVariante ?? "COMUM"}`;
}

function statusN2(q: QuestaoRow): { label: string; className: string } {
  const escopoId = q.conhecimentoEscopoId?.trim();
  if (!escopoId) {
    if (q.materia !== "A classificar" && q.assunto.includes("N2 pendente")) {
      return { label: "Rota OK", className: "bg-sky-100 text-sky-800" };
    }
    return { label: "Sem escopo", className: "bg-slate-100 text-slate-600" };
  }
  if (escopoId.endsWith(".__nao_classificado")) {
    return { label: "Fallback", className: "bg-amber-100 text-amber-900" };
  }
  return { label: "N2 OK", className: "bg-emerald-100 text-emerald-800" };
}

function formatConfianca(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function rotaResumo(versao: string | null | undefined): string {
  if (!versao) return "—";
  const disc = versao.match(/disc=([^|]+)/)?.[1];
  const crit = versao.match(/crit=([^|]+)/)?.[1];
  if (disc && crit) return `${disc} (${crit})`;
  if (versao.includes("ia-catalogo")) return "catálogo direto";
  return versao.slice(0, 24);
}

function formDeQuestao(q: QuestaoRow): FormEdicao {
  const catalogoN1 = resolverCatalogoN1Questao(q);
  const materia =
    catalogoN1 && opcoesCatalogoN1().some((o) => o.id === catalogoN1)
      ? labelCatalogoN1(catalogoN1)
      : q.materia;
  return {
    catalogoN1,
    escopoN2: q.conhecimentoEscopoId?.trim() ?? "",
    areaBloco:
      normalizarAreaBloco(q.areaBloco, materia) ??
      inferirAreaBlocoPorMateria(materia) ??
      "",
    materia,
    assunto: assuntoEhPlaceholderN1(q.assunto)
      ? q.conhecimentoEscopoId
        ? q.assunto.replace(/^N1:\s*\S+/i, "").trim() || q.assunto
        : q.assunto
      : q.assunto,
    conhecimento: q.conhecimentoExigido ?? "",
    dificuldade: q.nivelDificuldade ?? "",
    observacoes: (q.observacoes ?? "").replace(/\[CONFERIDO\]\s*/gi, "").trim(),
  };
}

export function AdminTabelaQuestoes({
  provaId,
  questoes,
  alertaChaves = [],
  abrirEdicao = null,
  onEdicaoAberta,
  onEditarTexto,
  onAtualizado,
  onMensagem,
}: Props) {
  const alertaSet = useMemo(() => new Set(alertaChaves), [alertaChaves]);
  const [editando, setEditando] = useState<QuestaoRow | null>(null);
  const [form, setForm] = useState<FormEdicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conferida, setConferida] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "alerta" | "sem_n1" | "sem_n2" | "revisao_imagem">(
    "todas"
  );
  const [escoposN2, setEscoposN2] = useState<EscopoN2Opcao[]>([]);
  const [buscaEscopo, setBuscaEscopo] = useState("");
  const [carregandoEscopos, setCarregandoEscopos] = useState(false);
  const [opcoesN1Api, setOpcoesN1Api] = useState<OpcaoCatalogoN1[]>([]);

  const materias = taxonomy.materias.map((m) => m.label);
  const opcoesArea = opcoesAreaBlocoAdmin();
  const opcoesN1Base = useMemo(() => opcoesCatalogoN1(), []);
  const opcoesN1 = opcoesN1Api.length > 0 ? opcoesN1Api : opcoesN1Base;

  useEffect(() => {
    fetch("/api/admin/catalogos/n1-destino")
      .then((r) => r.json())
      .then((data: { opcoes?: OpcaoCatalogoN1[] }) => {
        if (data.opcoes?.length) setOpcoesN1Api(data.opcoes);
      })
      .catch(() => {
        /* fallback local opcoesCatalogoN1 */
      });
  }, []);

  const opcoesN1ComAtual = useMemo(() => {
    const ids = new Set(opcoesN1.map((o) => o.id));
    const atual = form?.catalogoN1?.trim();
    if (atual && !ids.has(atual)) {
      return [
        ...opcoesN1,
        {
          id: atual,
          label: `${atual} (valor atual)`,
          area: "natureza" as const,
          grupo: "Outros",
        },
      ];
    }
    return opcoesN1;
  }, [opcoesN1, form?.catalogoN1]);

  const gruposN1 = useMemo(() => {
    const map = new Map<string, OpcaoCatalogoN1[]>();
    for (const o of opcoesN1ComAtual) {
      const g = map.get(o.grupo) ?? [];
      g.push(o);
      map.set(o.grupo, g);
    }
    return map;
  }, [opcoesN1ComAtual]);

  useEffect(() => {
    const cat = form?.catalogoN1?.trim();
    if (!editando || !cat) {
      setEscoposN2([]);
      return;
    }
    let cancel = false;
    setCarregandoEscopos(true);
    fetch(`/api/admin/catalogos/${encodeURIComponent(cat)}/escopos`)
      .then((r) => r.json())
      .then((data: { escopos?: EscopoN2Opcao[] }) => {
        if (!cancel) setEscoposN2(data.escopos ?? []);
      })
      .catch(() => {
        if (!cancel) setEscoposN2([]);
      })
      .finally(() => {
        if (!cancel) setCarregandoEscopos(false);
      });
    return () => {
      cancel = true;
    };
  }, [editando, form?.catalogoN1]);

  const escoposFiltrados = useMemo(() => {
    const q = buscaEscopo.trim().toLowerCase();
    if (!q) return escoposN2;
    return escoposN2.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.assuntoLabel.toLowerCase().includes(q)
    );
  }, [escoposN2, buscaEscopo]);

  const gruposEscopoN2 = useMemo(() => {
    const map = new Map<string, EscopoN2Opcao[]>();
    for (const e of escoposFiltrados) {
      const g = map.get(e.assuntoLabel) ?? [];
      g.push(e);
      map.set(e.assuntoLabel, g);
    }
    return map;
  }, [escoposFiltrados]);

  const lista = useMemo(() => {
    if (filtro === "alerta") {
      return questoes.filter((q) => alertaSet.has(chaveAlerta(q)));
    }
    if (filtro === "sem_n1") {
      return questoes.filter((q) => !n1Completo(parseClassificacaoN1(q.classificacaoN1Json)));
    }
    if (filtro === "sem_n2") {
      return questoes.filter((q) => {
        const id = q.conhecimentoEscopoId?.trim();
        return !id || id.endsWith(".__nao_classificado");
      });
    }
    if (filtro === "revisao_imagem") {
      return questoes.filter((q) => questaoPrecisaRevisaoImagem(q));
    }
    return questoes;
  }, [filtro, questoes, alertaSet]);

  useEffect(() => {
    if (abrirEdicao == null) return;
    const variante = abrirEdicao.idiomaVariante ?? "COMUM";
    const q =
      questoes.find(
        (x) => x.numero === abrirEdicao.numero && (x.idiomaVariante ?? "COMUM") === variante
      ) ?? questoes.find((x) => x.numero === abrirEdicao.numero);
    if (q) {
      setEditando(q);
      setForm(formDeQuestao(q));
      onEdicaoAberta?.();
    }
  }, [abrirEdicao, questoes, onEdicaoAberta]);

  function abrirModal(q: QuestaoRow) {
    setEditando(q);
    setForm(formDeQuestao(q));
    setBuscaEscopo("");
    setConferida(
      questaoConferidaPeloRevisor(q.observacoes) || !q.observacoes?.trim()
    );
  }

  function fecharModal() {
    setEditando(null);
    setForm(null);
  }

  async function salvarModal() {
    if (!editando || !form) return;
    if (!form.catalogoN1.trim()) {
      onMensagem?.("Selecione o catálogo destino (N1) antes de salvar.");
      return;
    }
    setSalvando(true);
    onMensagem?.("");
    const catalogoAnterior = resolverCatalogoN1Questao(editando);
    const n1Mudou = form.catalogoN1.trim() !== catalogoAnterior;
    const escopoAnterior = editando.conhecimentoEscopoId?.trim() ?? "";
    const escopoMudou = form.escopoN2 !== escopoAnterior;
    try {
      const res = await fetch(
        `/api/admin/provas/${provaId}/questoes/${editando.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classificacaoN1CatalogoId: n1Mudou ? form.catalogoN1.trim() : undefined,
            conhecimentoEscopoId: escopoMudou
              ? form.escopoN2.trim() || null
              : undefined,
            areaBloco: form.areaBloco.trim() || null,
            materia: n1Mudou ? undefined : form.materia.trim(),
            assunto: n1Mudou || escopoMudou ? undefined : form.assunto.trim(),
            conhecimentoExigido:
              n1Mudou || escopoMudou ? null : form.conhecimento.trim() || null,
            nivelDificuldade: form.dificuldade.trim() || null,
            observacoes:
              marcarObservacoesConferidas(form.observacoes, conferida) || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onMensagem?.(data.error ?? "Erro ao salvar");
        return;
      }
      onMensagem?.(`Questão ${editando.numero} salva.`);
      fecharModal();
      onAtualizado();
    } catch {
      onMensagem?.("Falha de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function temasDaMateria(materiaLabel: string): string[] {
    const m = taxonomy.materias.find((x) => x.label === materiaLabel);
    return m?.temas.map((t) => t.label) ?? [];
  }

  const semN2 = questoes.filter((q) => {
    const id = q.conhecimentoEscopoId?.trim();
    return !id || id.endsWith(".__nao_classificado");
  }).length;

  const semN1 = questoes.filter(
    (q) => !n1Completo(parseClassificacaoN1(q.classificacaoN1Json))
  ).length;

  const revisaoImagem = questoes.filter((q) => questaoPrecisaRevisaoImagem(q)).length;

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Tabela de questões — classificação N2</h2>
            <p className="text-sm text-slate-600">
              Fonte de verdade: <strong>Escopo N2</strong> e confiança. Matéria/assunto são
              rótulos auxiliares. Linha em destaque = alerta da auditoria.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={filtro === "todas" ? "primary" : "secondary"}
              onClick={() => setFiltro("todas")}
            >
              Todas ({questoes.length})
            </Button>
            {semN1 > 0 && (
              <Button
                type="button"
                variant={filtro === "sem_n1" ? "primary" : "secondary"}
                onClick={() => setFiltro("sem_n1")}
              >
                Sem N1 ({semN1})
              </Button>
            )}
            {semN2 > 0 && (
              <Button
                type="button"
                variant={filtro === "sem_n2" ? "primary" : "secondary"}
                onClick={() => setFiltro("sem_n2")}
              >
                Sem N2 real ({semN2})
              </Button>
            )}
            {alertaChaves.length > 0 && (
              <Button
                type="button"
                variant={filtro === "alerta" ? "primary" : "secondary"}
                onClick={() => setFiltro("alerta")}
              >
                Alertas ({alertaChaves.length})
              </Button>
            )}
            {revisaoImagem > 0 && (
              <Button
                type="button"
                variant={filtro === "revisao_imagem" ? "primary" : "secondary"}
                onClick={() => setFiltro("revisao_imagem")}
              >
                Revisar texto ({revisaoImagem})
              </Button>
            )}
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">
            {filtro === "alerta"
              ? "Nenhum alerta — rode «Auditar» ou volte para todas."
              : filtro === "sem_n1"
                ? "Todas as questões têm N1."
                : filtro === "sem_n2"
                ? "Todas as questões têm escopo N2 real."
                : filtro === "revisao_imagem"
                  ? "Nenhuma questão com placeholder de imagem."
                  : "Nenhuma questão no banco."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-2">#</th>
                  <th className="p-2">N1 catálogo</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Disciplina</th>
                  <th className="p-2">Escopo N2</th>
                  <th className="p-2">Label escopo</th>
                  <th className="p-2">Conf.</th>
                  <th className="p-2">N3 / conhecimento</th>
                  <th className="p-2">Gabarito</th>
                  <th className="p-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((q) => {
                  const st = statusN2(q);
                  const n1 = parseClassificacaoN1(q.classificacaoN1Json);
                  const revisarImg = questaoPrecisaRevisaoImagem(q);
                  return (
                    <tr
                      key={q.id}
                      className={`border-b border-slate-100 ${
                        alertaSet.has(chaveAlerta(q))
                          ? "bg-amber-50"
                          : revisarImg
                            ? "bg-violet-50/60"
                            : ""
                      }`}
                    >
                      <td className="p-2 font-medium">
                        {q.numero}
                        {revisarImg && (
                          <span
                            className="ml-1 inline-block rounded bg-violet-100 px-1 text-[9px] font-semibold text-violet-800"
                            title={LABEL_TEXTO_INCOMPLETO}
                          >
                            !
                          </span>
                        )}
                        {q.idiomaVariante && q.idiomaVariante !== "COMUM" && (
                          <span className="ml-1 text-[10px] font-normal text-slate-500">
                            {q.idiomaVariante === "INGLES" ? "EN" : "ES"}
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs" title={n1?.justificativa ?? ""}>
                        {resolverCatalogoN1Questao(q) || "—"}
                      </td>
                      <td className="p-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${st.className}`}
                          title={rotaResumo(q.classificacaoVersao)}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="p-2">{q.materia}</td>
                      <td
                        className="max-w-[10rem] truncate p-2 font-mono text-xs"
                        title={q.conhecimentoEscopoId ?? ""}
                      >
                        {q.conhecimentoEscopoId ?? "—"}
                      </td>
                      <td className="max-w-[12rem] truncate p-2" title={q.assunto}>
                        {q.assunto}
                      </td>
                      <td className="p-2 text-xs">{formatConfianca(q.classificacaoConfianca)}</td>
                      <td className="max-w-xs truncate p-2 text-xs" title={q.conhecimentoExigido ?? ""}>
                        {q.conhecimentoExigido ?? "—"}
                      </td>
                      <td className="p-2 font-mono font-bold">
                        {q.gabarito === "*" ? (
                          <span className="text-slate-500" title="Anulada pela banca">
                            *
                          </span>
                        ) : (
                          (q.gabarito ?? "—")
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {onEditarTexto && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => onEditarTexto(q.numero)}
                            >
                              Texto
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => abrirModal(q)}
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-editar-questao"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="modal-editar-questao" className="text-lg font-bold">
                Questão {editando.numero}
              </h3>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <label className="mb-3 block text-xs text-slate-600">
              Catálogo destino (N1)
              <select
                className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={form.catalogoN1}
                onChange={(e) => {
                  const catalogoN1 = e.target.value;
                  const op = opcoesN1ComAtual.find((o) => o.id === catalogoN1);
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          catalogoN1,
                          escopoN2: "",
                          materia: op ? op.label : f.materia,
                          assunto: op ? `N1: ${catalogoN1}` : f.assunto,
                        }
                      : f
                  );
                }}
              >
                <option value="">— Selecione o catálogo —</option>
                {[...gruposN1.entries()].map(([grupo, itens]) => (
                  <optgroup key={grupo} label={grupo}>
                    {itens.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} ({o.id})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {form.catalogoN1 && (
                <code className="mt-1 block text-[10px] text-violet-800">
                  {form.catalogoN1}
                  {labelCatalogoN1(form.catalogoN1) !== form.catalogoN1
                    ? ` · ${labelCatalogoN1(form.catalogoN1)}`
                    : ""}
                </code>
              )}
              <span className="mt-1 block text-[11px] text-slate-500">
                Escolha aqui para mudar de Química → Geografia etc. Alterar o N1 zera N2/N3 desta
                questão. O campo «Assunto» abaixo não define o N1.
              </span>
            </label>

            <label className="mb-3 block text-xs text-slate-600">
              Escopo N2 (catálogo)
              <input
                type="search"
                placeholder="Filtrar escopos…"
                className="mt-0.5 mb-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={buscaEscopo}
                onChange={(e) => setBuscaEscopo(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={form.escopoN2}
                disabled={!form.catalogoN1 || carregandoEscopos}
                onChange={(e) =>
                  setForm((f) => f && { ...f, escopoN2: e.target.value })
                }
              >
                <option value="">
                  {carregandoEscopos
                    ? "Carregando escopos…"
                    : !form.catalogoN1
                      ? "Defina N1 primeiro"
                      : "— Sem escopo / limpar —"}
                </option>
                {[...gruposEscopoN2.entries()].map(([grupo, itens]) => (
                  <optgroup key={grupo} label={grupo}>
                    {itens.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                        {o.ehFallback ? " (fallback)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {form.escopoN2 && (
                <code className="mt-1 block truncate text-[10px] text-violet-800">
                  {form.escopoN2}
                </code>
              )}
              <span className="mt-1 block text-[11px] text-slate-500">
                Alterar N2 zera N3. Use para corrigir inglês/mat etc. sem rodar a prova inteira.
              </span>
            </label>

            <div className="grid gap-3">
              <label className="text-xs text-slate-600">
                Área (padrão interno)
                <select
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.areaBloco}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, areaBloco: e.target.value })
                  }
                >
                  <option value="">— Não definida —</option>
                  {opcoesArea.map((o) => (
                    <option key={o.id} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Matéria
                <select
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.materia}
                  onChange={(e) => {
                    const materia = e.target.value;
                    setForm((f) => {
                      if (!f) return f;
                      const canon = opcoesArea.some((o) => o.value === f.areaBloco);
                      const sugerida = inferirAreaBlocoPorMateria(materia);
                      return {
                        ...f,
                        materia,
                        areaBloco: canon ? f.areaBloco : sugerida ?? f.areaBloco,
                      };
                    });
                  }}
                >
                  {materias.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Assunto / label escopo
                {assuntoEhPlaceholderN1(form.assunto) && !form.escopoN2 && (
                  <span className="ml-1 text-amber-700">(placeholder N1 — use o dropdown acima)</span>
                )}
                <input
                  list="assuntos-modal"
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm disabled:bg-slate-100"
                  value={form.assunto}
                  readOnly={assuntoEhPlaceholderN1(form.assunto) && !form.escopoN2}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, assunto: e.target.value })
                  }
                />
                <datalist id="assuntos-modal">
                  {temasDaMateria(form.materia).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label className="text-xs text-slate-600">
                Conhecimento exigido (N3)
                <input
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.conhecimento}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, conhecimento: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-slate-600">
                Dificuldade
                <select
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.dificuldade}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, dificuldade: e.target.value })
                  }
                >
                  {DIFICULDADES.map((d) => (
                    <option key={d || "vazio"} value={d}>
                      {d || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Observações para a IA (ao reclassificar)
                <textarea
                  rows={2}
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.observacoes.replace(/\[CONFERIDO\]\s*/gi, "")}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, observacoes: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={conferida}
                  onChange={(e) => setConferida(e.target.checked)}
                />
                Conferida por mim — remove alertas de heurística (mantém só erro grave
                de bloco/taxonomia)
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button type="button" disabled={salvando} onClick={salvarModal}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
