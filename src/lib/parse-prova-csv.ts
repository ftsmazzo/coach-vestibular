export interface ProvaQuestaoRow {
  numero: number;
  areaBloco?: string;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string;
  nivelDificuldade?: string;
  observacoes?: string;
  enunciado?: string;
  gabarito?: string;
}

export interface ParseProvaCsvOptions {
  /** Default false — gabarito só via lote admin ou CSV oficial explícito */
  incluirGabarito?: boolean;
}

export interface ParseProvaCsvResult {
  rows: ProvaQuestaoRow[];
  /** Colunas extras (Prova, Caderno, etc.) são ignoradas — não entram no banco */
  avisos: string[];
}

/** Cabeçalhos só informativos do GPT; nunca mapeiam para ProvaQuestao */
const COLUNAS_IGNORADAS = new Set([
  "prova",
  "caderno",
  "tipo",
  "vestibular",
  "banca",
  "ano",
  "dia",
  "edital",
  "processo seletivo",
]);

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function detectDelimiter(line: string): "," | ";" | "\t" {
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function parseProvaQuestoesCsv(
  text: string,
  options: ParseProvaCsvOptions = {}
): ParseProvaCsvResult {
  const incluirGabarito = options.incluirGabarito === true;
  const avisos: string[] = [];
  const raw = stripBom(text).trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      avisos: [
        "CSV precisa de cabeçalho + pelo menos uma linha de questão.",
        "Se exportou do Excel no Brasil, salve como CSV UTF-8 (vírgula ou ponto-e-vírgula).",
      ],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  if (delimiter === ";") {
    avisos.push("Detectado separador ponto-e-vírgula (;) — comum em planilhas brasileiras.");
  }

  const headerRaw = splitCsvLine(lines[0], delimiter);
  const header = headerRaw.map(normalizeHeader);

  const colunasIgnoradas = headerRaw.filter((_, i) => COLUNAS_IGNORADAS.has(header[i]));
  if (colunasIgnoradas.length > 0) {
    avisos.push(
      `Colunas ignoradas (já estão no cadastro da prova): ${colunasIgnoradas.join(", ")}.`
    );
  }

  const idx = (names: string[]) =>
    header.findIndex((h) => {
      if (COLUNAS_IGNORADAS.has(h)) return false;
      return names.some((n) => h.includes(n.replace(/\p{Diacritic}/gu, "")));
    });

  const iNumero = idx(["numero da questao", "numero", "n questao", "questao", "item"]);
  const iArea = idx(["area", "bloco", "area grande", "grupo", "area/bloco"]);
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
  const iEnunciado = idx(["enunciado", "trecho enunciado", "texto da questao", "texto questao"]);
  const iGabarito = idx(["gabarito", "resposta correta", "alternativa correta"]);

  if (iNumero < 0) {
    return {
      rows: [],
      avisos: [
        "Cabeçalho sem coluna de número (ex.: «Número da Questão»).",
        `Cabeçalho lido: ${headerRaw.slice(0, 8).join(" | ")}`,
      ],
    };
  }

  if (iMateria < 0 && iAssunto < 0) {
    return {
      rows: [],
      avisos: [
        "Cabeçalho sem colunas Matéria/Assunto.",
        `Cabeçalho lido: ${headerRaw.slice(0, 8).join(" | ")}`,
      ],
    };
  }

  const rows: ProvaQuestaoRow[] = [];
  let linhasIgnoradas = 0;

  for (let l = 1; l < lines.length; l++) {
    const cols = splitCsvLine(lines[l], delimiter);
    const numero = parseInt(cols[iNumero]?.replace(/\D/g, "") ?? "", 10);
    if (isNaN(numero) || numero <= 0) {
      linhasIgnoradas++;
      continue;
    }

    const materia = (iMateria >= 0 ? cols[iMateria] : "")?.trim();
    const assunto = (iAssunto >= 0 ? cols[iAssunto] : "")?.trim();
    if (!materia && !assunto) {
      linhasIgnoradas++;
      continue;
    }

    let gabarito: string | undefined;
    if (incluirGabarito && iGabarito >= 0) {
      const letra = cols[iGabarito]?.toUpperCase().replace(/[^A-E]/g, "").slice(0, 1);
      if (letra && /^[A-E]$/.test(letra)) gabarito = letra;
    }

    rows.push({
      numero,
      areaBloco: iArea >= 0 ? cols[iArea]?.trim() || undefined : undefined,
      materia: materia || assunto || "A classificar",
      assunto: assunto || materia || "A classificar",
      conhecimentoExigido: iConhec >= 0 ? cols[iConhec]?.trim() || undefined : undefined,
      nivelDificuldade: iDificuldade >= 0 ? cols[iDificuldade]?.trim() || undefined : undefined,
      observacoes: iObs >= 0 ? cols[iObs]?.trim() || undefined : undefined,
      enunciado: iEnunciado >= 0 ? cols[iEnunciado]?.trim() || undefined : undefined,
      gabarito,
    });
  }

  if (linhasIgnoradas > 0) {
    avisos.push(`${linhasIgnoradas} linha(s) ignorada(s) (sem número ou sem matéria/assunto).`);
  }

  if (rows.length === 0) {
    avisos.push(
      "Nenhuma questão válida encontrada. Confira separador (vírgula ou ;) e nomes das colunas."
    );
  }

  return { rows, avisos };
}
