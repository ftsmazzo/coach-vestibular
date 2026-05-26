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
  aplicarBlocosDoCaderno,
  cabecalhoConfiavelParaQuestao,
  extrairMapaBlocosDoCaderno,
  type InfoBlocoCaderno,
} from "@/lib/prova-blocos-caderno";
import {
  assuntoPadraoMateria,
  inferirMateriaPorEnunciado,
} from "@/lib/prova-heuristicas";
import {
  montarBlocoOrientacaoRevisor,
  REGRA_PROMPT_ORIENTACAO_REVISOR,
} from "@/lib/prova-orientacao-revisor";

const allowedTaxonomyStr = taxonomy.materias
  .map((m) => {
    const temasStr = m.temas.map((t) => `"${t.label}"`).join(", ");
    return `- "${m.label}": ${temasStr}`;
  })
  .join("\n");

import { limitesTokensCompletacao, modeloClassificacao } from "@/lib/openai-modelos";

export { modeloClassificacao };

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

  const model = modeloClassificacao();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      ...limitesTokensCompletacao(model, 16000),
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

Regras:
- Foque no conteúdo cognitivo (Física, Química, Biologia, etc.), não só palavras soltas como "bioma" em texto de Geografia.
- Inglês só se o texto-base principal estiver em inglês; pergunta em português não basta.
- Humanas (Filosofia, Sociologia, História, Geografia) não são Biologia.
- dificuldade: facil, media ou dificil (obrigatório se a questão for legível).
- conhecimento: uma frase curta do que a questão exige.
- ${REGRA_PROMPT_ORIENTACAO_REVISOR}

JSON: { "numero": ${numero}, "materia": "...", "assunto": "...", "conhecimento": "...", "dificuldade": "facil|media|dificil" }`;
}

function formatarLoteParaIA(questoes: QuestaoExtraida[], maxChars: number): string {
  return questoes
    .map((q) => {
      const enc = cortarEnunciado(q.trechoEnunciado, maxChars);
      const cab = montarBlocoOrientacaoRevisor({
        areaBloco: q.areaBloco,
        materiaAtual: q.materia,
        observacoes: q.observacoes,
      });
      return `### Questão ${q.numero}\n${cab}${enc}\n`;
    })
    .join("\n");
}

function restaurarMateriaDoCaderno(
  q: QuestaoExtraida,
  mapa: Map<number, InfoBlocoCaderno>
): void {
  const c = mapa.get(q.numero);
  if (!c?.materia || !cabecalhoConfiavelParaQuestao(q, c)) return;
  if (norm(q.materia) !== norm(c.materia)) {
    q.materia = c.materia;
    q.assunto = c.assunto;
    q.areaBloco = c.areaBloco;
    q.observacoes =
      q.observacoes ?? `Corrigido para matéria do cabeçalho «${c.tituloCabecalho}».`;
  }
}

function questaoPrecisaIA(q: QuestaoExtraida, mapa: Map<number, InfoBlocoCaderno>): boolean {
  const c = mapa.get(q.numero);
  if (c?.materia && cabecalhoConfiavelParaQuestao(q, c)) return false;
  return (
    q.materia === "A classificar" ||
    q.assunto === "A classificar" ||
    classificacaoSuspeita(q)
  );
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

function aplicarDificuldade(raw: unknown): string | null {
  const n = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (n === "facil" || n === "fácil") return "Fácil";
  if (n === "media" || n === "média") return "Média";
  if (n === "dificil" || n === "difícil") return "Difícil";
  return null;
}

async function classificarUnitario(q: QuestaoExtraida, maxChars: number): Promise<boolean> {
  const enc = cortarEnunciado(q.trechoEnunciado, maxChars);
  const cab = montarBlocoOrientacaoRevisor({
    areaBloco: q.areaBloco,
    materiaAtual: q.materia,
    observacoes: q.observacoes,
  });
  const res = await callOpenAIClassificacao(
    buildPromptUnitario(q.numero),
    `${cab}Enunciado:\n${enc}`
  );
  if (res.numero === q.numero && res.materia && res.assunto) {
    q.materia = normalizarLabelMateria(String(res.materia));
    q.assunto = normalizarLabelAssunto(q.materia, String(res.assunto));
    const conh = String(res.conhecimento ?? "").trim();
    if (conh) q.conhecimentoExigido = conh;
    const dif = aplicarDificuldade(res.dificuldade);
    if (dif) q.nivelDificuldade = dif;
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
  const mAt = norm(q.materia);
  const materiaDefinida =
    q.materia &&
    q.materia !== "A classificar" &&
    !["a classificar", ""].includes(mAt);

  const inferida = inferirMateriaPorEnunciado(q.trechoEnunciado);
  if (inferida && !materiaDefinida) {
    const mInf = norm(inferida);
    const idioma = mInf === "ingles" || mInf === "espanhol";
    const ciencia = ["biologia", "matematica", "fisica", "quimica"].includes(mInf);
    if (idioma || ciencia) {
      return {
        ...q,
        materia: inferida,
        assunto:
          q.assunto && q.assunto !== "A classificar"
            ? q.assunto
            : assuntoPadraoMateria(inferida),
        conhecimentoExigido: q.conhecimentoExigido,
        nivelDificuldade: q.nivelDificuldade,
      };
    }
  }

  const ajustada = ajustarMateriaIdiomaEDisciplina(q.trechoEnunciado, q);
  return {
    ...ajustada,
    conhecimentoExigido: q.conhecimentoExigido ?? ajustada.conhecimentoExigido,
    nivelDificuldade: q.nivelDificuldade ?? ajustada.nivelDificuldade,
  };
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
  const alinhada = alinharLoteTaxonomia([copia]).questoes[0];
  return alinhada;
}

export async function classificarMateriaEAssuntoMotor(
  base: QuestaoExtraida[],
  avisosIn: string[] = [],
  textoCaderno?: string,
  opts?: { excluirBlocoEspanhol?: boolean }
): Promise<{ questoes: QuestaoExtraida[]; avisos: string[] }> {
  const avisos = [...avisosIn];
  let resultado = base.map((q) => ({
    ...q,
    materia: q.materia === "A classificar" ? "A classificar" : q.materia,
    assunto: q.assunto === "A classificar" ? "A classificar" : q.assunto,
  }));

  let mapaCaderno = new Map<number, InfoBlocoCaderno>();
  if (textoCaderno?.trim()) {
    const blocos = aplicarBlocosDoCaderno(resultado, textoCaderno, {
      ignorarBlocoEspanhol: opts?.excluirBlocoEspanhol !== false,
    });
    resultado = blocos.questoes;
    avisos.push(...blocos.avisos);
    mapaCaderno = extrairMapaBlocosDoCaderno(textoCaderno);
  }

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
    const paraIA = lote.filter((q) => questaoPrecisaIA(q, mapaCaderno));
    if (paraIA.length === 0) return;
    try {
      const n = await classificarLote(paraIA, maxChars);
      if (n < paraIA.length) {
        avisos.push(`Lote ${idx + 1}: IA classificou ${n}/${paraIA.length} questões.`);
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
    if (mapaCaderno.size > 0) restaurarMateriaDoCaderno(q, mapaCaderno);
  }

  const suspeitas = resultado.filter((q) => {
    const c = mapaCaderno.get(q.numero);
    if (c?.materia && cabecalhoConfiavelParaQuestao(q, c)) return false;
    return classificacaoSuspeita(q);
  });
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
