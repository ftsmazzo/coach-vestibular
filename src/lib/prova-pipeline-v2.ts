import {
  modeloPipelinePrincipal,
  responsesComPdfSchemaComValidacao,
  uploadPdfBuffer,
} from "@/lib/openai-responses-client";
import {
  validarClassificacaoLote,
  validarEstruturaProva,
} from "@/lib/prova-pipeline-v2-validacao";
import { parseGabaritoLote } from "@/lib/gabarito";
import { gerarCsvProvaQuestoes } from "@/lib/prova-csv-export";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import {
  alinharLoteTaxonomia,
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { taxonomy } from "@/lib/taxonomy";
import {
  PROMPT_SISTEMA_CLASSIFICACAO,
  PROMPT_SISTEMA_ESTRUTURA,
} from "@/lib/prova-pipeline-v2-prompts";
import {
  montarContextoProvaTxt,
  resolverPoliticaIdiomas,
  resumoEstruturaParaClassificacao,
  type EstruturaProvaDetectada,
  type ProvaPipelineContext,
} from "@/lib/prova-pipeline-contexto";

export type { ProvaPipelineContext };

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

function schemaClassificacaoLote() {
  return {
    name: "classificacao_questoes",
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
              area_bloco: { type: "string" },
              materia: { type: "string" },
              assunto: { type: "string" },
              conhecimento: { type: "string" },
              dificuldade: {
                type: "string",
                enum: ["facil", "media", "dificil", ""],
              },
            },
            required: [
              "numero",
              "area_bloco",
              "materia",
              "assunto",
              "conhecimento",
              "dificuldade",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["questoes"],
      additionalProperties: false,
    },
  };
}

function resumoTaxonomia(): string {
  return taxonomy.materias
    .map((m) => `${m.label}: ${m.temas.map((t) => t.label).join(", ")}`)
    .join("\n");
}

function normalizarDificuldade(raw: string): string | undefined {
  const n = raw.trim().toLowerCase();
  if (!n) return undefined;
  if (n === "facil" || n === "fácil" || n === "easy") return "Fácil";
  if (n === "media" || n === "média" || n === "medium") return "Média";
  if (n === "dificil" || n === "difícil" || n === "hard") return "Difícil";
  return undefined;
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

type ClassificacaoRes = {
  questoes: Array<{
    numero: number;
    area_bloco: string;
    materia: string;
    assunto: string;
    conhecimento: string;
    dificuldade: string;
  }>;
};

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function tamanhoLote(totalNumeros: number): number {
  const env = parseInt(process.env.PIPELINE_V2_LOTE_SIZE ?? "18", 10);
  const base = Number.isFinite(env) && env >= 5 ? env : 18;
  if (totalNumeros <= 25) return Math.min(base, 12);
  if (totalNumeros <= 60) return base;
  return Math.min(22, base + 4);
}

function validarRows(
  rows: ProvaQuestaoRow[],
  totalEsperado: number,
  numerosPdf: number[],
  avisos: string[]
): void {
  const numsList = rows.map((r) => r.numero);
  const nums = new Set(numsList);
  if (nums.size !== numsList.length) {
    const dup = numsList.filter((n, i) => numsList.indexOf(n) !== i);
    avisos.push(`Numeração duplicada no resultado: ${[...new Set(dup)].join(", ")}.`);
  }

  const pdfSet = new Set(numerosPdf);
  const faltandoNoPdf = numerosPdf.filter((n) => !nums.has(n));
  if (faltandoNoPdf.length > 0) {
    avisos.push(
      `Sem classificação para ${faltandoNoPdf.length} número(s) detectado(s) no PDF: ${faltandoNoPdf.slice(0, 12).join(", ")}${faltandoNoPdf.length > 12 ? "…" : ""}.`
    );
  }

  const diffCadastro = Math.abs(rows.length - totalEsperado);
  if (diffCadastro > 0) {
    avisos.push(
      `Cadastro: ${totalEsperado} questões · PDF/classificação: ${rows.length}. ${diffCadastro > 3 ? "Revise o campo «total de questões» no cadastro se o PDF estiver correto." : "Diferença pequena — confira na auditoria."}`
    );
  }

  const semConhecimento = rows.filter(
    (r) => !r.conhecimentoExigido?.trim() && r.materia !== "A classificar"
  );
  if (semConhecimento.length > 0) {
    avisos.push(
      `${semConhecimento.length} questão(ões) sem conhecimento exigido (nº ${semConhecimento
        .slice(0, 8)
        .map((q) => q.numero)
        .join(", ")}${semConhecimento.length > 8 ? "…" : ""}).`
    );
  }

  const extras = rows.filter((r) => !pdfSet.has(r.numero));
  if (extras.length > 0) {
    avisos.push(
      `${extras.length} questão(ões) classificada(s) fora da lista estrutural do PDF.`
    );
  }
}

/**
 * Pipeline V2: PDF → estrutura autônoma → classificação em lotes → gabarito em código → banco.
 * ENEM, vestibulares, simulados e listas — layout inferido do documento.
 */
export async function executarPipelineProvaV2(
  pdfBuffer: Buffer,
  ctx: ProvaPipelineContext,
  opts?: {
    gabaritoTexto?: string;
    incluirGabarito?: boolean;
    incluirBlocoEspanhol?: boolean;
    /** @deprecated Use incluirBlocoEspanhol (inverso). */
    excluirBlocoEspanhol?: boolean;
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

Preencha o schema estrutural completo a partir do PDF.
- numeros: cada questão objetiva distinta que o aluno responde
- total_questoes_detectado: quantidade de números únicos
- blocos: seções com título (vazio se não houver seções claras)
- formato_layout e idiomas_estrangeiros: inferir do documento`,
    schema: SCHEMA_ESTRUTURA,
    validate: (data) => validarEstruturaProva(data, ctx.totalEsperado),
  });
  const estrutura = estruturaExec.data;

  const politicaIdioma = resolverPoliticaIdiomas(estrutura, {
    incluirBlocoEspanhol: opts?.incluirBlocoEspanhol === true,
    forcarExcluirEspanhol: opts?.excluirBlocoEspanhol === true,
  });
  const excluirEs = politicaIdioma.excluirBlocoEspanhol;

  etapas.push(
    `Estrutura (${estruturaExec.model}): ${estrutura.numeros.length} questões · layout ${estrutura.formato_layout ?? "?"}` +
      (politicaIdioma.automatico
        ? " · idioma EN/ES: mantido inglês (automático)"
        : "")
  );

  let numeros = [...new Set(estrutura.numeros)]
    .filter((n) => n > 0 && n <= 500)
    .sort((a, b) => a - b);

  if (numeros.length === 0) {
    numeros = Array.from({ length: ctx.totalEsperado }, (_, i) => i + 1);
    avisos.push(
      "Nenhum número detectado no PDF — usando faixa 1.." + ctx.totalEsperado + " do cadastro."
    );
  }

  const resumoEstrutura = resumoEstruturaParaClassificacao(estrutura);
  const taxonomia = resumoTaxonomia();
  const loteSize = tamanhoLote(numeros.length);
  const lotesNums = chunks(numeros, loteSize);
  const rowsMap = new Map<number, ProvaQuestaoRow>();
  let modelClass = modeloPipelinePrincipal();

  for (let i = 0; i < lotesNums.length; i++) {
    const lote = lotesNums[i];
    const numsStr = lote.join(", ");
    const instrucaoClass = `${ctxTxt}

${resumoEstrutura ? `Contexto estrutural já detectado:\n${resumoEstrutura}\n` : ""}
Classifique SOMENTE as questões de números: ${numsStr}

Use a taxonomia quando couber; respeite area_bloco conforme seções do PDF.
${excluirEs ? "Há duplicata inglês/espanhol: classifique apenas o bloco em INGLÊS para esses números.\n" : ""}
Taxonomia do projeto:
${taxonomia}`;

    const classExec = await responsesComPdfSchemaComValidacao<ClassificacaoRes>({
      fileId,
      taskName: `classificacao-lote-${i + 1}`,
      systemPrompt: PROMPT_SISTEMA_CLASSIFICACAO,
      instrucao: instrucaoClass,
      schema: schemaClassificacaoLote(),
      validate: (data) => validarClassificacaoLote(data, lote),
    });
    const classRes = classExec.data;
    modelClass = classExec.model;

    for (const q of classRes.questoes ?? []) {
      if (!lote.includes(q.numero)) continue;
      const materia = normalizarLabelMateria(q.materia);
      const assunto = normalizarLabelAssunto(materia, q.assunto);
      rowsMap.set(q.numero, {
        numero: q.numero,
        areaBloco: q.area_bloco?.trim() || undefined,
        materia,
        assunto,
        conhecimentoExigido: q.conhecimento?.trim() || undefined,
        nivelDificuldade: normalizarDificuldade(q.dificuldade ?? ""),
        observacoes: estrutura.observacoes?.slice(0, 200) || undefined,
      });
    }

    etapas.push(
      `Lote ${i + 1}/${lotesNums.length} (${classExec.model}): ${classRes.questoes?.length ?? 0} itens`
    );
  }

  let rows: ProvaQuestaoRow[] = [...rowsMap.values()].sort((a, b) => a.numero - b.numero);

  const alinhadas = alinharLoteTaxonomia(
    rows.map((r) => ({
      numero: r.numero,
      trechoEnunciado: "",
      materia: r.materia,
      assunto: r.assunto,
      areaBloco: r.areaBloco ?? null,
      conhecimentoExigido: r.conhecimentoExigido ?? null,
      nivelDificuldade: r.nivelDificuldade ?? null,
      observacoes: r.observacoes ?? null,
    }))
  );
  rows = alinhadas.questoes.map((q) => ({
    numero: q.numero,
    areaBloco: q.areaBloco ?? undefined,
    materia: q.materia,
    assunto: q.assunto,
    conhecimentoExigido: q.conhecimentoExigido ?? undefined,
    nivelDificuldade: q.nivelDificuldade ?? undefined,
    observacoes: q.observacoes ?? undefined,
  }));
  if (alinhadas.corrigidas > 0) {
    avisos.push(`${alinhadas.corrigidas} par(es) matéria/assunto alinhados à taxonomia.`);
  }

  if (opts?.incluirGabarito && opts.gabaritoTexto?.trim()) {
    const mapaG = parseGabaritoLote(opts.gabaritoTexto);
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

  validarRows(rows, ctx.totalEsperado, numeros, avisos);

  if (estrutura.observacoes?.trim()) {
    avisos.push(`Leitura do PDF: ${estrutura.observacoes.trim().slice(0, 300)}`);
  }

  return {
    rows,
    csv: opts?.gerarCsv ? gerarCsvProvaQuestoes(rows) : "",
    avisos,
    modeloUsado: modelClass,
    numerosDetectados: numeros,
    etapas,
    estruturaDetectada: estrutura,
  };
}
