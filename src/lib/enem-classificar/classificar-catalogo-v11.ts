import { responsesComSchema } from "@/lib/openai-responses-client";
import {
  montarBlocoQuestaoV11,
  montarCatalogoReduzido,
  montarSystemClassificacaoV11,
  montarSystemClassificacaoLinguagensV12,
} from "@/lib/conhecimento-catalog/prompt-classificacao";
import { idFallbackNaoClassificado } from "@/lib/conhecimento-catalog/load";
import { sanitizarTextoPostgres } from "@/lib/sanitize-postgres-text";
import {
  aplicarMapaComChavesFonteId,
} from "@/lib/enem-classificar/fonte-id-utils";
import type {
  EscopoIndexEntry,
  MateriaCatalogo,
  ResultadoClassificacao,
} from "@/lib/conhecimento-catalog/types";

export const CLASSIFICADOR_CATALOGO_V11 = "ia-catalogo-v11";

type IaV11Item = {
  fonteId: string;
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

type IaV11Lote = {
  classificacoes: IaV11Item[];
};

const SCHEMA_V11 = {
  name: "classificacao_catalogo_v11",
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

function idsValidos(escopos: Map<string, EscopoIndexEntry>, fallbackId: string): Set<string> {
  return new Set([...escopos.keys(), fallbackId]);
}

export function itemParaResultadoFromIa(
  row: IaV11Item,
  escopos: Map<string, EscopoIndexEntry>,
  materiaId: string,
  confiancaMinima: number,
  fallbackId: string,
  ids: Set<string>
): ResultadoClassificacao {
  let primarioId = row.primario.id;
  if (!ids.has(primarioId)) {
    primarioId = fallbackId;
  }

  const entry = escopos.get(primarioId);
  const confianca = row.primario.confianca ?? 0;
  const ehFallback = primarioId === fallbackId;
  const revisao =
    row.sinalizadorRevisao === true || ehFallback || confianca < confiancaMinima;

  const secundariosValidos = (row.secundarios ?? [])
    .filter((s) => ids.has(s.id) && s.id !== primarioId && s.id !== fallbackId)
    .slice(0, 2)
    .map((s) => ({ escopoId: s.id, confianca: s.confianca }));

  const n3 = (row.conhecimentoExigidoN3 ?? [])
    .map((s) => sanitizarTextoPostgres(s) ?? "")
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  if (!entry && !ehFallback) {
    return {
      status: "unclassified",
      confianca: 0,
      materiaId,
      assuntoId: null,
      dominioId: null,
      escopoId: null,
      conceitoCanonic: null,
      motivo: `ID inválido: ${row.primario.id}`,
      conhecimentoExigido: n3 || null,
      sinalizadorRevisao: true,
    };
  }

  const status =
    ehFallback || revisao ? "review" : confianca >= confiancaMinima + 0.1 ? "classified" : "review";

  return {
    status,
    confianca,
    materiaId: entry?.materiaId ?? materiaId,
    assuntoId: entry?.assuntoId ?? row.primario.assuntoId ?? null,
    dominioId: entry?.dominioId ?? null,
    escopoId: ehFallback ? fallbackId : entry!.escopoId,
    conceitoCanonic: row.primario.conceitoCanonic ?? entry?.conceitoCanonic ?? null,
    motivo: row.justificativa ?? "IA v11",
    conhecimentoExigido: n3 || null,
    escoposSecundarios: secundariosValidos.length ? secundariosValidos : undefined,
    sinalizadorRevisao: revisao,
    justificativa: row.justificativa ?? null,
  };
}

export type QuestaoClassificacaoV11 = {
  fonteId: string;
  enunciado: string;
  alternativas: string;
  gabarito?: string | null;
  numero?: number;
  idioma?: string | null;
};

export type ClassificarV11Opts = {
  instrucaoExtra?: string;
  /** System prompt completo (ex.: markdown da disciplina v1.0). */
  systemPrompt?: string;
  /** @deprecated Linguagens agregado — usar classificarLoteLinguagensV20. */
  rotaDisciplina?: string;
};

/** Classificação IA v1.1+ — catálogo rico, multi-label, N3 livre, validação de IDs. */
export async function classificarLoteCatalogoV11(
  items: QuestaoClassificacaoV11[],
  catalog: MateriaCatalogo,
  escopos: Map<string, EscopoIndexEntry>,
  opts?: ClassificarV11Opts
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const confiancaMinima = catalog.regras.confiancaMinima ?? 0.45;
  const fallbackId = idFallbackNaoClassificado(catalog.materiaId);
  const ids = idsValidos(escopos, fallbackId);
  const catalogoJson = JSON.stringify(montarCatalogoReduzido(escopos));

  const blocos = items.map((q) => montarBlocoQuestaoV11(q)).join("\n\n");

  const systemPrompt =
    opts?.systemPrompt?.trim() ||
    (catalog.materiaId === "linguagens"
      ? montarSystemClassificacaoLinguagensV12(catalog)
      : montarSystemClassificacaoV11(catalog));

  const extra = opts?.instrucaoExtra?.trim();
  const instrucaoExtra = extra ? `\n\n${extra}` : "";

  const data = await responsesComSchema<IaV11Lote>({
    systemPrompt,
    instrucao:
      `CATÁLOGO (escopos N2 da rota permitida):\n${catalogoJson}\n\n` +
      `Fallback se incerto: ${fallbackId}\n` +
      instrucaoExtra +
      `\n\nClassifique cada questão:\n${blocos}`,
    schema: SCHEMA_V11,
    content: [],
  });

  const esperados = items.map((q) => q.fonteId);
  const bruto = new Map<string, ResultadoClassificacao>();
  for (const row of data.classificacoes) {
    bruto.set(
      row.fonteId,
      itemParaResultadoFromIa(row, escopos, catalog.materiaId, confiancaMinima, fallbackId, ids)
    );
  }
  for (const [k, v] of aplicarMapaComChavesFonteId(bruto, esperados)) {
    map.set(k, v);
  }

  for (const q of items) {
    if (!map.has(q.fonteId)) {
      map.set(q.fonteId, {
        status: "review",
        confianca: 0,
        materiaId: catalog.materiaId,
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
