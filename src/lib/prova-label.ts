/** Rótulo para o aluno escolher a prova no registro do simulado */
export function formatProvaLabel(p: {
  nome: string;
  banca: string;
  ano?: number | null;
  caderno?: string | null;
  dia?: number | null;
}): string {
  const parts = [p.nome];
  if (p.ano) parts.push(String(p.ano));
  if (p.caderno) parts.push(p.caderno);
  if (p.dia) parts.push(`dia ${p.dia}`);
  if (!p.nome.toLowerCase().includes(p.banca.toLowerCase())) parts.push(`(${p.banca})`);
  return parts.join(" · ");
}
