export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const o = JSON.parse(raw);
    if (!Array.isArray(o)) return [];
    return o.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export type ClassificacaoSecundaria = { escopoId: string; confianca: number };

export function parseClassificacaoSecundarios(
  raw: string | null | undefined
): ClassificacaoSecundaria[] {
  if (!raw?.trim()) return [];
  try {
    const o = JSON.parse(raw) as ClassificacaoSecundaria[];
    if (!Array.isArray(o)) return [];
    return o.filter((x) => x?.escopoId && typeof x.confianca === "number");
  } catch {
    return [];
  }
}
