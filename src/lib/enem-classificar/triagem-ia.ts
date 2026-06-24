import { responsesComSchema } from "@/lib/openai-responses-client";
import type { MateriaNatureza, TriagemNatureza } from "@/lib/enem-classificar/triagem-natureza";
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

const MATERIAS = ["Biologia", "Química", "Física"] as const;

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

/** Heurística inconclusiva → candidata a triagem IA. */
export function precisaTriagemIA(tri: TriagemNatureza): boolean {
  if (tri.materia === null) return true;
  return tri.motivo.startsWith("empate");
}

/** Resolve lote indefinido via OpenAI — Bio / Química / Física / null. */
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
      "Você tria questões do ENEM (Ciências da Natureza) em Biologia, Química ou Física. " +
      "Biologia: seres vivos, corpo humano, ecologia, evolução, genética, microbiologia, botânica. " +
      "Química: átomos, ligações, reações, estequiometria, orgânica, soluções, pH. " +
      "Física: movimento, forças, energia, eletricidade, magnetismo, ondas, óptica, termodinâmica. " +
      "REGRA CRÍTICA (fisica_prevalece_quando_ha_grandezas_e_fenomeno): se a questão usa números, " +
      "equações, gráficos ou proporções para modelar grandezas físicas, unidades físicas, leis físicas " +
      "ou fenômenos físicos (velocidade, força, energia, potência, empuxo, gás ideal, óptica, etc.), " +
      "classifique como Física — NÃO escolha null por parecer 'matematizada'. " +
      "Use null só se realmente não der para distinguir. Prefira a matéria dominante do conteúdo exigido.",
    instrucao:
      items.length === 1
        ? `Classifique esta única questão (materia: Biologia | Química | Física | null):\n\n${blocos}`
        : `Classifique cada questão (materia: Biologia | Química | Física | null):\n\n${blocos}`,
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

export function mesclarTriagem(
  heuristica: TriagemNatureza,
  ia: TriagemNatureza | undefined
): TriagemNatureza {
  if (!precisaTriagemIA(heuristica)) return heuristica;
  if (ia?.materia) return ia;
  return heuristica.materia ? heuristica : { materia: null, confianca: 0, motivo: heuristica.motivo };
}
