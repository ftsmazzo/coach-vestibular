import {
  responsesComImageSchemaComFallback,
  responsesComPdfSchemaComFallback,
  uploadFileBuffer,
  type JsonSchemaFormat,
} from "@/lib/openai-responses-client";
import { normalizarNumerosGabaritoExtraido } from "@/lib/prova-numeracao";

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
  /** Gabarito oficial — trilha inglês (admin, faixa opcional) */
  letraEn?: string;
  /** Gabarito oficial — trilha espanhol (admin, faixa opcional) */
  letraEs?: string;
};

/** Converte grid admin (incl. dual EN/ES) para payload da API de gabarito. */
export function itensGabaritoOficialFromGrade(
  linhas: LinhaRevisaoGabarito[],
  faixaIdioma?: { inicio: number; fim: number } | null
): Array<{ numero: number; gabarito?: string; ingles?: string; espanhol?: string }> {
  const itens: Array<{ numero: number; gabarito?: string; ingles?: string; espanhol?: string }> = [];
  for (const l of linhas) {
    const dual =
      faixaIdioma && l.numero >= faixaIdioma.inicio && l.numero <= faixaIdioma.fim;
    if (dual) {
      if (l.letraEn || l.letraEs) {
        itens.push({
          numero: l.numero,
          ...(l.letraEn ? { ingles: l.letraEn.toUpperCase() } : {}),
          ...(l.letraEs ? { espanhol: l.letraEs.toUpperCase() } : {}),
        });
      }
    } else if (l.letra) {
      itens.push({ numero: l.numero, gabarito: l.letra.toUpperCase() });
    }
  }
  return itens;
}

/** Grade de revisão a partir do gabarito oficial já gravado no banco (admin). */
export function gradeFromQuestoesGabarito(
  numeros: number[],
  questoes: { numero: number; gabarito: string | null; idiomaVariante?: string }[],
  faixaIdioma?: { inicio: number; fim: number } | null
): LinhaRevisaoGabarito[] {
  if (faixaIdioma) {
    return numeros.map((n) => {
      const naFaixa = n >= faixaIdioma.inicio && n <= faixaIdioma.fim;
      if (naFaixa) {
        const en = questoes.find(
          (q) => q.numero === n && (q.idiomaVariante ?? "COMUM") === "INGLES"
        );
        const es = questoes.find(
          (q) => q.numero === n && (q.idiomaVariante ?? "COMUM") === "ESPANHOL"
        );
        return {
          numero: n,
          letra: "",
          letraEn: en?.gabarito?.toUpperCase() ?? "",
          letraEs: es?.gabarito?.toUpperCase() ?? "",
          confianca: "alta" as const,
        };
      }
      const comum = questoes.find(
        (q) => q.numero === n && (q.idiomaVariante ?? "COMUM") === "COMUM"
      );
      return {
        numero: n,
        letra: comum?.gabarito?.toUpperCase() ?? "",
        confianca: "alta" as const,
      };
    });
  }

  const extraidas: RespostaExtraida[] = questoes
    .filter((q) => q.gabarito && /^[A-E]$/i.test(q.gabarito))
    .filter(
      (q, _i, arr) =>
        arr.filter((x) => x.numero === q.numero).length === 1 ||
        (q.idiomaVariante ?? "COMUM") === "COMUM"
    )
    .map((q) => ({
      numero: q.numero,
      letra: q.gabarito!.toUpperCase(),
      confianca: "alta" as const,
    }));
  return buildGradeRevisao(numeros, extraidas);
}

export function buildGradeRevisao(
  numeros: number[],
  extraidas: RespostaExtraida[]
): LinhaRevisaoGabarito[] {
  const map = new Map(extraidas.map((r) => [r.numero, r]));
  return numeros.map((n) => {
    const ex = map.get(n);
    return ex
      ? { numero: ex.numero, letra: ex.letra, confianca: ex.confianca }
      : {
          numero: n,
          letra: "",
          confianca: "baixa" as const,
        };
  });
}

export type GabaritoExtracaoModo = "aluno" | "oficial";

function montarInstrucao(opts: {
  nomeProva: string;
  numerosEsperados: number[];
  banca: string;
  modo: GabaritoExtracaoModo;
}): string {
  const inicio = opts.numerosEsperados[0] ?? 1;
  const fim = opts.numerosEsperados[opts.numerosEsperados.length - 1] ?? inicio;
  const total = opts.numerosEsperados.length;
  const contexto = `Contexto da prova no app:
- Nome: ${opts.nomeProva}
- Banca: ${opts.banca}
- Total de questões: ${total}
- Numere cada questão de ${inicio} a ${fim} (use exatamente essa numeração do ENEM/cadastro, não reinicie em 1).`;

  if (opts.modo === "oficial") {
    return `Analise o anexo: é o GABARITO OFICIAL da prova (tabela publicada pela banca, folha de respostas modelo, PDF do INEP/cursinho com respostas corretas, ou lista número→letra).

${contexto}

Tarefa:
1. Para cada questão visível, extraia o NÚMERO e a alternativa CORRETA oficial (A, B, C, D ou E).
2. Em tabelas ENEM/vestibular, leia a coluna de gabarito ou a letra indicada como resposta certa.
3. Se não tiver certeza, use confianca "baixa" ou omita a questão — não invente.
4. NÃO interprete marcações de aluno — só o gabarito oficial publicado.
5. Coloque avisos curtos em português (ex.: página cortada, foto escura).

Retorne JSON conforme o schema.`;
  }

  return `Analise o anexo: é o gabarito/respostas DO ALUNO (folha preenchida, caderno com alternativas marcadas ou lista questão-resposta).

${contexto}

Tarefa:
1. Para cada questão que conseguir ler, extraia o NÚMERO da questão e a alternativa marcada pelo aluno (A, B, C, D ou E).
2. Em cadernos ENEM/vestibular, interprete bolinhas, risquinhos ou letras circuladas como a alternativa escolhida.
3. Se não tiver certeza, ainda assim informe com confianca "baixa" ou omita a questão.
4. NÃO invente o gabarito oficial — só o que o aluno marcou.
5. Coloque avisos curtos em português (ex.: página cortada, foto escura).

Retorne JSON conforme o schema.`;
}

export async function extrairGabaritoDeArquivo(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  nomeProva: string;
  totalQuestoes: number;
  banca: string;
  modo?: GabaritoExtracaoModo;
  numerosEsperados?: number[];
}): Promise<ExtracaoGabaritoAlunoResult> {
  const modo = opts.modo ?? "aluno";
  const numerosEsperados =
    opts.numerosEsperados ??
    Array.from({ length: opts.totalQuestoes }, (_, i) => i + 1);
  const minN = numerosEsperados[0] ?? 1;
  const maxN = numerosEsperados[numerosEsperados.length - 1] ?? opts.totalQuestoes;

  const instrucao = montarInstrucao({
    nomeProva: opts.nomeProva,
    numerosEsperados,
    banca: opts.banca,
    modo,
  });

  const systemPrompt =
    modo === "oficial"
      ? "Você extrai o gabarito OFICIAL de provas vestibulares a partir de fotos/PDFs. Seja conservador: só inclua questões visíveis. Letras sempre A–E maiúsculas."
      : "Você extrai respostas de provas vestibulares a partir de fotos/PDFs. Seja conservador: só inclua questões visíveis. Letras sempre A–E maiúsculas.";
  const mime = opts.mimeType.toLowerCase();
  let data: ExtracaoIaPayload;
  if (mime.startsWith("image/")) {
    const imageDataUrl = `data:${mime};base64,${opts.buffer.toString("base64")}`;
    const resp = await responsesComImageSchemaComFallback<ExtracaoIaPayload>({
      imageDataUrl,
      instrucao,
      systemPrompt,
      schema: SCHEMA,
      taskName: modo === "oficial" ? "extrair_gabarito_oficial_img" : "extrair_gabarito_aluno_img",
    });
    data = resp.data;
  } else {
    const fileId = await uploadFileBuffer(opts.buffer, opts.fileName, opts.mimeType);
    const resp = await responsesComPdfSchemaComFallback<ExtracaoIaPayload>({
      fileId,
      instrucao,
      systemPrompt,
      schema: SCHEMA,
      taskName: modo === "oficial" ? "extrair_gabarito_oficial_pdf" : "extrair_gabarito_aluno_pdf",
    });
    data = resp.data;
  }

  const respostasRaw = Array.isArray(data.respostas) ? data.respostas : [];
  let respostas = respostasRaw
    .filter(
      (r) =>
        Number.isInteger(r.numero) &&
        r.numero >= minN &&
        r.numero <= maxN &&
        /^[A-E]$/.test(r.letra)
    )
    .map((r) => ({
      numero: r.numero,
      letra: r.letra.toUpperCase(),
      confianca: r.confianca,
    }));

  // IA costuma reler ENEM dia 2 como 1–90; alinha à faixa 91–180 do cadastro.
  if (respostas.length === 0) {
    respostas = respostasRaw
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
  }

  const normalizado = normalizarNumerosGabaritoExtraido(respostas, numerosEsperados);
  respostas = normalizado.respostas;

  const avisos = Array.isArray(data.avisos) ? [...data.avisos] : [];
  if (normalizado.aviso) avisos.push(normalizado.aviso);
  const minimoSugerido = Math.min(3, Math.max(1, Math.ceil(numerosEsperados.length * 0.08)));
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

/** Alias para fluxo do aluno (marcações na folha). */
export async function extrairGabaritoAlunoDeArquivo(
  opts: Omit<Parameters<typeof extrairGabaritoDeArquivo>[0], "modo">
): Promise<ExtracaoGabaritoAlunoResult> {
  return extrairGabaritoDeArquivo({ ...opts, modo: "aluno" });
}
