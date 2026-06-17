/** Gabarito oficial de questão anulada pela banca (padrão ENEM/vestibular: *). */
export const GABARITO_ANULADA = "*";

const ROTULOS_ANULADA = /^(anulad[ao]?|n\/a|null|cancelad[ao]?|\*)$/i;

export function gabaritoEhAnulada(gabarito: string | null | undefined): boolean {
  if (!gabarito?.trim()) return false;
  const g = gabarito.trim();
  return g === GABARITO_ANULADA || ROTULOS_ANULADA.test(g);
}

/** Normaliza entrada admin/CSV/cola para A–E ou *. */
export function normalizarGabaritoOficial(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  if (gabaritoEhAnulada(t)) return GABARITO_ANULADA;
  const letra = t.toUpperCase().replace(/[^A-E*]/g, "").slice(0, 1);
  if (letra === "*") return GABARITO_ANULADA;
  if (/^[A-E]$/.test(letra)) return letra;
  return undefined;
}

export function gabaritoOficialPreenchido(gabarito: string | null | undefined): boolean {
  if (!gabarito?.trim()) return false;
  return /^[A-Ea-e]$/.test(gabarito.trim()) || gabaritoEhAnulada(gabarito);
}
