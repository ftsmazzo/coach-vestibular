import type { DiagnosisResult, GroupedError } from "./diagnosis";
import {
  limitesTokensCompletacao,
  modeloPipelineFallback,
  modeloPipelinePrincipal,
} from "./openai-modelos";
import {
  formatFocosPedagogicosParaPrompt,
} from "@/lib/learning-motor-foco";
import type { StudyPlanItem } from "./study-plan";
import { getTipoErroLabel, taxonomy } from "./taxonomy";

export function modeloCoachPlano(): string {
  return (
    process.env.OPENAI_MODEL_COACH?.trim() ||
    process.env.OPENAI_MODEL_PIPELINE_FALLBACK?.trim() ||
    process.env.OPENAI_MODEL_PIPELINE?.trim() ||
    "gpt-5.5"
  );
}

const ROTULOS_CAUSA = taxonomy.tiposErro
  .map((t) => `- ${t.id}: ${t.label}`)
  .join("\n");

export interface PlanoCoachIAResponse {
  mensagemResumo: string;
  diagnosticoNarrativo: string;
  orientacaoSemana?: string;
  analisePorMateria: Array<{
    materia: string;
    analise: string;
    prioridade?: "alta" | "media" | "manter";
  }>;
  focos?: never;
  quests: Array<{
    titulo: string;
    descricao: string;
    duracaoMin: number;
    materiaId?: string;
    temaId?: string;
    estrategiaInterna?: "lacuna" | "reversa" | "velocidade";
    numerosQuestoes?: number[];
    escopoId?: string;
    dominioId?: string;
    conceitosCanonicos?: string[];
  }>;
}

function sanitizarParaAluno(texto: string): string {
  return texto
    .replace(/MODELO\s+LACUNA\s+DE\s+BASE/gi, "")
    .replace(/LACUNA\s+DE\s+BASE/gi, "")
    .replace(/MODELO\s+BLOCO\s+DE\s+VELOCIDADE/gi, "")
    .replace(/BLOCO\s+DE\s+VELOCIDADE/gi, "")
    .replace(/MODELO\s+ENGENHARIA\s+REVERSA/gi, "")
    .replace(/ENGENHARIA\s+REVERSA/gi, "")
    .replace(/aplicar\s+o\s+Modelo\s+[ABC]/gi, "sua tarefa será")
    .replace(/Modelo\s+[ABC]\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function montarFocosPedagogicos(diagnosis: DiagnosisResult): string {
  return formatFocosPedagogicosParaPrompt(diagnosis.focosPedagogicos ?? []);
}

function montarResumoMaterias(diagnosis: DiagnosisResult): string {
  const r = diagnosis.resumoProva;
  if (!r) {
    const porMateria = new Map<string, { acertos: number; total: number; erros: number }>();
    for (const s of diagnosis.escopoScores) {
      const m = porMateria.get(s.materiaLabel) ?? { acertos: 0, total: 0, erros: 0 };
      m.total += s.total;
      m.acertos += s.acertos;
      m.erros += s.erros;
      porMateria.set(s.materiaLabel, m);
    }
    return [...porMateria.entries()]
      .map(
        ([label, m]) =>
          `- ${label}: ${Math.round((m.acertos / Math.max(1, m.total)) * 100)}% acerto (${m.erros} erros)`
      )
      .join("\n");
  }
  const porMateria = new Map<
    string,
    { acertos: number; total: number; erros: number; numerosErrados: number[] }
  >();
  for (const e of r.todosEscopos) {
    const m = porMateria.get(e.materia) ?? {
      acertos: 0,
      total: 0,
      erros: 0,
      numerosErrados: [],
    };
    m.acertos += e.acertos;
    m.total += e.total;
    m.erros += e.erros;
    m.numerosErrados.push(...e.numerosErrados);
    porMateria.set(e.materia, m);
  }
  return [...porMateria.entries()]
    .map(
      ([materia, m]) =>
        `- ${materia}: ${m.acertos}/${m.total} acertos (${m.erros} erro(s) — questões ${m.numerosErrados.slice(0, 12).join(", ")}${m.numerosErrados.length > 12 ? "…" : ""})`
    )
    .join("\n");
}

function montarCausasMetacognitivas(grouped: GroupedError[]): string {
  if (grouped.length === 0) return "Nenhum erro classificado com anotação.";
  return grouped
    .map((g) => {
      const causas = [...new Set(g.causas)]
        .map((c) => getTipoErroLabel(c) ?? c)
        .join(", ");
      const anot = g.anotacoes.length
        ? g.anotacoes.slice(0, 5).join("\n")
        : "Sem anotações.";
      return `### ${g.escopoLabel} (${g.materiaLabel})
- Erros: ${g.errosCount} (Q${g.questoesNumeros.join(", Q")})
- Causas (metacognição): ${causas || "não informadas"}
- Anotações do aluno:
${anot}`;
    })
    .join("\n\n");
}

const SYSTEM_PROMPT = `Você é o Coach Vestibular — mentor para vestibulandos de Medicina (alto nível), empático e analítico.

Gere um PLANO SEMANAL em JSON. Separe claramente NARRATIVA (plano) de TAREFAS (quests).

## REGRA — FOCOS PEDAGÓGICOS (OBRIGATÓRIO)

Os focos pedagógicos já foram calculados por um motor determinístico (escopo N2, histórico, metadados cognitivos).
Sua função é transformar esses focos em linguagem humana, plano semanal e quests acionáveis.
Nunca substitua um foco por outro assunto inventado. Nunca troque a disciplina ou escopo.

## PARTE 1 — PLANO (texto para o aluno ler)

**diagnosticoNarrativo** (3–5 parágrafos):
- Desempenho geral na prova com números.
- Use as CAUSAS METACOGNITIVAS com os rótulos humanos (ex.: "dúvida entre duas alternativas", "não sabia o conteúdo", "erro de interpretação do enunciado", "conta/atento", "falta de tempo") — NUNCA use códigos como CONCEITO_TEORICO na prosa.
- Tom motivacional e honesto; se modo recuperação, acolher sem vitimizar.
- Não liste micro-tarefas aqui.

**analisePorMateria** (uma entrada por matéria que apareceu na prova com desempenho):
- Campo "materia": nome da matéria (ex.: Filosofia, Matemática).
- Campo "analise": 1 parágrafo fluido sobre como foi o desempenho nessa matéria, padrões de erro, o que a prova cobrou em termos gerais — analítico, não uma lista de assuntos micro.
- Mencione pontos de foco dentro do texto, sem segmentar em subtítulos por assunto.
- prioridade: "alta" | "media" | "manter".

**orientacaoSemana** (1 parágrafo): direção geral da semana (carga, equilíbrio, integração) sem enumerar 15 tarefas.

**mensagemResumo**: 2 frases para card resumido (dashboard).

## PARTE 2 — QUESTS (tarefas em /quests)

Gere "quests" — atividades práticas. Regras:

1. PROIBIDO citar nomes internos de método ("Lacuna de base", "Engenharia reversa", "Bloco de velocidade"). O aluno só vê a prática.
2. Títulos curtos: "Filosofia — revisão das questões 56, 58 e 60", não "Filosofia Política: Conceitos Fundamentais e Teóricos".
3. Máximo de quests: ${"{maxQuests}"} (modo recuperação = menos).
4. Agrupe por MATÉRIA: no máximo 1–2 quests por matéria com erro, não uma quest por micro-assunto.
5. Cada descrição: referência empática às anotações (ex.: "Na Q16 você escreveu que…") + atividade concreta.
6. Escolha internamente estrategiaInterna (não aparece para o aluno):
   - "lacuna": falta de conteúdo → fichamento curto + 5 questões focadas.
   - "reversa": dúvida cruel → 3 questões resolvidas passo a passo, marcar onde a lógica bifurca.
   - "velocidade": interpretação/conta/tempo → bloco cronometrado 10–15 min, marcar comando do enunciado, checklist.
7. Leia anotações do aluno antes do banco; se o aluno corrigiu matéria na anotação, use a correção dele.

Causas metacognitivas (IDs internos — traduza na prosa):
${ROTULOS_CAUSA}

Responda APENAS JSON válido:
{
  "mensagemResumo": "...",
  "diagnosticoNarrativo": "...",
  "orientacaoSemana": "...",
  "analisePorMateria": [{ "materia": "...", "analise": "...", "prioridade": "alta" }],
  "focos": [{ "materiaId": "...", "temaId": "...", "label": "...", "prioridade": "alta", "motivo": "...", "tipoErroDominante": "..." }],
  "quests": [{
    "titulo": "...",
    "descricao": "...",
    "duracaoMin": 45,
    "materiaId": "filosofia",
    "temaId": "etica",
    "estrategiaInterna": "lacuna",
    "numerosQuestoes": [56, 58]
  }]
}`;

function modelosCoachTentativa(): string[] {
  const principal = modeloCoachPlano();
  const fallbacks = [
    process.env.OPENAI_MODEL_COACH?.trim(),
    principal,
    modeloPipelineFallback(),
    modeloPipelinePrincipal(),
    "gpt-4o",
  ].filter(Boolean) as string[];
  return [...new Set(fallbacks)];
}

async function chamarCoachOpenAI(
  model: string,
  system: string,
  userContent: string,
  apiKey: string
): Promise<{ parsed: PlanoCoachIAResponse | null; erro?: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      ...limitesTokensCompletacao(model, 12000),
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return {
      parsed: null,
      erro: `OpenAI ${res.status} (${model}): ${txt.slice(0, 120)}`,
    };
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return { parsed: null, erro: `Resposta vazia (${model})` };

  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(clean) as PlanoCoachIAResponse & {
      studyPlanItems?: unknown;
    };
    if (!parsed.diagnosticoNarrativo && parsed.studyPlanItems) {
      return {
        parsed: null,
        erro: "Modelo retornou formato antigo (studyPlanItems)",
      };
    }
    if (!parsed.diagnosticoNarrativo || !Array.isArray(parsed.quests)) {
      return { parsed: null, erro: "JSON sem diagnosticoNarrativo ou quests" };
    }
    parsed.diagnosticoNarrativo = sanitizarParaAluno(parsed.diagnosticoNarrativo);
    parsed.orientacaoSemana = parsed.orientacaoSemana
      ? sanitizarParaAluno(parsed.orientacaoSemana)
      : undefined;
    parsed.mensagemResumo = sanitizarParaAluno(
      parsed.mensagemResumo || parsed.diagnosticoNarrativo.slice(0, 280)
    );
    parsed.analisePorMateria = (parsed.analisePorMateria ?? []).map((m) => ({
      ...m,
      analise: sanitizarParaAluno(m.analise),
    }));
    parsed.quests = parsed.quests.map((q) => ({
      ...q,
      titulo: sanitizarParaAluno(q.titulo),
      descricao: sanitizarParaAluno(q.descricao),
    }));
    return { parsed };
  } catch {
    return { parsed: null, erro: "JSON inválido da IA" };
  }
}

export async function gerarPlanoComCoachIA(input: {
  diagnosis: DiagnosisResult;
  groupedErrors: GroupedError[];
  overallAcerto: number;
  recoveryMode: boolean;
  checkInScore?: number | null;
  examLabel?: string;
}): Promise<{ parsed: PlanoCoachIAResponse | null; erroIa?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { parsed: null, erroIa: "OPENAI_API_KEY não configurada no servidor" };
  }

  const maxQuests = input.recoveryMode ? 5 : 8;
  const system = SYSTEM_PROMPT.replace("{maxQuests}", String(maxQuests));

  const userContent = `Prova: ${input.examLabel ?? "simulado"}
Acertos: ${(input.overallAcerto * 100).toFixed(0)}%
Modo recuperação: ${input.recoveryMode ? "sim" : "não"}
Check-in emocional (1-5): ${input.checkInScore ?? "não informado"}

Desempenho por matéria:
${montarResumoMaterias(input.diagnosis)}

Focos pedagógicos (calculados — NÃO invente outros):
${montarFocosPedagogicos(input.diagnosis)}

Erros e metacognição:
${montarCausasMetacognitivas(input.groupedErrors)}

Gere o JSON agora.`;

  const erros: string[] = [];
  for (const model of modelosCoachTentativa()) {
    const { parsed, erro } = await chamarCoachOpenAI(model, system, userContent, apiKey);
    if (parsed) return { parsed };
    if (erro) {
      console.warn(`Coach plano (${model}):`, erro);
      erros.push(erro);
    }
  }

  return {
    parsed: null,
    erroIa: erros[0] ?? "Falha ao gerar plano com IA",
  };
}

function atividadePorCausa(
  materia: string,
  nums: number[],
  causa?: string,
  anotacao?: string
): { titulo: string; descricao: string; duracaoMin: number; estrategia: "lacuna" | "reversa" | "velocidade" } {
  const ref = nums.length ? `questões ${nums.slice(0, 6).join(", ")}` : "questões que você errou";
  const nota = anotacao ? ` Você anotou: «${anotacao.slice(0, 120)}».` : "";
  const c = causa ?? "";

  if (c === "CALCULO_BOBEIRA" || c === "INTERPRETACAO_ENUNCIADO" || c === "FALTA_TEMPO") {
    return {
      titulo: `${materia} — bloco cronometrado`,
      descricao:
        `Nas ${ref}, o padrão foi ${getTipoErroLabel(c) ?? "atenção no enunciado ou na conta"}.${nota} ` +
        `Resolva 5 a 8 questões em 12 minutos: sublinhe o comando do enunciado e confira cada passo antes de marcar a alternativa.`,
      duracaoMin: 15,
      estrategia: "velocidade",
    };
  }
  if (c === "DUVIDA_CRUCIAL") {
    return {
      titulo: `${materia} — destrinchar a dúvida`,
      descricao:
        `Nas ${ref}, você ficou entre duas alternativas.${nota} ` +
        `Pegue 3 questões parecidas (incluindo uma que errou), resolva com gabarito comentado e marque o ponto exato em que a lógica bifurcou.`,
      duracaoMin: 50,
      estrategia: "reversa",
    };
  }
  return {
    titulo: `${materia} — fechar base`,
    descricao:
      `Nas ${ref}, faltou consolidar o conteúdo (${getTipoErroLabel(c) ?? "lacuna de estudo"}).${nota} ` +
      `Faça um fichamento curto do que caiu e resolva 5 questões novas só desse recorte, sem dispersar para o resto da matéria.`,
    duracaoMin: 55,
    estrategia: "lacuna",
  };
}

/** Formato novo sem API — garante diagnóstico + análise por matéria + quests. */
export function planoCoachFallbackLocal(
  diagnosis: DiagnosisResult,
  grouped: GroupedError[]
): StudyPlanItem[] {
  const resumo = diagnosis.resumoProva;

  const paragrafosDiag: string[] = [];
  if (resumo) {
    paragrafosDiag.push(
      `Nesta prova você acertou ${resumo.acertos} de ${resumo.total} questões (${resumo.pctAcerto}% de acerto). ` +
        `Isso não define seu vestibular — é um retrato do que precisa de atenção agora.`
    );
    if (diagnosis.recoveryMode) {
      paragrafosDiag.push(
        "O desempenho ou o check-in indicam uma semana mais leve: menos volume, mais clareza em cada erro. " +
          "Priorize entender o porquê de cada questão errada antes de aumentar a quantidade de exercícios."
      );
    } else {
      paragrafosDiag.push(
        "O que mais importa é o padrão dos erros: onde foi falta de conteúdo, onde foi leitura do enunciado, " +
          "onde foi dúvida entre alternativas ou pressa. Suas anotações em cada questão guiam o foco abaixo."
      );
    }
    const causas = Object.entries(diagnosis.tipoErroCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, n]) => `${getTipoErroLabel(k) ?? k} (${n}×)`);
    if (causas.length) {
      paragrafosDiag.push(`Pelos seus registros, os tipos de erro mais frequentes foram: ${causas.join("; ")}.`);
    }
  } else {
    paragrafosDiag.push(diagnosis.mensagem);
  }

  const analises: PlanoCoachIAResponse["analisePorMateria"] = [];
  const porMateriaResumo = new Map<
    string,
    { materia: string; erros: number; acertos: number; total: number; numerosErrados: number[] }
  >();
  if (resumo) {
    for (const e of resumo.todosEscopos) {
      const m = porMateriaResumo.get(e.materia) ?? {
        materia: e.materia,
        erros: 0,
        acertos: 0,
        total: 0,
        numerosErrados: [],
      };
      m.erros += e.erros;
      m.acertos += e.acertos;
      m.total += e.total;
      m.numerosErrados.push(...e.numerosErrados);
      porMateriaResumo.set(e.materia, m);
    }
  } else {
    for (const s of diagnosis.escopoScores) {
      const m = porMateriaResumo.get(s.materiaLabel) ?? {
        materia: s.materiaLabel,
        erros: 0,
        acertos: 0,
        total: 0,
        numerosErrados: s.numerosErrados,
      };
      m.erros += s.erros;
      m.acertos += s.acertos;
      m.total += s.total;
      porMateriaResumo.set(s.materiaLabel, m);
    }
  }
  const materias = [...porMateriaResumo.values()];

  for (const m of materias) {
    const taxa = m.total > 0 ? Math.round((m.acertos / m.total) * 100) : 0;
    let texto: string;
    if (m.erros === 0) {
      texto = `Você manteve bom desempenho em ${m.materia} (${taxa}% de acerto na prova). Vale um bloco curto de manutenção para não perder ritmo.`;
    } else if (taxa < 45) {
      texto = `Em ${m.materia} houve ${m.erros} erro(s) em ${m.total} questões (${taxa}% de acerto). A prova mostrou lacunas que pedem revisão estruturada esta semana — não só mais questões soltas.`;
    } else {
      texto = `Em ${m.materia} o resultado foi misto (${taxa}% de acerto, ${m.erros} erro(s)). Há pontos sólidos e trechos que ainda vazam; o equilíbrio é consolidar sem abandonar o que já funciona.`;
    }
    const gruposMat = grouped.filter(
      (g) => g.materiaLabel.toLowerCase() === m.materia.toLowerCase()
    );
    if (gruposMat.length) {
      const causas = [...new Set(gruposMat.flatMap((g) => g.causas))]
        .map((c) => getTipoErroLabel(c) ?? c)
        .join(", ");
      if (causas) texto += ` Nos erros, predominaram: ${causas}.`;
    }
    analises.push({
      materia: m.materia,
      analise: texto,
      prioridade: m.erros >= 3 ? "alta" : m.erros > 0 ? "media" : "manter",
    });
  }

  const quests: PlanoCoachIAResponse["quests"] = [];
  const maxQ = diagnosis.recoveryMode ? 5 : 8;

  if (diagnosis.focosPedagogicos?.length) {
    for (const fp of diagnosis.focosPedagogicos.slice(0, maxQ)) {
      quests.push({
        titulo: `${fp.materiaLabel} — ${fp.escopoLabel}`,
        descricao:
          `${fp.hipoteseCausa} Objetivo: ${fp.objetivoDaSemana} ` +
          `Refaça as questões ${fp.numerosErrados.join(", ")} e consolide com 3 exercícios do mesmo escopo.`,
        duracaoMin: fp.prioridade === "alta" ? 50 : 35,
        materiaId: fp.materiaId,
        numerosQuestoes: fp.numerosErrados,
        estrategiaInterna:
          fp.estrategiaRecomendada === "treino_cronometrado"
            ? "velocidade"
            : fp.estrategiaRecomendada === "engenharia_reversa"
              ? "reversa"
              : "lacuna",
        escopoId: fp.escopoId,
        dominioId: fp.dominioId,
        conceitosCanonicos: fp.conceitosCanonicos,
      } as PlanoCoachIAResponse["quests"][0]);
    }
  }

  const porEscopo = new Map<string, GroupedError[]>();
  for (const g of grouped) {
    const list = porEscopo.get(g.escopoId) ?? [];
    list.push(g);
    porEscopo.set(g.escopoId, list);
  }

  if (quests.length === 0) {
  for (const [, grupos] of porEscopo) {
    if (quests.length >= maxQ) break;
    const g0 = grupos[0]!;
    const nums = [...new Set(grupos.flatMap((g) => g.questoesNumeros))].sort((a, b) => a - b);
    const causas = grupos.flatMap((g) => g.causas);
    const causaDom =
      causas.sort(
        (a, b) =>
          causas.filter((x) => x === b).length - causas.filter((x) => x === a).length
      )[0] ?? "CONCEITO_TEORICO";
    const anot = grupos.flatMap((g) => g.anotacoes)[0]?.replace(/^Q\d+:\s*"?|"$/g, "");
    const at = atividadePorCausa(g0.materiaLabel, nums, causaDom, anot);
    quests.push({
      titulo: `${g0.escopoLabel} — ${at.titulo}`,
      descricao: at.descricao,
      duracaoMin: at.duracaoMin,
      numerosQuestoes: nums,
      estrategiaInterna: at.estrategia,
      escopoId: g0.escopoId,
    });
  }
  }

  if (quests.length === 0 && resumo) {
    for (const e of resumo.escoposPrioritarios.slice(0, maxQ)) {
      const at = atividadePorCausa(e.materia, e.numerosErrados, "CONCEITO_TEORICO");
      quests.push({
        titulo: `${e.escopoLabel} — ${at.titulo}`,
        descricao: at.descricao,
        duracaoMin: at.duracaoMin,
        numerosQuestoes: e.numerosErrados,
        estrategiaInterna: at.estrategia,
        escopoId: e.escopoId,
      });
    }
  }

  return planoCoachParaStudyItems(
    {
      mensagemResumo: diagnosis.mensagem,
      diagnosticoNarrativo: paragrafosDiag.join("\n\n"),
      orientacaoSemana:
        "Esta semana: leia o diagnóstico e as análises por matéria; depois execute as atividades em Quests na ordem sugerida. " +
        "Ao final, faça um mini-simulado misto das matérias da prova.",
      analisePorMateria: analises,
      quests,
    },
    diagnosis
  );
}

export function planoCoachParaStudyItems(
  parsed: PlanoCoachIAResponse,
  diagnosis: DiagnosisResult
): StudyPlanItem[] {
  const items: StudyPlanItem[] = [];
  let ordem = 1;

  items.push({
    ordem: ordem++,
    titulo: "Diagnóstico",
    descricao: parsed.diagnosticoNarrativo,
    duracaoMin: 0,
    bloco: "diagnostico",
    geraQuest: false,
  });

  if (parsed.orientacaoSemana?.trim()) {
    items.push({
      ordem: ordem++,
      titulo: "Direção da semana",
      descricao: parsed.orientacaoSemana,
      duracaoMin: 0,
      bloco: "contexto",
      geraQuest: false,
    });
  }

  for (const m of parsed.analisePorMateria) {
    const matResumo = diagnosis.resumoProva?.todosEscopos.find(
      (x) => x.materia.toLowerCase() === m.materia.toLowerCase()
    );
    items.push({
      ordem: ordem++,
      titulo: m.materia,
      descricao: m.analise,
      duracaoMin: 0,
      bloco: "analise_materia",
      materiaDestaque: m.materia,
      errosNaMateria: matResumo?.erros,
      geraQuest: false,
    });
  }

  for (const q of parsed.quests) {
    if (!q.titulo?.trim() || !q.descricao?.trim()) continue;
    const bloco =
      q.estrategiaInterna === "velocidade"
        ? "consolidacao"
        : q.estrategiaInterna === "reversa"
          ? "foco_profundo"
          : "foco_profundo";
    items.push({
      ordem: ordem++,
      titulo: q.titulo,
      descricao: q.descricao,
      duracaoMin: q.duracaoMin > 0 ? q.duracaoMin : 45,
      materiaId: q.materiaId,
      temaId: q.temaId,
      bloco,
      numerosQuestoes: q.numerosQuestoes,
      geraQuest: true,
    });
  }

  const horasQuests = Math.round(
    items.filter((i) => i.geraQuest).reduce((s, i) => s + i.duracaoMin, 0) / 60
  );

  items.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao:
      `Complete as atividades em Quests (~${horasQuests || 6}h de estudo ativo). ` +
      `Revise este diagnóstico antes de começar e, ao final da semana, faça um mini-simulado misto das matérias da prova.`,
    duracaoMin: 0,
    bloco: "meta",
    geraQuest: false,
  });

  return items;
}
