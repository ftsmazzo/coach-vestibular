import {
  responsesComPdfSchemaComFallback,
  uploadFileBuffer,
  type JsonSchemaFormat,
} from "@/lib/openai-responses-client";

export type ConfiancaExtracao = "alta" | "media" | "baixa";

export type RespostaExtraida = {
  numero: number;
  letra: string;
  confianca: ConfiancaExtracao;
};

export type ExtracaoGabaritoAlunoResult = {
  respostas: RespostaExtraida[];
  avisos: string[];
};

const SCHEMA: JsonSchemaFormat = {
  name: "gabarito_aluno",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      respostas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            numero: { type: "integer" },
            letra: { type: "string", enum: ["A", "B", "C", "D", "E"] },
            confianca: { type: "string", enum: ["alta", "media", "baixa"] },
          },
          required: ["numero", "letra", "confianca"],
        },
      },
      avisos: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["respostas", "avisos"],
  },
};

type ExtracaoIaPayload = ExtracaoGabaritoAlunoResult;

const RANK_CONFIANCA: Record<ConfiancaExtracao, number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

export function mesclarRespostasExtraidas(
  listas: RespostaExtraida[][]
): RespostaExtraida[] {
  const map = new Map<number, RespostaExtraida>();
  for (const lista of listas) {
    for (const r of lista) {
      const prev = map.get(r.numero);
      if (!prev || RANK_CONFIANCA[r.confianca] >= RANK_CONFIANCA[prev.confianca]) {
        map.set(r.numero, r);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.numero - b.numero);
}

export function respostasParaGabaritoLote(respostas: { numero: number; letra: string }[]): string {
  return respostas
    .filter((r) => r.letra && /^[A-E]$/.test(r.letra.toUpperCase()))
    .sort((a, b) => a.numero - b.numero)
    .map((r) => `${r.numero},${r.letra.toUpperCase()}`)
    .join("\n");
}

export type LinhaRevisaoGabarito = {
  numero: number;
  letra: string;
  confianca: ConfiancaExtracao;
};

export function buildGradeRevisao(
  totalQuestoes: number,
  extraidas: RespostaExtraida[]
): LinhaRevisaoGabarito[] {
  const map = new Map(extraidas.map((r) => [r.numero, r]));
  const grade: LinhaRevisaoGabarito[] = [];
  for (let n = 1; n <= totalQuestoes; n++) {
    const ex = map.get(n);
    grade.push(
      ex
        ? { numero: ex.numero, letra: ex.letra, confianca: ex.confianca }
        : {
            numero: n,
            letra: "",
            confianca: "baixa",
          }
    );
  }
  return grade;
}

function montarInstrucao(opts: {
  nomeProva: string;
  totalQuestoes: number;
  banca: string;
}): string {
  return `Analise o anexo: é o gabarito/respostas DO ALUNO (folha preenchida, caderno com alternativas marcadas ou lista questão-resposta).

Contexto da prova no app:
- Nome: ${opts.nomeProva}
- Banca: ${opts.banca}
- Total de questões esperado: ${opts.totalQuestoes} (numere de 1 a ${opts.totalQuestoes})

Tarefa:
1. Para cada questão que conseguir ler, extraia o NÚMERO da questão e a alternativa marcada pelo aluno (A, B, C, D ou E).
2. Em cadernos ENEM/vestibular, interprete bolinhas, risquinhos ou letras circuladas como a alternativa escolhida.
3. Se não tiver certeza, ainda assim informe com confianca "baixa" ou omita a questão.
4. NÃO invente o gabarito oficial — só o que o aluno marcou.
5. Coloque avisos curtos em português (ex.: página cortada, foto escura).

Retorne JSON conforme o schema.`;
}

export async function extrairGabaritoAlunoDeArquivo(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  nomeProva: string;
  totalQuestoes: number;
  banca: string;
}): Promise<ExtracaoGabaritoAlunoResult> {
  const fileId = await uploadFileBuffer(opts.buffer, opts.fileName, opts.mimeType);
  const instrucao = montarInstrucao({
    nomeProva: opts.nomeProva,
    totalQuestoes: opts.totalQuestoes,
    banca: opts.banca,
  });

  const { data } = await responsesComPdfSchemaComFallback<ExtracaoIaPayload>({
    fileId,
    instrucao,
    systemPrompt:
      "Você extrai respostas de provas vestibulares a partir de fotos/PDFs. Seja conservador: só inclua questões visíveis. Letras sempre A–E maiúsculas.",
    schema: SCHEMA,
    taskName: "extrair_gabarito_aluno",
  });

  const respostasRaw = Array.isArray(data.respostas) ? data.respostas : [];
  const respostas = respostasRaw
    .filter(
      (r) =>
        Number.isInteger(r.numero) &&
        r.numero >= 1 &&
        r.numero <= opts.totalQuestoes &&
        /^[A-E]$/.test(r.letra)
    )
    .map((r) => ({
      numero: r.numero,
      letra: r.letra.toUpperCase(),
      confianca: r.confianca,
    }));

  const avisos = Array.isArray(data.avisos) ? [...data.avisos] : [];
  const minimoSugerido = Math.min(3, Math.max(1, Math.ceil(opts.totalQuestoes * 0.08)));
  if (respostas.length < minimoSugerido) {
    avisos.push(
      `Leitura parcial (${respostas.length} resposta(s) detectada(s)). Revise manualmente as questões em branco e, se preciso, tente outra foto mais nítida.`
    );
  }

  return {
    respostas,
    avisos,
  };
}
