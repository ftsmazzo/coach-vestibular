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

export async function buildPlanoSemanalCopiloto(userId: string): Promise<{
  items: StudyPlanItem[];
  recoveryMode: boolean;
}> {
  const [motor, resumo, analytics] = await Promise.all([
    buildDiagnosticoMotor(userId),
    buildResumoJornada(userId),
    aggregateJourneyLearning(userId, "todos"),
  ]);

  const recoveryMode = resumo.pctAcertoPonderado < 50 && resumo.totalRegistros >= 2;
  const items: StudyPlanItem[] = [];
  let ordem = 1;

  const registrosLabel =
    resumo.totalRegistros === 1
      ? "1 registro na jornada"
      : `${resumo.totalRegistros} registros na jornada`;

  items.push({
    ordem: ordem++,
    titulo: "Sua semana na jornada",
    descricao:
      `Este plano usa **todos os ${registrosLabel}** (oficiais, simulados e listas com pesos diferentes) — ` +
      `não é revisão só da última prova. Acerto ponderado: ${resumo.pctAcertoPonderado}%. ` +
      `Leia os blocos abaixo; o passo a passo da semana está em Quests → O que fazer agora (sem repetir o mesmo texto da Home).`,
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "jornada",
  });

  if (!motor.temDados || !motor.clusterPrincipal) {
    items.push({
      ordem: ordem++,
      titulo: "Meta da semana",
      descricao:
        "Registre mais provas do catálogo com gabarito e metacognição nos erros para o copiloto montar passos personalizados.",
      duracaoMin: 10,
      bloco: "meta",
      geraQuest: false,
    });
    return { items, recoveryMode };
  }

  const principal = motor.clusterPrincipal;
  const narrativa = narrativaCopiloto(principal, motor.materiaDeficit, motor.totalExames);
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

  return { items, recoveryMode };
}
