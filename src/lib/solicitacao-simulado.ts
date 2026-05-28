export const STATUS_SOLICITACAO_PENDENTE = "solicitacao_simulado";
export const STATUS_SOLICITACAO_PROCESSADA = "solicitacao_processada";

export type SolicitacaoSimuladoMeta = {
  tipo?: string;
  nome?: string;
  banca?: string | null;
  observacao?: string | null;
  tamanhoBytes?: number;
  mimeType?: string;
  mensagem?: string;
};

export function parseSolicitacaoMeta(resultJson: string | null): SolicitacaoSimuladoMeta {
  if (!resultJson) return {};
  try {
    return JSON.parse(resultJson) as SolicitacaoSimuladoMeta;
  } catch {
    return {};
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isSolicitacaoStatus(status: string): boolean {
  return status === STATUS_SOLICITACAO_PENDENTE || status === STATUS_SOLICITACAO_PROCESSADA;
}
