/** Instrução reforçada para chamadas IA na fase N1 (roteamento / triagem). */

export const INSTRUCAO_SISTEMA_FASE_N1 =
  "Você está na fase N1.\n" +
  "Sua única tarefa é escolher o catálogo/disciplina destino.\n" +
  "Não escolha escopo (N2).\n" +
  "Não gere conhecimento exigido (N3).\n" +
  "Não justifique longamente.\n" +
  "Não use a posição da questão na prova como única evidência — use como apoio só se o conteúdo confirmar.\n" +
  "Decida pelo conhecimento exigido no comando da questão, não por palavras soltas do texto-base.";

export function systemPromptComFaseN1(promptBase: string): string {
  const base = promptBase?.trim() || "";
  return base ? `${INSTRUCAO_SISTEMA_FASE_N1}\n\n${base}` : INSTRUCAO_SISTEMA_FASE_N1;
}
