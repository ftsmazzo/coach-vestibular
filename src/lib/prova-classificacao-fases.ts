/**
 * Classificação em 3 FASES separadas — N1 → validar → N2 → validar → N3.
 * Cada fase persiste no banco antes da próxima rodar.
 */

import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { extrairTrechosPorNumero } from "@/lib/prova-texto-parse";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";
import { areaBlocoPorId } from "@/lib/areas-bloco";
import {
  resolverAreaMacroQuestao,
  resolverAreaMacroQuestaoAsync,
  type AreaMacro,
} from "@/lib/inferir-area-macro-conteudo";
import { atribuirAreasProvaDoCaderno } from "@/lib/prova-atribuir-area-caderno";
import { MARCADOR_EXTRACAO_ACEITA } from "@/lib/prova-texto-prova";
import {
  camposLimpezaN2N3,
  catalogoN1Mudou,
  deveProcessarQuestaoN1,
  montarN1AutomaticoComAuditoria,
  n1Completo,
  parseClassificacaoN1,
  resolverOpcoesFaseN1,
  versaoLabelN1,
  type ClassificacaoN1,
  type OpcoesFaseN1Prova,
} from "@/lib/classificacao-n1-types";
import {
  executarN1Questao,
  metaFromClassificacaoN1,
  passoClassificacaoN2Somente,
  passoClassificacaoN3,
  type PayloadQuestaoCompleto,
} from "@/lib/enem-classificar/classificar-pipeline-prova";
import { CLASSIFICADOR_CATALOGO_V11 } from "@/lib/enem-classificar/classificar-catalogo-v11";
import { versaoClassificacaoDisciplinaV10 } from "@/lib/enem-classificar/classificar-roteamento-disciplina";
import { camposClassificacaoFromResultado } from "@/lib/canonical-question/persist-classificacao";
import {
  labelsFromEscopoN2,
  TEXTO_MINIMO_CLASSIFICACAO,
  TEXTO_MINIMO_CLASSIFICACAO_CURTO,
} from "@/lib/prova-classificacao-catalogo";
import { LABEL_DISCIPLINA_SPLIT, ehCatalogDisciplinaSplit } from "@/lib/conhecimento-catalog/disciplinas-split";
import { CORPUS_MATERIA_CONFIG } from "@/lib/enem-corpus-materia";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";
import { resolverTextoCompartilhado } from "@/lib/prova-texto-compartilhado";

export type ResultadoFaseProva = {
  total: number;
  processadas: number;
  ok: number;
  falhas: number;
  avisos: string[];
  etapas: string[];
  puladas?: number;
  manuaisPreservadas?: number;
  n1Alterados?: number;
  n1Inalterados?: number;
};

type QuestaoDb = {
  id: string;
  ordemExtracao: number;
  numero: number;
  idiomaVariante: IdiomaVarianteQuestao;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  enunciado: string | null;
  alternativas: string | null;
  observacoes: string | null;
  gabarito: string | null;
  classificacaoN1Json: string | null;
  conhecimentoEscopoId: string | null;
  conhecimentoExigido: string | null;
  classificacaoVersao: string | null;
};

function labelMateriaFromN1(n1: ClassificacaoN1): string {
  if (ehCatalogDisciplinaSplit(n1.catalogoId)) {
    return LABEL_DISCIPLINA_SPLIT[n1.catalogoId];
  }
  const cfg = CORPUS_MATERIA_CONFIG[n1.catalogoId as MateriaCorpusId];
  return cfg?.label ?? n1.catalogoId;
}

async function resolverAreaParaN1(
  q: QuestaoDb,
  payload: PayloadQuestaoCompleto,
  banca?: string
): Promise<{ area: AreaMacro; via: string; motivo: string } | null> {
  const texto = textoCompletoPayload(payload);
  const res = await resolverAreaMacroQuestaoAsync(texto, {
    areaBloco: q.areaBloco,
    materia: q.materia,
    idiomaVariante: q.idiomaVariante,
    fonteId: q.id,
    banca: banca ?? null,
    numero: q.numero,
  });
  if (!res) return null;
  return { area: res.area, via: res.via, motivo: res.motivo };
}

function questaoParaPayload(
  q: QuestaoDb,
  trechos: Map<number, string>,
  banca?: string,
  todas?: QuestaoDb[]
): PayloadQuestaoCompleto {
  const trecho = trechos.get(q.numero);
  const enunciado = q.enunciado?.trim() || trecho?.trim() || "";
  let textoBase: string | null = null;
  if (trecho?.trim() && q.enunciado?.trim() && trecho.length > q.enunciado.length + 40) {
    textoBase = trecho.trim();
  } else if (trecho?.trim() && !q.enunciado?.trim()) {
    textoBase = trecho.trim();
  } else if (todas?.length) {
    const compartilhado = resolverTextoCompartilhado(q, todas);
    if (compartilhado) {
      textoBase = compartilhado;
    }
  }

  return {
    fonteId: q.id,
    numero: q.numero,
    idiomaVariante: q.idiomaVariante,
    areaBloco: q.areaBloco,
    banca: banca ?? null,
    enunciado,
    alternativas: q.alternativas?.trim() ?? "",
    textoBase,
    gabarito: q.gabarito,
    observacoes: q.observacoes,
  };
}

function textoMinimo(q: QuestaoDb): number {
  if (q.observacoes?.includes(MARCADOR_EXTRACAO_ACEITA)) {
    return TEXTO_MINIMO_CLASSIFICACAO_CURTO;
  }
  return TEXTO_MINIMO_CLASSIFICACAO;
}

function textoCompletoPayload(p: PayloadQuestaoCompleto): string {
  return [p.textoBase, p.enunciado, p.alternativas, p.observacoes].filter(Boolean).join("\n\n");
}

async function carregarContextoProva(provaId: string) {
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    select: { textoFonte: true, banca: true, extracaoValidada: true },
  });
  if (!prova) throw new Error("Prova não encontrada");
  if (!prova.extracaoValidada) throw new Error("Valide a extração (Passo 3) antes de classificar.");

  const questoes = await prisma.provaQuestao.findMany({
    where: { provaId },
    orderBy: { ordemExtracao: "asc" },
  });

  const textoFonte = prova.textoFonte?.trim() ?? "";
  const trechos =
    textoFonte.length > 200 ? extrairTrechosPorNumero(textoFonte) : new Map<number, string>();

  return { prova, questoes: questoes as QuestaoDb[], trechos };
}

function versaoN2(resultado: ResultadoClassificacao, n1: ClassificacaoN1): string {
  const mid = resultado.materiaId ?? n1.catalogoId;
  if (ehCatalogDisciplinaSplit(mid)) {
    const area = ["portugues", "ingles", "espanhol"].includes(mid) ? "linguagens" : "humanas";
    return versaoClassificacaoDisciplinaV10(resultado, area);
  }
  return `${CLASSIFICADOR_CATALOGO_V11}|n2|${n1.catalogoId}`;
}

/** FASE 1 — N1: roteamento / triagem → catálogo destino. Grava classificacaoN1Json. */
export async function executarFaseN1Prova(
  provaId: string,
  opts?: OpcoesFaseN1Prova
): Promise<ResultadoFaseProva> {
  const opcoes = resolverOpcoesFaseN1(opts);
  let { prova, questoes, trechos } = await carregarContextoProva(provaId);
  const avisos: string[] = [];
  const etapas: string[] = [
    "═══ FASE N1 — roteamento / catálogo destino ═══",
    `Modo: ${opcoes.forcarTudo ? "forcarTudo" : opcoes.reprocessarTodas ? "reprocessarTodas" : "apenasFaltantes"}` +
      (opcoes.preservarManuais ? " · preservarManuais" : ""),
  ];

  const semAreaInicial = questoes.filter((q) => {
    const payload = questaoParaPayload(q, trechos, prova.banca ?? undefined, questoes);
    return !resolverAreaMacroQuestao(textoCompletoPayload(payload), {
      areaBloco: q.areaBloco,
      materia: q.materia,
      idiomaVariante: q.idiomaVariante,
    });
  }).length;
  if (semAreaInicial > 0) {
    etapas.push(
      `${semAreaInicial} questão(ões) sem área por conteúdo — tentando cabeçalhos do PDF (fallback)…`
    );
    const inferencia = await atribuirAreasProvaDoCaderno(provaId);
    avisos.push(...inferencia.avisos);
    if (inferencia.atualizadas > 0) {
      etapas.push(`Áreas atribuídas automaticamente: ${inferencia.atualizadas} questão(ões).`);
      ({ prova, questoes, trechos } = await carregarContextoProva(provaId));
    }
  }
  let ok = 0;
  let processadas = 0;
  let puladas = 0;
  let manuaisPreservadas = 0;
  let n1Alterados = 0;
  let n1Inalterados = 0;
  const reprocessadoEm = new Date().toISOString();

  for (const q of questoes) {
    const n1Anterior = parseClassificacaoN1(q.classificacaoN1Json);
    const decisao = deveProcessarQuestaoN1(n1Anterior, opcoes);
    if (!decisao.processar) {
      puladas++;
      if (decisao.motivo === "manual_preservado") {
        manuaisPreservadas++;
        etapas.push(`Q${q.numero} → pulada (N1 manual preservado)`);
      } else if (decisao.motivo === "ja_tem_n1") {
        etapas.push(`Q${q.numero} → pulada (já tem N1)`);
      }
      continue;
    }

    const payload = questaoParaPayload(q, trechos, prova.banca ?? undefined, questoes);
    const texto = textoCompletoPayload(payload);
    if (texto.length < textoMinimo(q)) {
      avisos.push(`Q${q.numero}: texto insuficiente para N1.`);
      puladas++;
      continue;
    }

    const areaRes = await resolverAreaParaN1(q, payload, prova.banca ?? undefined);
    if (!areaRes) {
      avisos.push(`Q${q.numero}: área indefinida (conteúdo + cadastro).`);
      puladas++;
      continue;
    }

    if (areaRes.via === "conteudo") {
      etapas.push(`Q${q.numero} → área ${areaRes.area} (${areaRes.motivo})`);
    }

    const { n1, etapas: eq, avisos: aq } = await executarN1Questao(payload, areaRes.area);
    for (const e of eq) etapas.push(e.detalhe);
    avisos.push(...aq);

    if (!n1 || !n1Completo(n1)) {
      puladas++;
      continue;
    }

    const n1Gravar = montarN1AutomaticoComAuditoria(n1, n1Anterior, reprocessadoEm);
    const mudou = catalogoN1Mudou(n1Anterior, n1Gravar);
    const limparN2N3 = mudou ? camposLimpezaN2N3() : {};

    await prisma.provaQuestao.update({
      where: { id: q.id },
      data: {
        classificacaoN1Json: JSON.stringify(n1Gravar),
        materia: labelMateriaFromN1(n1Gravar),
        ...(mudou ? { assunto: `N1: ${n1Gravar.catalogoId}` } : {}),
        classificacaoVersao: versaoLabelN1(n1Gravar),
        ...(areaRes.via === "conteudo" && !q.areaBloco
          ? { areaBloco: areaBlocoPorId(areaRes.area).label }
          : {}),
        ...limparN2N3,
      },
    });

    if (mudou) {
      n1Alterados++;
      etapas.push(
        `Q${q.numero} → N1 alterado ${n1Anterior?.catalogoId ?? "∅"} → ${n1Gravar.catalogoId} (N2/N3 limpos)`
      );
    } else {
      n1Inalterados++;
    }
    ok++;
    processadas++;
  }

  etapas.push(
    `N1 concluído: ${ok}/${questoes.length} com catálogo destino · ` +
      `alterados ${n1Alterados} · inalterados ${n1Inalterados} · ` +
      `puladas ${puladas} (manuais ${manuaisPreservadas})`
  );

  return {
    total: questoes.length,
    processadas,
    ok,
    falhas: questoes.length - ok,
    avisos,
    etapas,
    puladas,
    manuaisPreservadas,
    n1Alterados,
    n1Inalterados,
  };
}

export type OpcoesFaseN2Prova = {
  /** Pula questões que já têm escopo N2 real (não fallback). */
  apenasSemEscopoReal?: boolean;
  /** Reprocessa só estas numerações (ex.: [37, 47, 49, 58, 70]). */
  numerosQuestao?: number[];
};

/** FASE 2 — N2: escopo no catálogo. Exige N1 gravado. NÃO gera N3. */
export async function executarFaseN2Prova(
  provaId: string,
  opts?: OpcoesFaseN2Prova
): Promise<ResultadoFaseProva> {
  const { prova, questoes, trechos } = await carregarContextoProva(provaId);
  const avisos: string[] = [];
  const etapas: string[] = [
    opts?.numerosQuestao?.length
      ? `═══ FASE N2 — questões ${opts.numerosQuestao.join(", ")} ═══`
      : opts?.apenasSemEscopoReal
        ? "═══ FASE N2 — só questões sem escopo real ═══"
        : "═══ FASE N2 — escopo no catálogo (sem N3) ═══",
  ];
  let ok = 0;
  let processadas = 0;

  const semN1 = questoes.filter((q) => !n1Completo(parseClassificacaoN1(q.classificacaoN1Json)));
  if (semN1.length > 0) {
    throw new Error(
      `N1 incompleto: ${semN1.length}/${questoes.length} questão(ões) sem catálogo destino. ` +
        `Complete e valide o N1 em todas antes de rodar N2 — o N2 usa mat/bio/hist… definido no N1.`
    );
  }

  const filtroNumeros =
    opts?.numerosQuestao?.length && opts.numerosQuestao.length > 0
      ? new Set(opts.numerosQuestao)
      : null;

  for (const q of questoes) {
    const n1 = parseClassificacaoN1(q.classificacaoN1Json);
    if (!n1Completo(n1) || !n1) continue;

    if (filtroNumeros && !filtroNumeros.has(q.numero)) continue;

    const escAtual = q.conhecimentoEscopoId?.trim();
    if (
      opts?.apenasSemEscopoReal &&
      escAtual &&
      !escAtual.endsWith(".__nao_classificado")
    ) {
      continue;
    }

    const payload = questaoParaPayload(q, trechos, prova.banca ?? undefined, questoes);
    const meta = metaFromClassificacaoN1(n1);

    const { resultado, etapa } = await passoClassificacaoN2Somente(
      payload,
      meta,
      n1.catalogoId as MateriaCorpusId
    );
    etapas.push(etapa.detalhe);

    const versao = versaoN2(resultado, n1);
    const campos = camposClassificacaoFromResultado(resultado, versao);
    const { materia, assunto } = labelsFromEscopoN2(resultado);

    await prisma.provaQuestao.update({
      where: { id: q.id },
      data: {
        materia,
        assunto,
        conhecimentoEscopoId: campos.conhecimentoEscopoId,
        conhecimentoDominioId: campos.conhecimentoDominioId,
        classificacaoVersao: campos.classificacaoVersao,
        classificacaoConfianca: campos.classificacaoConfianca,
        classificacaoSecundariosJson: campos.classificacaoSecundariosJson,
        conceitosCanonicosJson: campos.conceitosCanonicosJson,
        // N3 fica para fase 3 — não sobrescrever se já existir? Limpar ao re-N2:
        conhecimentoExigido: null,
      },
    });

    if (campos.conhecimentoEscopoId && !campos.conhecimentoEscopoId.endsWith(".__nao_classificado")) {
      ok++;
    }
    processadas++;
  }

  etapas.push(`N2 concluído: ${ok}/${processadas} com escopo real`);

  return {
    total: questoes.length,
    processadas,
    ok,
    falhas: processadas - ok,
    avisos,
    etapas,
  };
}

/** FASE 3 — N3: conhecimento exigido. Exige N2 (escopoId) gravado. */
export async function executarFaseN3Prova(provaId: string): Promise<ResultadoFaseProva> {
  const { prova, questoes, trechos } = await carregarContextoProva(provaId);
  const avisos: string[] = [];
  const etapas: string[] = ["═══ FASE N3 — conhecimento exigido ═══"];
  let ok = 0;
  let processadas = 0;

  const semN2 = questoes.filter((q) => !q.conhecimentoEscopoId?.trim());
  if (semN2.length > 0) {
    throw new Error(
      `N2 incompleto: ${semN2.length}/${questoes.length} questão(ões) sem escopo. ` +
        `Rode e valide o N2 em todas antes do N3.`
    );
  }

  for (const q of questoes) {
    const n1 = parseClassificacaoN1(q.classificacaoN1Json);
    const escopoId = q.conhecimentoEscopoId?.trim();
    if (!n1Completo(n1) || !n1 || !escopoId) continue;

    const payload = questaoParaPayload(q, trechos, prova.banca ?? undefined, questoes);
    const meta = metaFromClassificacaoN1(n1);
    meta.catalogoDestino = n1.catalogoId;

    const { conhecimentoExigido, etapa } = await passoClassificacaoN3(payload, meta, escopoId);
    etapas.push(etapa.detalhe);

    await prisma.provaQuestao.update({
      where: { id: q.id },
      data: {
        conhecimentoExigido,
        classificacaoVersao: `${q.classificacaoVersao ?? ""}|n3-v1`.replace(/^\|/, ""),
      },
    });

    if (conhecimentoExigido?.trim()) ok++;
    processadas++;
  }

  etapas.push(`N3 concluído: ${ok}/${processadas} com conhecimento exigido`);

  return {
    total: questoes.length,
    processadas,
    ok,
    falhas: processadas - ok,
    avisos,
    etapas,
  };
}
