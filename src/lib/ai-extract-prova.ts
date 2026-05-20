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

OBJETIVO PRINCIPAL: cobertura completa. Para CADA questão numerada visível no trecho, inclua um objeto em "questoes".

Campos por questão:
- numero: número oficial na prova (inteiro)
- areaBloco: bloco ENEM ou área, se aplicável — senão null
- materia: disciplina (obrigatório; se incerto: "A classificar")
- assunto: tema específico (obrigatório; se incerto: "A classificar")
- conhecimentoExigido: frase curta ou null
- nivelDificuldade: facil | media | dificil ou null
- observacoes: ambiguidade, imagem, interdisciplinar — ou null

REGRAS DE COBERTURA (prioridade máxima):
- NÃO omita questões numeradas que aparecem no texto, mesmo com enunciado incompleto ou cortado no fim do trecho.
- Se o trecho termina no meio de uma questão, classifique-a com o número visível e "A classificar" onde faltar contexto.
- Se matéria/assunto forem ambíguos, use melhor hipótese OU "A classificar" — mas SEMPRE inclua a linha da questão.
- Não invente números que não aparecem no trecho.
- Não misture matéria com assunto.

PROIBIDO:
- gabarito, resposta correta, letra A–E
- null em materia/assunto (use string)

Formato: { "questoes": [...], "avisos": ["..."], "resumo": "..." }
No resumo, indique quantas questões classificou e o intervalo de números (ex.: "34 questões, nº 1–34").`;

/** Quebra preferencial antes de marcadores de questão (evita cortar no meio). */
function findSoftBreakEnd(slice: string, minRatio = 0.35): number {
  const patterns = [
    /\n\s*(?:QUEST[ÃA]O|Questão|Q\.)\s*\d+/gi,
    /\n\s*\d{1,3}\s*[\.\)]\s/g,
    /\n\s*—\s*\d{1,3}\s*—/g,
  ];
  let best = -1;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(slice)) !== null) {
      if (m.index >= slice.length * minRatio) best = Math.max(best, m.index);
    }
  }
  return best;
}

function chunkText(text: string, maxLen = 10000, overlap = 2000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);

    if (end < text.length) {
      const slice = text.slice(start, end);
      const soft = findSoftBreakEnd(slice);
      if (soft > 0) end = start + soft;
    }

    chunks.push(text.slice(start, end));

    if (end >= text.length) break;
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;
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

function numerosFaltantes(
  questoes: QuestaoExtraida[],
  totalEsperado?: number
): number[] {
  if (!totalEsperado || totalEsperado < 1) return [];
  const presentes = new Set(questoes.map((q) => q.numero));
  const faltando: number[] = [];
  for (let n = 1; n <= totalEsperado; n++) {
    if (!presentes.has(n)) faltando.push(n);
  }
  return faltando;
}

async function callOpenAI(
  userContent: string,
  provaContext: {
    nome: string;
    banca: string;
    ano?: number | null;
    caderno?: string | null;
    totalEsperado?: number;
    parte?: string;
    numerosAlvo?: number[];
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
    `Total esperado na prova: ${provaContext.totalEsperado ?? "desconhecido"}`,
    provaContext.parte ? `Trecho: ${provaContext.parte}` : null,
    provaContext.numerosAlvo?.length
      ? `Classifique APENAS estas questões (números): ${provaContext.numerosAlvo.join(", ")}`
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
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${meta}\n\nConteúdo (classifique TODAS as questões numeradas neste trecho):\n${userContent}`,
        },
      ],
      max_tokens: 16384,
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
      "Resposta da IA truncada (limite de tokens) — pode faltar questões neste trecho. Tente CSV ou complete faltantes."
    );
  }

  for (const q of result.questoes) {
    if (q.materia === "A classificar" || q.assunto === "A classificar") {
      avisos.push(`Questão ${q.numero}: matéria/assunto incertos — revise manualmente.`);
    }
  }

  return { ...result, avisos: avisos.length ? avisos : result.avisos };
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

/** Extrai trechos do texto que mencionam números de questão faltantes (para repasse focado). */
function extrairTrechoParaNumeros(texto: string, numeros: number[]): string {
  const lines = texto.split(/\r?\n/);
  const wanted = new Set(numeros);
  const chunks: string[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length) chunks.push(buf.join("\n"));
    buf = [];
  };

  const matchesNumero = (line: string): number | null => {
    const patterns = [
      /(?:QUEST[ÃA]O|Questão|Q\.?)\s*(\d{1,3})/i,
      /^(\d{1,3})\s*[\.\)]\s/,
      /^(\d{1,3})\s*[-–—]\s/,
    ];
    for (const re of patterns) {
      const m = line.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (wanted.has(n)) return n;
      }
    }
    return null;
  };

  let active = false;
  for (const line of lines) {
    const n = matchesNumero(line);
    if (n != null) {
      if (active) flush();
      active = true;
      buf = [line];
    } else if (active) {
      buf.push(line);
      if (buf.length > 80) flush();
    }
  }
  flush();

  if (chunks.length > 0) return chunks.join("\n\n---\n\n");
  return texto.slice(0, 12000);
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

  if (chunks.length > 1) {
    allAvisos.push(
      `Prova dividida em ${chunks.length} partes para a IA (com sobreposição para não perder questões nas bordas).`
    );
  }

  for (let i = 0; i < chunks.length; i++) {
    const result = await callOpenAI(
      chunks.length > 1 ? `[Parte ${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i],
      {
        ...provaContext,
        parte: chunks.length > 1 ? `${i + 1}/${chunks.length}` : undefined,
      }
    );
    allQuestoes.push(...result.questoes);
    if (result.avisos) allAvisos.push(...result.avisos);
  }

  let questoes = mergeQuestoes(allQuestoes);

  const faltando = numerosFaltantes(questoes, provaContext.totalEsperado);
  if (faltando.length > 0 && faltando.length <= 25) {
    allAvisos.push(
      `Após extração faltam ${faltando.length} questão(ões): nº ${faltando.slice(0, 15).join(", ")}${faltando.length > 15 ? "…" : ""}. Tentando repasse focado…`
    );
    const trecho = extrairTrechoParaNumeros(trimmed, faltando);
    try {
      const retry = await callOpenAI(trecho, {
        ...provaContext,
        parte: "repasse faltantes",
        numerosAlvo: faltando,
      });
      questoes = mergeQuestoes([...questoes, ...retry.questoes]);
      if (retry.avisos) allAvisos.push(...retry.avisos);
    } catch {
      allAvisos.push("Repasse focado falhou — use o bloco «Completar faltantes» ou CSV.");
    }
  }

  const aindaFaltando = numerosFaltantes(questoes, provaContext.totalEsperado);
  if (aindaFaltando.length > 0) {
    allAvisos.push(
      `Ainda faltam ${aindaFaltando.length} de ${provaContext.totalEsperado} questões: nº ${aindaFaltando.slice(0, 20).join(", ")}${aindaFaltando.length > 20 ? ` (+${aindaFaltando.length - 20})` : ""}.`
    );
  }

  if (questoes.length === 0) {
    allAvisos.push("Nenhuma questão identificada — revise o texto ou use CSV do GPT.");
  }

  return {
    questoes,
    avisos: allAvisos,
    resumo: `${questoes.length} questões extraídas${provaContext.totalEsperado ? ` (meta: ${provaContext.totalEsperado})` : ""}`,
  };
}
