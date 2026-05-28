/**
 * Plano semanal da jornada — mesmo motor da Home e das alavancas.
 * Sem números de questão de uma prova isolada; foco em padrão + passos.
 */
import { buildDiagnosticoMotor } from "@/lib/diagnostic-motor";
import { buildResumoJornada } from "@/lib/jornada";
import { narrativaCopiloto } from "@/lib/narrativa-copiloto";
import { formatarPassos, PASSOS_POR_CLUSTER } from "@/lib/copiloto-passos";
import { CLUSTERS_PEDAGOGICOS } from "@/lib/pedagogical-clusters";
import type { StudyPlanItem } from "@/lib/study-plan";
import { materiasComDadosReais } from "@/lib/jornada-analytics";
import { aggregateJourneyLearning } from "@/lib/jornada-analytics";
import { getAnamneseMotorContext } from "@/lib/anamnese-motor";

function blocosPlanoSóAnamnese(
  anamneseCtx: Awaited<ReturnType<typeof getAnamneseMotorContext>>,
  ordemInicial: number
): StudyPlanItem[] {
  const items: StudyPlanItem[] = [];
  let ordem = ordemInicial;
  const weak = anamneseCtx.profile?.academicSelfPerception?.perceivedWeakSubjects ?? [];
  const strong = anamneseCtx.profile?.academicSelfPerception?.perceivedStrongSubjects ?? [];

  items.push({
    ordem: ordem++,
    titulo: "O que você contou na conversa inicial",
    descricao:
      (anamneseCtx.summary ?? anamneseCtx.focoInicialDescricao ?? "") +
      "\n\nAinda não há provas registradas — este plano vem da sua anamnese. " +
      "Quando registrar simulados, o copiloto cruza o que você disse com seus erros reais.",
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "jornada",
  });

  if (anamneseCtx.focoInicialTitulo) {
    items.push({
      ordem: ordem++,
      titulo: `Prioridade 1 — ${anamneseCtx.focoInicialTitulo}`,
      descricao:
        (anamneseCtx.focoInicialDescricao ?? "Foco inicial a partir da sua jornada.") +
        (weak.length
          ? `\n\nMatérias que você sinalizou como mais difíceis: ${weak.join(", ")}.`
          : "") +
        (strong.length ? `\nOnde você se sente mais forte: ${strong.join(", ")}.` : "") +
        "\n\nPasso a passo prático → Quests → O que fazer agora.",
      duracaoMin: 40,
      bloco: "foco_profundo",
      materiaDestaque: weak[0] ?? undefined,
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  if (anamneseCtx.profile?.examBehavior?.fatigueInLongExams) {
    items.push({
      ordem: ordem++,
      titulo: "Também vale atenção — clareza em prova longa",
      descricao:
        "Você comentou que perde clareza em provas longas. Quando fizer simulados, marque em qual bloco de questões a cabeça cansou — isso vira dado real para o copiloto.",
      duracaoMin: 0,
      bloco: "consolidacao",
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  items.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao:
      "Completar os passos em Quests. Registrar pelo menos uma atividade no catálogo para o plano passar a usar seus erros reais.",
    duracaoMin: 0,
    bloco: "meta",
    geraQuest: false,
  });

  return items;
}

export async function buildPlanoSemanalCopiloto(userId: string): Promise<{
  items: StudyPlanItem[];
  recoveryMode: boolean;
  fonte: "jornada" | "anamnese" | "vazio";
}> {
  const [motor, resumo, analytics, anamneseCtx] = await Promise.all([
    buildDiagnosticoMotor(userId),
    buildResumoJornada(userId),
    aggregateJourneyLearning(userId, "todos"),
    getAnamneseMotorContext(userId),
  ]);

  const recoveryMode = resumo.pctAcertoPonderado < 50 && resumo.totalRegistros >= 2;
  const items: StudyPlanItem[] = [];
  let ordem = 1;

  const registrosLabel =
    resumo.totalRegistros === 1
      ? "1 registro na jornada"
      : `${resumo.totalRegistros} registros na jornada`;

  const introAnamnese =
    resumo.totalRegistros === 0 && anamneseCtx.completed
      ? "Por enquanto o plano vem da **conversa inicial** (anamnese). "
      : "";

  const geradoEm = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  items.push({
    ordem: ordem++,
    titulo: "Sua semana na jornada",
    descricao:
      `Atualizado pelo copiloto em ${geradoEm}.\n\n` +
      introAnamnese +
      (resumo.totalRegistros > 0
        ? `Este plano usa **todos os ${registrosLabel}** — acerto ponderado: ${resumo.pctAcertoPonderado}%. `
        : "Registre provas quando puder para cruzar com o que você já contou. ") +
      `Passo a passo em Quests → O que fazer agora.`,
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "jornada",
  });

  if (!motor.temDados || !motor.clusterPrincipal) {
    if (anamneseCtx.completed) {
      items.push(...blocosPlanoSóAnamnese(anamneseCtx, ordem));
      return { items, recoveryMode, fonte: "anamnese" };
    }
    items.push({
      ordem: ordem++,
      titulo: "Meta da semana",
      descricao:
        "Faça a conversa inicial na Home (Entendendo sua jornada) e registre provas do catálogo para o copiloto montar passos personalizados.",
      duracaoMin: 10,
      bloco: "meta",
      geraQuest: false,
    });
    return { items, recoveryMode, fonte: "vazio" };
  }

  const principal = motor.clusterPrincipal;
  const narrativa = narrativaCopiloto(
    principal,
    motor.materiaDeficit,
    motor.totalExames,
    anamneseCtx
  );
  const def = CLUSTERS_PEDAGOGICOS[principal.clusterId];
  const materia =
    principal.materias[0]?.nome ?? motor.materiaDeficit?.label ?? "sua matéria prioritária";

  items.push({
    ordem: ordem++,
    titulo: `Prioridade 1 — ${def.tituloHumano}`,
    descricao:
      `${narrativa.camadas.caminho}\n\n` +
      formatarPassos(
        PASSOS_POR_CLUSTER[principal.clusterId],
        `padrão mais forte em ${materia} na sua jornada.`,
        recoveryMode ? 35 : 45
      ),
    duracaoMin: recoveryMode ? 35 : 45,
    bloco: "foco_profundo",
    materiaDestaque: materia,
    geraQuest: false,
    errosContexto: "jornada",
  });

  const secundario = motor.clusters[1];
  if (secundario && !recoveryMode) {
    const def2 = CLUSTERS_PEDAGOGICOS[secundario.clusterId];
    const mat2 = secundario.materias[0]?.nome ?? "outra matéria";
    items.push({
      ordem: ordem++,
      titulo: `Também vale atenção — ${def2.tituloHumano}`,
      descricao: formatarPassos(
        PASSOS_POR_CLUSTER[secundario.clusterId].slice(0, 4),
        `segundo padrão na jornada (${mat2}).`,
        35
      ),
      duracaoMin: 35,
      bloco: "consolidacao",
      materiaDestaque: mat2,
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  const materiasBase = materiasComDadosReais(analytics.materiasMedia, 5);
  const solidas = materiasBase.filter((m) => m.pctAcerto >= 65).slice(0, recoveryMode ? 0 : 1);
  for (const m of solidas) {
    items.push({
      ordem: ordem++,
      titulo: `${m.label} — manter ritmo`,
      descricao: formatarPassos(
        [
          `Você está com ${m.pctAcerto}% de acerto ponderado em ${m.label} na jornada.`,
          "Faça 8 questões de nível médio (não pule esta matéria).",
          "Corrija e siga para o próximo bloco.",
        ],
        "manter o que já funciona enquanto ataca o déficit.",
        25
      ),
      duracaoMin: 25,
      bloco: "manutencao",
      materiaDestaque: m.label,
      geraQuest: false,
      errosContexto: "jornada",
    });
  }

  items.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao:
      `Completar os blocos na ordem. O foco central é ${def.tituloHumano.toLowerCase()} em ${materia}. ` +
      `Tempo total sugerido: ${recoveryMode ? "2–3h" : "4–6h"} distribuídas na semana. ` +
      `Depois de registrar uma nova prova, use "Regenerar plano" para atualizar com a jornada inteira.`,
    duracaoMin: 0,
    bloco: "meta",
    geraQuest: false,
    errosContexto: "jornada",
  });

  return { items, recoveryMode, fonte: "jornada" };
}
