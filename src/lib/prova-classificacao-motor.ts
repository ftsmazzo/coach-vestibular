import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import {
  ajustarMateriaIdiomaEDisciplina,
  detectarPassagemIngles,
  detectarPassagemEspanhol,
} from "@/lib/prova-materia-ajuste";
import {
  alinharLoteTaxonomia,
  assuntoPertenceMateria,
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { taxonomy } from "@/lib/taxonomy";
import {
  assuntoPadraoMateria,
  inferirMateriaPorEnunciado,
} from "@/lib/prova-heuristicas";

const allowedTaxonomyStr = taxonomy.materias
  .map((m) => {
    const temasStr = m.temas.map((t) => `"${t.label}"`).join(", ");
    return `- "${m.label}": ${temasStr}`;
  })
  .join("\n");

/** Extração pode usar mini; classificação pede modelo mais capaz. */
export function modeloClassificacao(): string {
  const passo2 = process.env.OPENAI_MODEL_PASSO_2?.trim();
  if (passo2) return passo2;
  const base = process.env.OPENAI_MODEL?.trim();
  if (base && base !== "gpt-4o-mini") return base;
  return "gpt-4o";
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function cortarEnunciado(texto: string, max: number): string {
  const t = texto.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function callOpenAIClassificacao(
  systemPrompt: string,
  userContent: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no servidor");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modeloClassificacao(),
      temperature: 0,
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

function buildPromptLote(): string {
  return `Você é especialista em classificar questões de vestibular brasileiro.
Para cada questão abaixo, leia o ENUNCIADO COMPLETO (texto-base + comando) e retorne matéria e assunto.

TAXONOMIA (use grafia exata):
${allowedTaxonomyStr}

COMO DECIDIR A MATÉRIA (conteúdo cognitivo, não o idioma só da pergunta):
- Biologia: células, DNA, ecologia, biomas, corpo humano, evolução, genética.
- Química: reações, mol, tabela periódica, orgânica, estequiometria.
- Física: forças, energia, circuitos, ondas, óptica, cinemática.
- Matemática: equações, gráficos, geometria, matrizes, funções, probabilidade.
- História / Geografia: fatos históricos, mapas, sociedade, geopolítica.
- Inglês: texto-base principal em inglês (pergunta pode estar em português).
- Espanhol: texto-base principal em espanhol.
- Português: interpretação de texto literário, gramática, redação — NÃO use para ciências.

PROIBIDO: "A classificar", null, assunto de outra matéria (ex.: Química Orgânica em Português).

Responda JSON: { "classificacoes": [{ "numero": 1, "materia": "Biologia", "assunto": "Ecologia" }] }`;
}

function buildPromptUnitario(numero: number): string {
  return `Classifique UMA questão de vestibular (nº ${numero}). Leia todo o enunciado.

TAXONOMIA:
${allowedTaxonomyStr}

Foque no conteúdo necessário para resolver. Não use Português para questões de ciências ou matemática.

JSON: { "numero": ${numero}, "materia": "...", "assunto": "..." }`;
}

function formatarLoteParaIA(questoes: QuestaoExtraida[], maxChars: number): string {
  return questoes
    .map((q) => {
      const enc = cortarEnunciado(q.trechoEnunciado, maxChars);
      return `### Questão ${q.numero}\n${enc}\n`;
    })
    .join("\n");
}

function aplicarClassificacoes(
  resultado: QuestaoExtraida[],
  rows: Array<{ numero?: number; materia?: string; assunto?: string }>
): number {
  let n = 0;
  for (const row of rows) {
    const q = resultado.find((x) => x.numero === row.numero);
    if (!q || !row.materia || !row.assunto) continue;
    q.materia = normalizarLabelMateria(row.materia);
    q.assunto = normalizarLabelAssunto(q.materia, row.assunto);
    n++;
  }
  return n;
}

async function classificarLote(questoes: QuestaoExtraida[], maxChars: number): Promise<number> {
  const user = formatarLoteParaIA(questoes, maxChars);
  const res = await callOpenAIClassificacao(buildPromptLote(), user);
  const rows = res.classificacoes;
  if (!Array.isArray(rows)) return 0;
  return aplicarClassificacoes(questoes, rows);
}

async function classificarUnitario(q: QuestaoExtraida, maxChars: number): Promise<boolean> {
  const enc = cortarEnunciado(q.trechoEnunciado, maxChars);
  const res = await callOpenAIClassificacao(
    buildPromptUnitario(q.numero),
    `Enunciado:\n${enc}`
  );
  if (res.numero === q.numero && res.materia && res.assunto) {
    q.materia = normalizarLabelMateria(String(res.materia));
    q.assunto = normalizarLabelAssunto(q.materia, String(res.assunto));
    return true;
  }
  if (Array.isArray(res.classificacoes) && res.classificacoes[0]) {
    return aplicarClassificacoes([q], res.classificacoes) > 0;
  }
  return false;
}

async function executarEmParalelo<T>(
  tarefas: Array<() => Promise<T>>,
  concorrencia: number
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tarefas.length; i += concorrencia) {
    const fatia = tarefas.slice(i, i + concorrencia);
    out.push(...(await Promise.all(fatia.map((fn) => fn()))));
  }
  return out;
}

/** Questão com classificação claramente incoerente com o enunciado. */
export function classificacaoSuspeita(q: QuestaoExtraida): boolean {
  if (q.materia === "A classificar" || q.assunto === "A classificar") return true;
  if (!assuntoPertenceMateria(q.materia, q.assunto)) return true;

  const t = norm(q.trechoEnunciado);
  const m = norm(q.materia);

  if (m === "portugues") {
    if (
      /hotspot|biodiversidade|bioma|genetica|dna\b|ecologia|citologia|fisiologia/.test(t)
    ) {
      return true;
    }
    if (/tetraedro|matriz|determinante|funcao de variavel|probabilidade|trigonometria/.test(t)) {
      return true;
    }
    if (/estequiometria|reacao quimica|tabela periodica|mol\b|eletroquimica/.test(t)) {
      return true;
    }
    if (/cinematica|forca resultante|circuito|corrente eletrica|optica|lente/.test(t)) {
      return true;
    }
  }

  if (m === "ingles" && detectarPassagemEspanhol(q.trechoEnunciado) && !detectarPassagemIngles(q.trechoEnunciado)) {
    return true;
  }
  if (m === "espanhol" && detectarPassagemIngles(q.trechoEnunciado) && !detectarPassagemEspanhol(q.trechoEnunciado)) {
    return true;
  }

  const inferida = inferirMateriaPorEnunciado(q.trechoEnunciado);
  if (inferida && norm(inferida) !== m && m === "portugues") return true;

  return false;
}

function posProcessarQuestao(q: QuestaoExtraida): QuestaoExtraida {
  const inferida = inferirMateriaPorEnunciado(q.trechoEnunciado);
  if (inferida) {
    const mInf = norm(inferida);
    const mAt = norm(q.materia);
    const idioma = mInf === "ingles" || mInf === "espanhol";
    const ciencia = ["biologia", "matematica", "fisica", "quimica"].includes(mInf);
    if (idioma || (ciencia && mAt === "portugues")) {
      return {
        ...q,
        materia: inferida,
        assunto: assuntoPadraoMateria(inferida),
      };
    }
  }
  return ajustarMateriaIdiomaEDisciplina(q.trechoEnunciado, q);
}

/**
 * Motor de classificação: lotes paralelos + revisão unitária só nas suspeitas.
 * Modelo padrão gpt-4o (OPENAI_MODEL_PASSO_2); extração continua no mini.
 */
/** Uma questão com enunciado completo (reclassificar na auditoria). */
export async function classificarQuestaoUnica(
  q: QuestaoExtraida
): Promise<QuestaoExtraida> {
  const maxChars = parseInt(process.env.ENUNCIADO_PARA_CLASSIFICAR_MAX ?? "6000", 10);
  const copia = { ...q };
  await classificarUnitario(copia, maxChars);
  const p = posProcessarQuestao(copia);
  const alinhada = alinharLoteTaxonomia([p]).questoes[0];
  return alinhada;
}

export async function classificarMateriaEAssuntoMotor(
  base: QuestaoExtraida[],
  avisosIn: string[] = []
): Promise<{ questoes: QuestaoExtraida[]; avisos: string[] }> {
  const avisos = [...avisosIn];
  const resultado = base.map((q) => ({
    ...q,
    materia: q.materia === "A classificar" ? "A classificar" : q.materia,
    assunto: q.assunto === "A classificar" ? "A classificar" : q.assunto,
  }));

  const batchSize = Math.max(2, parseInt(process.env.CLASS_BATCH_SIZE ?? "4", 10));
  const paralelo = Math.max(1, parseInt(process.env.CLASSIFICACAO_PARALLEL ?? "4", 10));
  const maxChars = parseInt(process.env.ENUNCIADO_PARA_CLASSIFICAR_MAX ?? "4500", 10);
  const modelo = modeloClassificacao();

  avisos.push(`Classificação com modelo ${modelo} (lotes de ${batchSize}, ${paralelo} em paralelo).`);

  const lotes: QuestaoExtraida[][] = [];
  for (let i = 0; i < resultado.length; i += batchSize) {
    lotes.push(resultado.slice(i, i + batchSize));
  }

  const tarefas = lotes.map((lote, idx) => async () => {
    try {
      const n = await classificarLote(lote, maxChars);
      if (n < lote.length) {
        avisos.push(`Lote ${idx + 1}: IA classificou ${n}/${lote.length} questões.`);
      }
    } catch (e) {
      avisos.push(
        `Lote ${idx + 1}: ${e instanceof Error ? e.message : "erro na classificação"}`
      );
    }
  });

  await executarEmParalelo(tarefas, paralelo);

  for (const q of resultado) {
    const p = posProcessarQuestao(q);
    q.materia = p.materia;
    q.assunto = p.assunto;
    q.observacoes = p.observacoes;
  }

  const suspeitas = resultado.filter(classificacaoSuspeita);
  if (suspeitas.length > 0) {
    avisos.push(
      `Revisão unitária de ${suspeitas.length} questão(ões) suspeita(s): nº ${suspeitas
        .slice(0, 12)
        .map((q) => q.numero)
        .join(", ")}${suspeitas.length > 12 ? "…" : ""}.`
    );
    const revTasks = suspeitas.map((q) => async () => {
      try {
        await classificarUnitario(q, maxChars);
        const p = posProcessarQuestao(q);
        q.materia = p.materia;
        q.assunto = p.assunto;
      } catch {
        const h = inferirMateriaPorEnunciado(q.trechoEnunciado);
        if (h) {
          q.materia = h;
          q.assunto = assuntoPadraoMateria(h);
        }
      }
    });
    await executarEmParalelo(revTasks, Math.min(6, paralelo + 2));
  }

  const { questoes: alinhadas, corrigidas } = alinharLoteTaxonomia(resultado);
  for (let i = 0; i < resultado.length; i++) {
    resultado[i] = alinhadas[i];
  }
  if (corrigidas > 0) {
    avisos.push(`${corrigidas} par(es) matéria/assunto alinhados à taxonomia.`);
  }

  const aindaSuspeitas = resultado.filter(classificacaoSuspeita).length;
  if (aindaSuspeitas > 0) {
    avisos.push(
      `${aindaSuspeitas} questão(ões) ainda merecem revisão manual após IA — use Auditar.`
    );
  }

  return { questoes: resultado, avisos };
}
