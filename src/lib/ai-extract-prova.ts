import { z } from "zod";
import { modeloExtracao } from "@/lib/openai-modelos";
import {
  executarPipelineExtracao,
  type EtapaExtracao,
  type ProvaExtracaoContext,
} from "@/lib/prova-extracao-pipeline";

export type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";

/** IA costuma enviar null em campos vazios. */
const textoOpcional = z.string().nullish();

function normalizarClassificacao(val: unknown): string {
  if (val == null) return "A classificar";
  const t = String(val).trim();
  return t.length > 0 ? t : "A classificar";
}

const questaoExtraidaSchema = z.object({
  numero: z.number().int().positive(),
  areaBloco: textoOpcional,
  materia: z.preprocess(normalizarClassificacao, z.string().min(1)),
  assunto: z.preprocess(normalizarClassificacao, z.string().min(1)),
  conhecimentoExigido: textoOpcional,
  nivelDificuldade: textoOpcional,
  observacoes: textoOpcional,
  trechoEnunciado: z.string().min(5),
});

export type QuestaoExtraida = z.infer<typeof questaoExtraidaSchema>;

const SYSTEM_PROMPT_PASSO_1 = `Você é um extrator literal implacável de questões de provas de vestibulares.
Sua única tarefa é extrair as questões contidas no texto fornecido exatamente como estão escritas, sem resumir, parafrasear, explicar ou interpretar absolutamente nada.

REGRAS DE OURO:
1. O campo "trechoEnunciado" DEVE conter a cópia literal ("ipsis litteris") de todo o texto de apoio da questão, poemas, textos de referência, charges (se houver, descreva entre colchetes [como esta]) e a pergunta/comando em si. Não mude uma única palavra.
2. É terminantemente proibido resumir os enunciados. Capturar o texto completo e literal.
3. Não tente classificar a matéria ou assunto nesta etapa. Foque apenas na extração textual exata.

Responda apenas com um JSON válido seguindo esta estrutura rígida:
{
  "questoes": [
    {
      "numero": 1,
      "trechoEnunciado": "[Texto de apoio completo...] + [Pergunta/Comando completo]"
    }
  ]
}`;

async function callOpenAI(systemPrompt: string, userContent: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no servidor");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modeloExtracao(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Resposta vazia da OpenAI");
  return JSON.parse(raw);
}

async function extrairLoteEnunciados(
  lote: string,
  idx: number,
  total: number
): Promise<Array<{ numero: number; trechoEnunciado: string }>> {
  const result = await callOpenAI(
    SYSTEM_PROMPT_PASSO_1,
    `Lote ${idx + 1}/${total} a extrair:\n\n${lote}`
  );
  if (!result || !Array.isArray(result.questoes)) return [];
  const out: Array<{ numero: number; trechoEnunciado: string }> = [];
  for (const q of result.questoes) {
    if (!q) continue;
    const rawNum = q.numero ?? q.n ?? q.number;
    const numero =
      typeof rawNum === "number" && Number.isInteger(rawNum)
        ? rawNum
        : typeof rawNum === "string"
          ? parseInt(rawNum.replace(/\D/g, ""), 10)
          : NaN;
    const trecho = String(q.trechoEnunciado ?? q.enunciado ?? "").trim();
    if (Number.isInteger(numero) && numero > 0 && numero <= 300 && trecho.length >= 20) {
      out.push({ numero, trechoEnunciado: trecho });
    }
  }
  return out;
}

export async function extrairQuestoesComIA(
  textoProva: string,
  provaContext: ProvaExtracaoContext,
  options?: {
    etapa?: EtapaExtracao;
    baseInicial?: QuestaoExtraida[];
    textoCaderno?: string;
    excluirBlocoEspanhol?: boolean;
  }
): Promise<{
  questoes: QuestaoExtraida[];
  avisos: string[];
  resumo?: string;
  etapa?: EtapaExtracao;
}> {
  const etapa = options?.etapa ?? "completo";
  const trimmed = textoProva.trim();

  if (
    (etapa === "enunciados" || etapa === "completo") &&
    trimmed.length < 100 &&
    !options?.baseInicial?.length
  ) {
    throw new Error(
      "Texto muito curto para extração — envie o PDF convertido ou mais conteúdo"
    );
  }

  const resultado = await executarPipelineExtracao(trimmed, provaContext, etapa, {
    extrairEnunciadosLote: extrairLoteEnunciados,
    baseInicial: options?.baseInicial,
    textoCaderno: options?.textoCaderno,
    excluirBlocoEspanhol: options?.excluirBlocoEspanhol,
  });

  return {
    questoes: resultado.questoes,
    avisos: resultado.avisos,
    resumo: resultado.resumo,
    etapa: resultado.etapa,
  };
}
