import { sanitizarTextoPostgres } from "@/lib/sanitize-postgres-text";

/** Mínimo recomendado para considerar enunciado “completo” na validação admin. */
export const ENUNCIADO_VALIDACAO_MIN_CHARS = 80;

/**
 * Sanitiza texto de prova para persistência e classificação.
 * Remove null bytes, normaliza quebras e espaços repetidos.
 */
export function sanitizarTextoProva(raw: string | null | undefined): string {
  if (raw == null) return "";
  let t = sanitizarTextoPostgres(raw) ?? "";
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\u0000/g, "");
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
  t = t.replace(/\t/g, " ");
  t = t.replace(/ +/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export function truncarTextoProva(raw: string, max = 12000): string {
  const t = sanitizarTextoProva(raw);
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export type StatusExtracaoQuestao = "faltando" | "curto" | "ok";

export function statusEnunciadoExtracao(
  enunciado: string | null | undefined,
  minChars = ENUNCIADO_VALIDACAO_MIN_CHARS
): StatusExtracaoQuestao {
  const t = sanitizarTextoProva(enunciado);
  if (!t) return "faltando";
  if (t.length < minChars) return "curto";
  return "ok";
}
