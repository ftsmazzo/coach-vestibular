import type { DiagnosisResult } from "./diagnosis";
import { getTipoErroLabel } from "./taxonomy";

export interface StudyPlanItem {
  ordem: number;
  titulo: string;
  descricao: string;
  materiaId?: string;
  temaId?: string;
  tipoErro?: string;
  duracaoMin: number;
}

export function generateStudyPlan(diagnosis: DiagnosisResult): {
  items: StudyPlanItem[];
  recoveryMode: boolean;
} {
  const recoveryMode = diagnosis.recoveryMode;
  const items: StudyPlanItem[] = [];
  const focos = diagnosis.focos.slice(0, recoveryMode ? 2 : 3);

  focos.forEach((foco, i) => {
    const tipoLabel = foco.tipoErroDominante
      ? getTipoErroLabel(foco.tipoErroDominante)
      : "revisão";
    items.push({
      ordem: i + 1,
      titulo: foco.label,
      descricao: recoveryMode
        ? `Revisão leve: 10–15 questões de ${foco.label.split(" — ")[1] ?? foco.label} (${tipoLabel ?? "base"}). Sem pressa.`
        : `20 questões + resumo teórico: ${foco.label} — foco em ${tipoLabel ?? "base teórica"}.`,
      materiaId: foco.materiaId,
      temaId: foco.temaId,
      tipoErro: foco.tipoErroDominante,
      duracaoMin: recoveryMode ? 25 : 45,
    });
  });

  if (!recoveryMode) {
    items.push({
      ordem: items.length + 1,
      titulo: "Interpretação diária",
      descricao: "1 questão de interpretação de texto por dia (10 min).",
      materiaId: "portugues",
      temaId: "interpretacao_texto",
      tipoErro: "interpretacao",
      duracaoMin: 10,
    });
  }

  items.push({
    ordem: items.length + 1,
    titulo: "Meta transversal",
    descricao: recoveryMode
      ? "Revisar com calma 1 simulado antigo — só entender os erros, sem cronômetro."
      : "Revisar 2 simulados antigos com calma — identificar padrões de erro.",
    duracaoMin: recoveryMode ? 20 : 40,
  });

  return { items, recoveryMode };
}

export function planToQuests(
  items: StudyPlanItem[],
  userId: string
): Array<{
  userId: string;
  titulo: string;
  descricao: string;
  materiaId?: string;
  temaId?: string;
  duracaoMin: number;
  rewardMsg: string;
}> {
  return items
    .filter((item) => item.titulo !== "Meta transversal")
    .map((item) => ({
      userId,
      titulo: item.titulo,
      descricao: item.descricao,
      materiaId: item.materiaId,
      temaId: item.temaId,
      duracaoMin: item.duracaoMin,
      rewardMsg:
        "Cada passo conta. Você está construindo consistência — isso vence na maratona do vestibular.",
    }));
}
