import {
  responsesComImageSchemaComFallback,
  responsesComPdfSchemaComFallback,
  uploadFileBuffer,
  type JsonSchemaFormat,
} from "@/lib/openai-responses-client";
import { labelAreaBlocoCanonica } from "@/lib/areas-bloco";
import { sanitizarTextoProva } from "@/lib/prova-texto-prova";

export type ExtracaoQuestaoImagemResult = {
  numero: number | null;
  enunciado: string;
  alternativas: string;
  areaBloco: string | null;
  avisos: string[];
  precisaRevisaoImagem: boolean;
};

const SCHEMA: JsonSchemaFormat = {
  name: "questao_prova_imagem",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      numero: { type: "integer" },
      texto_apoio: { type: "string" },
      enunciado: { type: "string" },
      alternativa_a: { type: "string" },
      alternativa_b: { type: "string" },
      alternativa_c: { type: "string" },
      alternativa_d: { type: "string" },
      alternativa_e: { type: "string" },
      area_sugerida: { type: "string" },
      avisos: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "numero",
      "texto_apoio",
      "enunciado",
      "alternativa_a",
      "alternativa_b",
      "alternativa_c",
      "alternativa_d",
      "alternativa_e",
      "area_sugerida",
      "avisos",
    ],
  },
};

type PayloadIa = {
  numero: number;
  texto_apoio: string;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string;
  area_sugerida: string;
  avisos: string[];
};

const PLACEHOLDER_IMAGEM = "[revisar: alternativa em imagem]";

function montarInstrucao(opts: {
  numeroEsperado?: number;
  banca?: string;
  nomeProva?: string;
}): string {
  const partes = [
    "Extraia UMA questão de vestibular desta imagem ou recorte de PDF.",
    "Transcreva o enunciado completo em português, preservando fórmulas como texto ou LaTeX simples quando legível.",
    "Se houver texto de apoio (trecho, gráfico descrito, tabela), coloque em texto_apoio separado do enunciado (pergunta).",
    "Para cada alternativa A–E: transcreva o texto visível. Se a alternativa for só figura/fórmula ilegível, use exatamente: [revisar: alternativa em imagem]",
    "Se não vir o número da questão, use 0 em numero.",
    "Não invente conteúdo. Se não vir alternativas, deixe strings vazias.",
  ];
  if (opts.numeroEsperado) {
    partes.push(`O administrador espera a questão número ${opts.numeroEsperado}.`);
  }
  if (opts.nomeProva) partes.push(`Prova: ${opts.nomeProva}.`);
  if (opts.banca) partes.push(`Banca: ${opts.banca}.`);
  partes.push(
    "area_sugerida: uma entre Línguas e códigos, Ciências Humanas, Ciências Naturais, Exatas — ou vazio."
  );
  return partes.join("\n");
}

function formatarAlternativas(p: PayloadIa): { texto: string; precisaRevisao: boolean } {
  const letras = [
    ["A", p.alternativa_a],
    ["B", p.alternativa_b],
    ["C", p.alternativa_c],
    ["D", p.alternativa_d],
    ["E", p.alternativa_e],
  ] as const;

  let precisaRevisao = false;
  const linhas: string[] = [];

  for (const [l, raw] of letras) {
    let v = sanitizarTextoProva(raw);
    if (!v || v.length < 2) {
      v = PLACEHOLDER_IMAGEM;
      precisaRevisao = true;
    } else if (v.includes("[revisar:")) {
      precisaRevisao = true;
    }
    linhas.push(`(${l}) ${v}`);
  }

  return { texto: linhas.join("\n"), precisaRevisao };
}

function montarEnunciado(p: PayloadIa): string {
  const apoio = sanitizarTextoProva(p.texto_apoio);
  const pergunta = sanitizarTextoProva(p.enunciado);
  if (apoio && pergunta) return `${apoio}\n\n${pergunta}`;
  return pergunta || apoio;
}

export async function extrairQuestaoDeArquivo(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  numeroEsperado?: number;
  banca?: string;
  nomeProva?: string;
}): Promise<ExtracaoQuestaoImagemResult> {
  const instrucao = montarInstrucao({
    numeroEsperado: opts.numeroEsperado,
    banca: opts.banca,
    nomeProva: opts.nomeProva,
  });

  const systemPrompt =
    "Você transcreve questões de provas vestibulares brasileiras a partir de fotos e PDFs. Seja fiel ao texto visível; não complete alternativas ausentes.";

  const mime = opts.mimeType.toLowerCase();
  let data: PayloadIa;

  if (mime.startsWith("image/")) {
    const imageDataUrl = `data:${mime};base64,${opts.buffer.toString("base64")}`;
    const resp = await responsesComImageSchemaComFallback<PayloadIa>({
      imageDataUrl,
      instrucao,
      systemPrompt,
      schema: SCHEMA,
      taskName: "extrair_questao_imagem",
    });
    data = resp.data;
  } else {
    const fileId = await uploadFileBuffer(opts.buffer, opts.fileName, opts.mimeType);
    const resp = await responsesComPdfSchemaComFallback<PayloadIa>({
      fileId,
      instrucao,
      systemPrompt,
      schema: SCHEMA,
      taskName: "extrair_questao_pdf",
    });
    data = resp.data;
  }

  const enunciado = montarEnunciado(data);
  if (!enunciado || enunciado.length < 10) {
    throw new Error(
      "Não foi possível ler o enunciado na imagem. Tente um recorte mais nítido ou preencha manualmente."
    );
  }

  const { texto: alternativas, precisaRevisao } = formatarAlternativas(data);
  const areaBloco = labelAreaBlocoCanonica(data.area_sugerida?.trim() || null);
  const avisos = Array.isArray(data.avisos) ? [...data.avisos] : [];
  if (precisaRevisao) {
    avisos.push("Uma ou mais alternativas parecem ser só imagem — revise antes de salvar.");
  }

  const numero =
    data.numero >= 1 && data.numero <= 200
      ? data.numero
      : opts.numeroEsperado ?? null;

  return {
    numero,
    enunciado,
    alternativas,
    areaBloco,
    avisos,
    precisaRevisaoImagem: precisaRevisao,
  };
}
