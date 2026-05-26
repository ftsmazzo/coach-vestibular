import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import { classificarMateriaEAssuntoMotor } from "@/lib/prova-classificacao-motor";
import {
  assuntoPadraoMateria,
  inferirMateriaPorEnunciado,
} from "@/lib/prova-heuristicas";
import { textoIndicaPortuguesInterpretacao } from "@/lib/prova-materia-ajuste";
import {
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { taxonomy } from "@/lib/taxonomy";

export { inferirMateriaPorEnunciado } from "@/lib/prova-heuristicas";
export { normalizarLabelAssunto, normalizarLabelMateria } from "@/lib/taxonomia-validacao";

export type EtapaExtracao =
  | "enunciados"
  | "materia"
  | "assunto"
  | "conhecimento"
  | "completo";

export interface ProvaExtracaoContext {
  nome: string;
  banca: string;
  ano?: number | null;
  caderno?: string | null;
  totalEsperado?: number;
}

type EnunciadoBruto = { numero: number; trechoEnunciado: string };

function dedupeAvisos(avisos: string[]): string[] {
  return [...new Set(avisos)];
}

function cortarEnunciado(texto: string, max = 5000): string {
  const t = texto.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function aplicarFallbacksClassificacao(questoes: QuestaoExtraida[]): string[] {
  const avisos: string[] = [];
  for (const q of questoes) {
    if (q.materia !== "A classificar" && q.assunto !== "A classificar") continue;
    const h = inferirMateriaPorEnunciado(q.trechoEnunciado);
    if (h) {
      q.materia = h;
      if (q.assunto === "A classificar") q.assunto = assuntoPadraoMateria(h);
      continue;
    }
    if (textoIndicaPortuguesInterpretacao(q.trechoEnunciado)) {
      q.materia = "Português";
      q.assunto = q.assunto === "A classificar" ? "Interpretação de Texto" : q.assunto;
    }
  }
  const incertas = questoes.filter(
    (q) => q.materia === "A classificar" || q.assunto === "A classificar"
  );
  if (incertas.length > 0) {
    avisos.push(
      `${incertas.length} questão(ões) ainda sem classificação completa: nº ${incertas
        .slice(0, 15)
        .map((q) => q.numero)
        .join(", ")}${incertas.length > 15 ? "…" : ""}.`
    );
  }
  return avisos;
}

function questaoBase(numero: number, trecho: string): QuestaoExtraida {
  return {
    numero,
    trechoEnunciado: trecho,
    materia: "A classificar",
    assunto: "A classificar",
    areaBloco: null,
    conhecimentoExigido: null,
    nivelDificuldade: null,
    observacoes: null,
  };
}

function mergeEnunciados(listas: EnunciadoBruto[][]): EnunciadoBruto[] {
  const map = new Map<number, EnunciadoBruto>();
  for (const lista of listas) {
    for (const q of lista) {
      const prev = map.get(q.numero);
      if (!prev || q.trechoEnunciado.length > prev.trechoEnunciado.length) {
        map.set(q.numero, q);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.numero - b.numero);
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  modelOverride?: string
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no servidor");

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

function buildPromptAssunto(materiaLabel: string): string {
  const mat = taxonomy.materias.find((m) => m.label === materiaLabel);
  const temas = mat?.temas.map((t) => t.label).join(", ") ?? "";
  return `Classifique APENAS o assunto das questões da matéria "${materiaLabel}".
Assuntos permitidos (grafia exata): ${temas}.

Não mude a matéria. Uma frase de assunto da taxonomia por questão.
JSON: { "assuntos": [{ "numero": 1, "assunto": "${mat?.temas[0]?.label ?? "Interpretação de Texto"}" }] }`;
}

const PROMPT_CONHECIMENTO = `Para cada questão, escreva UMA frase curta do conhecimento/habilidade exigido (máx. 120 caracteres).
Use o enunciado e a classificação já definida. Não invente gabarito.
JSON: { "conhecimentos": [{ "numero": 1, "conhecimentoExigido": "..." }] }`;

/** Motor principal: gpt-4o, lotes paralelos, revisão unitária nas suspeitas. */
export async function classificarMateriaEAssunto(
  base: QuestaoExtraida[],
  avisosIn: string[] = []
): Promise<{ questoes: QuestaoExtraida[]; avisos: string[] }> {
  const r = await classificarMateriaEAssuntoMotor(base, avisosIn);
  r.avisos.push(...aplicarFallbacksClassificacao(r.questoes));
  return r;
}

export async function classificarMaterias(
  base: QuestaoExtraida[],
  avisosIn: string[] = []
): Promise<{ questoes: QuestaoExtraida[]; avisos: string[] }> {
  return classificarMateriaEAssunto(base, avisosIn);
}

export async function classificarAssuntos(
  base: QuestaoExtraida[],
  avisosIn: string[] = []
): Promise<{ questoes: QuestaoExtraida[]; avisos: string[] }> {
  const avisos = [...avisosIn];
  const resultado = base.map((q) => ({ ...q }));
  const porMateria = new Map<string, QuestaoExtraida[]>();

  for (const q of resultado) {
    const m = normalizarLabelMateria(q.materia);
    q.materia = m;
    const lista = porMateria.get(m) ?? [];
    lista.push(q);
    porMateria.set(m, lista);
  }

  for (const [materiaLabel, lista] of porMateria) {
    if (materiaLabel === "A classificar") continue;
    const BATCH = 8;
    for (let i = 0; i < lista.length; i += BATCH) {
      const lote = lista.slice(i, i + BATCH);
      const payload = lote.map((q) => ({
        numero: q.numero,
        materia: materiaLabel,
        enunciado: cortarEnunciado(q.trechoEnunciado, 3500),
      }));
      try {
        const res = await callOpenAI(buildPromptAssunto(materiaLabel), JSON.stringify(payload));
        if (Array.isArray(res.assuntos)) {
          for (const row of res.assuntos) {
            const q = resultado.find((x) => x.numero === row.numero);
            if (q && row.assunto) {
              q.assunto = normalizarLabelAssunto(materiaLabel, row.assunto);
            }
          }
        }
      } catch (e) {
        avisos.push(
          `Etapa 3 (assunto) ${materiaLabel} lote ${i}: ${e instanceof Error ? e.message : "erro"}`
        );
      }
    }
  }

  avisos.push(...aplicarFallbacksClassificacao(resultado));

  avisos.push(`Etapa 3: assuntos refinados.`);
  return { questoes: resultado, avisos };
}

export async function gerarConhecimentos(
  base: QuestaoExtraida[],
  avisosIn: string[] = []
): Promise<{ questoes: QuestaoExtraida[]; avisos: string[] }> {
  const avisos = [...avisosIn];
  const resultado = base.map((q) => ({ ...q }));
  const BATCH = 6;

  for (let i = 0; i < resultado.length; i += BATCH) {
    const lote = resultado.slice(i, i + BATCH).filter(
      (q) => q.materia !== "A classificar" && q.assunto !== "A classificar"
    );
    if (lote.length === 0) continue;

    const payload = lote.map((q) => ({
      numero: q.numero,
      materia: q.materia,
      assunto: q.assunto,
      enunciado: cortarEnunciado(q.trechoEnunciado, 2500),
    }));

    try {
      const res = await callOpenAI(PROMPT_CONHECIMENTO, JSON.stringify(payload));
      if (Array.isArray(res.conhecimentos)) {
        for (const row of res.conhecimentos) {
          const q = resultado.find((x) => x.numero === row.numero);
          if (q && row.conhecimentoExigido?.trim()) {
            q.conhecimentoExigido = row.conhecimentoExigido.trim().slice(0, 300);
          }
        }
      }
    } catch (e) {
      avisos.push(
        `Etapa 4 (conhecimento) lote ${i}: ${e instanceof Error ? e.message : "erro"}`
      );
    }
  }

  avisos.push(`Etapa 4: conhecimento exigido gerado.`);
  return { questoes: resultado, avisos };
}

export async function executarPipelineExtracao(
  textoProva: string,
  ctx: ProvaExtracaoContext,
  etapa: EtapaExtracao,
  options: {
    extrairEnunciadosLote: (
      lote: string,
      idx: number,
      total: number
    ) => Promise<EnunciadoBruto[]>;
    baseInicial?: QuestaoExtraida[];
  }
): Promise<{
  questoes: QuestaoExtraida[];
  avisos: string[];
  etapa: EtapaExtracao;
  resumo?: string;
}> {
  const avisos: string[] = [];
  let questoes: QuestaoExtraida[] = options.baseInicial ?? [];

  if (
    (etapa === "materia" ||
      etapa === "assunto" ||
      etapa === "conhecimento") &&
    questoes.length === 0 &&
    options.baseInicial?.length
  ) {
    questoes = options.baseInicial.map((q) => ({ ...q }));
  }

  if (etapa === "enunciados" || etapa === "completo") {
    const lotes: EnunciadoBruto[][] = [];
    const trimmed = textoProva.trim();
    if (trimmed.length < 100 && questoes.length === 0) {
      throw new Error("Texto muito curto para extração.");
    }
    if (trimmed.length >= 100) {
      const regex =
        /(?=Quest(?:ã|a)o\s+\d+|QUEST(?:Ã|A)O\s+\d+|\bQ\s*\d+\b|\bQ\.\s*\d+\b)/gi;
      const partes = trimmed
        .split(regex)
        .map((c) => c.trim())
        .filter((c) => c.length > 20);
      const batchSize = 8;
      const batches: string[] = [];
      if (partes.length <= 1) {
        let start = 0;
        while (start < trimmed.length) {
          batches.push(trimmed.slice(start, start + 12000));
          start += 12000;
        }
      } else {
        for (let i = 0; i < partes.length; i += batchSize) {
          batches.push(partes.slice(i, i + batchSize).join("\n\n--- NOVA QUESTÃO ---\n\n"));
        }
      }
      for (let i = 0; i < batches.length; i++) {
        try {
          lotes.push(await options.extrairEnunciadosLote(batches[i], i, batches.length));
        } catch (e) {
          avisos.push(
            `Etapa 1 lote ${i + 1}: ${e instanceof Error ? e.message : "erro"}`
          );
        }
      }
      const merged = mergeEnunciados(lotes);
      questoes = merged.map((q) => questaoBase(q.numero, q.trechoEnunciado));
    }
    if (questoes.length === 0) throw new Error("Nenhum enunciado extraído.");
    if (etapa === "enunciados") {
      return {
        questoes,
        avisos: dedupeAvisos(avisos),
        etapa,
        resumo: `${questoes.length} enunciados prontos para gravar.`,
      };
    }
  }

  if (etapa === "materia" || etapa === "completo") {
    if (questoes.length === 0) throw new Error("Sem enunciados — rode a etapa 1 antes.");
    const r = await classificarMaterias(questoes, avisos);
    questoes = r.questoes;
    avisos.push(...r.avisos);
    if (etapa === "materia") {
      return {
        questoes,
        avisos: dedupeAvisos(avisos),
        etapa,
        resumo: `Matéria e assunto classificados (${questoes.length} questões).`,
      };
    }
  }

  if (etapa === "assunto") {
    const r = await classificarAssuntos(questoes, avisos);
    questoes = r.questoes;
    avisos.push(...r.avisos);
    return {
      questoes,
      avisos: dedupeAvisos(avisos),
      etapa,
      resumo: `Assuntos refinados (${questoes.length} questões).`,
    };
  }

  if (etapa === "conhecimento" || etapa === "completo") {
    const r = await gerarConhecimentos(questoes, avisos);
    questoes = r.questoes;
    avisos.push(...r.avisos);
  }

  if (ctx.totalEsperado && ctx.totalEsperado > 0) {
    const nums = new Set(questoes.map((q) => q.numero));
    const faltando: number[] = [];
    for (let n = 1; n <= ctx.totalEsperado; n++) {
      if (!nums.has(n)) faltando.push(n);
    }
    if (faltando.length > 0) {
      avisos.push(
        `Faltam ${faltando.length} questão(ões) (de ${ctx.totalEsperado}): nº ${faltando.slice(0, 20).join(", ")}${faltando.length > 20 ? "…" : ""}.`
      );
    }
  }

  return {
    questoes,
    avisos: dedupeAvisos(avisos),
    etapa: etapa === "completo" ? "completo" : etapa,
    resumo: `Pipeline concluído — ${questoes.length} questões.`,
  };
}
