export interface ProvaQuestaoRow {
  numero: number;
  caderno?: string;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string;
  nivelDificuldade?: string;
  observacoes?: string;
  gabarito?: string;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseProvaQuestoesCsv(text: string): ProvaQuestaoRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
  );
  const idx = (names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n.replace(/\p{Diacritic}/gu, ""))));

  const iNumero = idx(["numero da questao", "numero", "n questao", "questao"]);
  const iCaderno = idx(["caderno"]);
  const iMateria = idx(["materia", "disciplina"]);
  const iAssunto = idx(["assunto", "tema"]);
  const iConhec = idx([
    "habilidade",
    "conhecimento exigido",
    "conhecimento",
    "habilidade/conhecimento",
  ]);
  const iDificuldade = idx(["nivel de dificuldade", "dificuldade"]);
  const iObs = idx(["observacoes", "observacao"]);
  const iGabarito = idx(["gabarito", "resposta", "alternativa"]);

  const rows: ProvaQuestaoRow[] = [];

  for (let l = 1; l < lines.length; l++) {
    const cols = splitCsvLine(lines[l]);
    const numero = parseInt(cols[iNumero >= 0 ? iNumero : 2], 10);
    if (isNaN(numero)) continue;

    const materia = cols[iMateria >= 0 ? iMateria : 3]?.trim();
    const assunto = cols[iAssunto >= 0 ? iAssunto : 4]?.trim();
    if (!materia && !assunto) continue;

    rows.push({
      numero,
      caderno: iCaderno >= 0 ? cols[iCaderno] : undefined,
      materia: materia || "A classificar",
      assunto: assunto || "A classificar",
      conhecimentoExigido: iConhec >= 0 ? cols[iConhec] : undefined,
      nivelDificuldade: iDificuldade >= 0 ? cols[iDificuldade] : undefined,
      observacoes: iObs >= 0 ? cols[iObs] : undefined,
      gabarito: iGabarito >= 0 ? cols[iGabarito]?.toUpperCase().slice(0, 1) : undefined,
    });
  }

  return rows;
}
