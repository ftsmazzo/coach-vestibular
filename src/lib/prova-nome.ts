/** Nome canônico da prova a partir dos metadados cadastrados */
export function buildProvaNome(params: {
  banca: string;
  ano?: number | null;
  dia?: number | null;
  caderno?: string | null;
}): string {
  const parts: string[] = [params.banca.trim()];
  if (params.ano != null && !Number.isNaN(params.ano)) parts.push(String(params.ano));
  if (params.dia != null && !Number.isNaN(params.dia)) parts.push(`Dia ${params.dia}`);
  const caderno = params.caderno?.trim();
  if (caderno) parts.push(caderno);
  return parts.join(" — ");
}
