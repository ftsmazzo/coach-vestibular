/**
 * Pipeline de classificação PROVA — uma questão por vez, um passo por chamada IA.
 * Cada passo recebe metadados acumulados dos passos anteriores.
 */

import { responsesComSchema } from "@/lib/openai-responses-client";
import {
  montarBlocoQuestaoV11,
  montarCatalogoReduzido,
  montarSystemClassificacaoV11,
} from "@/lib/conhecimento-catalog/prompt-classificacao";
import {
  carregarCatalogoMateria,
  idFallbackNaoClassificado,
  indexarEscopos,
  promptClassificacaoDisciplina,
  promptRoteamentoHumanas,
  promptRoteamentoLinguagens,
} from "@/lib/conhecimento-catalog/load";
import type { CatalogDisciplinaId } from "@/lib/conhecimento-catalog/disciplinas-split";
import {
  DISCIPLINAS_HUMANAS,
  DISCIPLINAS_LINGUAGENS,
  ehCatalogDisciplinaSplit,
  prefixoValidoParaDisciplina,
} from "@/lib/conhecimento-catalog/disciplinas-split";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";
import {
  itemParaResultadoFromIa,
} from "@/lib/enem-classificar/classificar-catalogo-v11";
import { resolverChaveFonteId } from "@/lib/enem-classificar/fonte-id-utils";
import {
  triarMateriaNatureza,
  type MateriaNatureza,
  type TriagemNatureza,
} from "@/lib/enem-classificar/triagem-natureza";
import { triarQuestaoIA } from "@/lib/enem-classificar/triagem-ia";
import {
  fisicaPrevaleceSobreMatematica,
  REGRA_FISICA_PREVALECE_ID,
} from "@/lib/enem-classificar/fisica-vs-matematica";
import type { ClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { CLASSIFICACAO_N1_VERSAO } from "@/lib/classificacao-n1-types";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";

export type PayloadQuestaoCompleto = {
  fonteId: string;
  numero: number;
  idiomaVariante?: string;
  areaBloco?: string | null;
  banca?: string | null;
  enunciado: string;
  alternativas: string;
  textoBase?: string | null;
  gabarito?: string | null;
  observacoes?: string | null;
};

export type MetaPipelineProva = {
  area?: "linguagens" | "humanas" | "exatas" | "natureza";
  triagemNatureza?: {
    materia: MateriaNatureza | null;
    confianca: number;
    motivo: string;
    via: "heuristica" | "ia";
  };
  rota?: {
    disciplinaId: string;
    criterio: string;
    confianca: number;
    justificativa: string;
    area: "humanas" | "linguagens";
  };
  catalogoDestino?: string;
};

export type EtapaPipeline = {
  passo: string;
  detalhe: string;
};

const MAP_NATUREZA_CORPUS: Record<MateriaNatureza, MateriaCorpusId> = {
  Biologia: "biologia",
  Química: "quimica",
  Física: "fisica",
};

function montarMetadadosAcumulados(meta: MetaPipelineProva): string {
  const linhas: string[] = ["=== METADADOS ACUMULADOS (passos anteriores) ==="];
  if (meta.area) linhas.push(`Área/bloco: ${meta.area}`);
  if (meta.triagemNatureza) {
    const t = meta.triagemNatureza;
    linhas.push(
      `Triagem Natureza (${t.via}): ${t.materia ?? "indefinido"} · conf=${t.confianca.toFixed(2)} · ${t.motivo}`
    );
  }
  if (meta.rota) {
    linhas.push(
      `Rota disciplinar (${meta.rota.area}): ${meta.rota.disciplinaId} · crit=${meta.rota.criterio} · conf=${meta.rota.confianca.toFixed(2)} · ${meta.rota.justificativa}`
    );
  }
  if (meta.catalogoDestino) linhas.push(`Catálogo destino: ${meta.catalogoDestino}`);
  if (linhas.length === 1) return "";
  return `${linhas.join("\n")}\n\n`;
}

function blocoQuestaoCompleto(
  q: PayloadQuestaoCompleto,
  meta?: MetaPipelineProva
): string {
  const metaAcum = meta ? montarMetadadosAcumulados(meta) : "";
  const hints = [
    `numero=${q.numero}`,
    q.idiomaVariante ? `idiomaVariante=${q.idiomaVariante}` : null,
    q.areaBloco ? `areaBloco=${q.areaBloco}` : null,
    q.banca ? `banca=${q.banca}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const tb = q.textoBase?.trim();
  const textoBase = tb ? `Texto-base / contexto compartilhado:\n${tb}\n\n` : "";
  const obs = q.observacoes?.trim();
  const observacoes = obs ? `Observações do revisor:\n${obs}\n\n` : "";

  const enunciado = [q.enunciado.trim()].filter(Boolean).join("\n\n");

  return (
    metaAcum +
    `Metadados da questão: ${hints}\n\n` +
    textoBase +
    observacoes +
    montarBlocoQuestaoV11({
      fonteId: q.fonteId,
      enunciado,
      alternativas: q.alternativas.trim(),
      gabarito: q.gabarito,
      numero: q.numero,
      idioma: q.idiomaVariante === "INGLES" ? "ingles" : q.idiomaVariante === "ESPANHOL" ? "espanhol" : null,
    })
  );
}

function textoCompleto(q: PayloadQuestaoCompleto): string {
  return [
    q.textoBase?.trim(),
    q.enunciado.trim(),
    q.alternativas.trim(),
    q.observacoes?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

type RotaIa = {
  disciplinaId: string;
  criterio: string;
  confianca: number;
  justificativa: string;
  sinalizadorRevisao: boolean;
};

type RotaLote = {
  classificacoes: Array<{ fonteId: string; rota: RotaIa }>;
};

function schemaRoteamento(enumDisciplinas: string[]) {
  return {
    name: "roteamento_disciplina_unitario",
    strict: true,
    schema: {
      type: "object",
      properties: {
        classificacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fonteId: { type: "string" },
              rota: {
                type: "object",
                properties: {
                  disciplinaId: { type: "string", enum: enumDisciplinas },
                  criterio: { type: "string" },
                  confianca: { type: "number" },
                  justificativa: { type: "string" },
                  sinalizadorRevisao: { type: "boolean" },
                },
                required: [
                  "disciplinaId",
                  "criterio",
                  "confianca",
                  "justificativa",
                  "sinalizadorRevisao",
                ],
                additionalProperties: false,
              },
            },
            required: ["fonteId", "rota"],
            additionalProperties: false,
          },
        },
      },
      required: ["classificacoes"],
      additionalProperties: false,
    },
  } as const;
}

function rotaDeterministicaLinguagens(
  q: PayloadQuestaoCompleto,
  rota: RotaIa
): RotaIa {
  if (q.idiomaVariante === "INGLES") {
    if (rota.disciplinaId === "ingles") return rota;
    return {
      disciplinaId: "ingles",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.95),
      justificativa: `Rota forçada por idiomaVariante=INGLES; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }
  if (q.idiomaVariante === "ESPANHOL") {
    if (rota.disciplinaId === "espanhol") return rota;
    return {
      disciplinaId: "espanhol",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.95),
      justificativa: `Rota forçada por idiomaVariante=ESPANHOL; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }
  if (rota.disciplinaId === "indefinido") {
    return {
      disciplinaId: "portugues",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.55),
      justificativa:
        "Variante COMUM em Linguagens — roteada para português (comando em PT não exclui LP).",
      sinalizadorRevisao: true,
    };
  }
  return rota;
}

/** Passo 2a — triagem Bio/Quím/Fís (heurística, depois IA se necessário). */
export async function passoTriagemNatureza(
  q: PayloadQuestaoCompleto,
  meta: MetaPipelineProva
): Promise<{ meta: MetaPipelineProva; etapa: EtapaPipeline; materiaId: MateriaCorpusId | null }> {
  const texto = textoCompleto(q);
  const heur = triarMateriaNatureza(texto);
  let tri: TriagemNatureza = heur;
  let via: "heuristica" | "ia" = "heuristica";

  if (!heur.materia) {
    tri = await triarQuestaoIA(q.fonteId, texto);
    via = "ia";
  }

  const materiaId = tri.materia ? MAP_NATUREZA_CORPUS[tri.materia] : null;
  const metaOut: MetaPipelineProva = {
    ...meta,
    triagemNatureza: { ...tri, via },
  };

  return {
    meta: metaOut,
    materiaId,
    etapa: {
      passo: "triagem-natureza",
      detalhe: materiaId
        ? `Q${q.numero} → ${tri.materia} (${via}, conf=${tri.confianca.toFixed(2)})`
        : `Q${q.numero} → triagem inconclusiva (${via})`,
    },
  };
}

/** Passo 2b — roteamento disciplinar (1 questão, 1 prompt). */
export async function passoRoteamentoDisciplina(
  q: PayloadQuestaoCompleto,
  meta: MetaPipelineProva,
  area: "humanas" | "linguagens"
): Promise<{ meta: MetaPipelineProva; etapa: EtapaPipeline; rota: RotaIa | null }> {
  const enumDisciplinas =
    area === "humanas"
      ? [...DISCIPLINAS_HUMANAS, "indefinido"]
      : [...DISCIPLINAS_LINGUAGENS, "indefinido"];

  const promptMd =
    area === "humanas" ? promptRoteamentoHumanas() : promptRoteamentoLinguagens();
  const systemPrompt =
    promptMd?.trim() ||
    (area === "humanas"
      ? "Roteie UMA questão de Ciências Humanas para historia, geografia, filosofia, sociologia ou indefinido."
      : "Roteie UMA questão de Linguagens para portugues, ingles, espanhol ou indefinido.");

  const bloco = blocoQuestaoCompleto(q, meta);

  const data = await responsesComSchema<RotaLote>({
    systemPrompt,
    instrucao:
      `Roteie SOMENTE esta questão (disciplina, sem escopo N2). ` +
      `Retorne fonteId exatamente como "${q.fonteId}".\n\n${bloco}`,
    schema: schemaRoteamento(enumDisciplinas),
    content: [],
  });

  const row = data.classificacoes[0];
  const fonteOk = row
    ? resolverChaveFonteId(row.fonteId, [q.fonteId]) === q.fonteId
    : false;

  let rota: RotaIa | null = fonteOk && row ? row.rota : null;
  if (!rota) {
    rota = {
      disciplinaId: "indefinido",
      criterio: "incerto",
      confianca: 0,
      justificativa: "IA não retornou rota válida.",
      sinalizadorRevisao: true,
    };
  }

  if (area === "linguagens") {
    rota = rotaDeterministicaLinguagens(q, rota);
  }

  const metaOut: MetaPipelineProva = {
    ...meta,
    rota: {
      disciplinaId: rota.disciplinaId,
      criterio: rota.criterio,
      confianca: rota.confianca,
      justificativa: rota.justificativa,
      area,
    },
  };

  return {
    meta: metaOut,
    rota,
    etapa: {
      passo: `roteamento-${area}`,
      detalhe: `Q${q.numero} → ${rota.disciplinaId} (conf=${rota.confianca.toFixed(2)})`,
    },
  };
}

/** Passo N2 — somente escopo no catálogo (sem N3). */
export async function passoClassificacaoN2Somente(
  q: PayloadQuestaoCompleto,
  meta: MetaPipelineProva,
  catalogoId: MateriaCorpusId | CatalogDisciplinaId
): Promise<{ resultado: ResultadoClassificacao; etapa: EtapaPipeline }> {
  const catalog = carregarCatalogoMateria(catalogoId);
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras.confiancaMinima ?? 0.45;
  const fallbackId = idFallbackNaoClassificado(catalog.materiaId);
  const promptMd = promptClassificacaoDisciplina(catalogoId);
  const systemPrompt =
    (promptMd?.trim() || montarSystemClassificacaoV11(catalog)) +
    "\n\nIMPORTANTE: Esta é a FASE N2 apenas. NÃO preencha conhecimento exigido (N3) — será uma fase separada.";

  const catalogoJson = JSON.stringify(montarCatalogoReduzido(escopos), null, 0);
  const bloco = blocoQuestaoCompleto(q, { ...meta, catalogoDestino: catalogoId });

  const SCHEMA_N2 = {
    name: "classificacao_n2_sem_n3",
    strict: true,
    schema: {
      type: "object",
      properties: {
        classificacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fonteId: { type: "string" },
              primario: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  assuntoId: { type: "string" },
                  conceitoCanonic: { type: ["string", "null"] },
                  confianca: { type: "number" },
                },
                required: ["id", "assuntoId", "conceitoCanonic", "confianca"],
                additionalProperties: false,
              },
              secundarios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    confianca: { type: "number" },
                  },
                  required: ["id", "confianca"],
                  additionalProperties: false,
                },
              },
              justificativa: { type: "string" },
              desempateAplicado: { type: ["string", "null"] },
              sinalizadorRevisao: { type: "boolean" },
            },
            required: [
              "fonteId",
              "primario",
              "secundarios",
              "justificativa",
              "desempateAplicado",
              "sinalizadorRevisao",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["classificacoes"],
      additionalProperties: false,
    },
  } as const;

  const data = await responsesComSchema<{
    classificacoes: Array<
      Parameters<typeof itemParaResultadoFromIa>[0] & {
        conhecimentoExigidoN3?: string[];
      }
    >;
  }>({
    systemPrompt,
    instrucao:
      `FASE N2 — escolha escopo no catálogo (${catalog.materiaLabel}).\n` +
      `CATÁLOGO:\n${catalogoJson}\n\nFallback: ${fallbackId}\n\n` +
      `fonteId="${q.fonteId}". NÃO gere N3.\n\n${bloco}`,
    schema: SCHEMA_N2,
    content: [],
  });

  const row = data.classificacoes[0];
  const ids = new Set([...escopos.keys(), fallbackId]);

  let resultado: ResultadoClassificacao;
  if (!row || resolverChaveFonteId(row.fonteId, [q.fonteId]) !== q.fonteId) {
    resultado = {
      status: "review",
      confianca: 0,
      materiaId: catalog.materiaId,
      assuntoId: null,
      dominioId: null,
      escopoId: fallbackId,
      conceitoCanonic: null,
      motivo: "IA não retornou N2.",
      sinalizadorRevisao: true,
      disciplinaOriginalId: meta.rota?.disciplinaId,
      rotaCriterio: meta.rota?.criterio,
      conhecimentoExigido: null,
    };
  } else {
    const rowComN3 = { ...row, conhecimentoExigidoN3: [] as string[] };
    resultado = itemParaResultadoFromIa(
      rowComN3,
      escopos,
      catalog.materiaId,
      confiancaMinima,
      fallbackId,
      ids
    );
    resultado = { ...resultado, conhecimentoExigido: null };
    if (meta.rota) {
      resultado = {
        ...resultado,
        disciplinaOriginalId: meta.rota.disciplinaId,
        rotaCriterio: meta.rota.criterio,
      };
    }
  }

  const disc = catalogoId;
  if (ehCatalogDisciplinaSplit(disc)) {
    const escopoId = resultado.escopoId;
    if (escopoId && !prefixoValidoParaDisciplina(escopoId, disc)) {
      resultado = {
        ...resultado,
        escopoId: fallbackId,
        status: "review",
        sinalizadorRevisao: true,
        motivo: `Escopo ${escopoId} fora do prefixo de ${disc}.`,
      };
    }
    resultado = { ...resultado, materiaId: disc };
  }

  return {
    resultado,
    etapa: {
      passo: `n2-${catalogoId}`,
      detalhe: `Q${q.numero} → ${resultado.escopoId ?? "sem escopo"} (conf=${(resultado.confianca ?? 0).toFixed(2)})`,
    },
  };
}

/** Passo N3 — conhecimento exigido (texto livre), usa N1+N2 já gravados. */
export async function passoClassificacaoN3(
  q: PayloadQuestaoCompleto,
  meta: MetaPipelineProva,
  escopoId: string
): Promise<{ conhecimentoExigido: string | null; etapa: EtapaPipeline }> {
  const entry = indexGlobalEscopos().get(escopoId);
  const escopoLabel = entry?.escopoLabel ?? escopoId;
  const bloco = blocoQuestaoCompleto(q, meta);

  const SCHEMA_N3 = {
    name: "classificacao_n3_conhecimento",
    strict: true,
    schema: {
      type: "object",
      properties: {
        fonteId: { type: "string" },
        conhecimentoExigidoN3: { type: "array", items: { type: "string" } },
        justificativa: { type: "string" },
      },
      required: ["fonteId", "conhecimentoExigidoN3", "justificativa"],
      additionalProperties: false,
    },
  } as const;

  const data = await responsesComSchema<{
    fonteId: string;
    conhecimentoExigidoN3: string[];
    justificativa: string;
  }>({
    systemPrompt:
      "Você descreve o CONHECIMENTO EXIGIDO (N3) para resolver uma questão de vestibular. " +
      "Texto livre, objetivo, em português. Use o escopo N2 já definido como guia — não reclassifique o escopo.",
    instrucao:
      `FASE N3 — somente conhecimento exigido.\n` +
      `Escopo N2: ${escopoId} (${escopoLabel})\n` +
      `Catálogo destino (N1): ${meta.catalogoDestino ?? "?"}\n\n` +
      `fonteId="${q.fonteId}".\n\n${bloco}`,
    schema: SCHEMA_N3,
    content: [],
  });

  const n3 = (data.conhecimentoExigidoN3 ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  return {
    conhecimentoExigido: n3 || null,
    etapa: {
      passo: "n3",
      detalhe: `Q${q.numero} → N3 ${n3 ? "ok" : "vazio"}`,
    },
  };
}

export function metaFromClassificacaoN1(n1: ClassificacaoN1): MetaPipelineProva {
  return {
    area: n1.area,
    catalogoDestino: n1.catalogoId,
    triagemNatureza: n1.triagemNatureza
      ? {
          materia: (n1.triagemNatureza.materia as MateriaNatureza | null) ?? null,
          confianca: n1.confianca,
          motivo: n1.triagemNatureza.motivo,
          via: n1.triagemNatureza.via,
        }
      : undefined,
    rota: n1.rota
      ? {
          disciplinaId: n1.rota.disciplinaId,
          criterio: n1.criterio,
          confianca: n1.confianca,
          justificativa: n1.justificativa,
          area: n1.rota.area,
        }
      : undefined,
  };
}

/** FASE N1 — roteamento / triagem → catálogo destino (persistir antes de N2). */
export async function executarN1Questao(
  q: PayloadQuestaoCompleto,
  area: MetaPipelineProva["area"]
): Promise<{ n1: ClassificacaoN1 | null; etapas: EtapaPipeline[]; avisos: string[] }> {
  const etapas: EtapaPipeline[] = [];
  const avisos: string[] = [];

  if (!area) {
    avisos.push(`Q${q.numero}: área indefinida.`);
    return { n1: null, etapas, avisos };
  }

  etapas.push({ passo: "n1-area", detalhe: `Q${q.numero} → área ${area}` });
  const classificadoEm = new Date().toISOString();
  let meta: MetaPipelineProva = { area };

  if (area === "exatas") {
    const prev = fisicaPrevaleceSobreMatematica(textoCompleto(q));
    if (prev.prevalece) {
      const n1: ClassificacaoN1 = {
        versao: CLASSIFICACAO_N1_VERSAO,
        area: "natureza",
        catalogoId: "fisica",
        confianca: prev.confianca,
        criterio: REGRA_FISICA_PREVALECE_ID,
        justificativa:
          `Área Exatas no bloco, mas fenômeno físico prevalece: ${prev.motivo}. ` +
          "Não rotear para Matemática só por cálculo/gráfico/proporção.",
        triagemNatureza: {
          materia: "Física",
          via: "heuristica",
          motivo: prev.motivo,
        },
        classificadoEm,
      };
      etapas.push({
        passo: "n1-cat",
        detalhe: `Q${q.numero} → fisica (${REGRA_FISICA_PREVALECE_ID}, conf=${prev.confianca.toFixed(2)})`,
      });
      return { n1, etapas, avisos };
    }

    const n1: ClassificacaoN1 = {
      versao: CLASSIFICACAO_N1_VERSAO,
      area,
      catalogoId: "matematica",
      confianca: 1,
      criterio: "area_bloco",
      justificativa: "Área Exatas → catálogo matemática.",
      classificadoEm,
    };
    etapas.push({ passo: "n1-cat", detalhe: `Q${q.numero} → matematica` });
    return { n1, etapas, avisos };
  }

  if (area === "natureza") {
    const tri = await passoTriagemNatureza(q, meta);
    meta = tri.meta;
    etapas.push(tri.etapa);
    if (!tri.materiaId) {
      avisos.push(`Q${q.numero}: triagem Natureza inconclusiva.`);
      return { n1: null, etapas, avisos };
    }
    const n1: ClassificacaoN1 = {
      versao: CLASSIFICACAO_N1_VERSAO,
      area,
      catalogoId: tri.materiaId,
      confianca: tri.meta.triagemNatureza?.confianca ?? 0.5,
      criterio: tri.meta.triagemNatureza?.via ?? "heuristica",
      justificativa: tri.meta.triagemNatureza?.motivo ?? "Triagem natureza",
      triagemNatureza: tri.meta.triagemNatureza
        ? {
            materia: tri.meta.triagemNatureza.materia,
            via: tri.meta.triagemNatureza.via,
            motivo: tri.meta.triagemNatureza.motivo,
          }
        : undefined,
      classificadoEm,
    };
    return { n1, etapas, avisos };
  }

  if (area === "humanas" || area === "linguagens") {
    const rot = await passoRoteamentoDisciplina(q, meta, area);
    meta = rot.meta;
    etapas.push(rot.etapa);
    if (!rot.rota || rot.rota.disciplinaId === "indefinido") {
      avisos.push(`Q${q.numero}: rota indefinida.`);
      return { n1: null, etapas, avisos };
    }
    const n1: ClassificacaoN1 = {
      versao: CLASSIFICACAO_N1_VERSAO,
      area,
      catalogoId: rot.rota.disciplinaId,
      confianca: rot.rota.confianca,
      criterio: rot.rota.criterio,
      justificativa: rot.rota.justificativa,
      rota: { disciplinaId: rot.rota.disciplinaId, area },
      classificadoEm,
    };
    return { n1, etapas, avisos };
  }

  avisos.push(`Q${q.numero}: área não suportada.`);
  return { n1: null, etapas, avisos };
}

export type ResultadoPipelineQuestao = {
  resultado: ResultadoClassificacao | null;
  meta: MetaPipelineProva;
  etapas: EtapaPipeline[];
  avisos: string[];
};

/** @deprecated Monolítico N1+N2 — use fases separadas em prova-classificacao-fases.ts */
export async function classificarQuestaoPipeline(
  q: PayloadQuestaoCompleto,
  area: MetaPipelineProva["area"]
): Promise<ResultadoPipelineQuestao> {
  const n1r = await executarN1Questao(q, area);
  if (!n1r.n1) {
    return { resultado: null, meta: { area }, etapas: n1r.etapas, avisos: n1r.avisos };
  }
  const meta = metaFromClassificacaoN1(n1r.n1);
  const n2 = await passoClassificacaoN2Somente(
    q,
    meta,
    n1r.n1.catalogoId as MateriaCorpusId | CatalogDisciplinaId
  );
  return {
    resultado: n2.resultado,
    meta,
    etapas: [...n1r.etapas, n2.etapa],
    avisos: n1r.avisos,
  };
}
