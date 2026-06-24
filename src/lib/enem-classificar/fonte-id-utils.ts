/** Normaliza fonteId retornado pela IA (ex.: "46" → "46:COMUM"). */

export function resolverChaveFonteId(
  retornado: string,
  esperados: Iterable<string>
): string | null {
  const set = esperados instanceof Set ? esperados : new Set(esperados);
  const chave = retornado.trim();
  if (!chave) return null;
  if (set.has(chave)) return chave;

  for (const esperado of set) {
    const [num] = esperado.split(":");
    if (num === chave) return esperado;
    if (chave.startsWith(`${num}:`) && set.has(chave)) return chave;
  }

  return null;
}

export function aplicarMapaComChavesFonteId<T>(
  bruto: Map<string, T>,
  esperados: string[]
): Map<string, T> {
  const set = new Set(esperados);
  const out = new Map<string, T>();
  for (const [k, v] of bruto) {
    const canon = resolverChaveFonteId(k, set);
    if (canon) out.set(canon, v);
  }
  return out;
}

export function fonteIdsFaltantes(esperados: string[], map: Map<string, unknown>): string[] {
  return esperados.filter((id) => !map.has(id));
}
