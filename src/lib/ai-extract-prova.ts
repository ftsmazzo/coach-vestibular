import { z } from "zod";

/** IA costuma enviar null em campos vazios. */
const textoOpcional = z.string().nullish();

const questaoExtraidaSchema = z.object({
  numero: z.number().int().positive(),
  areaBloco: textoOpcional,
  materia: z.string().min(1),
  assunto: z.string().min(1),
  conhecimentoExigido: textoOpcional,
  nivelDificuldade: textoOpcional,
  observacoes: textoOpcional,
  gabarito: z
    .union([z.string().regex(/^[A-Ea-e]$/), z.null()])
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
});

const respostaSchema = z.object({
  questoes: z.array(questaoExtraidaSchema),
  avisos: z.array(z.string()).optional(),
  resumo: z.string().optional(),
});

export type QuestaoExtraida = z.infer<typeof questaoExtraidaSchema>;

const SYSTEM_PROMPT = `Você classifica questões objetivas de provas vestibulares (ENEM, UFU, Fuvest, simulados).

O cadastro da prova (instituição, ano, caderno azul/branco, vestibular) já foi feito pelo admin — NÃO repita nome da prova nem caderno por questão.

Para CADA questão no texto, retorne JSON:
- numero: número da questão na prova
- areaBloco: bloco grande da prova, se aplicável (ex. Ciências da Natureza, Linguagens, Matemática e suas Tecnologias) — senão omita/null
- materia: disciplina principal (Química, Física, Matemática, Biologia, História, Geografia, Filosofia, Sociologia, Língua Portuguesa, Literatura, Inglês, Espanhol, Redação)
- assunto: tema específico (ex. Ondas, Estequiometria, Interpretação de texto) — mais específico que matéria
- conhecimentoExigido: em uma frase curta o que o estudante precisa saber/fazer
- nivelDificuldade: facil | media | dificil ou null
- observacoes: só se interdisciplinar, imagem, ambiguidade relevante
- gabarito: letra A–E SOMENTE se explícita no material; senão null

REGRAS DE CLASSIFICAÇÃO:
- Não misture matéria com assunto.
- Não invente gabarito nem número de questão inexistente.
- Em ambiguidade, escolha a classificação mais defensável e explique brevemente em observacoes.
- Interdisciplinar: matéria predominante + observação curta se necessário.
- Padronize nomenclaturas para comparar provas depois.

Formato: { "questoes": [...], "avisos": [...], "resumo": "..." }`;

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

async function callOpenAI(
  userContent: string,
  provaContext: { nome: string; banca: string; ano?: number | null; caderno?: string | null; totalEsperado?: number }
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
    `Total esperado: ${provaContext.totalEsperado ?? "desconhecido"}`,
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
          content: `${meta}\n\nConteúdo das questões (classifique apenas o pedagógico por linha):\n${userContent}`,
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

  const parsed = JSON.parse(raw);
  return respostaSchema.parse(parsed);
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
      materia: q.materia !== "A classificar" ? q.materia : existing.materia,
      assunto: q.assunto !== "A classificar" ? q.assunto : existing.assunto,
    });
  }
  return [...map.values()].sort((a, b) => a.numero - b.numero);
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
  if (questoes.length === 0) {
    allAvisos.push("Nenhuma questão identificada — revise o texto ou use CSV do GPT.");
  }

  return {
    questoes,
    avisos: allAvisos,
    resumo: `${questoes.length} questões extraídas`,
  };
}
