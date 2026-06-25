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
import { normalizarMapaGabarito } from "@/lib/prova-numeracao";
import { gerarCsvProvaQuestoes } from "@/lib/prova-csv-export";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { chaveOrdemExtracao, compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";
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
  totalOcorrencias: number;
  totalLogicas: number;
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
      total_ocorrencias_detectado: { type: "integer" },
      total_questoes_logicas: { type: "integer" },
      numeros_logicos: {
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
      "total_ocorrencias_detectado",
      "total_questoes_logicas",
      "numeros_logicos",
      "blocos",
      "observacoes",
    ],
    additionalProperties: false,
  },
} as const;

function schemaExtracaoLiteralLote() {
  return {
    name: "extracao_literal_ocorrencias",
    strict: true,
    schema: {
      type: "object",
      properties: {
        questoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ordem: {
                type: "integer",
                description: "Posição física no caderno (1 = primeira questão do PDF).",
              },
              numero: {
                type: "integer",
                description: "Número impresso na prova (pode repetir entre blocos EN/ES).",
              },
              enunciado: {
                type: "string",
                description: "Texto literal completo. Proibido resumir.",
              },
              alternativas: {
                type: "string",
                description: "Alternativas A–E literais, ou vazio.",
              },
            },
            required: ["ordem", "numero", "enunciado", "alternativas"],
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
  total_ocorrencias_detectado: number;
  total_questoes_logicas: number;
  numeros_logicos: number[];
  blocos: Array<{ titulo: string; questao_inicio: number; questao_fim: number }>;
  observacoes: string;
};

type QuestaoExtraidaPdf = {
  ordem: number;
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

function tamanhoLote(total: number): number {
  const env = parseInt(process.env.PIPELINE_V2_LOTE_SIZE ?? "4", 10);
  const base = Number.isFinite(env) && env >= 2 ? Math.min(env, 6) : 4;
  if (total <= 20) return Math.min(base, 3);
  return base;
}

function questaoParaRow(q: QuestaoExtraidaPdf): ProvaQuestaoRow {
  const enunciado = truncarTextoProva(sanitizarTextoProva(q.enunciado));
  const alternativas = truncarTextoProva(sanitizarTextoProva(q.alternativas), 8000);
  return {
    ordemExtracao: q.ordem,
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
  loteOrdens: number[],
  rowsMap: Map<string, ProvaQuestaoRow>
): void {
  const esperadas = new Set(loteOrdens);
  for (const q of questoes) {
    if (!esperadas.has(q.ordem)) continue;
    rowsMap.set(chaveOrdemExtracao(q.ordem), questaoParaRow(q));
  }
}

function validarRowsExtracao(
  rows: ProvaQuestaoRow[],
  totalLogicoCadastro: number,
  totalOcorrencias: number,
  numerosLogicos: number[],
  avisos: string[]
): void {
  const ordens = rows.map((r) => r.ordemExtracao ?? 0);
  if (new Set(ordens).size !== ordens.length) {
    avisos.push("Ordens de extração duplicadas no resultado — confira na validação.");
  }

  if (rows.length !== totalOcorrencias) {
    avisos.push(
      `Extraídas ${rows.length} linha(s) · estrutura detectou ${totalOcorrencias} ocorrência(s) física(s).`
    );
  }

  const numsLogicosExtraidos = new Set(rows.map((r) => r.numero));
  const faltando = numerosLogicos.filter((n) => !numsLogicosExtraidos.has(n));
  if (faltando.length > 0) {
    avisos.push(
      `Nenhuma linha com número impresso ${faltando.slice(0, 8).join(", ")}${faltando.length > 8 ? "…" : ""}.`
    );
  }

  const diffLogico = Math.abs(totalLogicoCadastro - (numerosLogicos.length || totalLogicoCadastro));
  if (numerosLogicos.length > 0 && diffLogico > 0) {
    avisos.push(
      `Cadastro: ${totalLogicoCadastro} questões lógicas · PDF: ${numerosLogicos.length} número(s) único(s).`
    );
  }

  const duplicados = rows.filter(
    (r, i, arr) => arr.findIndex((x) => x.numero === r.numero) !== i
  );
  if (duplicados.length > 0) {
    const nums = [...new Set(duplicados.map((r) => r.numero))].sort((a, b) => a - b);
    avisos.push(
      `${nums.length} número(s) com mais de uma linha (EN/ES): ${nums.slice(0, 10).join(", ")}${nums.length > 10 ? "…" : ""} — esperado em vestibulares bilíngues.`
    );
  }
}

/**
 * Extração pura em ordem física: cada ocorrência no PDF → uma linha (ordemExtracao + numero impresso).
 */
export async function executarExtracaoProvaV2(
  pdfBuffer: Buffer,
  ctx: ProvaPipelineContext,
  opts?: {
    gabaritoTexto?: string;
    incluirGabarito?: boolean;
    gerarCsv?: boolean;
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

Preencha o schema estrutural:
- total_ocorrencias_detectado: TODAS as questões objetivas na ordem do PDF (inclua EN e ES separados)
- total_questoes_logicas: números únicos que o aluno responde
- numeros_logicos: lista dos números únicos impressos
- blocos: seções com título (vazio se não houver)`,
    schema: SCHEMA_ESTRUTURA,
    validate: (data) => validarEstruturaProva(data, ctx.totalEsperado),
  });
  const estrutura = estruturaExec.data;

  const totalOcorrencias = Math.max(1, estrutura.total_ocorrencias_detectado);
  const numerosLogicos = [...new Set(estrutura.numeros_logicos ?? [])]
    .filter((n) => n > 0 && n <= 500)
    .sort((a, b) => a - b);
  const totalLogicas =
    estrutura.total_questoes_logicas > 0
      ? estrutura.total_questoes_logicas
      : numerosLogicos.length;

  etapas.push(
    `Estrutura (${estruturaExec.model}): ${totalOcorrencias} ocorrência(s) física(s) · ${totalLogicas} lógica(s) · layout ${estrutura.formato_layout ?? "?"}`
  );

  if (estrutura.idiomas_estrangeiros === "duplicata_ingles_espanhol") {
    avisos.push(
      "Blocos EN/ES detectados — cada ocorrência física será gravada como linha separada (mesmo número impresso permitido)."
    );
  }

  const ordens = Array.from({ length: totalOcorrencias }, (_, i) => i + 1);
  const resumoEstrutura = resumoEstruturaParaClassificacao(estrutura);
  const rowsMap = new Map<string, ProvaQuestaoRow>();
  let modelExtracao = modeloPipelinePrincipal();

  const montarInstrucaoExtracao = (faixa: string) => `${ctxTxt}

${resumoEstrutura ? `Contexto estrutural:\n${resumoEstrutura}\n` : ""}
Extraia texto LITERAL (ipsis litteris) das OCORRÊNCIAS FÍSICAS de ordem ${faixa} (ordem = posição no PDF, numero = número impresso).
Uma entrada por ordem — blocos EN e ES com o mesmo numero geram ordens diferentes.
NÃO resuma. NÃO classifique matéria, área ou idioma.`;

  const loteSize = tamanhoLote(totalOcorrencias);
  const lotesOrdens = chunks(ordens, loteSize);
  for (let i = 0; i < lotesOrdens.length; i++) {
    const lote = lotesOrdens[i];
    const faixa =
      lote.length === 1
        ? String(lote[0])
        : `${lote[0]} a ${lote[lote.length - 1]}`;
    const extracaoExec = await responsesComPdfSchemaComValidacao<ExtracaoRes>({
      fileId,
      taskName: `extracao-lote-${i + 1}`,
      systemPrompt: PROMPT_SISTEMA_EXTRACAO_LITERAL,
      instrucao: montarInstrucaoExtracao(faixa),
      schema: schemaExtracaoLiteralLote(),
      validate: (data) => validarExtracaoLiteralLote(data, lote),
    });
    modelExtracao = extracaoExec.model;
    aplicarQuestoesExtraidas(extracaoExec.data.questoes ?? [], lote, rowsMap);
    etapas.push(
      `Extração lote ${i + 1}/${lotesOrdens.length} (${extracaoExec.model}): ${extracaoExec.data.questoes?.length ?? 0} ocorrência(s)`
    );
  }

  const rows: ProvaQuestaoRow[] = [...rowsMap.values()].sort(compararPorOrdemExtracao);

  etapas.push(
    `Extração concluída: ${rows.length} linha(s) em ordem física — valide o texto antes de qualquer classificação.`
  );

  if (opts?.incluirGabarito && opts.gabaritoTexto?.trim()) {
    const mapaG = normalizarMapaGabarito(
      parseGabaritoLote(opts.gabaritoTexto),
      numerosLogicos.length > 0 ? numerosLogicos : rows.map((r) => r.numero)
    );
    let aplicados = 0;
    for (const r of rows) {
      const g = mapaG.get(r.numero);
      if (g) {
        r.gabarito = g;
        aplicados++;
      }
    }
    etapas.push(`Gabarito oficial aplicado em ${aplicados} linha(s) (por número impresso).`);
  }

  validarRowsExtracao(rows, ctx.totalEsperado, totalOcorrencias, numerosLogicos, avisos);

  if (estrutura.observacoes?.trim()) {
    avisos.push(`Leitura do PDF: ${estrutura.observacoes.trim().slice(0, 300)}`);
  }

  return {
    rows,
    csv: opts?.gerarCsv ? gerarCsvProvaQuestoes(rows) : "",
    avisos,
    modeloUsado: modelExtracao,
    totalOcorrencias,
    totalLogicas,
    etapas,
    estruturaDetectada: estrutura,
  };
}

/** @deprecated use executarExtracaoProvaV2 */
export const executarPipelineProvaV2 = executarExtracaoProvaV2;
