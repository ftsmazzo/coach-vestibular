/**
 * Consome anamnese no motor narrativo — hipótese declarada + confirmação com provas.
 */
import type { AnamneseMotorContext } from "@/lib/anamnese-types";
import type { ClusterAgregado } from "@/lib/diagnostic-motor";

export function enriquecerParagrafoComAnamnese(
  paragrafo: string,
  ctx: AnamneseMotorContext | null,
  principal: ClusterAgregado | null
): string {
  if (!ctx?.completed || !ctx.ponteNarrativa) return paragrafo;

  const ponte = ctx.ponteNarrativa;
  if (principal && ctx.profile?.declaredPatterns?.length) {
    const weak = ctx.profile.academicSelfPerception?.perceivedWeakSubjects?.[0];
    const matCluster = principal.materias[0]?.nome;
    if (weak && matCluster && matCluster.toLowerCase().includes(weak.toLowerCase().slice(0, 4))) {
      return `${ponte} Nos seus registros, isso aparece de forma consistente — não é só sensação. ${paragrafo}`;
    }
    if (weak && matCluster && !matCluster.toLowerCase().includes(weak.toLowerCase().slice(0, 4))) {
      return `${ponte} Seus registros mostram um padrão mais forte em ${matCluster} do que em ${weak} — vale atacar os dois com prioridade diferente. ${paragrafo}`;
    }
  }

  return `${ponte} ${paragrafo}`;
}

export function linhaContrasteAnamnese(
  ctx: AnamneseMotorContext | null,
  temRegistros: boolean
): string | null {
  if (!ctx?.completed || !ctx.profile) return null;
  if (!temRegistros) {
    return "Quando você registrar provas, vou cruzar o que você contou aqui com seus erros reais — e ajustar o foco com cuidado.";
  }
  const meta = ctx.profile.metacognition;
  if (meta?.metacognitiveMaturity === "BAIXA") {
    return "Você comentou que ainda não revisa erros com método — nas próximas semanas o copiloto vai priorizar revisão guiada.";
  }
  if (ctx.profile.examBehavior?.fatigueInLongExams) {
    return "Você falou em perder clareza em provas longas — vamos observar se isso se repete nos seus simulados.";
  }
  return null;
}
