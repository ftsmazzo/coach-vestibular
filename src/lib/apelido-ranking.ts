/**
 * Apelido público no ranking — não expõe nome completo (evita identificar colegas do mesmo cursinho).
 * Formato: Estudante L.ab.cd (letra do nome + 2 primeiras do nome + 2 do sobrenome).
 */
export function apelidoRanking(name: string): string {
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
