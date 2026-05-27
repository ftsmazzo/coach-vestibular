import type { DiagnosisResult, GroupedError } from "./diagnosis";
import { limitesTokensCompletacao } from "./openai-modelos";
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
  focos?: DiagnosisResult["focos"];
  quests: Array<{
    titulo: string;
    descricao: string;
    duracaoMin: number;
    materiaId?: string;
    temaId?: string;
    estrategiaInterna?: "lacuna" | "reversa" | "velocidade";
    numerosQuestoes?: number[];
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

function montarResumoMaterias(diagnosis: DiagnosisResult): string {
  const r = diagnosis.resumoProva;
  if (!r) {
    return diagnosis.materiaScores
      .map(
        (m) =>
          `- ${m.materiaLabel}: ${Math.round(m.taxaAcerto * 100)}% acerto (${m.erros} erros)`
      )
      .join("\n");
  }
  return r.todasMaterias
    .map(
      (m) =>
        `- ${m.materia}: ${m.acertos}/${m.total} acertos (${m.erros} erro(s) — questões ${m.numerosErrados.slice(0, 12).join(", ")}${m.numerosErrados.length > 12 ? "…" : ""})`
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
      return `### ${g.materia}
- Erros: ${g.errosCount} (Q${g.questoesNumeros.join(", Q")})
- Causas (metacognição): ${causas || "não informadas"}
- Anotações do aluno:
${anot}`;
    })
    .join("\n\n");
}

const SYSTEM_PROMPT = `Você é o Coach Vestibular — mentor para vestibulandos de Medicina (alto nível), empático e analítico.

Gere um PLANO SEMANAL em JSON. Separe claramente NARRATIVA (plano) de TAREFAS (quests).

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

export async function gerarPlanoComCoachIA(input: {
  diagnosis: DiagnosisResult;
  groupedErrors: GroupedError[];
  overallAcerto: number;
  recoveryMode: boolean;
  checkInScore?: number | null;
  examLabel?: string;
}): Promise<PlanoCoachIAResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const maxQuests = input.recoveryMode ? 5 : 8;
  const system = SYSTEM_PROMPT.replace("{maxQuests}", String(maxQuests));

  const userContent = `Prova: ${input.examLabel ?? "simulado"}
Acertos: ${(input.overallAcerto * 100).toFixed(0)}%
Modo recuperação: ${input.recoveryMode ? "sim" : "não"}
Check-in emocional (1-5): ${input.checkInScore ?? "não informado"}

Desempenho por matéria:
${montarResumoMaterias(input.diagnosis)}

Erros e metacognição:
${montarCausasMetacognitivas(input.groupedErrors)}

Gere o JSON agora.`;

  const model = modeloCoachPlano();

  try {
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
      console.error("Coach plano IA:", res.status, await res.text().then((t) => t.slice(0, 300)));
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    let clean = raw.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    }
    const parsed = JSON.parse(clean) as PlanoCoachIAResponse;
    if (!parsed.diagnosticoNarrativo || !Array.isArray(parsed.quests)) return null;
    parsed.diagnosticoNarrativo = sanitizarParaAluno(parsed.diagnosticoNarrativo);
    parsed.orientacaoSemana = parsed.orientacaoSemana
      ? sanitizarParaAluno(parsed.orientacaoSemana)
      : undefined;
    parsed.mensagemResumo = sanitizarParaAluno(parsed.mensagemResumo);
    parsed.analisePorMateria = (parsed.analisePorMateria ?? []).map((m) => ({
      ...m,
      analise: sanitizarParaAluno(m.analise),
    }));
    parsed.quests = parsed.quests.map((q) => ({
      ...q,
      titulo: sanitizarParaAluno(q.titulo),
      descricao: sanitizarParaAluno(q.descricao),
    }));
    return parsed;
  } catch (e) {
    console.error("Erro ao gerar plano com Coach IA:", e);
    return null;
  }
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
    const matResumo = diagnosis.resumoProva?.todasMaterias.find(
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
