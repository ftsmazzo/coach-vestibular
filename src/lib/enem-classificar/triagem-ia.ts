import { responsesComSchema } from "@/lib/openai-responses-client";
import type {
  MateriaNatureza,
  TriagemMateria,
  TriagemNatureza,
} from "@/lib/enem-classificar/triagem-natureza";
import { iaClassificacaoDisponivel } from "@/lib/enem-classificar/classificar-ia";

export { iaClassificacaoDisponivel };

type IaTriagemRes = {
  triagens: Array<{
    fonteId: string;
    materia: MateriaNatureza | null;
    confianca: number;
    motivo: string;
  }>;
};

const MATERIAS = ["Biologia", "Química", "Física", "Transversal"] as const;

const SCHEMA = {
  name: "enem_triagem_natureza",
  strict: true,
  schema: {
    type: "object",
    properties: {
      triagens: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fonteId: { type: "string" },
            materia: { type: ["string", "null"] },
            confianca: { type: "number" },
            motivo: { type: "string" },
          },
          required: ["fonteId", "materia", "confianca", "motivo"],
          additionalProperties: false,
        },
      },
    },
    required: ["triagens"],
    additionalProperties: false,
  },
} as const;

const CONFIANCA_MIN = 0.45;

function parseMateria(v: string | null): MateriaNatureza | null {
  if (!v) return null;
  return MATERIAS.includes(v as MateriaNatureza) ? (v as MateriaNatureza) : null;
}

function resultadoDeIa(row: IaTriagemRes["triagens"][number]): TriagemNatureza {
  const materia = parseMateria(row.materia);
  if (!materia || row.confianca < CONFIANCA_MIN) {
    return {
      materia: null,
      confianca: row.confianca,
      motivo: row.motivo ? `IA: ${row.motivo}` : "IA: confiança baixa",
    };
  }
  return {
    materia,
    confianca: row.confianca,
    motivo: `IA: ${row.motivo}`,
  };
}

/** Resolve lote via OpenAI — Bio / Química / Física / Transversal / null. */
export async function triarLoteIA(
  items: Array<{ fonteId: string; texto: string }>
): Promise<Map<string, TriagemNatureza>> {
  const map = new Map<string, TriagemNatureza>();
  if (items.length === 0) return map;

  const blocos = items
    .map(
      (q, i) =>
        `### ${i + 1}. ${q.fonteId}\n${q.texto.replace(/!\[[^\]]*\]\([^)]+\)/g, "[imagem]")}`
    )
    .join("\n\n");

  const data = await responsesComSchema<IaTriagemRes>({
    systemPrompt:
      "Você tria UMA questão de Ciências da Natureza em Biologia, Química, Física ou Transversal. " +
      "Classifique pelo conhecimento exigido no comando, não pelo tema superficial do texto-base. " +
      "Biologia: processos ecológicos, fisiológicos, celulares, genéticos, evolutivos — mesmo que apareçam termos químicos no texto. " +
      "Química: reações, fórmulas, concentração/cálculo químico, pH, estequiometria, separação de misturas (decantação, destilação) — mesmo com plantas ou produtos naturais no contexto. " +
      "Física: grandezas físicas, leis, fenômenos (movimento, força, energia, colisões, quantidade de movimento, óptica, eletricidade). " +
      "Transversal: metodologia científica, natureza da ciência, hipótese, experimentação, etapas do método — quando o comando cobra isso e não conteúdo disciplinar específico. " +
      "Números, gráficos ou álgebra para modelar fenômeno físico → Física, não null. " +
      "Não escolha Química só por nicotina, concentração ou metais se o comando cobra fisiologia. " +
      "Não escolha Biologia se o comando cobra método de separação de misturas. " +
      "Use null só se realmente não distinguir.",
    instrucao:
      items.length === 1
        ? `Classifique esta única questão (materia: Biologia | Química | Física | Transversal | null):\n\n${blocos}`
        : `Classifique cada questão (materia: Biologia | Química | Física | Transversal | null):\n\n${blocos}`,
    schema: SCHEMA,
    content: [],
  });

  for (const row of data.triagens) {
    map.set(row.fonteId, resultadoDeIa(row));
  }

  for (const q of items) {
    if (!map.has(q.fonteId)) {
      map.set(q.fonteId, {
        materia: null,
        confianca: 0,
        motivo: "IA não retornou item",
      });
    }
  }

  return map;
}

/** Triagem IA de UMA questão — texto integral, uma chamada. */
export async function triarQuestaoIA(
  fonteId: string,
  texto: string
): Promise<TriagemNatureza> {
  const map = await triarLoteIA([{ fonteId, texto }]);
  return (
    map.get(fonteId) ?? {
      materia: null,
      confianca: 0,
      motivo: "IA não retornou triagem",
    }
  );
}

