/** Texto de orientação humana injetado no prompt de classificação (reclassificar / lotes). */

export type OrientacaoRevisorInput = {
  areaBloco?: string | null;
  materiaAtual?: string | null;
  observacoes?: string | null;
  /** Dica pontual só nesta chamada (ex. motivo da auditoria). */
  orientacaoExtra?: string | null;
};

export function montarBlocoOrientacaoRevisor(input: OrientacaoRevisorInput): string {
  const linhas: string[] = [];
  if (input.areaBloco?.trim()) {
    linhas.push(`Bloco/área no caderno: ${input.areaBloco.trim()}`);
  }
  if (input.materiaAtual?.trim() && input.materiaAtual !== "A classificar") {
    linhas.push(
      `Classificação atual no banco (pode estar errada): ${input.materiaAtual.trim()}`
    );
  }
  const partes = [input.observacoes?.trim(), input.orientacaoExtra?.trim()].filter(
    Boolean
  ) as string[];
  if (partes.length > 0) {
    linhas.push(
      "ORIENTAÇÃO DO REVISOR (prioridade — corrija a classificação se conflitar com o enunciado):",
      ...partes
    );
  }
  if (linhas.length === 0) return "";
  return `${linhas.join("\n")}\n\n`;
}

export const REGRA_PROMPT_ORIENTACAO_REVISOR = `Se existir bloco «ORIENTAÇÃO DO REVISOR», trate-o como verdade operacional (matéria correta, idioma do texto-base, tipo de conteúdo). Não ignore essa orientação por palavras isoladas no enunciado.`;
