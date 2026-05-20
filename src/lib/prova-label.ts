/** Rótulo para o aluno escolher a prova no registro do simulado */
export function formatProvaLabel(p: {
  nome: string;
  banca?: string;
  ano?: number | null;
  caderno?: string | null;
  dia?: number | null;
}): string {
  return p.nome.trim();
}
