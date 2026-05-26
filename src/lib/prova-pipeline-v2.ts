import {
  modeloPipelinePrincipal,
  responsesComPdfSchemaComFallback,
  uploadPdfBuffer,
} from "@/lib/openai-responses-client";
import { parseGabaritoLote } from "@/lib/gabarito";
import { gerarCsvProvaQuestoes } from "@/lib/prova-csv-export";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import {
  alinharLoteTaxonomia,
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { taxonomy } from "@/lib/taxonomy";

export interface ProvaPipelineContext {
  nome: string;
  banca: string;
  ano?: number | null;
  caderno?: string | null;
  totalEsperado: number;
  tipoProva?: string | null;
}

export interface PipelineV2Result {
  rows: ProvaQuestaoRow[];
  csv: string;
  avisos: string[];
  modeloUsado: string;
  numerosDetectados: number[];
  etapas: string[];
}

const SCHEMA_ESTRUTURA = {
  name: "estrutura_prova",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tipo_prova: { type: "string" },
      total_questoes_detectado: { type: "integer" },
      numeros: {
        type: "array",
        items: { type: "integer" },
      },
      observacoes: { type: "string" },
    },
    required: ["tipo_prova", "total_questoes_detectado", "numeros", "observacoes"],
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

function normalizarDificuldade(raw: string): string {
  const n = raw.trim().toLowerCase();
  if (n === "facil" || n === "fácil" || n === "easy") return "Fácil";
  if (n === "media" || n === "média" || n === "medium") return "Média";
  if (n === "dificil" || n === "difícil" || n === "hard") return "Difícil";
  return raw.trim() || "Média";
}

type EstruturaRes = {
  tipo_prova: string;
  total_questoes_detectado: number;
  numeros: number[];
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

function validarRows(
  rows: ProvaQuestaoRow[],
  totalEsperado: number,
  avisos: string[]
): void {
  const nums = new Set(rows.map((r) => r.numero));
  const faltando: number[] = [];
  for (let n = 1; n <= totalEsperado; n++) {
    if (!nums.has(n)) faltando.push(n);
  }
  if (faltando.length > 0) {
    avisos.push(
      `Faltam ${faltando.length} questão(ões) no resultado (de ${totalEsperado}): nº ${faltando.slice(0, 15).join(", ")}${faltando.length > 15 ? "…" : ""}.`
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
}

/**
 * Pipeline V2: PDF → estrutura → classificação em lotes → gabarito em código → CSV.
 * Não extrai enunciado completo (opcional vazio).
 */
export async function executarPipelineProvaV2(
  pdfBuffer: Buffer,
  ctx: ProvaPipelineContext,
  opts?: {
    gabaritoTexto?: string;
    incluirGabarito?: boolean;
    excluirBlocoEspanhol?: boolean;
  }
): Promise<PipelineV2Result> {
  const avisos: string[] = [];
  const etapas: string[] = [];
  const excluirEs = opts?.excluirBlocoEspanhol === true;

  const fileId = await uploadPdfBuffer(pdfBuffer, "prova.pdf");
  etapas.push("PDF enviado à OpenAI");

  const ctxTxt = [
    `Prova: ${ctx.nome}`,
    `Banca: ${ctx.banca}`,
    ctx.ano ? `Ano: ${ctx.ano}` : "",
    ctx.caderno ? `Caderno: ${ctx.caderno}` : "",
    ctx.tipoProva ? `Tipo: ${ctx.tipoProva}` : "",
    `Total esperado no cadastro: ${ctx.totalEsperado} questões`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: estrutura, model: modelEstrutura } =
    await responsesComPdfSchemaComFallback<EstruturaRes>({
      fileId,
      instrucao: `Você é um analisador estrutural de provas de vestibular.
${ctxTxt}

Tarefa APENAS estrutural (sem classificar matéria):
- Identifique o tipo da prova (objetiva, etc.)
- Liste TODOS os números de questões objetivas encontradas no PDF
- total_questoes_detectado = quantidade de questões objetivas distintas
- Se houver bloco duplicado de língua estrangeira (inglês e espanhol com mesma numeração), liste só o bloco em INGLÊS (ignore espanhol).
- observacoes: notas curtas sobre legibilidade ou blocos

Não invente números que não aparecem no PDF.`,
      schema: SCHEMA_ESTRUTURA,
    });

  etapas.push(`Estrutura detectada (${modelEstrutura}): ${estrutura.numeros.length} questões`);

  let numeros = [...new Set(estrutura.numeros)]
    .filter((n) => n > 0 && n <= 300)
    .sort((a, b) => a - b);

  if (numeros.length === 0) {
    numeros = Array.from({ length: ctx.totalEsperado }, (_, i) => i + 1);
    avisos.push(
      "Nenhum número detectado no PDF — usando faixa 1.." + ctx.totalEsperado + " do cadastro."
    );
  }

  const taxonomia = resumoTaxonomia();
  const loteSize = Math.max(
    8,
    parseInt(process.env.PIPELINE_V2_LOTE_SIZE ?? "18", 10)
  );
  const lotesNums = chunks(numeros, loteSize);
  const rowsMap = new Map<number, ProvaQuestaoRow>();
  let modelClass = modeloPipelinePrincipal();

  for (let i = 0; i < lotesNums.length; i++) {
    const lote = lotesNums[i];
    const numsStr = lote.join(", ");
    const instrucaoClass = `Você classifica questões de vestibular com precisão pedagógica.
${ctxTxt}

Classifique SOMENTE as questões de números: ${numsStr}

Regras:
- Use EXATAMENTE nomes de matéria e assunto da taxonomia abaixo quando possível
- conhecimento: uma frase curta, objetiva, do que o aluno precisa saber (nunca vazio se a questão for legível)
- dificuldade: apenas facil, media ou dificil (string vazia se incerto)
- area_bloco: área do caderno (ex. Linguagens, Ciências da Natureza…)
- Não invente gabarito
- Não copie enunciado inteiro
${excluirEs ? "- Ignore questões do bloco de Língua Espanhola (só inglês se houver duplicata de número)\n" : ""}

Taxonomia:
${taxonomia}`;

    const { data: classRes, model } = await responsesComPdfSchemaComFallback<ClassificacaoRes>(
      {
        fileId,
        instrucao: instrucaoClass,
        schema: schemaClassificacaoLote(),
      }
    );
    modelClass = model;

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
        nivelDificuldade: normalizarDificuldade(q.dificuldade),
        observacoes: estrutura.observacoes?.slice(0, 200) || undefined,
      });
    }

    etapas.push(`Lote ${i + 1}/${lotesNums.length}: ${classRes.questoes?.length ?? 0} classificadas`);
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

  validarRows(rows, ctx.totalEsperado, avisos);

  if (estrutura.observacoes?.trim()) {
    avisos.push(`Observação da leitura: ${estrutura.observacoes.trim().slice(0, 300)}`);
  }

  return {
    rows,
    csv: gerarCsvProvaQuestoes(rows),
    avisos,
    modeloUsado: modelClass,
    numerosDetectados: numeros,
    etapas,
  };
}
