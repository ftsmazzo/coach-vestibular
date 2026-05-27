/** Constantes e mensagens — seguro para importar em Client Components. */
export const MAX_QUESTOES_LISTA = 50;
export const MAX_LISTAS_POR_SEMANA = 15;

export function mensagemErroLista(code: string): string {
  const map: Record<string, string> = {
    NOME_OBRIGATORIO: "Informe um nome para a lista.",
    DATA_OBRIGATORIA: "Informe a data em que você fez os exercícios.",
    TOTAL_QUESTOES_INVALIDO: `Use entre 1 e ${MAX_QUESTOES_LISTA} questões.`,
    ERROS_OBRIGATORIOS: "Informe pelo menos um número de questão que você errou.",
    ERRO_FORA_INTERVALO: "Algum número de erro está fora do total de questões.",
    LIMITE_SEMANAL: `Limite de ${MAX_LISTAS_POR_SEMANA} listas por semana. Tente na próxima semana.`,
  };
  return map[code] ?? "Não foi possível salvar a lista.";
}

export function ehListaPessoal(exam: { provaId: string | null }): boolean {
  return exam.provaId == null;
}
