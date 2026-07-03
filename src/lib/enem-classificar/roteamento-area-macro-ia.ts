import { responsesComSchema } from "@/lib/openai-responses-client";
import type { AreaBlocoId } from "@/lib/areas-bloco";
import { promptRoteamentoAreaMacro } from "@/lib/conhecimento-catalog/load";
import { INSTRUCAO_SISTEMA_FASE_N1 } from "@/lib/enem-classificar/instrucao-fase-n1";

export type AreaMacroIa = AreaBlocoId | "indefinido";

export type RotaAreaMacroIa = {
  areaId: AreaMacroIa;
  confianca: number;
  criterio: string;
  justificativa: string;
  sinalizadorRevisao: boolean;
};

type IaAreaMacroRes = {
  classificacoes: Array<{
    fonteId: string;
    rota: {
      areaId: string;
      criterio: string;
      confianca: number;
      justificativa: string;
      sinalizadorRevisao: boolean;
    };
  }>;
};

const AREAS_VALIDAS = ["linguagens", "humanas", "natureza", "exatas", "indefinido"] as const;

const SCHEMA = {
  name: "roteamento_area_macro_n1",
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
                areaId: { type: "string", enum: [...AREAS_VALIDAS] },
                criterio: { type: "string" },
                confianca: { type: "number" },
                justificativa: { type: "string" },
                sinalizadorRevisao: { type: "boolean" },
              },
              required: [
                "areaId",
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

function parseAreaId(v: string): AreaMacroIa {
  return AREAS_VALIDAS.includes(v as (typeof AREAS_VALIDAS)[number])
    ? (v as AreaMacroIa)
    : "indefinido";
}

function systemPromptAreaMacro(): string {
  const promptMd = promptRoteamentoAreaMacro();
  const base =
    promptMd?.trim() ||
    "Roteie UMA questão de vestibular para linguagens, humanas, natureza, exatas ou indefinido.";
  return `${INSTRUCAO_SISTEMA_FASE_N1}\n\n${base}`;
}

/** Roteamento de área macro via IA — uma questão, uma chamada. */
export async function rotearAreaMacroQuestaoIA(
  fonteId: string,
  texto: string,
  ctx?: {
    banca?: string | null;
    idiomaVariante?: string | null;
    numero?: number;
  }
): Promise<RotaAreaMacroIa | null> {
  const hints = [
    ctx?.numero != null ? `numero=${ctx.numero}` : null,
    ctx?.banca ? `banca=${ctx.banca}` : null,
    ctx?.idiomaVariante ? `idiomaVariante=${ctx.idiomaVariante}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const bloco =
    (hints ? `Metadados: ${hints}\n\n` : "") +
    `fonteId=${fonteId}\n\n` +
    texto.replace(/!\[[^\]]*\]\([^)]+\)/g, "[imagem]").trim();

  const data = await responsesComSchema<IaAreaMacroRes>({
    systemPrompt: systemPromptAreaMacro(),
    instrucao:
      `Roteie SOMENTE esta questão para a área macro (sem disciplina N1). ` +
      `Retorne fonteId exatamente como "${fonteId}".\n\n${bloco}`,
    schema: SCHEMA,
    content: [],
  });

  const row = data.classificacoes[0];
  if (!row || row.fonteId !== fonteId) return null;

  return {
    areaId: parseAreaId(row.rota.areaId),
    confianca: row.rota.confianca,
    criterio: row.rota.criterio,
    justificativa: row.rota.justificativa,
    sinalizadorRevisao: row.rota.sinalizadorRevisao,
  };
}
