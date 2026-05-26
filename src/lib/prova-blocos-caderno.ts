import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import { assuntoPadraoMateria } from "@/lib/prova-heuristicas";
import { normalizarLabelAssunto, normalizarLabelMateria } from "@/lib/taxonomia-validacao";

export interface InfoBlocoCaderno {
  numero: number;
  materia: string;
  assunto: string;
  areaBloco: string;
  tituloCabecalho: string;
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Cabeçalhos de bloco UFU/vestibular → matéria da taxonomia. */
const REGRAS_CABECALHO: Array<{
  test: (linha: string) => boolean;
  materia: string;
  assunto?: string;
  areaBloco: string;
}> = [
  {
    test: (l) => /matematica\s+e\s+suas\s+tecnologias/.test(norm(l)) || /^\s*matematica\s*$/i.test(l),
    materia: "Matemática",
    areaBloco: "Matemática e suas tecnologias",
  },
  {
    test: (l) => /lingua\s+inglesa|ingles\s+e\s+suas|teste\s+de\s+ingles/i.test(norm(l)),
    materia: "Inglês",
    areaBloco: "Língua Inglesa",
  },
  {
    test: (l) => /lingua\s+espanhola|espanhol\s+e\s+suas/i.test(norm(l)),
    materia: "Espanhol",
    areaBloco: "Língua Espanhola",
  },
  {
    test: (l) =>
      /lingua\s+portuguesa|linguagens,?\s+codigos|linguagens\s+e\s+codigos/i.test(norm(l)),
    materia: "Português",
    areaBloco: "Linguagens, códigos e suas tecnologias",
  },
  {
    test: (l) => /^\s*biologia\s*$/i.test(l) || /\bbiologia\b/i.test(l) && l.length < 80,
    materia: "Biologia",
    areaBloco: "Ciências da Natureza",
  },
  {
    test: (l) => /^\s*fisica\s*$/i.test(l) || /\bfisica\b/i.test(l) && l.length < 80,
    materia: "Física",
    areaBloco: "Ciências da Natureza",
  },
  {
    test: (l) => /^\s*quimica\s*$/i.test(l) || /\bquimica\b/i.test(l) && l.length < 80,
    materia: "Química",
    areaBloco: "Ciências da Natureza",
  },
  {
    test: (l) =>
      /ciencias\s+da\s+natureza|natureza\s+e\s+suas\s+tecnologias/i.test(norm(l)),
    materia: "",
    areaBloco: "Ciências da Natureza e suas tecnologias",
  },
  {
    test: (l) => /^\s*sociologia\s*$/i.test(l) || /\bsociologia\b/i.test(l) && l.length < 90,
    materia: "Sociologia",
    areaBloco: "Ciências Humanas",
  },
  {
    test: (l) => /^\s*filosofia\s*$/i.test(l) || /\bfilosofia\b/i.test(l) && l.length < 90,
    materia: "Filosofia",
    areaBloco: "Ciências Humanas",
  },
  {
    test: (l) => /^\s*historia\s*$/i.test(l) || /\bhistoria\b/i.test(l) && l.length < 90,
    materia: "História",
    areaBloco: "Ciências Humanas",
  },
  {
    test: (l) => /^\s*geografia\s*$/i.test(l) || /\bgeografia\b/i.test(l) && l.length < 90,
    materia: "Geografia",
    areaBloco: "Ciências Humanas",
  },
  {
    test: (l) =>
      /ciencias\s+humanas|humanas\s+e\s+suas\s+tecnologias/i.test(norm(l)),
    materia: "",
    areaBloco: "Ciências Humanas e suas tecnologias",
  },
  {
    test: (l) => /^tipo\s*\d+\s*$/i.test(l.trim()),
    materia: "",
    areaBloco: l.trim(),
  },
];

function linhaEhCabecalhoBloco(linha: string): boolean {
  const t = linha.trim();
  if (t.length < 3 || t.length > 120) return false;
  if (/quest[aã]o\s*\d|^\d{1,3}\s*[.)]/i.test(t)) return false;
  if (/processo\s+seletivo|edital\s+dirps|ufu\s*\/\s*20\d{2}/i.test(t) && t.length > 40) {
    return false;
  }
  const letras = t.replace(/[^A-Za-zÀ-ú]/g, "");
  if (letras.length < 4) return false;
  const maiusculas = t.replace(/[^A-ZÀ-Ú]/g, "").length;
  const ratio = maiusculas / Math.max(letras.length, 1);
  const matchRegra = REGRAS_CABECALHO.some((r) => r.test(t));
  return matchRegra || (ratio > 0.55 && t.length < 70);
}

function cabecalhoParaBloco(linha: string): {
  materia: string;
  assunto: string;
  areaBloco: string;
  titulo: string;
} | null {
  const t = linha.trim();
  if (!linhaEhCabecalhoBloco(t)) return null;

  for (const regra of REGRAS_CABECALHO) {
    if (!regra.test(t)) continue;
    const materia = regra.materia;
    const assunto = regra.assunto ?? (materia ? assuntoPadraoMateria(materia) : "");
    return {
      materia,
      assunto,
      areaBloco: regra.areaBloco,
      titulo: t,
    };
  }

  if (/^[A-ZÀ-Ú0-9\s,–—-]{4,}$/.test(t) && t.length < 70) {
    return { materia: "", assunto: "", areaBloco: t, titulo: t };
  }
  return null;
}

interface MarcaQuestao {
  numero: number;
  pos: number;
}

interface MarcaCabecalho {
  pos: number;
  materia: string;
  assunto: string;
  areaBloco: string;
  titulo: string;
}

function marcasQuestoes(texto: string): MarcaQuestao[] {
  const marcas: MarcaQuestao[] = [];
  const re =
    /(?:^|\n)\s*(?:(?:Quest[aã]o|QUEST[AÃ]O)\s*)?(\d{1,3})\s*[.)]\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const numero = parseInt(m[1], 10);
    if (numero > 0 && numero <= 300) marcas.push({ numero, pos: m.index });
  }
  marcas.sort((a, b) => a.pos - b.pos);
  return marcas;
}

function marcasCabecalhos(texto: string): MarcaCabecalho[] {
  const out: MarcaCabecalho[] = [];
  let pos = 0;
  for (const line of texto.split(/\n/)) {
    const bloco = cabecalhoParaBloco(line);
    if (bloco) {
      out.push({
        pos,
        materia: bloco.materia,
        assunto: bloco.assunto,
        areaBloco: bloco.areaBloco,
        titulo: bloco.titulo,
      });
    }
    pos += line.length + 1;
  }
  return out;
}

/** Mapa questão → matéria/assunto inferidos pelos títulos do caderno (PDF). */
export function extrairMapaBlocosDoCaderno(texto: string): Map<number, InfoBlocoCaderno> {
  const mapa = new Map<number, InfoBlocoCaderno>();
  const t = texto.replace(/\r\n/g, "\n");
  if (t.length < 200) return mapa;

  const questoes = marcasQuestoes(t);
  const cabecalhos = marcasCabecalhos(t);
  if (questoes.length === 0 || cabecalhos.length === 0) return mapa;

  let cabIdx = 0;
  let blocoAtual = cabecalhos[0];

  for (const q of questoes) {
    while (cabIdx + 1 < cabecalhos.length && cabecalhos[cabIdx + 1].pos <= q.pos) {
      cabIdx++;
      blocoAtual = cabecalhos[cabIdx];
    }

    if (!blocoAtual.materia) continue;

    mapa.set(q.numero, {
      numero: q.numero,
      materia: blocoAtual.materia,
      assunto: blocoAtual.assunto,
      areaBloco: blocoAtual.areaBloco,
      tituloCabecalho: blocoAtual.titulo,
    });
  }

  return mapa;
}

export function mesclarTextoParaBlocos(
  textoProva: string,
  questoes: QuestaoExtraida[]
): string {
  const partes = [textoProva.trim()];
  for (const q of questoes) {
    if (q.trechoEnunciado.trim().length > 30) {
      partes.push(`\n\nQuestão ${q.numero}\n${q.trechoEnunciado}`);
    }
  }
  return partes.filter(Boolean).join("\n");
}

/**
 * Aplica matéria/assunto do cabeçalho do caderno (prioridade sobre IA genérica).
 */
export function aplicarBlocosDoCaderno(
  questoes: QuestaoExtraida[],
  textoCaderno: string
): { questoes: QuestaoExtraida[]; avisos: string[] } {
  const avisos: string[] = [];
  const mapa = extrairMapaBlocosDoCaderno(textoCaderno);
  if (mapa.size === 0) {
    avisos.push(
      "Nenhum cabeçalho de bloco (ex.: MATEMÁTICA, SOCIOLOGIA) detectado no texto — classificação só pela IA."
    );
    return { questoes, avisos };
  }

  let aplicadas = 0;
  const blocosVistos = new Set<string>();

  for (const q of questoes) {
    const info = mapa.get(q.numero);
    if (!info?.materia) {
      if (info?.areaBloco) q.areaBloco = info.areaBloco;
      continue;
    }

    q.materia = normalizarLabelMateria(info.materia);
    q.assunto = normalizarLabelAssunto(q.materia, info.assunto);
    q.areaBloco = info.areaBloco;
    q.observacoes =
      q.observacoes ??
      `Matéria definida pelo cabeçalho do caderno: «${info.tituloCabecalho}».`;
    aplicadas++;
    blocosVistos.add(info.tituloCabecalho);
  }

  avisos.push(
    `Caderno: ${aplicadas} questão(ões) ancoradas em ${blocosVistos.size} bloco(s) detectado(s) (${[...blocosVistos].slice(0, 5).join("; ")}${blocosVistos.size > 5 ? "…" : ""}).`
  );
  return { questoes, avisos };
}

export function materiaDoCadernoParaQuestao(
  numero: number,
  textoCaderno: string
): InfoBlocoCaderno | undefined {
  return extrairMapaBlocosDoCaderno(textoCaderno).get(numero);
}
