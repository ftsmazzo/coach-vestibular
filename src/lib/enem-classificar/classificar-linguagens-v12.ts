import { responsesComSchema } from "@/lib/openai-responses-client";
import {
  montarBlocoQuestaoV11,
  montarCatalogoReduzido,
  montarSystemClassificacaoLinguagensV12,
} from "@/lib/conhecimento-catalog/prompt-classificacao";
import { idFallbackNaoClassificado } from "@/lib/conhecimento-catalog/load";
import { sanitizarTextoPostgres } from "@/lib/sanitize-postgres-text";
import type {
  EscopoIndexEntry,
  MateriaCatalogo,
  ResultadoClassificacao,
} from "@/lib/conhecimento-catalog/types";
import type { DisciplinaLinguagens } from "./route-language-discipline";

export const CLASSIFICADOR_LING_V12 = "ia-catalogo-v12-ling";

const ROTAS_ASSUNTOS: Record<Exclude<DisciplinaLinguagens, "indefinido">, string[]> = {
  portugues: ["pt_interp", "pt_lit", "pt_gram", "pt_sem", "pt_art", "pt_tec"],
  ingles: ["l2_en"],
  espanhol: ["l2_es"],
};

type IaLingV12Item = {
  fonteId: string;
  rota: {
    disciplinaOriginalId: DisciplinaLinguagens;
    criterio: string;
    confianca: number;
    justificativa?: string;
  };
  primario: {
    id: string;
    assuntoId?: string;
    conceitoCanonic?: string | null;
    confianca: number;
  };
  secundarios?: Array<{ id: string; confianca: number }>;
  conhecimentoExigidoN3?: string[];
  justificativa?: string;
  desempateAplicado?: string | null;
  sinalizadorRevisao?: boolean;
};

type IaLingV12Lote = { classificacoes: IaLingV12Item[] };

const SCHEMA_LING_V12 = {
  name: "classificacao_linguagens_v12",
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
                disciplinaOriginalId: {
                  type: "string",
                  enum: ["portugues", "ingles", "espanhol", "indefinido"],
                },
                criterio: { type: "string" },
                confianca: { type: "number" },
                justificativa: { type: "string" },
              },
              required: ["disciplinaOriginalId", "criterio", "confianca", "justificativa"],
              additionalProperties: false,
            },
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
            conhecimentoExigidoN3: {
              type: "array",
              items: { type: "string" },
            },
            justificativa: { type: "string" },
            desempateAplicado: { type: ["string", "null"] },
            sinalizadorRevisao: { type: "boolean" },
          },
          required: [
            "fonteId",
            "rota",
            "primario",
            "secundarios",
            "conhecimentoExigidoN3",
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

export type QuestaoLinguagensV12 = {
  fonteId: string;
  enunciado: string;
  alternativas: string;
  gabarito?: string | null;
  /** Metadados opcionais — hint, não regra (ENEM, PDF, simulado). */
  numero?: number;
  idioma?: string | null;
  banca?: string | null;
  origem?: string | null;
};

function escopoNaRota(
  escopoId: string,
  disciplina: DisciplinaLinguagens,
  escopos: Map<string, EscopoIndexEntry>,
  fallbackId: string
): boolean {
  if (escopoId === fallbackId) return true;
  if (disciplina === "indefinido") return false;
  const entry = escopos.get(escopoId);
  if (!entry) return false;
  return ROTAS_ASSUNTOS[disciplina].includes(entry.assuntoId);
}

function itemParaResultado(
  row: IaLingV12Item,
  escopos: Map<string, EscopoIndexEntry>,
  confiancaMinima: number,
  fallbackId: string,
  ids: Set<string>
): ResultadoClassificacao {
  const rota = row.rota;
  let primarioId = row.primario.id;
  const rotaOk = escopoNaRota(primarioId, rota.disciplinaOriginalId, escopos, fallbackId);
  const idOk = ids.has(primarioId);

  if (!idOk || !rotaOk) {
    primarioId = fallbackId;
  }

  const entry = escopos.get(primarioId);
  const confianca = row.primario.confianca ?? 0;
  const ehFallback = primarioId === fallbackId;
  const revisao =
    row.sinalizadorRevisao === true ||
    rota.disciplinaOriginalId === "indefinido" ||
    ehFallback ||
    confianca < confiancaMinima ||
    !rotaOk;

  const secundariosValidos = (row.secundarios ?? [])
    .filter(
      (s) =>
        ids.has(s.id) &&
        s.id !== primarioId &&
        s.id !== fallbackId &&
        escopoNaRota(s.id, rota.disciplinaOriginalId, escopos, fallbackId)
    )
    .slice(0, 2)
    .map((s) => ({ escopoId: s.id, confianca: s.confianca }));

  const n3 = (row.conhecimentoExigidoN3 ?? [])
    .map((s) => sanitizarTextoPostgres(s) ?? "")
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  const status =
    ehFallback || revisao ? "review" : confianca >= confiancaMinima + 0.1 ? "classified" : "review";

  return {
    status,
    confianca,
    materiaId: "linguagens",
    assuntoId: entry?.assuntoId ?? row.primario.assuntoId ?? null,
    dominioId: entry?.dominioId ?? null,
    escopoId: ehFallback ? fallbackId : entry!.escopoId,
    conceitoCanonic: row.primario.conceitoCanonic ?? entry?.conceitoCanonic ?? null,
    disciplinaOriginalId: rota.disciplinaOriginalId,
    rotaCriterio: rota.criterio,
    motivo: row.justificativa ?? rota.justificativa ?? "IA linguagens v12",
    conhecimentoExigido: n3 || null,
    escoposSecundarios: secundariosValidos.length ? secundariosValidos : undefined,
    sinalizadorRevisao: revisao,
    justificativa: row.justificativa ?? null,
  };
}

function aplicarRotaDeterministicaPorIdioma(
  item: QuestaoLinguagensV12,
  resultado: ResultadoClassificacao,
  escopos: Map<string, EscopoIndexEntry>,
  fallbackId: string
): ResultadoClassificacao {
  const hint = item.idioma;
  if (hint !== "ingles" && hint !== "espanhol") return resultado;

  const disc = hint;
  const allowed = ROTAS_ASSUNTOS[disc];
  const entry = resultado.escopoId ? escopos.get(resultado.escopoId) : null;
  const escopoOk =
    resultado.escopoId === fallbackId ||
    (entry != null && (entry.ehFallback || allowed.includes(entry.assuntoId)));

  return {
    ...resultado,
    disciplinaOriginalId: disc,
    rotaCriterio: "metadata",
    sinalizadorRevisao:
      resultado.sinalizadorRevisao === true ||
      resultado.disciplinaOriginalId !== disc ||
      !escopoOk,
    status:
      !escopoOk || resultado.escopoId === fallbackId ? "review" : resultado.status,
    motivo:
      resultado.disciplinaOriginalId !== disc
        ? `Rota forçada por idiomaVariante (${disc}); IA sugeriu ${resultado.disciplinaOriginalId ?? "?"}.`
        : resultado.motivo,
  };
}

/**
 * Classificação Linguagens v1.2 — prova-agnóstica.
 * Uma chamada IA: rota (PT/EN/ES) + escopo N2 via catálogo (sem Q6+ nem heurística de palavras).
 */
export async function classificarLoteLinguagensV12(
  items: QuestaoLinguagensV12[],
  catalog: MateriaCatalogo,
  escopos: Map<string, EscopoIndexEntry>
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const confiancaMinima = catalog.regras.confiancaMinima ?? 0.45;
  const fallbackId = idFallbackNaoClassificado("linguagens");
  const ids = new Set([...escopos.keys(), fallbackId]);
  const catalogoJson = JSON.stringify(montarCatalogoReduzido(escopos));

  const blocos = items
    .map((q) => {
      const metaParts = [
        q.origem ? `origem=${q.origem}` : null,
        q.numero != null ? `numero=${q.numero}` : null,
        q.idioma ? `idioma=${q.idioma}` : null,
        q.banca ? `banca=${q.banca}` : null,
      ].filter(Boolean);
      const meta = metaParts.length ? `Metadados (hints): ${metaParts.join(" ")}\n` : "";
      return meta + montarBlocoQuestaoV11(q);
    })
    .join("\n\n");

  const data = await responsesComSchema<IaLingV12Lote>({
    systemPrompt: montarSystemClassificacaoLinguagensV12(catalog),
    instrucao:
      `CATÁLOGO LINGUAGENS (todos os escopos N2 — rota + primário):\n${catalogoJson}\n\n` +
      `Fallback se incerto: ${fallbackId}\n\n` +
      `Classifique cada questão (primeiro rota PT/EN/ES pelo texto-base, depois escopo N2):\n${blocos}`,
    schema: SCHEMA_LING_V12,
    content: [],
  });

  for (const row of data.classificacoes) {
    const item = items.find((q) => q.fonteId === row.fonteId);
    const base = itemParaResultado(row, escopos, confiancaMinima, fallbackId, ids);
    map.set(
      row.fonteId,
      item ? aplicarRotaDeterministicaPorIdioma(item, base, escopos, fallbackId) : base
    );
  }

  for (const q of items) {
    if (!map.has(q.fonteId)) {
      map.set(q.fonteId, {
        status: "review",
        confianca: 0,
        materiaId: "linguagens",
        assuntoId: null,
        dominioId: null,
        escopoId: fallbackId,
        conceitoCanonic: null,
        motivo: "IA não retornou item",
        sinalizadorRevisao: true,
      });
    }
  }

  return map;
}

export function versaoClassificacaoLingV12(resultado: ResultadoClassificacao): string {
  const disc = resultado.disciplinaOriginalId ?? "indefinido";
  const crit = resultado.rotaCriterio ?? "ia";
  return `${CLASSIFICADOR_LING_V12}|disc=${disc}|crit=${crit}|rc=${(resultado.confianca ?? 0).toFixed(2)}`;
}
