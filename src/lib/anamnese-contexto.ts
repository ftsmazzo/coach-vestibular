/**
 * Consome anamnese no motor narrativo — hipótese declarada + confirmação com escopo N2.
 */
import type { AnamneseMotorContext } from "@/lib/anamnese-types";
import type { FocoPedagogico } from "@/lib/diagnosis-escopo";

export function enriquecerParagrafoComAnamneseEscopo(
  paragrafo: string,
  ctx: AnamneseMotorContext | null,
  foco: FocoPedagogico | null
): string {
  if (!ctx?.completed || !ctx.ponteNarrativa) return paragrafo;

  const ponte = ctx.ponteNarrativa;
  if (foco && ctx.profile?.declaredPatterns?.length) {
    const weak = ctx.profile.academicSelfPerception?.perceivedWeakSubjects?.[0];
    const matFoco = foco.materiaLabel;
    if (weak && matFoco.toLowerCase().includes(weak.toLowerCase().slice(0, 4))) {
      return `${ponte} Nos seus registros, isso aparece de forma consistente em ${foco.escopoLabel} — não é só sensação. ${paragrafo}`;
    }
    if (weak && !matFoco.toLowerCase().includes(weak.toLowerCase().slice(0, 4))) {
      return `${ponte} Seus registros mostram foco mais forte em ${foco.escopoLabel} (${matFoco}) do que em ${weak} — vale atacar os dois com prioridade diferente. ${paragrafo}`;
    }
  }

  return `${ponte} ${paragrafo}`;
}

export function linhaContrasteAnamneseEscopo(
  ctx: AnamneseMotorContext | null,
  temRegistros: boolean,
  foco: FocoPedagogico | null
): string | null {
  if (!ctx?.completed || !ctx.profile) return null;
  if (!temRegistros) {
    return "Quando você registrar provas do catálogo, vou cruzar o que você contou aqui com seus erros por escopo — e ajustar o foco com cuidado.";
  }
  if (foco && ctx.profile.academicSelfPerception?.perceivedWeakSubjects?.length) {
    const weak = ctx.profile.academicSelfPerception.perceivedWeakSubjects[0];
    if (weak && foco.materiaLabel.toLowerCase().includes(weak.toLowerCase().slice(0, 4))) {
      return `Na conversa inicial você citou ${weak} — seus erros confirmam foco em ${foco.escopoLabel}.`;
    }
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

/** @deprecated use linhaContrasteAnamneseEscopo */
export function linhaContrasteAnamnese(
  ctx: AnamneseMotorContext | null,
  temRegistros: boolean
): string | null {
  return linhaContrasteAnamneseEscopo(ctx, temRegistros, null);
}
