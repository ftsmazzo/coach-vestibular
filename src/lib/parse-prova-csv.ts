export interface ProvaQuestaoRow {
  numero: number;
  caderno?: string;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string;
  gabarito?: string;
}

export function parseProvaQuestoesCsv(text: string): ProvaQuestaoRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  const iNumero = idx(["numero", "número", "questao", "questão"]);
  const iCaderno = idx(["caderno"]);
  const iMateria = idx(["materia", "matéria", "disciplina"]);
  const iAssunto = idx(["assunto", "tema"]);
  const iConhec = idx(["conhecimento", "conteudo", "conteúdo", "exige"]);
  const iGabarito = idx(["gabarito", "resposta", "alternativa"]);

  const rows: ProvaQuestaoRow[] = [];

  for (let l = 1; l < lines.length; l++) {
    const cols = lines[l].split(",").map((c) => c.trim());
    const numero = parseInt(cols[iNumero >= 0 ? iNumero : 0], 10);
    if (isNaN(numero)) continue;

    rows.push({
      numero,
      caderno: iCaderno >= 0 ? cols[iCaderno] : undefined,
      materia: cols[iMateria >= 0 ? iMateria : 1] || "Geral",
      assunto: cols[iAssunto >= 0 ? iAssunto : 2] || "Geral",
      conhecimentoExigido: iConhec >= 0 ? cols[iConhec] : undefined,
      gabarito: iGabarito >= 0 ? cols[iGabarito]?.toUpperCase().slice(0, 1) : undefined,
    });
  }

  return rows;
}
