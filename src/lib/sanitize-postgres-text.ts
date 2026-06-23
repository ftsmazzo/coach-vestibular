/** Remove U+0000 — PostgreSQL rejeita null byte em colunas text/varchar. */
export function sanitizarTextoPostgres(
  value: string | null | undefined
): string | undefined {
  if (value == null) return undefined;
  const cleaned = value.replace(/\u0000/g, "");
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Sanitiza strings dentro de JSON antes de persistir em jsonb. */
export function sanitizarJsonPostgres<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    return sanitizarTextoPostgres(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizarJsonPostgres(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizarJsonPostgres(v);
    }
    return out as T;
  }
  return value;
}
