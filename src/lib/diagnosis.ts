import type { ErrorType } from "@/generated/prisma/client";
import { getMateriaLabel, getTemaLabel } from "./taxonomy";
import type { StudyPlanItem } from "./study-plan";

export interface TemaScore {
  materiaId: string;
  temaId: string;
  materiaLabel: string;
  temaLabel: string;
  total: number;
  erros: number;
  acertos: number;
  taxaAcerto: number;
  vulnerabilidade?: number;
  tendencia?: "up" | "down" | "stable";
}

export interface MateriaScore {
  materiaId: string;
  materiaLabel: string;
  total: number;
  erros: number;
  taxaAcerto: number;
  vulnerabilidade?: number;
}

export interface DiagnosisResult {
  overallAcerto: number;
  materiaScores: MateriaScore[];
  temaScores: TemaScore[];
  focos: Array<{
    materiaId: string;
    temaId: string;
    label: string;
    prioridade: "alta" | "media";
    motivo: string;
    tipoErroDominante?: string;
    assunto?: string;
    conhecimentoExigido?: string | null;
    nivelDificuldade?: string | null;
    numerosErrados?: number[];
  }>;
  /** Agregação pedagógica da prova (matéria/assunto do banco) */
  resumoProva?: import("./diagnosis-prova").ResumoProvaDiagnostico;
  fortes: string[];
  fracos: string[];
  recoveryMode: boolean;
  mensagem: string;
  tipoErroCounts: Record<string, number>;
  aiStudyPlanItems?: StudyPlanItem[];
}

export interface AttemptInput {
  numero: number;
  correto: boolean;
  materiaId?: string | null;
  temaId?: string | null;
  tipoErro?: ErrorType | null;
  observacao?: string | null;
}

function getProvaTipoWeight(tipo?: string | null): number {
  if (tipo === "ENEM_OFICIAL" || tipo === "VESTIBULAR") return 3;
  if (tipo === "SIMULADO") return 2;
  if (tipo === "LISTA_FIXACAO") return 1;
  return 2; // Default to Simulado
}

function computeTemaScores(attempts: AttemptInput[], weight: number): TemaScore[] {
  const map = new Map<string, TemaScore>();

  for (const a of attempts) {
    if (!a.materiaId || !a.temaId) continue;
    const key = `${a.materiaId}:${a.temaId}`;
    const existing = map.get(key) ?? {
      materiaId: a.materiaId,
      temaId: a.temaId,
      materiaLabel: getMateriaLabel(a.materiaId),
      temaLabel: getTemaLabel(a.materiaId, a.temaId),
      total: 0,
      erros: 0,
      acertos: 0,
      taxaAcerto: 0,
      vulnerabilidade: 0,
    };
    existing.total++;
    if (a.correto) existing.acertos++;
    else existing.erros++;
    existing.taxaAcerto = existing.total > 0 ? existing.acertos / existing.total : 0;
    
    // Weighted vulnerability calculation
    const weightedErrors = existing.erros * weight;
    const weightedTotal = existing.total * weight;
    existing.vulnerabilidade = weightedTotal > 0 ? weightedErrors / weightedTotal : 0;
    
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.taxaAcerto - b.taxaAcerto);
}

function computeMateriaScores(attempts: AttemptInput[], weight: number): MateriaScore[] {
  const map = new Map<string, MateriaScore>();

  for (const a of attempts) {
    if (!a.materiaId) continue;
    const existing = map.get(a.materiaId) ?? {
      materiaId: a.materiaId,
      materiaLabel: getMateriaLabel(a.materiaId),
      total: 0,
      erros: 0,
      taxaAcerto: 0,
      vulnerabilidade: 0,
    };
    existing.total++;
    if (!a.correto) existing.erros++;
    existing.taxaAcerto =
      existing.total > 0 ? (existing.total - existing.erros) / existing.total : 0;
      
    // Weighted vulnerability calculation
    const weightedErrors = existing.erros * weight;
    const weightedTotal = existing.total * weight;
    existing.vulnerabilidade = weightedTotal > 0 ? weightedErrors / weightedTotal : 0;
    
    map.set(a.materiaId, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.taxaAcerto - a.taxaAcerto);
}

function inferTipoErro(attempts: AttemptInput[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of attempts) {
    if (a.correto || !a.tipoErro) continue;
    counts[a.tipoErro] = (counts[a.tipoErro] ?? 0) + 1;
  }
  return counts;
}

function detectRecoveryMode(overallAcerto: number, checkIn?: number | null) {
  return overallAcerto < 0.45 || (checkIn !== undefined && checkIn !== null && checkIn <= 2);
}

export async function buildDiagnosis(
  currentAttempts: AttemptInput[],
  historicalAttempts: AttemptInput[][],
  options?: { checkInScore?: number | null; examLabel?: string; provaTipo?: string | null }
): Promise<DiagnosisResult> {
  const total = currentAttempts.length;
  const acertos = currentAttempts.filter((a) => a.correto).length;
  const overallAcerto = total > 0 ? acertos / total : 0;

  const weight = getProvaTipoWeight(options?.provaTipo);
  const temaScores = computeTemaScores(currentAttempts, weight);
  const materiaScores = computeMateriaScores(currentAttempts, weight);
  const tipoErroCounts = inferTipoErro(currentAttempts);

  const temaRecurrence = new Map<string, number>();
  for (const hist of historicalAttempts) {
    for (const a of hist) {
      if (!a.correto && a.materiaId && a.temaId) {
        const key = `${a.materiaId}:${a.temaId}`;
        temaRecurrence.set(key, (temaRecurrence.get(key) ?? 0) + 1);
      }
    }
  }
  for (const a of currentAttempts) {
    if (!a.correto && a.materiaId && a.temaId) {
      const key = `${a.materiaId}:${a.temaId}`;
      temaRecurrence.set(key, (temaRecurrence.get(key) ?? 0) + 1);
    }
  }

  const focos = temaScores
    .filter((t) => t.erros > 0)
    .slice(0, 5)
    .map((t) => {
      const key = `${t.materiaId}:${t.temaId}`;
      const rec = temaRecurrence.get(key) ?? 0;
      const errosTema = currentAttempts.filter(
        (a) => !a.correto && a.materiaId === t.materiaId && a.temaId === t.temaId
      );
      const tipos = errosTema.map((e) => e.tipoErro).filter(Boolean) as ErrorType[];
      const tipoDominante = tipos.sort(
        (a, b) =>
          tipos.filter((x) => x === b).length - tipos.filter((x) => x === a).length
      )[0];

      return {
        materiaId: t.materiaId,
        temaId: t.temaId,
        label: `${t.materiaLabel} — ${t.temaLabel}`,
        prioridade: (rec >= 2 || t.taxaAcerto < 0.4 ? "alta" : "media") as "alta" | "media",
        motivo:
          rec >= 2
            ? `Errou este tema em ${rec} registros recentes`
            : `${Math.round((1 - t.taxaAcerto) * 100)}% de erro neste registro`,
        tipoErroDominante: tipoDominante,
      };
    })
    .sort((a, b) => (a.prioridade === "alta" ? -1 : 1))
    .slice(0, 3);

  const fortes = materiaScores.filter((m) => m.taxaAcerto >= 0.7).map((m) => m.materiaLabel);
  const fracos = materiaScores.filter((m) => m.taxaAcerto < 0.55).map((m) => m.materiaLabel);

  const recoveryMode = detectRecoveryMode(overallAcerto, options?.checkInScore);

  const errosSemTema = currentAttempts.filter(
    (a) => !a.correto && (!a.materiaId || !a.temaId)
  ).length;

  const focosFromMateria = materiaScores
    .filter((m) => m.erros > 0 && m.taxaAcerto < 0.55)
    .slice(0, 3)
    .map((m) => ({
      materiaId: m.materiaId,
      temaId: "geral",
      label: m.materiaLabel,
      prioridade: "media" as const,
      motivo: `${m.erros} erro(s) nesta área (estimativa por bloco da prova)`,
    }));

  const focosFinal = focos.length > 0 ? focos : focosFromMateria;
  const focosTexto = focosFinal
    .map((f) => f.label.split(" — ")[1] ?? f.label)
    .join(", ");
  const melhoraMateria = materiaScores.find((m) => m.taxaAcerto >= 0.65);

  const rotulo =
    options?.examLabel === "prova oficial"
      ? {
          este: "Esta prova oficial",
          neste: "Nesta prova oficial",
          comparar: "suas últimas provas oficiais",
        }
      : {
          este: "Este simulado",
          neste: "Neste simulado",
          comparar: "seus últimos simulados",
        };

  let mensagem: string;
  if (recoveryMode) {
    mensagem =
      `${rotulo.este} foi pesada — e isso não define seu vestibular. ` +
      `Um passo de cada vez: esta semana foque em no máximo ${focosFinal.length || 2} temas (` +
      `${focosTexto || "revisão leve"}). ` +
      `Você já demonstrou capacidade${melhoraMateria ? ` em ${melhoraMateria.materiaLabel}` : ""}. Respire, revise com calma.`;
  } else {
    const pct = Math.round(overallAcerto * 100);
    mensagem =
      `${rotulo.neste} você acertou ${pct}% das questões registradas. ` +
      (fortes.length ? `Pontos fortes: ${fortes.join(", ")}. ` : "") +
      (focosTexto ? `Focos da semana: ${focosTexto}. ` : "") +
      `Compare com ${rotulo.comparar} — a tendência importa mais que uma nota isolada.`;
  }

  if (errosSemTema > 0 && focos.length === 0) {
    mensagem +=
      ` Para diagnóstico por tema, registre o gabarito completo (número + letra) ou envie o caderno na Fase 2.`;
  }

  // --- GOOGLE GEMINI DEEP INTEL INTEGRATION ---
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      // 1. Build the Metacognitive Context (Highly structured and clear to highlight student annotations)
      const metacognitiveSummary = currentAttempts
        .filter((a) => !a.correto)
        .map((a) => {
          const mat = getMateriaLabel(a.materiaId);
          const tema = getTemaLabel(a.materiaId, a.temaId);
          const causa = a.tipoErro || "Sem Classificação";
          const obs = a.observacao ? a.observacao : "Nenhuma anotação pessoal.";
          return `- Questão ${a.numero}:
    * Matéria (banco): ${mat}
    * Assunto (banco): ${tema}
    * Causa do erro (tipoErro): ${causa}
    * Anotação Metacognitiva do Aluno (pode conter correções de matéria/assunto): "${obs}"`;
        })
        .join("\n\n");

      // 2. Build Vulnerability context
      const vulnerabilitySummary = temaScores
        .map(
          (t) =>
            `- ${t.materiaLabel} — ${t.temaLabel}: Vulnerabilidade Ponderada ${t.vulnerabilidade?.toFixed(
              2
            )} (Erros: ${t.erros}/${t.total}, Tipo de Prova: ${options?.provaTipo || "SIMULADO"})`
        )
        .join("\n");

      // 3. System Prompt for Gemini
      const systemPrompt = `Você é o Coach Vestibular, um mentor de alta performance cirúrgico, analítico e implacável, especialista em preparar vestibulandos de Medicina de altíssimo nível.
Sua missão é analisar o diagnóstico de erros de um simulado ou prova e gerar:
1. Uma narrativa empática, altamente personalizada e motivadora de até 3 frases (campo "mensagem"). Adapte a intensidade e o tom para ser acolhedor se o aluno estiver no Modo Recuperação (checkInScore baixo ou desempenho geral baixo).
2. Uma lista de focos prioritários de estudos (campo "focos").
3. Um plano de estudos prático estruturado em blocos de Quests de estudo ativo (campo "studyPlanItems").

Siga rigorosamente as seguintes REGRAS DE FERRO:

1. PRIORIDADE ABSOLUTA DA METACOGNIÇÃO (OVERRIDE DO ALUNO):
Você DEVE ler a anotação metacognitiva/observação do aluno para cada questão errada ANTES de analisar qualquer classificação padrão de matéria ou assunto do banco de dados. 
Se na anotação/observação o aluno apontar explícita ou implicitamente que a classificação cadastrada no banco está errada (por exemplo: "essa questão na verdade é de geografia, não de biologia/genética" ou "era sobre pronomes relativos, não interpretação de texto" ou "era sobre tempos verbais"), você DEVE ignorar completamente os metadados do banco e usar a matéria e o tema corrigidos pelo aluno para gerar a Quest correspondente e os focos de estudo.
Caso a matéria seja corrigida pelo aluno, mapeie-a preferencialmente para um dos seguintes IDs válidos de matéria (biologia, quimica, fisica, matematica, portugues, historia, geografia) e use o tema descrito pelo aluno.

2. HIPER-ESPECIFICIDADE NAS TAREFAS (PROIBIDO TERMOS MACRO OU GENÉRICOS):
Você é terminantemente proibido de gerar títulos macros, vagos ou genéricos como "Estudar Gramática", "Construir Mapa Mental de Óptica", "Fisiologia Humana", "Revisar Genética", "Fazer exercícios de Trigonometria", "Gramática Essencial", "Óptica Geométrica".
Os títulos e descrições das Quests DEVEM ser extremamente específicos, focados nos micro-temas exatos do erro e citando diretamente a dor descrita pelo aluno.
- Exemplo Inaceitável: "Revise Gramática e construa mapa mental."
- Exemplo Correto: "Foco em Pronomes Relativos: cujo e onde" (mencionando na descrição para revisar especificamente o uso de 'cujo' e 'onde' conforme apontado pelo aluno).
- Exemplo Correto 2: "Óptica: Espelhos Côncavos e Convexos" (focando a Quest apenas nas equações de Gauss para espelhos esféricos e esquecendo a parte teórica de refração que o aluno já domina).

3. ESTRUTURAÇÃO DAS AÇÕES POR TIPO DE ERRO:
- Se o tipo de erro de uma questão for "CALCULO_BOBEIRA" ou "INTERPRETACAO_ENUNCIADO" (como erros de distração de sinal, sinal invertido, pegadinha de atenção ou pressa): a Quest gerada DEVE ser uma tarefa prática de mecânica de prova ou agilidade operacional (por exemplo: "Montar checklist mental de conferência de sinal antes de preencher a resposta", "Resolver 5 blocos de exercícios rápidos em 10 minutos para treinar velocidade", "Marcar fisicamente os dados e o comando da questão"). É TERMINANTEMENTE PROIBIDO mandar o aluno assistir aulas teóricas, rever teoria do início ou ler apostilas básicas nestes casos!
- Se o tipo de erro for "CONCEITO_TEORICO", a Quest gerada deve ser de estudo ativo de base teórica (por exemplo: construir um mapa mental focado de fórmulas, explicar o conceito teórico complexo em voz alta, fazer um fichamento cirúrgico de um ponto específico da teoria).

4. LEITURA ATIVA DAS ANOTAÇÕES NA DESCRIÇÃO (TEXTO DINÂMICO):
A descrição de cada Quest DEVE obrigatoriamente iniciar com um texto dinâmico mostrando de forma clara e empática que você leu de fato a anotação pessoal que o aluno escreveu, usando exatamente o padrão: "Com base na sua anotação da QX, onde você mencionou que [resumo da anotação/dor do aluno], sua tarefa será...".

Você deve responder APENAS com um objeto JSON estruturado seguindo exatamente este formato (não adicione blocos de código markdown ao redor do JSON):
{
  "mensagem": "...",
  "focos": [
    {
      "materiaId": "...",
      "temaId": "...",
      "label": "Matéria — Tema",
      "prioridade": "alta" | "media",
      "motivo": "...",
      "tipoErroDominante": "..."
    }
  ],
  "studyPlanItems": [
    {
      "ordem": 1,
      "titulo": "...",
      "descricao": "...",
      "duracaoMin": 60,
      "materiaId": "...",
      "temaId": "...",
      "tipoErro": "...",
      "bloco": "foco_profundo",
      "geraQuest": true
    }
  ]
}`;

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
                  text: `Diagnóstico Geral:
- Acertos: ${acertos}/${total} (${(overallAcerto * 100).toFixed(0)}%)
- Modo Recuperação: ${recoveryMode ? "Sim" : "Não"}
- Check-In Emocional (1 a 5): ${options?.checkInScore ?? "Não informado"}

Resumo dos Erros Metacognitivos:
${metacognitiveSummary || "Nenhum erro metacognitivo registrado."}

Vulnerabilidade por Tema (Ponderada por Peso de Prova):
${vulnerabilitySummary || "Nenhuma vulnerabilidade calculada."}

Gere o diagnóstico estruturado e as Quests de estudo agora seguindo rigorosamente as Regras de Ferro.`,
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
            temperature: 0.2,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
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
          return {
            overallAcerto,
            materiaScores,
            temaScores,
            focos: parsed.focos || focosFinal,
            fortes,
            fracos,
            recoveryMode,
            mensagem: parsed.mensagem || mensagem,
            tipoErroCounts,
            aiStudyPlanItems: parsed.studyPlanItems,
          };
        }
      }
    } catch (err) {
      console.error("Erro na inteligência profunda do Gemini:", err);
    }
  }

  return {
    overallAcerto,
    materiaScores,
    temaScores,
    focos: focosFinal,
    fortes,
    fracos,
    recoveryMode,
    mensagem,
    tipoErroCounts,
  };
}

export function computeTrend(
  current: TemaScore[],
  previous: TemaScore[] | null
): TemaScore[] {
  if (!previous) return current;
  return current.map((t) => {
    const prev = previous.find(
      (p) => p.materiaId === t.materiaId && p.temaId === t.temaId
    );
    if (!prev) return { ...t, tendencia: "stable" as const };
    const diff = t.taxaAcerto - prev.taxaAcerto;
    return {
      ...t,
      tendencia: diff > 0.05 ? "up" : diff < -0.05 ? "down" : "stable",
    };
  });
}
