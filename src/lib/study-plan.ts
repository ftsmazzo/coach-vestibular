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
  numerosQuestoes?: number[];
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
}

export function generateStudyPlan(diagnosis: DiagnosisResult): {
  items: StudyPlanItem[];
  recoveryMode: boolean;
} {
  const recoveryMode = diagnosis.recoveryMode;
  const items: StudyPlanItem[] = [];
  const focos = diagnosis.focos.slice(0, recoveryMode ? 2 : 3);

  focos.forEach((foco, i) => {
    const assunto = foco.assunto ?? foco.label.split(" — ")[1] ?? foco.label;
    const nums =
      foco.numerosErrados && foco.numerosErrados.length > 0
        ? `Questões que errou nesta prova: nº ${foco.numerosErrados.slice(0, 10).join(", ")}${foco.numerosErrados.length > 10 ? "…" : ""}. `
        : "";
    const conhec = foco.conhecimentoExigido
      ? `Conhecimento exigido: ${foco.conhecimentoExigido}. `
      : "";
    const dif = foco.nivelDificuldade ? `Nível ${foco.nivelDificuldade}. ` : "";
    const tipoLabel = foco.tipoErroDominante
      ? getTipoErroLabel(foco.tipoErroDominante)
      : null;

    items.push({
      ordem: i + 1,
      titulo: foco.label,
      descricao: recoveryMode
        ? `${nums}${conhec}${dif}Revisão leve: 10–15 questões de ${assunto}${tipoLabel ? ` (${tipoLabel})` : ""}. Sem pressa.`
        : `${nums}${conhec}${dif}Resolver 15–20 questões de ${assunto}${tipoLabel ? ` — atenção a ${tipoLabel}` : ""} + anotar 5 linhas de teoria.`,
      materiaId: foco.materiaId,
      temaId: foco.temaId,
      tipoErro: foco.tipoErroDominante,
      duracaoMin: recoveryMode ? 25 : 45,
      numerosQuestoes: foco.numerosErrados,
      conhecimentoExigido: foco.conhecimentoExigido,
      nivelDificuldade: foco.nivelDificuldade,
    });
  });

  if (!recoveryMode && diagnosis.resumoProva?.materiasComMaisErros[0]) {
    const forte = diagnosis.materiaScores.find((m) => m.taxaAcerto >= 0.7);
    if (forte) {
      items.push({
        ordem: items.length + 1,
        titulo: `Manter ritmo — ${forte.materiaLabel}`,
        descricao: `Você foi bem em ${forte.materiaLabel} nesta prova. Faça 5 questões de manutenção para não perder o ritmo.`,
        materiaId: forte.materiaId,
        duracaoMin: 15,
      });
    }
  }

  items.push({
    ordem: items.length + 1,
    titulo: "Meta transversal",
    descricao: recoveryMode
      ? "Reler só as questões erradas listadas acima — entender o raciocínio, sem cronômetro."
      : "No próximo simulado da mesma banca, conferir se os assuntos prioritários melhoraram.",
    duracaoMin: recoveryMode ? 20 : 30,
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
      rewardMsg: item.conhecimentoExigido
        ? `Foco desta semana: ${item.titulo}. Você já viu na prova que isso aparece — dominar agora evita repetir o erro.`
        : `Bloco concluído: ${item.titulo}. Consistência neste assunto é o que separa quem melhora de prova em prova.`,
    }));
}
