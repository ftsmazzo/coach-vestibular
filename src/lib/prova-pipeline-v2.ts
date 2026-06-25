import {
  modeloPipelinePrincipal,
  responsesComPdfSchemaComValidacao,
  uploadPdfBuffer,
} from "@/lib/openai-responses-client";
import {
  validarExtracaoLiteralLote,
  validarEstruturaProva,
} from "@/lib/prova-pipeline-v2-validacao";
import { parseGabaritoLote } from "@/lib/gabarito";
import { normalizarMapaGabarito, resolverNumerosGradeProva } from "@/lib/prova-numeracao";
import { gerarCsvProvaQuestoes } from "@/lib/prova-csv-export";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { chaveQuestaoVariante, compararQuestoesPorNumeroEOrdem } from "@/lib/prova-idioma";
import {
  montarContextoProvaTxt,
  resumoEstruturaParaClassificacao,
  type EstruturaProvaDetectada,
  type ProvaPipelineContext,
} from "@/lib/prova-pipeline-contexto";
import { sanitizarTextoProva, truncarTextoProva } from "@/lib/prova-texto-prova";
import {
  PROMPT_SISTEMA_EXTRACAO_LITERAL,
  PROMPT_SISTEMA_ESTRUTURA,
} from "@/lib/prova-pipeline-v2-prompts";

export type { ProvaPipelineContext };

export type ExtracaoProvaResult = PipelineV2Result;

export interface PipelineV2Result {
  rows: ProvaQuestaoRow[];
  csv: string;
  avisos: string[];
  modeloUsado: string;
  numerosDetectados: number[];
  etapas: string[];
  estruturaDetectada?: EstruturaProvaDetectada;
}

const SCHEMA_ESTRUTURA = {
  name: "estrutura_prova",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tipo_prova: { type: "string" },
      formato_layout: {
        type: "string",
        enum: [
          "desconhecido",
          "enem_por_area",
          "vestibular_secoes",
          "simulado_linear",
          "multiplos_tipos",
          "lista_fixacao",
        ],
      },
      idiomas_estrangeiros: {
        type: "string",
        enum: [
          "nenhum",
          "duplicata_ingles_espanhol",
          "somente_ingles",
          "somente_espanhol",
          "outro",
        ],
      },
      total_questoes_detectado: { type: "integer" },
      numeros: {
        type: "array",
        items: { type: "integer" },
      },
      blocos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            questao_inicio: { type: "integer" },
            questao_fim: { type: "integer" },
          },
          required: ["titulo", "questao_inicio", "questao_fim"],
          additionalProperties: false,
        },
      },
      observacoes: { type: "string" },
    },
    required: [
      "tipo_prova",
      "formato_layout",
      "idiomas_estrangeiros",
      "total_questoes_detectado",
      "numeros",
      "blocos",
      "observacoes",
    ],
    additionalProperties: false,
  },
} as const;

function schemaExtracaoLiteralLote() {
  return {
    name: "extracao_literal_questoes",
    strict: true,
    schema: {
      type: "object",
      properties: {
        questoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              numero: { type: "integer" },
              enunciado: {
                type: "string",
                description:
                  "Texto literal completo da questão (apoio + comando). Proibido resumir.",
              },
              alternativas: {
                type: "string",
                description: "Alternativas A–E literais, ou vazio se não houver.",
              },
            },
            required: ["numero", "enunciado", "alternativas"],
            additionalProperties: false,
          },
        },
      },
      required: ["questoes"],
      additionalProperties: false,
    },
  };
}

type EstruturaRes = EstruturaProvaDetectada & {
  tipo_prova: string;
  formato_layout: string;
  idiomas_estrangeiros: string;
  total_questoes_detectado: number;
  numeros: number[];
  blocos: Array<{ titulo: string; questao_inicio: number; questao_fim: number }>;
  observacoes: string;
};

type QuestaoExtraidaPdf = {
  numero: number;
  enunciado: string;
  alternativas: string;
};

type ExtracaoRes = {
  questoes: QuestaoExtraidaPdf[];
};

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function tamanhoLote(totalNumeros: number): number {
  const env = parseInt(process.env.PIPELINE_V2_LOTE_SIZE ?? "4", 10);
  const base = Number.isFinite(env) && env >= 2 ? Math.min(env, 6) : 4;
  if (totalNumeros <= 20) return Math.min(base, 3);
  return base;
}

function questaoParaRow(q: QuestaoExtraidaPdf): ProvaQuestaoRow {
  const enunciado = truncarTextoProva(sanitizarTextoProva(q.enunciado));
  const alternativas = truncarTextoProva(sanitizarTextoProva(q.alternativas), 8000);
  return {
    numero: q.numero,
    idiomaVariante: "COMUM",
    materia: "A classificar",
    assunto: "A classificar",
    enunciado: enunciado || undefined,
    alternativas: alternativas || undefined,
  };
}

function aplicarQuestoesExtraidas(
  questoes: QuestaoExtraidaPdf[],
  lote: number[],
  rowsMap: Map<string, ProvaQuestaoRow>
): void {
  for (const q of questoes) {
    if (!lote.includes(q.numero)) continue;
    const row = questaoParaRow(q);
    rowsMap.set(chaveQuestaoVariante(q.numero, "COMUM"), row);
  }
}

function validarRowsExtracao(
  rows: ProvaQuestaoRow[],
  totalEsperado: number,
  numerosPdf: number[],
  avisos: string[]
): void {
  const numsList = rows.map((r) => r.numero);
  const numsLogicos = new Set(numsList);
  if (numsList.length !== numsLogicos.size) {
    const dup = numsList.filter((n, i) => numsList.indexOf(n) !== i);
    avisos.push(`Numeração duplicada no resultado: ${[...new Set(dup)].join(", ")}.`);
  }

  const pdfSet = new Set(numerosPdf);
  const faltandoNoPdf = numerosPdf.filter((n) => !numsLogicos.has(n));
  if (faltandoNoPdf.length > 0) {
    avisos.push(
      `Sem extração para ${faltandoNoPdf.length} número(s) detectado(s) no PDF: ${faltandoNoPdf.slice(0, 12).join(", ")}${faltandoNoPdf.length > 12 ? "…" : ""}.`
    );
  }

  const diffCadastro = Math.abs(rows.length - totalEsperado);
  if (diffCadastro > 0) {
    avisos.push(
      `Cadastro: ${totalEsperado} questões · banco: ${rows.length} linha(s). ${diffCadastro > 5 ? "Revise o total no cadastro ou reexecute o pipeline." : "Diferença pequena — confira na validação."}`
    );
  }

  const extras = rows.filter((r) => !pdfSet.has(r.numero));
  if (extras.length > 0) {
    avisos.push(
      `${extras.length} questão(ões) extraída(s) fora da lista estrutural do PDF.`
    );
  }
}

/**
 * Extração pura: PDF → numeração + enunciado literal + alternativas (+ gabarito opcional).
 * Uma linha COMUM por número. Classificação (N1+) vem depois.
 */
export async function executarExtracaoProvaV2(
  pdfBuffer: Buffer,
  ctx: ProvaPipelineContext,
  opts?: {
    gabaritoTexto?: string;
    incluirGabarito?: boolean;
    gerarCsv?: boolean;
    /** @deprecated Ignorado — trilhas EN/ES são configuradas após N1. */
    incluirBlocoEspanhol?: boolean;
    /** @deprecated Ignorado. */
    excluirBlocoEspanhol?: boolean;
    /** @deprecated Ignorado. */
    faixaIdiomaCadastro?: unknown;
  }
): Promise<PipelineV2Result> {
  const avisos: string[] = [];
  const etapas: string[] = [];

  const fileId = await uploadPdfBuffer(pdfBuffer, "prova.pdf");
  etapas.push("PDF enviado à OpenAI");

  const ctxTxt = montarContextoProvaTxt(ctx);

  const estruturaExec = await responsesComPdfSchemaComValidacao<EstruturaRes>({
    fileId,
    taskName: "estrutura",
    systemPrompt: PROMPT_SISTEMA_ESTRUTURA,
    instrucao: `${ctxTxt}

Preencha o schema estrutural completo a partir do PDF.
- numeros: cada questão objetiva distinta que o aluno responde (numeração lógica, sem duplicar EN/ES)
- total_questoes_detectado: quantidade de números únicos
- blocos: seções com título (vazio se não houver seções claras)`,
    schema: SCHEMA_ESTRUTURA,
    validate: (data) => validarEstruturaProva(data, ctx.totalEsperado),
  });
  const estrutura = estruturaExec.data;

  if (estrutura.idiomas_estrangeiros === "duplicata_ingles_espanhol") {
    avisos.push(
      "PDF com blocos EN/ES detectado — extraído 1 linha por número. Trilhas duplicadas serão configuradas após validar N1."
    );
  }

  etapas.push(
    `Estrutura (${estruturaExec.model}): ${estrutura.numeros.length} números únicos · layout ${estrutura.formato_layout ?? "?"} · extração literal (COMUM)`
  );

  let numeros = [...new Set(estrutura.numeros)]
    .filter((n) => n > 0 && n <= 500)
    .sort((a, b) => a - b);

  if (numeros.length === 0) {
    numeros = resolverNumerosGradeProva({
      totalQuestoes: ctx.totalEsperado,
      dia: ctx.dia,
      banca: ctx.banca,
    });
    avisos.push(
      `Nenhum número detectado no PDF — usando faixa ${numeros[0]}..${numeros[numeros.length - 1]} do cadastro.`
    );
  }

  const resumoEstrutura = resumoEstruturaParaClassificacao(estrutura);
  const rowsMap = new Map<string, ProvaQuestaoRow>();
  let modelExtracao = modeloPipelinePrincipal();

  const montarInstrucaoExtracao = (numsStr: string) => `${ctxTxt}

${resumoEstrutura ? `Contexto estrutural (só numeração/seções):\n${resumoEstrutura}\n` : ""}
Extraia texto LITERAL (ipsis litteris) SOMENTE das questões: ${numsStr}
Para cada item: enunciado completo + alternativas A–E.
NÃO resuma. NÃO classifique matéria, área, idioma nem dificuldade.`;

  const loteSize = tamanhoLote(numeros.length);
  const lotesNums = chunks(numeros, loteSize);
  for (let i = 0; i < lotesNums.length; i++) {
    const lote = lotesNums[i];
    const extracaoExec = await responsesComPdfSchemaComValidacao<ExtracaoRes>({
      fileId,
      taskName: `extracao-lote-${i + 1}`,
      systemPrompt: PROMPT_SISTEMA_EXTRACAO_LITERAL,
      instrucao: montarInstrucaoExtracao(lote.join(", ")),
      schema: schemaExtracaoLiteralLote(),
      validate: (data) => validarExtracaoLiteralLote(data, lote),
    });
    modelExtracao = extracaoExec.model;
    aplicarQuestoesExtraidas(extracaoExec.data.questoes ?? [], lote, rowsMap);
    etapas.push(
      `Extração lote ${i + 1}/${lotesNums.length} (${extracaoExec.model}): ${extracaoExec.data.questoes?.length ?? 0} itens`
    );
  }

  const rows: ProvaQuestaoRow[] = [...rowsMap.values()].sort((a, b) =>
    compararQuestoesPorNumeroEOrdem(a, b)
  );

  etapas.push(`Extração concluída: ${rows.length} linha(s) COMUM — valide o texto antes do N1.`);

  if (opts?.incluirGabarito && opts.gabaritoTexto?.trim()) {
    const mapaG = normalizarMapaGabarito(parseGabaritoLote(opts.gabaritoTexto), numeros);
    let aplicados = 0;
    for (const r of rows) {
      const g = mapaG.get(r.numero);
      if (g) {
        r.gabarito = g;
        aplicados++;
      }
    }
    etapas.push(`Gabarito oficial aplicado em ${aplicados} questão(ões) (código, não IA).`);
  }

  validarRowsExtracao(rows, ctx.totalEsperado, numeros, avisos);

  if (estrutura.observacoes?.trim()) {
    avisos.push(`Leitura do PDF: ${estrutura.observacoes.trim().slice(0, 300)}`);
  }

  return {
    rows,
    csv: opts?.gerarCsv ? gerarCsvProvaQuestoes(rows) : "",
    avisos,
    modeloUsado: modelExtracao,
    numerosDetectados: numeros,
    etapas,
    estruturaDetectada: estrutura,
  };
}

/** @deprecated use executarExtracaoProvaV2 */
export const executarPipelineProvaV2 = executarExtracaoProvaV2;
