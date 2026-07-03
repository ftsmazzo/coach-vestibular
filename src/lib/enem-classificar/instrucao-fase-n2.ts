/** Instrução reforçada para chamadas IA na fase N2 (escopo no catálogo). */

export const INSTRUCAO_SISTEMA_FASE_N2 =
  "Você está na fase N2.\n" +
  "Sua única tarefa é escolher o escopo primário (e opcionalmente secundários) no catálogo da disciplina já definida no N1.\n" +
  "Não altere a disciplina/catálogo destino — respeite a LINHA DE CLASSIFICAÇÃO com N1 gravado.\n" +
  "Não gere conhecimento exigido (N3).\n" +
  "Classifique pelo conhecimento exigido no comando da questão, não por palavras soltas do texto-base.\n" +
  "Use descricao, exemplosEnunciado e negativeHints de cada escopo antes de keywords isoladas.";

export function systemPromptComFaseN2(promptBase: string): string {
  const base = promptBase?.trim() || "";
  return base ? `${INSTRUCAO_SISTEMA_FASE_N2}\n\n${base}` : INSTRUCAO_SISTEMA_FASE_N2;
}
