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
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import {
  chaveQuestaoVariante,
  compararQuestoesPorNumeroEOrdem,
  inferirFaixaIdiomaComConfianca,
  inferirFaixaIdiomaDoPdf,
  inferirOrdemIdiomasDoPdf,
  proporFaixaIdiomaPorConteudo,
  sanearVariantesIdiomaExtracao,
  type FaixaIdiomaOpcional,
  type InferirFaixaIdiomaOpts,
  type PropostaFaixaIdioma,
} from "@/lib/prova-idioma";
import { areaBlocoPorNumero } from "@/lib/prova-classificacao-regras";
import {
  montarContextoProvaTxt,
  resolverPoliticaIdiomas,
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
  politicaIdiomas?: "NENHUMA" | "DUPLICATA_EN_ES";
  faixaIdioma?: FaixaIdiomaOpcional | null;
  /** True quando a faixa foi usada na extração (cadastro manual ou confiança alta). */
  faixaIdiomaConfirmada?: boolean;
  propostaFaixaIdioma?: PropostaFaixaIdioma | null;
  ordemIdiomasFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO";
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
              area_bloco: { type: "string" },
              enunciado: {
                type: "string",
                description:
                  "Texto literal completo da questão (apoio + comando). Proibido resumir.",
              },
              alternativas: {
                type: "string",
                description: "Alternativas A–E literais, ou vazio se não houver.",
              },
              dificuldade: {
                type: "string",
                enum: ["facil", "media", "dificil", ""],
              },
            },
            required: ["numero", "area_bloco", "enunciado", "alternativas", "dificuldade"],
            additionalProperties: false,
          },
        },
      },
      required: ["questoes"],
      additionalProperties: false,
    },
  };
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

type QuestaoExtraidaPdf = {
  numero: number;
  area_bloco: string;
  enunciado: string;
  alternativas: string;
  dificuldade: string;
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

function questaoParaRow(
  q: QuestaoExtraidaPdf,
  estrutura: EstruturaRes,
  idiomaVariante: ProvaQuestaoRow["idiomaVariante"] = "COMUM"
): ProvaQuestaoRow {
  const areaRaw =
    q.area_bloco?.trim() ||
    areaBlocoPorNumero(estrutura.blocos ?? [], q.numero) ||
    undefined;
  const areaBloco = normalizarAreaBloco(areaRaw) ?? undefined;
  const enunciado = truncarTextoProva(sanitizarTextoProva(q.enunciado));
  const alternativas = truncarTextoProva(sanitizarTextoProva(q.alternativas), 8000);
  return {
    numero: q.numero,
    idiomaVariante,
    areaBloco,
    materia: "A classificar",
    assunto: "A classificar",
    nivelDificuldade: normalizarDificuldade(q.dificuldade ?? ""),
    enunciado: enunciado || undefined,
    alternativas: alternativas || undefined,
  };
}

function aplicarQuestoesExtraidas(
  questoes: QuestaoExtraidaPdf[],
  lote: number[],
  estrutura: EstruturaRes,
  rowsMap: Map<string, ProvaQuestaoRow>,
  idiomaVariante: ProvaQuestaoRow["idiomaVariante"] = "COMUM"
): void {
  for (const q of questoes) {
    if (!lote.includes(q.numero)) continue;
    const row = questaoParaRow(q, estrutura, idiomaVariante);
    const chave = chaveQuestaoVariante(q.numero, idiomaVariante ?? "COMUM");
    rowsMap.set(chave, row);
  }
}

function validarRows(
  rows: ProvaQuestaoRow[],
  totalEsperado: number,
  numerosPdf: number[],
  avisos: string[],
  opts?: { modoDuplicata?: boolean; faixa?: FaixaIdiomaOpcional | null }
): void {
  const numsList = rows.map((r) => r.numero);
  const numsLogicos = new Set(numsList);
  if (!opts?.modoDuplicata && numsList.length !== numsLogicos.size) {
    const dup = numsList.filter((n, i) => numsList.indexOf(n) !== i);
    avisos.push(`Numeração duplicada no resultado: ${[...new Set(dup)].join(", ")}.`);
  }

  const pdfSet = new Set(numerosPdf);
  const faltandoNoPdf = numerosPdf.filter((n) => !numsLogicos.has(n));
  if (faltandoNoPdf.length > 0) {
    avisos.push(
      `Sem classificação para ${faltandoNoPdf.length} número(s) detectado(s) no PDF: ${faltandoNoPdf.slice(0, 12).join(", ")}${faltandoNoPdf.length > 12 ? "…" : ""}.`
    );
  }

  const linhasEsperadas = opts?.modoDuplicata && opts.faixa
    ? totalEsperado + (opts.faixa.fim - opts.faixa.inicio + 1)
    : totalEsperado;
  const diffCadastro = Math.abs(rows.length - linhasEsperadas);
  if (diffCadastro > 0) {
    avisos.push(
      `Cadastro: ${totalEsperado} questões (aluno) · banco: ${rows.length} linha(s)${opts?.modoDuplicata ? " (EN+ES na faixa opcional)" : ""}. ${diffCadastro > 5 ? "Revise o total no cadastro ou reexecute o pipeline." : "Diferença pequena — confira na auditoria."}`
    );
  }

  const semConhecimento = rows.filter(
    (r) => r.materia !== "A classificar" && !r.conhecimentoEscopoId?.trim()
  );
  if (semConhecimento.length > 0) {
    avisos.push(
      `${semConhecimento.length} questão(ões) sem escopo N2 (nº ${semConhecimento
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
 * Extração pura: PDF → estrutura → enunciado literal + alternativas (+ gabarito opcional).
 * Não classifica matéria/assunto — use após validar extração no admin.
 */
export async function executarExtracaoProvaV2(
  pdfBuffer: Buffer,
  ctx: ProvaPipelineContext,
  opts?: {
    gabaritoTexto?: string;
    incluirGabarito?: boolean;
    incluirBlocoEspanhol?: boolean;
    /** @deprecated Use incluirBlocoEspanhol (inverso). */
    excluirBlocoEspanhol?: boolean;
    gerarCsv?: boolean;
    /** Faixa EN/ES já cadastrada na prova (prioridade sobre inferência). */
    faixaIdiomaCadastro?: FaixaIdiomaOpcional | null;
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
  const faixaOpts: InferirFaixaIdiomaOpts = {
    banca: ctx.banca,
    totalEsperado: ctx.totalEsperado,
    faixaCadastro: opts?.faixaIdiomaCadastro ?? null,
  };
  const inferenciaFaixa = politicaIdioma.modoDuplicata
    ? inferirFaixaIdiomaComConfianca(estrutura, faixaOpts)
    : null;
  const faixaIdiomaConfirmada = Boolean(
    opts?.faixaIdiomaCadastro ??
      (inferenciaFaixa?.confianca === "alta" ? inferenciaFaixa.faixa : null)
  );
  const faixaIdioma =
    politicaIdioma.modoDuplicata && faixaIdiomaConfirmada
      ? (opts?.faixaIdiomaCadastro ?? inferenciaFaixa?.faixa ?? null)
      : null;
  const ordemIdiomasFaixa = politicaIdioma.modoDuplicata
    ? inferirOrdemIdiomasDoPdf(estrutura)
    : "INGLES_PRIMEIRO";

  if (politicaIdioma.modoDuplicata && !faixaIdiomaConfirmada) {
    avisos.push(
      "Duplicata EN/ES detectada no PDF — extração conservadora: todas as questões como COMUM. " +
        "Confirme a faixa EN/ES no cadastro ou use «Detectar pelo conteúdo» antes de dividir trilhas e gabarito dual."
    );
    if (inferenciaFaixa) {
      avisos.push(
        `Sugestão estrutural: Q${inferenciaFaixa.faixa.inicio}–${inferenciaFaixa.faixa.fim} (${inferenciaFaixa.confianca}: ${inferenciaFaixa.motivo}).`
      );
    }
  }

  etapas.push(
    `Estrutura (${estruturaExec.model}): ${estrutura.numeros.length} números únicos · layout ${estrutura.formato_layout ?? "?"}` +
      (politicaIdioma.modoDuplicata
        ? faixaIdioma
          ? ` · EN/ES confirmada: Q${faixaIdioma.inicio}–${faixaIdioma.fim} (${ordemIdiomasFaixa === "ESPANHOL_PRIMEIRO" ? "ES antes EN" : "EN antes ES"})`
          : inferenciaFaixa
            ? ` · EN/ES pendente (sugestão Q${inferenciaFaixa.faixa.inicio}–${inferenciaFaixa.faixa.fim}, ${inferenciaFaixa.confianca}) — extração COMUM`
            : " · EN/ES detectada — extração COMUM até confirmar faixa"
        : politicaIdioma.forcarSomenteIngles
          ? " · idioma: só inglês (legado)"
          : "")
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

  const numerosFaixa =
    faixaIdioma != null
      ? numeros.filter((n) => n >= faixaIdioma.inicio && n <= faixaIdioma.fim)
      : [];
  const numerosComuns =
    faixaIdioma != null
      ? numeros.filter((n) => n < faixaIdioma.inicio || n > faixaIdioma.fim)
      : numeros;

  const montarInstrucaoExtracao = (numsStr: string, extra = "") => `${ctxTxt}

${resumoEstrutura ? `Contexto estrutural:\n${resumoEstrutura}\n` : ""}
Extraia texto LITERAL (ipsis litteris) SOMENTE das questões: ${numsStr}
Para cada item: area_bloco (4 rótulos canônicos), enunciado completo, alternativas A–E e dificuldade.
NÃO resuma o enunciado. NÃO preencha matéria nem assunto — a classificação N2 é feita depois pelo catálogo Coach.
${extra}`;

  async function extrairLotes(
    nums: number[],
    variante: ProvaQuestaoRow["idiomaVariante"],
    instrucaoExtra: string,
    label: string
  ): Promise<void> {
    if (nums.length === 0) return;
    const loteSize = tamanhoLote(nums.length);
    const lotes = chunks(nums, loteSize);
    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      const extracaoExec = await responsesComPdfSchemaComValidacao<ExtracaoRes>({
        fileId,
        taskName: `extracao-${label}-${i + 1}`,
        systemPrompt: PROMPT_SISTEMA_EXTRACAO_LITERAL,
        instrucao: montarInstrucaoExtracao(lote.join(", "), instrucaoExtra),
        schema: schemaExtracaoLiteralLote(),
        validate: (data) => validarExtracaoLiteralLote(data, lote),
      });
      modelExtracao = extracaoExec.model;
      aplicarQuestoesExtraidas(
        extracaoExec.data.questoes ?? [],
        lote,
        estrutura,
        rowsMap,
        variante
      );
      etapas.push(
        `${label} lote ${i + 1}/${lotes.length} (${extracaoExec.model}): ${extracaoExec.data.questoes?.length ?? 0} itens`
      );
    }
  }

  if (politicaIdioma.modoDuplicata && faixaIdioma) {
    await extrairLotes(numerosComuns, "COMUM", "", "Comum");
    const instrIng =
      "Extraia APENAS o bloco em INGLÊS (Língua Inglesa) — ignore a versão em espanhol.\n" +
      (ordemIdiomasFaixa === "ESPANHOL_PRIMEIRO"
        ? "No PDF o bloco de Inglês vem DEPOIS do bloco de Espanhol (5 questões ES e depois 5 EN).\n"
        : "");
    const instrEsp =
      "Extraia APENAS o bloco em ESPANHOL (Língua Espanhola) — ignore a versão em inglês.\n" +
      (ordemIdiomasFaixa === "ESPANHOL_PRIMEIRO"
        ? "No PDF o bloco de Espanhol vem ANTES do bloco de Inglês (5 questões ES seguidas de 5 EN).\n"
        : "");
    if (ordemIdiomasFaixa === "ESPANHOL_PRIMEIRO") {
      await extrairLotes(numerosFaixa, "ESPANHOL", instrEsp, "Espanhol");
      await extrairLotes(numerosFaixa, "INGLES", instrIng, "Inglês");
    } else {
      await extrairLotes(numerosFaixa, "INGLES", instrIng, "Inglês");
      await extrairLotes(numerosFaixa, "ESPANHOL", instrEsp, "Espanhol");
    }
  } else if (politicaIdioma.forcarSomenteIngles) {
    const faixaLegado = faixaIdioma ?? inferirFaixaIdiomaDoPdf(estrutura) ?? { inicio: 1, fim: 5 };
    const comuns = numeros.filter((n) => n < faixaLegado.inicio || n > faixaLegado.fim);
    const faixaNums = numeros.filter((n) => n >= faixaLegado.inicio && n <= faixaLegado.fim);
    await extrairLotes(comuns, "COMUM", "", "Comum");
    await extrairLotes(
      faixaNums,
      "INGLES",
      "Duplicata EN/ES: extraia só o bloco em INGLÊS.\n",
      "Inglês"
    );
  } else {
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
      aplicarQuestoesExtraidas(
        extracaoExec.data.questoes ?? [],
        lote,
        estrutura,
        rowsMap,
        "COMUM"
      );
      etapas.push(
        `Extração lote ${i + 1}/${lotesNums.length} (${extracaoExec.model}): ${extracaoExec.data.questoes?.length ?? 0} itens`
      );
    }
  }

  let rows: ProvaQuestaoRow[] = [...rowsMap.values()].sort((a, b) =>
    compararQuestoesPorNumeroEOrdem(a, b, ordemIdiomasFaixa)
  );

  if (politicaIdioma.modoDuplicata && faixaIdioma) {
    rows = sanearVariantesIdiomaExtracao(rows, faixaIdioma, avisos, ordemIdiomasFaixa);
    etapas.push(
      `Saneamento EN/ES: faixa ${faixaIdioma.inicio}–${faixaIdioma.fim} · ${rows.length} linha(s) após consolidar variantes.`
    );
  }

  let propostaFaixaIdioma: PropostaFaixaIdioma | null = null;
  if (politicaIdioma.modoDuplicata && !faixaIdiomaConfirmada) {
    propostaFaixaIdioma = proporFaixaIdiomaPorConteudo(rows, {
      ...faixaOpts,
      estrutura,
    });
    if (propostaFaixaIdioma) {
      avisos.push(
        `Proposta por conteúdo (catálogo EN/ES): Q${propostaFaixaIdioma.faixa.inicio}–${propostaFaixaIdioma.faixa.fim} (${propostaFaixaIdioma.confianca}) — ${propostaFaixaIdioma.motivo}.`
      );
      etapas.push(
        `Faixa sugerida pelo conteúdo: Q${propostaFaixaIdioma.faixa.inicio}–${propostaFaixaIdioma.faixa.fim}.`
      );
    }
  }

  etapas.push(`Extração concluída: ${rows.length} linha(s) — classificação pendente de validação.`);

  if (opts?.incluirGabarito && opts.gabaritoTexto?.trim()) {
    const mapaG = normalizarMapaGabarito(parseGabaritoLote(opts.gabaritoTexto), numeros);
    let aplicados = 0;
    for (const r of rows) {
      const g = mapaG.get(r.numero);
      if (g && (r.idiomaVariante === "COMUM" || !politicaIdioma.modoDuplicata)) {
        r.gabarito = g;
        aplicados++;
      }
    }
    etapas.push(`Gabarito oficial aplicado em ${aplicados} questão(ões) (código, não IA).`);
  }

  validarRows(rows, ctx.totalEsperado, numeros, avisos, {
    modoDuplicata: politicaIdioma.modoDuplicata,
    faixa: faixaIdioma,
  });

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
    politicaIdiomas: politicaIdioma.modoDuplicata ? "DUPLICATA_EN_ES" : "NENHUMA",
    faixaIdioma: faixaIdioma ?? inferenciaFaixa?.faixa ?? null,
    faixaIdiomaConfirmada,
    propostaFaixaIdioma,
    ordemIdiomasFaixa: politicaIdioma.modoDuplicata ? ordemIdiomasFaixa : undefined,
  };
}

/** @deprecated use executarExtracaoProvaV2 */
export const executarPipelineProvaV2 = executarExtracaoProvaV2;
