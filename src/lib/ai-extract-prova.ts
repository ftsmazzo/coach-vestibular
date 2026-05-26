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

const allowedTaxonomyStr = taxonomy.materias
  .map((m) => {
    const temasStr = m.temas.map((t) => `"${t.label}"`).join(", ");
    return `- Matéria: "${m.label}" | Assuntos permitidos: ${temasStr}`;
  })
  .join("\n");

const SYSTEM_PROMPT_PASSO_2 = `Você é um classificador pedagógico de altíssima precisão para vestibulares brasileiros.
Sua missão é ler uma lista de questões (contendo seus enunciados literais pré-extraídos) e classificar a matéria e o assunto de cada uma delas cruzando rigorosamente e exclusivamente com a taxonomia oficial do projeto.

REGRAS DE CLASSIFICAÇÃO PEDAGÓGICA (TAXONOMIA):
Você é terminantemente proibido de retornar null ou strings vazias para 'materia' e 'assunto'.
Você DEVE escolher a matéria e o assunto de cada questão EXCLUSIVAMENTE a partir da taxonomia oficial abaixo:

${allowedTaxonomyStr}

ATENÇÃO:
1. A matéria e o assunto devem corresponder exatamente a um dos pares listados acima (com a grafia idêntica, incluindo acentos).
2. NUNCA use "A classificar" ou retorne null para materia ou assunto. Encontre a melhor correspondência pedagógica.
3. Inglês/Espanhol: Se o texto-base principal estiver em inglês/espanhol, classifique inicialmente a matéria como "Português" e o assunto como "Interpretação de Texto" (já que a taxonomia oficial não possui Inglês e Espanhol como matérias separadas). O pós-processador do sistema irá ajustar depois.

Responda apenas com um JSON válido relacionando o número da questão à classificação oficial:
{
  "classificacoes": [
    {
      "numero": 1,
      "materia": "Física",
      "assunto": "Cinemática"
    }
  ]
}`;

function dedupeAvisos(avisos: string[]): string[] {
  return [...new Set(avisos)];
}

function chunkTextPedagogical(text: string, batchSize = 8): string[] {
  const regex = /(?=Quest(?:ã|a)o\s+\d+|QUEST(?:Ã|A)O\s+\d+|\bQ\s*\d+\b|\bQ\.\s*\d+\b)/gi;
  const chunks = text.split(regex).map((c) => c.trim()).filter((c) => c.length > 20);
  
  if (chunks.length <= 1) {
    const maxLen = 12000;
    const fallbackChunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      fallbackChunks.push(text.slice(start, start + maxLen));
      start += maxLen;
    }
    return fallbackChunks;
  }
  
  const batches: string[] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize).join("\n\n--- NOVA QUESTÃO ---\n\n"));
  }
  return batches;
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  modelOverride?: string
): Promise<any> {
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
      model: modelOverride ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
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

  const batches = chunkTextPedagogical(trimmed, 8);
  const questoesPasso1: Array<{
    numero: number;
    trechoEnunciado: string;
  }> = [];

  const allAvisos: string[] = [];

  // PASSO 1: Extração Literal
  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await callOpenAI(
        SYSTEM_PROMPT_PASSO_1,
        `Lote ${i + 1}/${batches.length} a extrair:\n\n${batches[i]}`
      );
      if (result && Array.isArray(result.questoes)) {
        const brutas = result.questoes as Array<any>;
        const validas = brutas.filter((q) => {
          return (
            q &&
            typeof q.numero === "number" &&
            Number.isInteger(q.numero) &&
            typeof q.trechoEnunciado === "string" &&
            q.trechoEnunciado.trim().length >= 20
          );
        });
        if (validas.length !== brutas.length) {
          allAvisos.push(
            `Passo 1: lote ${i + 1} retornou ${brutas.length} itens, mas ${validas.length} foram válidos (numero + trechoEnunciado).`
          );
        }
        questoesPasso1.push(...validas);
      }
    } catch (error) {
      console.error(`Erro no Passo 1, lote ${i + 1}:`, error);
      allAvisos.push(
        `Erro de extração literal no lote ${i + 1}: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
    }
  }

  if (questoesPasso1.length === 0) {
    throw new Error("Nenhuma questão foi extraída no Passo 1 de extração literal.");
  }

  // PASSO 2: Classificação Pedagógica (sem preview curto)
  // Idioma e assunto dependem do enunciado completo; então classificamos em lotes menores.
  const MAX_ENUNCIADO_PARA_CLASSIFICAR =
    parseInt(process.env.ENUNCIADO_PARA_CLASSIFICAR_MAX ?? "5000", 10);
  const CLASS_BATCH_SIZE = parseInt(process.env.CLASS_BATCH_SIZE ?? "8", 10);
  const modelPasso2 = process.env.OPENAI_MODEL_PASSO_2 ?? process.env.OPENAI_MODEL;

  const mapClassificacoes = new Map<number, { materia: string; assunto: string }>();
  for (let i = 0; i < questoesPasso1.length; i += CLASS_BATCH_SIZE) {
    const lote = questoesPasso1.slice(i, i + CLASS_BATCH_SIZE);
    const loteParaIA = lote.map((q) => {
      const t = q.trechoEnunciado.trim();
      const cortado =
        t.length > MAX_ENUNCIADO_PARA_CLASSIFICAR
          ? `${t.slice(0, MAX_ENUNCIADO_PARA_CLASSIFICAR)}…`
          : t;
      return { numero: q.numero, enunciado: cortado };
    });

    try {
      const result = await callOpenAI(
        SYSTEM_PROMPT_PASSO_2,
        `Classifique as questões abaixo de acordo com a taxonomia:\n\n${JSON.stringify(
          loteParaIA
        )}`,
        modelPasso2
      );
      if (result && Array.isArray(result.classificacoes)) {
        for (const c of result.classificacoes) {
          if (c?.numero && c.materia && c.assunto) {
            mapClassificacoes.set(c.numero, { materia: c.materia, assunto: c.assunto });
          }
        }
      }
    } catch (error) {
      console.error(`Erro no Passo 2 (Classificação) — lote ${i}:`, error);
      allAvisos.push(
        `Erro de classificação no lote ${i} — usando fallback para as questões deste lote.`
      );
    }
  }

  const naoClassificadas = questoesPasso1.filter((q) => !mapClassificacoes.has(q.numero));
  if (naoClassificadas.length > 0) {
    allAvisos.push(
      `Passo 2: ${naoClassificadas.length} questão(ões) sem classificação (marcadas como «A classificar»).`
    );
  }

  const finalQuestoes: QuestaoExtraida[] = questoesPasso1.map((q) => {
    const c = mapClassificacoes.get(q.numero) ?? {
      materia: "A classificar",
      assunto: "A classificar",
    };

    return {
      numero: q.numero,
      // Para evitar ruído, o Passo 1 não extrai blocos nem campos pedagógicos.
      areaBloco: null,
      materia: c.materia,
      assunto: c.assunto,
      conhecimentoExigido: null,
      nivelDificuldade: null,
      observacoes: null,
      trechoEnunciado: q.trechoEnunciado,
    };
  });

  // Pós-processamento de idioma (Inglês/Espanhol)
  const ajustadas = finalQuestoes.map((q) =>
    ajustarMateriaPorIdiomaDoTexto(q.trechoEnunciado, q)
  );

  const questoes = mergeQuestoes(ajustadas);

  if (batches.length > 1) {
    allAvisos.unshift(
      `Arquitetura de Dois Passos (Two-Pass) concluída: ${batches.length} lotes literais extraídos e classificação unificada executada.`
    );
  }

  allAvisos.push(...avisosCobertura(questoes, provaContext.totalEsperado));

  return {
    questoes,
    avisos: dedupeAvisos(allAvisos),
    resumo: `${questoes.length} questões extraídas de forma literal e classificadas com sucesso.`,
  };
}
