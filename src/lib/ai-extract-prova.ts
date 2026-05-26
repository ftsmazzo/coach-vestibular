import { z } from "zod";
import { ajustarMateriaPorIdiomaDoTexto } from "@/lib/prova-materia-ajuste";
import { taxonomy } from "@/lib/taxonomy";

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
  /** Trecho do enunciado (MANDATÓRIO) */
  trechoEnunciado: z.string().min(5),
});

const respostaSchema = z.object({
  questoes: z.array(questaoExtraidaSchema),
  avisos: z.array(z.string()).optional(),
  resumo: z.string().optional(),
});

export type QuestaoExtraida = z.infer<typeof questaoExtraidaSchema>;

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

async function callGemini(
  userContent: string,
  provaContext: {
    nome: string;
    banca: string;
    ano?: number | null;
    caderno?: string | null;
    totalEsperado?: number;
  }
): Promise<z.infer<typeof respostaSchema>> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY ou OPENAI_API_KEY não configurada no servidor");
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

  const allowedTaxonomyStr = taxonomy.materias
    .map((m) => {
      const temasStr = m.temas.map((t) => `"${t.label}"`).join(", ");
      return `- Matéria: "${m.label}" | Assuntos permitidos: ${temasStr}`;
    })
    .join("\n");

  const systemPrompt = `Você é uma Inteligência Artificial especializada e implacável na classificação pedagógica e extração de questões objetivas de provas de vestibulares brasileiros (ENEM, vestibulares tradicionais, simulados).

Sua tarefa é analisar o texto completo da prova fornecido e extrair todas as questões em um formato estruturado JSON estrito.

REGRAS DE CLASSIFICAÇÃO PEDAGÓGICA (TAXONOMIA):
Você é terminantemente proibido de retornar null ou strings vazias em 'materia' e 'assunto'.
Você DEVE escolher a matéria e o assunto de cada questão EXCLUSIVAMENTE a partir da taxonomia oficial abaixo:

${allowedTaxonomyStr}

ATENÇÃO:
1. A matéria e o assunto devem corresponder exatamente a um dos pares listados acima (com a grafia idêntica, incluindo acentos).
2. NUNCA use "A classificar" ou retorne null para materia ou assunto. Encontre a melhor correspondência pedagógica.
3. Inglês/Espanhol: Se o texto-base principal estiver em inglês/espanhol, classifique inicialmente a matéria como "Português" e o assunto como "Interpretação de Texto" (já que a taxonomia oficial não possui Inglês e Espanhol como matérias separadas). O pós-processador do sistema irá ajustar depois.

REGRAS DE EXTRAÇÃO:
- "trechoEnunciado" é um campo MANDATÓRIO. Você deve extrair as frases centrais do enunciado da questão e da pergunta de forma a dar contexto completo para um diagnóstico de IA (entre 50 e 400 caracteres). Nunca deixe vazio, nulo ou com placeholder.
- "numero": número da questão (exatamente como aparece na prova).
- "areaBloco": bloco/área da prova (ex. "Ciências da Natureza", "Matemática e suas Tecnologias") ou null se não aplicável.
- "conhecimentoExigido": descrição em uma frase curta do que o aluno precisa saber para resolver, ou null.
- "nivelDificuldade": "facil" | "media" | "dificil" ou null.
- "observacoes": notas especiais (ex: "interdisciplinar", "tabela", "gráfico", "imagem") ou null.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${meta}\n\nConteúdo completo das questões (analise e classifique; resposta em JSON):\n${userContent}`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            questoes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  numero: { type: "INTEGER" },
                  areaBloco: { type: "STRING" },
                  materia: { type: "STRING" },
                  assunto: { type: "STRING" },
                  conhecimentoExigido: { type: "STRING" },
                  nivelDificuldade: { type: "STRING" },
                  observacoes: { type: "STRING" },
                  trechoEnunciado: { type: "STRING" },
                },
                required: ["numero", "materia", "assunto", "trechoEnunciado"],
              },
            },
            resumo: { type: "STRING" },
          },
          required: ["questoes"],
        },
        temperature: 0.15,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error("Resposta vazia do Gemini");

  // Limpador robusto de marcações de markdown de JSON
  let cleanJson = jsonText.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.substring(7);
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.substring(3);
  }
  if (cleanJson.endsWith("```")) {
    cleanJson = cleanJson.substring(0, cleanJson.length - 3);
  }
  cleanJson = cleanJson.trim();

  const parsed = JSON.parse(cleanJson);
  const stripped = stripGabaritoFromRaw(parsed);
  const result = respostaSchema.parse(stripped);

  return result;
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
      trechoEnunciado: q.trechoEnunciado ?? existing.trechoEnunciado,
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
      `Faltam ${faltando.length} questão(ões) no banco (de ${totalEsperado}): nº ${faltando.slice(0, 25).join(", ")}${faltando.length > 25 ? "…" : ""}.`
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

  // We take advantage of Gemini's large context window and send the entire text at once.
  const result = await callGemini(trimmed, provaContext);
  
  const ajustadas = result.questoes.map((q) =>
    ajustarMateriaPorIdiomaDoTexto(
      q.trechoEnunciado?.trim() ? `${trimmed}\n${q.trechoEnunciado}` : trimmed,
      q
    )
  );

  const questoes = mergeQuestoes(ajustadas);
  const allAvisos = [...(result.avisos ?? [])];

  allAvisos.push(...avisosCobertura(questoes, provaContext.totalEsperado));

  if (questoes.length === 0) {
    allAvisos.push("Nenhuma questão identificada — revise o texto ou use CSV.");
  }

  return {
    questoes,
    avisos: dedupeAvisos(allAvisos),
    resumo: result.resumo || `${questoes.length} questões extraídas`,
  };
}
