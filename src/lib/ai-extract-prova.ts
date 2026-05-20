import { z } from "zod";

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
});

const respostaSchema = z.object({
  questoes: z.array(questaoExtraidaSchema),
  avisos: z.array(z.string()).optional(),
  resumo: z.string().optional(),
});

export type QuestaoExtraida = z.infer<typeof questaoExtraidaSchema>;

const SYSTEM_PROMPT = `Você classifica questões objetivas de provas vestibulares (ENEM, UFU, Fuvest, simulados).

O cadastro da prova (instituição, ano, caderno) já foi feito pelo admin — NÃO repita nome da prova nem caderno por questão.

Para CADA questão no texto, retorne um objeto JSON com:
- numero: número da questão na prova
- areaBloco: bloco grande da prova, se aplicável (ex. Ciências da Natureza) — senão null
- materia: disciplina principal (Química, Física, Matemática, Biologia, Português, História, etc.)
- assunto: tema específico dentro da matéria (mais específico que matéria)
- conhecimentoExigido: em uma frase o que o estudante precisa saber/fazer, ou null
- nivelDificuldade: facil | media | dificil ou null
- observacoes: interdisciplinar, imagem, ambiguidade — ou null

REGRAS:
- Classifique com a melhor hipótese pedagógica a partir do enunciado.
- Use "A classificar" em matéria ou assunto só se o enunciado não der base nenhuma.
- Não misture matéria com assunto.
- Não invente número de questão que não apareça no trecho.
- NÃO inclua gabarito, resposta correta nem letra A–E.
- NÃO use null em materia nem assunto.

Responda somente com JSON válido (sem markdown):
{ "questoes": [...], "avisos": [...], "resumo": "..." }`;

function chunkText(text: string, maxLen = 14000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLen));
    start += maxLen;
  }
  return chunks;
}

function sanitizeQuestaoRaw(q: unknown): unknown {
  if (!q || typeof q !== "object") return q;
  const row = q as Record<string, unknown>;
  const { gabarito: _g, resposta: _r, respostaCorreta: _c, ...rest } = row;
  return {
    ...rest,
    materia: normalizarClassificacao(rest.materia),
    assunto: normalizarClassificacao(rest.assunto),
  };
}

function stripGabaritoFromRaw(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = parsed as { questoes?: unknown[] };
  if (!Array.isArray(obj.questoes)) return parsed;
  return {
    ...obj,
    questoes: obj.questoes.map(sanitizeQuestaoRaw),
  };
}

function dedupeAvisos(avisos: string[]): string[] {
  return [...new Set(avisos)];
}

async function callOpenAI(
  userContent: string,
  provaContext: {
    nome: string;
    banca: string;
    ano?: number | null;
    caderno?: string | null;
    totalEsperado?: number;
  }
): Promise<z.infer<typeof respostaSchema>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no servidor");
  }

  const meta = [
    `Prova cadastrada: ${provaContext.nome}`,
    `Banca/vestibular: ${provaContext.banca}`,
    provaContext.ano ? `Ano: ${provaContext.ano}` : null,
    provaContext.caderno ? `Caderno/tipo: ${provaContext.caderno}` : null,
    provaContext.totalEsperado
      ? `Total esperado: ${provaContext.totalEsperado}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${meta}\n\nConteúdo das questões (classifique o pedagógico; resposta em JSON):\n${userContent}`,
        },
      ],
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Resposta vazia da IA");

  const finishReason = data.choices?.[0]?.finish_reason;
  const parsed = stripGabaritoFromRaw(JSON.parse(raw));
  const result = respostaSchema.parse(parsed);

  const avisos = [...(result.avisos ?? [])];
  if (finishReason === "length") {
    avisos.push(
      "Resposta truncada neste trecho — se faltar questão, use «Completar faltantes» ou CSV."
    );
  }

  return { ...result, avisos: avisos.length ? avisos : undefined };
}

function mergeQuestoes(all: QuestaoExtraida[]): QuestaoExtraida[] {
  const map = new Map<number, QuestaoExtraida>();
  for (const q of all) {
    const existing = map.get(q.numero);
    if (!existing) {
      map.set(q.numero, q);
      continue;
    }
    map.set(q.numero, {
      ...existing,
      ...q,
      areaBloco: q.areaBloco ?? existing.areaBloco,
      materia: q.materia !== "A classificar" ? q.materia : existing.materia,
      assunto: q.assunto !== "A classificar" ? q.assunto : existing.assunto,
      conhecimentoExigido: q.conhecimentoExigido ?? existing.conhecimentoExigido,
      nivelDificuldade: q.nivelDificuldade ?? existing.nivelDificuldade,
      observacoes: q.observacoes ?? existing.observacoes,
    });
  }
  return [...map.values()].sort((a, b) => a.numero - b.numero);
}

function avisosCobertura(
  questoes: QuestaoExtraida[],
  totalEsperado?: number
): string[] {
  const avisos: string[] = [];
  if (!totalEsperado || totalEsperado < 1) return avisos;

  const presentes = new Set(questoes.map((q) => q.numero));
  const faltando: number[] = [];
  for (let n = 1; n <= totalEsperado; n++) {
    if (!presentes.has(n)) faltando.push(n);
  }
  if (faltando.length > 0) {
    avisos.push(
      `Faltam ${faltando.length} questão(ões) no banco (de ${totalEsperado}): nº ${faltando.slice(0, 25).join(", ")}${faltando.length > 25 ? "…" : ""}. Use «Completar faltantes» ou CSV.`
    );
  }

  const incertos = questoes.filter(
    (q) => q.materia === "A classificar" || q.assunto === "A classificar"
  );
  if (incertos.length > 0 && incertos.length <= 8) {
    avisos.push(
      `Questões com matéria/assunto incertos: nº ${incertos.map((q) => q.numero).join(", ")}.`
    );
  } else if (incertos.length > 8) {
    avisos.push(`${incertos.length} questões marcadas como «A classificar» — revise se necessário.`);
  }

  return avisos;
}

export async function extrairQuestoesComIA(
  textoProva: string,
  provaContext: {
    nome: string;
    banca: string;
    ano?: number | null;
    caderno?: string | null;
    totalEsperado?: number;
  }
): Promise<{
  questoes: QuestaoExtraida[];
  avisos: string[];
  resumo?: string;
}> {
  const trimmed = textoProva.trim();
  if (trimmed.length < 100) {
    throw new Error("Texto muito curto para extração — envie o PDF convertido ou mais conteúdo");
  }

  const chunks = chunkText(trimmed);
  const allQuestoes: QuestaoExtraida[] = [];
  const allAvisos: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const result = await callOpenAI(
      chunks.length > 1
        ? `[Parte ${i + 1}/${chunks.length}]\n${chunks[i]}`
        : chunks[i],
      provaContext
    );
    allQuestoes.push(...result.questoes);
    if (result.avisos) allAvisos.push(...result.avisos);
  }

  const questoes = mergeQuestoes(allQuestoes);

  if (chunks.length > 1) {
    allAvisos.unshift(
      `Texto longo: ${chunks.length} chamada(s) à IA (sem sobreposição).`
    );
  }

  allAvisos.push(...avisosCobertura(questoes, provaContext.totalEsperado));

  if (questoes.length === 0) {
    allAvisos.push("Nenhuma questão identificada — revise o texto ou use CSV do GPT.");
  }

  return {
    questoes,
    avisos: dedupeAvisos(allAvisos),
    resumo: `${questoes.length} questões extraídas`,
  };
}
