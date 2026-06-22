import { responsesComSchema } from "@/lib/openai-responses-client";
import type { EscopoIndexEntry, ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

export function iaClassificacaoDisponivel(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type IaLoteRes = {
  classificacoes: Array<{
    fonteId: string;
    escopoId: string | null;
    confianca: number;
    motivo?: string;
  }>;
};

const SCHEMA = {
  name: "enem_classificacao_n2",
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
            escopoId: { type: ["string", "null"] },
            confianca: { type: "number" },
            motivo: { type: "string" },
          },
          required: ["fonteId", "escopoId", "confianca", "motivo"],
          additionalProperties: false,
        },
      },
    },
    required: ["classificacoes"],
    additionalProperties: false,
  },
} as const;

function montarListaN2(escopos: Map<string, EscopoIndexEntry>): string {
  return [...escopos.values()]
    .map((e) => `${e.escopoId} — ${e.escopoLabel}`)
    .join("\n");
}

function resultadoDeIa(
  row: IaLoteRes["classificacoes"][number],
  escopos: Map<string, EscopoIndexEntry>
): ResultadoClassificacao {
  if (!row.escopoId) {
    return {
      status: "unclassified",
      confianca: row.confianca,
      materiaId: "biologia",
      assuntoId: null,
      dominioId: null,
      escopoId: null,
      conceitoCanonic: null,
      motivo: row.motivo ?? "IA: nenhum N2",
    };
  }

  const entry = escopos.get(row.escopoId);
  if (!entry) {
    return {
      status: "unclassified",
      confianca: 0,
      materiaId: null,
      assuntoId: null,
      dominioId: null,
      escopoId: null,
      conceitoCanonic: null,
      motivo: `ID inválido: ${row.escopoId}`,
    };
  }

  const status = row.confianca >= 0.55 ? "classified" : row.confianca >= 0.35 ? "review" : "unclassified";

  return {
    status,
    confianca: row.confianca,
    materiaId: entry.materiaId,
    assuntoId: entry.assuntoId,
    dominioId: entry.dominioId,
    escopoId: status === "unclassified" ? null : entry.escopoId,
    conceitoCanonic: entry.conceitoCanonic ?? null,
    motivo: row.motivo ?? "IA",
  };
}

/** Classifica lote via OpenAI — catálogo fechado (só IDs listados). */
export async function classificarLoteIA(
  items: Array<{ fonteId: string; texto: string }>,
  escopos: Map<string, EscopoIndexEntry>
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const blocos = items
    .map(
      (q, i) =>
        `### ${i + 1}. ${q.fonteId}\n${q.texto.slice(0, 1200).replace(/!\[[^\]]*\]\([^)]+\)/g, "[imagem]")}`
    )
    .join("\n\n");

  const data = await responsesComSchema<IaLoteRes>({
    systemPrompt:
      "Você classifica questões do ENEM de Biologia. Escolha EXATAMENTE um escopoId da lista. Use null SOMENTE se nenhum N2 for minimamente plausível. Prefira o melhor encaixe parcial a null. NUNCA invente IDs.",
    instrucao: `Catálogo N2 (escolha um ID ou null):\n${montarListaN2(escopos)}\n\nClassifique cada questão:\n${blocos}`,
    schema: SCHEMA,
    content: [],
  });

  for (const row of data.classificacoes) {
    map.set(row.fonteId, resultadoDeIa(row, escopos));
  }

  for (const q of items) {
    if (!map.has(q.fonteId)) {
      map.set(q.fonteId, {
        status: "unclassified",
        confianca: 0,
        materiaId: null,
        assuntoId: null,
        dominioId: null,
        escopoId: null,
        conceitoCanonic: null,
        motivo: "IA não retornou item",
      });
    }
  }

  return map;
}
