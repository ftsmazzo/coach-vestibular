import { responsesComSchema } from "@/lib/openai-responses-client";
import {
  montarBlocoQuestaoV11,
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
import type {
  CatalogDisciplinaId,
  DisciplinaHumanasId,
  DisciplinaLinguagensId,
  RotaHumanasId,
  RotaLinguagensId,
} from "@/lib/conhecimento-catalog/disciplinas-split";
import {
  DISCIPLINAS_HUMANAS,
  DISCIPLINAS_LINGUAGENS,
  prefixoValidoParaDisciplina,
} from "@/lib/conhecimento-catalog/disciplinas-split";
import { classificarLoteCatalogoV11 } from "@/lib/enem-classificar/classificar-catalogo-v11";
import {
  aplicarMapaComChavesFonteId,
  fonteIdsFaltantes,
} from "@/lib/enem-classificar/fonte-id-utils";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

export const CLASSIFICADOR_DISCIPLINA_V10 = "ia-disciplina-v10";

const LOTE_ROTEAMENTO = 3;
const LOTE_N2_DISCIPLINA = 4;

export type QuestaoRoteamento = {
  fonteId: string;
  enunciado: string;
  alternativas: string;
  textoBase?: string | null;
  gabarito?: string | null;
  numero?: number;
  idioma?: string | null;
  areaBloco?: string | null;
  banca?: string | null;
};

type RotaItem = {
  fonteId: string;
  rota: {
    disciplinaId: string;
    criterio: string;
    confianca: number;
    justificativa: string;
    sinalizadorRevisao: boolean;
  };
};

type RotaLote = { classificacoes: RotaItem[] };

function montarBlocoQuestaoRoteamento(q: QuestaoRoteamento): string {
  const metaParts = [
    q.numero != null ? `numero=${q.numero}` : null,
    q.idioma ? `idioma=${q.idioma}` : null,
    q.areaBloco ? `areaBloco=${q.areaBloco}` : null,
    q.banca ? `banca=${q.banca}` : null,
  ].filter(Boolean);
  const meta = metaParts.length ? `Metadados (hints): ${metaParts.join(" ")}\n` : "";
  const tb = q.textoBase?.trim();
  const textoBase = tb ? `Texto-base:\n${tb}\n\n` : "";
  return (
    meta +
    textoBase +
    montarBlocoQuestaoV11({
      fonteId: q.fonteId,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      gabarito: q.gabarito,
      numero: q.numero,
      idioma: q.idioma,
    })
  );
}

function schemaRoteamento(enumDisciplinas: string[]) {
  return {
    name: "roteamento_disciplina_v10",
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

async function rotearLote(
  items: QuestaoRoteamento[],
  area: "humanas" | "linguagens"
): Promise<Map<string, RotaItem["rota"]>> {
  if (items.length === 0) return new Map();

  const enumDisciplinas =
    area === "humanas"
      ? [...DISCIPLINAS_HUMANAS, "indefinido"]
      : [...DISCIPLINAS_LINGUAGENS, "indefinido"];

  const promptMd =
    area === "humanas" ? promptRoteamentoHumanas() : promptRoteamentoLinguagens();
  const systemPrompt =
    promptMd?.trim() ||
    (area === "humanas"
      ? "Roteie questões de Ciências Humanas para historia, geografia, filosofia, sociologia ou indefinido."
      : "Roteie questões de Linguagens para portugues, ingles, espanhol ou indefinido. O comando em PT não define portugues.");

  const blocos = items.map(montarBlocoQuestaoRoteamento).join("\n\n");

  const data = await responsesComSchema<RotaLote>({
    systemPrompt,
    instrucao: `Roteie cada questão (somente disciplina, sem escopo N2):\n${blocos}`,
    schema: schemaRoteamento(enumDisciplinas),
    content: [],
  });

  const esperados = items.map((q) => q.fonteId);
  const bruto = new Map<string, RotaItem["rota"]>();
  for (const row of data.classificacoes) {
    bruto.set(row.fonteId, row.rota);
  }
  return aplicarMapaComChavesFonteId(bruto, esperados);
}

function rotaDeterministicaLinguagens(
  item: QuestaoRoteamento,
  rota: RotaItem["rota"]
): RotaItem["rota"] {
  const hint = item.idioma;
  if (hint === "ingles" || hint === "espanhol") {
    const forçada = hint as DisciplinaLinguagensId;
    if (rota.disciplinaId === forçada) return rota;
    return {
      disciplinaId: forçada,
      criterio: "metadata",
      confianca: Math.max(rota.confianca ?? 0, 0.95),
      justificativa: `Rota forçada por idiomaVariante (${forçada}); IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }

  if (rota.disciplinaId === "indefinido") {
    return {
      disciplinaId: "portugues",
      criterio: "metadata",
      confianca: Math.max(rota.confianca ?? 0, 0.55),
      justificativa:
        "Variante COMUM em Linguagens — roteada para português (comando em PT não exclui Língua Portuguesa).",
      sinalizadorRevisao: true,
    };
  }

  return rota;
}

function resultadoIndefinido(
  materiaId: string,
  motivo: string,
  rota?: RotaItem["rota"]
): ResultadoClassificacao {
  return {
    status: "review",
    confianca: rota?.confianca ?? 0,
    materiaId,
    assuntoId: null,
    dominioId: null,
    escopoId: null,
    conceitoCanonic: null,
    disciplinaOriginalId: rota?.disciplinaId ?? "indefinido",
    rotaCriterio: rota?.criterio ?? "incerto",
    motivo,
    sinalizadorRevisao: true,
    justificativa: rota?.justificativa ?? motivo,
  };
}

function resultadoFallbackDisciplina(
  disciplinaId: CatalogDisciplinaId,
  rota: RotaItem["rota"],
  motivo: string
): ResultadoClassificacao {
  const fallbackId = idFallbackNaoClassificado(disciplinaId);
  return {
    status: "review",
    confianca: rota.confianca ?? 0,
    materiaId: disciplinaId,
    assuntoId: "nao_classificado",
    dominioId: null,
    escopoId: fallbackId,
    conceitoCanonic: null,
    disciplinaOriginalId: disciplinaId,
    rotaCriterio: rota.criterio,
    motivo,
    sinalizadorRevisao: true,
    justificativa: rota.justificativa,
  };
}

function validarResultadoDisciplina(
  resultado: ResultadoClassificacao,
  disciplinaId: CatalogDisciplinaId,
  confiancaMinima: number
): ResultadoClassificacao {
  const escopoId = resultado.escopoId;
  if (!escopoId) return resultado;

  const prefixoOk = prefixoValidoParaDisciplina(escopoId, disciplinaId);
  const fallbackId = idFallbackNaoClassificado(disciplinaId);
  const confianca = resultado.confianca ?? 0;
  const revisao =
    resultado.sinalizadorRevisao === true ||
    !prefixoOk ||
    confianca < confiancaMinima ||
    escopoId === fallbackId;

  if (!prefixoOk) {
    return {
      ...resultado,
      escopoId: fallbackId,
      status: "review",
      sinalizadorRevisao: true,
      motivo: `Escopo ${escopoId} fora do prefixo de ${disciplinaId}.`,
    };
  }

  return {
    ...resultado,
    materiaId: disciplinaId,
    disciplinaOriginalId: disciplinaId,
    sinalizadorRevisao: revisao,
    status: revisao ? "review" : resultado.status,
  };
}

export function versaoClassificacaoDisciplinaV10(
  resultado: ResultadoClassificacao,
  area: "humanas" | "linguagens"
): string {
  const disc = resultado.disciplinaOriginalId ?? resultado.materiaId ?? "indefinido";
  const crit = resultado.rotaCriterio ?? "ia";
  return `${CLASSIFICADOR_DISCIPLINA_V10}|area=${area}|disc=${disc}|crit=${crit}|rc=${(resultado.confianca ?? 0).toFixed(2)}`;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function classificarPorDisciplina(
  disciplinaId: CatalogDisciplinaId,
  items: QuestaoRoteamento[],
  rotas: Map<string, RotaItem["rota"]>
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const catalog = carregarCatalogoMateria(disciplinaId);
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras.confiancaMinima ?? 0.45;
  const promptMd = promptClassificacaoDisciplina(disciplinaId);
  const systemPrompt = promptMd?.trim() || montarSystemClassificacaoV11(catalog);

  for (const lote of chunks(items, LOTE_N2_DISCIPLINA)) {
    const payload = lote.map((q) => ({
      fonteId: q.fonteId,
      enunciado: [q.textoBase?.trim(), q.enunciado].filter(Boolean).join("\n\n"),
      alternativas: q.alternativas,
      gabarito: q.gabarito ?? null,
      numero: q.numero,
      idioma: q.idioma ?? null,
    }));

    const parcial = await classificarLoteCatalogoV11(payload, catalog, escopos, {
      systemPrompt,
    });

    for (const q of lote) {
      const rota = rotas.get(q.fonteId)!;
      const base = parcial.get(q.fonteId);
      if (!base) {
        map.set(
          q.fonteId,
          resultadoFallbackDisciplina(disciplinaId, rota, "IA não retornou classificação N2.")
        );
        continue;
      }
      map.set(q.fonteId, validarResultadoDisciplina(base, disciplinaId, confiancaMinima));
    }
  }

  return map;
}

async function rotearComRetry(
  items: QuestaoRoteamento[],
  area: "humanas" | "linguagens"
): Promise<Map<string, RotaItem["rota"]>> {
  const map = new Map<string, RotaItem["rota"]>();
  if (items.length === 0) return map;

  for (const lote of chunks(items, LOTE_ROTEAMENTO)) {
    const parcial = await rotearLote(lote, area);
    for (const [k, v] of parcial) map.set(k, v);
  }

  const faltantes = fonteIdsFaltantes(
    items.map((q) => q.fonteId),
    map
  );
  for (const fonteId of faltantes) {
    const item = items.find((q) => q.fonteId === fonteId);
    if (!item) continue;
    const solo = await rotearLote([item], area);
    for (const [k, v] of solo) map.set(k, v);
  }

  return map;
}

async function classificarAreaComRoteamento(
  items: QuestaoRoteamento[],
  area: "humanas" | "linguagens"
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const rotasBrutas = await rotearComRetry(items, area);
  const rotas = new Map<string, RotaItem["rota"]>();

  for (const item of items) {
    const bruta = rotasBrutas.get(item.fonteId) ?? {
      disciplinaId: "indefinido",
      criterio: "incerto",
      confianca: 0,
      justificativa: "IA não retornou rota.",
      sinalizadorRevisao: true,
    };
    rotas.set(
      item.fonteId,
      area === "linguagens" ? rotaDeterministicaLinguagens(item, bruta) : bruta
    );
  }

  const porDisciplina = new Map<CatalogDisciplinaId, QuestaoRoteamento[]>();

  for (const item of items) {
    const rota = rotas.get(item.fonteId)!;
    const disc = rota.disciplinaId;

    if (disc === "indefinido") {
      map.set(
        item.fonteId,
        resultadoIndefinido(
          area === "humanas" ? "humanas" : "linguagens",
          "Rota indefinida — revisão manual.",
          rota
        )
      );
      continue;
    }

    const lista = porDisciplina.get(disc as CatalogDisciplinaId) ?? [];
    lista.push(item);
    porDisciplina.set(disc as CatalogDisciplinaId, lista);
  }

  for (const [disciplinaId, grupo] of porDisciplina) {
    const parcial = await classificarPorDisciplina(disciplinaId, grupo, rotas);
    for (const [k, v] of parcial) map.set(k, v);
  }

  return map;
}

export async function classificarLoteHumanasV10(
  items: QuestaoRoteamento[]
): Promise<Map<string, ResultadoClassificacao>> {
  return classificarAreaComRoteamento(items, "humanas");
}

export async function classificarLoteLinguagensV20(
  items: QuestaoRoteamento[]
): Promise<Map<string, ResultadoClassificacao>> {
  return classificarAreaComRoteamento(items, "linguagens");
}

export type { RotaHumanasId, RotaLinguagensId, DisciplinaHumanasId, DisciplinaLinguagensId };
