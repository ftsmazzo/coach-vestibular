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

/** Título curto para cards e leitura do coach (ex.: UNESP 2026 — Caderno 001). */
export function abreviarNomeProva(nome: string, max = 52): string {
  const t = nome.trim();
  if (t.length <= max) return t;

  const porTraco = t.split(" — ");
  if (porTraco.length >= 2) {
    const curto = `${porTraco[0]!.trim()} — ${porTraco[porTraco.length - 1]!.trim()}`;
    if (curto.length <= max) return curto;
  }

  const porHifen = t.split(" - ");
  if (porHifen.length >= 2) {
    const curto = `${porHifen[0]!.trim()} — ${porHifen[porHifen.length - 1]!.trim()}`;
    if (curto.length <= max) return curto;
  }

  return `${t.slice(0, max - 1).trim()}…`;
}
