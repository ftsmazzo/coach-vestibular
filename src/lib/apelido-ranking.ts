/** Apelido automático quando o aluno não escolhe nome no ranking. */
export function apelidoRankingAutomatico(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Estudante ?";

  const primeiro = parts[0]!;
  const sobrenome = parts.length > 1 ? parts[parts.length - 1]! : primeiro;
  const letra = primeiro.charAt(0).toUpperCase();
  const n2 = primeiro.slice(0, 2).toLowerCase();
  const s2 = sobrenome.slice(0, 2).toLowerCase();

  if (parts.length === 1) {
    return `Estudante ${letra}.${n2}`;
  }
  return `Estudante ${letra}.${n2}.${s2}`;
}

const NOME_RANKING_REGEX = /^[\p{L}\p{N}][\p{L}\p{N}\s._-]{1,23}$/u;

export function parseNomeExibicaoRanking(
  raw: string
): { value: string | null; error?: string } {
  const t = raw.trim();
  if (!t) return { value: null };
  if (!NOME_RANKING_REGEX.test(t)) {
    return {
      value: null,
      error: "Use 2–24 caracteres (letras, números, espaço, ponto, hífen).",
    };
  }
  return { value: t };
}

export function nomePublicoRanking(user: {
  name: string;
  nomeExibicaoRanking?: string | null;
}): string {
  const custom = user.nomeExibicaoRanking?.trim();
  if (custom && custom.length >= 2) return custom;
  return apelidoRankingAutomatico(user.name);
}

/** @deprecated use apelidoRankingAutomatico */
export const apelidoRanking = apelidoRankingAutomatico;
