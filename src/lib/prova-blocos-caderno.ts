import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import { areaBlocoPorId } from "@/lib/areas-bloco";
import { assuntoPadraoMateria, inferirMateriaPorEnunciado } from "@/lib/prova-heuristicas";
import {
  detectarPassagemEspanhol,
  detectarPassagemIngles,
  textoIndicaPortuguesInterpretacao,
} from "@/lib/prova-materia-ajuste";
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

/** Linha de índice/sumário com várias disciplinas — não é cabeçalho de bloco. */
function linhaPareceIndiceOuLista(linha: string): boolean {
  const t = linha.trim();
  if (!t.includes(",")) return false;
  const n = norm(t);
  const rotulos = [
    "historia",
    "geografia",
    "sociologia",
    "filosofia",
    "biologia",
    "fisica",
    "quimica",
    "matematica",
    "portugues",
    "ingles",
    "espanhol",
    "linguagens",
  ];
  const hits = rotulos.filter((r) => n.includes(r)).length;
  return hits >= 2;
}

function linhaEhTituloExato(linha: string, padroes: RegExp[]): boolean {
  const t = linha.trim();
  const n = norm(t);
  return padroes.some((re) => re.test(n) || re.test(t));
}

/** Cabeçalhos de bloco UFU — só títulos explícitos, não menções em listas. */
const REGRAS_CABECALHO: Array<{
  test: (linha: string) => boolean;
  materia: string;
  assunto?: string;
  areaBloco: string;
}> = [
  {
    test: (l) =>
      linhaEhTituloExato(l, [
        /^matematica\s+e\s+suas\s+tecnologias$/i,
        /^matematica$/i,
      ]),
    materia: "Matemática",
    areaBloco: areaBlocoPorId("exatas").label,
  },
  {
    test: (l) =>
      linhaEhTituloExato(l, [
        /^lingua\s+inglesa$/i,
        /^ingles\s+e\s+suas\s+tecnologias$/i,
        /^ingles$/i,
      ]),
    materia: "Inglês",
    areaBloco: areaBlocoPorId("linguagens").label,
  },
  {
    test: (l) =>
      linhaEhTituloExato(l, [
        /^lingua\s+espanhola$/i,
        /^espanhol\s+e\s+suas\s+tecnologias$/i,
        /^espanhol$/i,
      ]),
    materia: "Espanhol",
    areaBloco: areaBlocoPorId("linguagens").label,
  },
  {
    test: (l) => {
      const n = norm(l);
      return (
        /^lingua\s+portuguesa$/.test(n) ||
        (n.startsWith("linguagens") && n.includes("codigos")) ||
        /^linguagens\s+e\s+codigos/.test(n)
      );
    },
    materia: "Português",
    areaBloco: areaBlocoPorId("linguagens").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^biologia$/i]),
    materia: "Biologia",
    areaBloco: areaBlocoPorId("natureza").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^fisica$/i]),
    materia: "Física",
    areaBloco: areaBlocoPorId("natureza").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^quimica$/i]),
    materia: "Química",
    areaBloco: areaBlocoPorId("natureza").label,
  },
  {
    test: (l) =>
      linhaEhTituloExato(l, [
        /^ciencias\s+da\s+natureza\s+e\s+suas\s+tecnologias$/i,
        /^ciencias\s+da\s+natureza$/i,
      ]),
    materia: "",
    areaBloco: areaBlocoPorId("natureza").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^sociologia$/i]),
    materia: "Sociologia",
    areaBloco: areaBlocoPorId("humanas").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^filosofia$/i]),
    materia: "Filosofia",
    areaBloco: areaBlocoPorId("humanas").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^historia$/i]),
    materia: "História",
    areaBloco: areaBlocoPorId("humanas").label,
  },
  {
    test: (l) => linhaEhTituloExato(l, [/^geografia$/i]),
    materia: "Geografia",
    areaBloco: areaBlocoPorId("humanas").label,
  },
  {
    test: (l) =>
      linhaEhTituloExato(l, [
        /^ciencias\s+humanas\s+e\s+suas\s+tecnologias$/i,
        /^ciencias\s+humanas$/i,
      ]),
    materia: "",
    areaBloco: areaBlocoPorId("humanas").label,
  },
];

function linhaEhCabecalhoBloco(linha: string): boolean {
  const t = linha.trim();
  if (t.length < 3 || t.length > 100) return false;
  if (linhaPareceIndiceOuLista(t)) return false;
  if (/quest[aã]o\s*\d|^\d{1,3}\s*[.)]/i.test(t)) return false;
  if (/processo\s+seletivo|edital\s+dirps|ufu\s*\/\s*20\d{2}/i.test(t) && t.length > 45) {
    return false;
  }
  if (/^tipo\s*\d+\s*$/i.test(t)) return true;
  return REGRAS_CABECALHO.some((r) => r.test(t));
}

function cabecalhoParaBloco(linha: string): {
  materia: string;
  assunto: string;
  areaBloco: string;
  titulo: string;
} | null {
  const t = linha.trim();
  if (!linhaEhCabecalhoBloco(t)) return null;

  if (/^tipo\s*\d+\s*$/i.test(t)) {
    return { materia: "", assunto: "", areaBloco: t, titulo: t };
  }

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

  return null;
}

/** Enunciado contradiz o cabeçalho do caderno → não forçar matéria do bloco. */
export function cabecalhoConfiavelParaQuestao(
  q: QuestaoExtraida,
  info: InfoBlocoCaderno
): boolean {
  if (!info.materia) return false;
  const enc = q.trechoEnunciado.trim();
  if (enc.length < 40) return true;

  const m = norm(info.materia);
  const n = norm(enc);

  if (m === "sociologia") {
    if (textoIndicaPortuguesInterpretacao(enc)) return false;
    if (/literatura|entrevista|poema|gramatica|didascalia|sujeito poetico|interpretacao/.test(n)) {
      return false;
    }
    if (detectarPassagemIngles(enc) || detectarPassagemEspanhol(enc)) return false;
  }

  if (m === "portugues" && (detectarPassagemIngles(enc) || detectarPassagemEspanhol(enc))) {
    return false;
  }

  if (m === "ingles" && detectarPassagemEspanhol(enc) && !detectarPassagemIngles(enc)) {
    return false;
  }

  if (m === "espanhol" && detectarPassagemIngles(enc) && !detectarPassagemEspanhol(enc)) {
    return false;
  }

  const inferida = inferirMateriaPorEnunciado(enc);
  if (inferida && norm(inferida) !== m) {
    const idioma = ["ingles", "espanhol", "portugues"];
    const ciencia = ["biologia", "matematica", "fisica", "quimica"];
    if (idioma.includes(norm(inferida)) || ciencia.includes(norm(inferida))) {
      if (m === "sociologia" || m === "historia" || m === "geografia" || m === "filosofia") {
        return false;
      }
    }
  }

  return true;
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

function prioridadeBlocoIdioma(materia: string): number {
  const m = norm(materia);
  if (m === "espanhol") return 0;
  if (m === "ingles") return 10;
  return 5;
}

/** Remove do texto o bloco entre «Língua Espanhola» e o próximo cabeçalho de outra área. */
export function removerTrechosBlocoEspanhol(texto: string): {
  texto: string;
  caracteresRemovidos: number;
  blocosRemovidos: number;
} {
  const t = texto.replace(/\r\n/g, "\n");
  if (t.length < 200) {
    return { texto: t, caracteresRemovidos: 0, blocosRemovidos: 0 };
  }

  const faixas: Array<{ inicio: number; fim: number }> = [];
  let pos = 0;
  let inicioEspanhol: number | null = null;

  for (const line of t.split(/\n/)) {
    const bloco = cabecalhoParaBloco(line);
    if (bloco?.materia === "Espanhol" && inicioEspanhol === null) {
      inicioEspanhol = pos;
    } else if (inicioEspanhol !== null && bloco && bloco.materia !== "Espanhol") {
      faixas.push({ inicio: inicioEspanhol, fim: pos });
      inicioEspanhol = null;
    } else if (inicioEspanhol !== null && /^tipo\s*\d+\s*$/i.test(line.trim())) {
      faixas.push({ inicio: inicioEspanhol, fim: pos });
      inicioEspanhol = null;
    }
    pos += line.length + 1;
  }
  if (inicioEspanhol !== null) {
    faixas.push({ inicio: inicioEspanhol, fim: t.length });
  }

  if (faixas.length === 0) {
    return { texto: t, caracteresRemovidos: 0, blocosRemovidos: 0 };
  }

  let resultado = "";
  let cursor = 0;
  for (const f of faixas) {
    resultado += t.slice(cursor, f.inicio);
    cursor = f.fim;
  }
  resultado += t.slice(cursor);
  const removido = faixas.reduce((s, f) => s + (f.fim - f.inicio), 0);

  return {
    texto: resultado.trim(),
    caracteresRemovidos: removido,
    blocosRemovidos: faixas.length,
  };
}

export function processarTextoProvaIdioma(
  texto: string,
  opts?: { excluirBlocoEspanhol?: boolean }
): { texto: string; avisos: string[] } {
  const excluir = opts?.excluirBlocoEspanhol !== false;
  const avisos: string[] = [];
  if (!excluir) return { texto: texto.replace(/\r\n/g, "\n"), avisos };

  const r = removerTrechosBlocoEspanhol(texto);
  if (r.blocosRemovidos > 0) {
    const restante = r.texto.trim().length;
    const original = texto.trim().length;
    if (restante < Math.max(800, original * 0.12)) {
      avisos.push(
        `Remoção do bloco de Espanhol ignorada — sobraram ${restante} de ${original} caracteres. Desmarque «Ignorar Espanhol» ou reenvie o PDF.`
      );
      return { texto: texto.replace(/\r\n/g, "\n"), avisos };
    }
    avisos.push(
      `Bloco de Espanhol removido do texto (${r.blocosRemovidos} seção(ões), ~${Math.round(r.caracteresRemovidos / 1000)}k caracteres) — prova bilíngue com mesma numeração.`
    );
  }
  return { texto: r.texto, avisos };
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

/** Cabeçalho válido: próximo da questão, não sumário do início do PDF. */
function cabecalhoParaQuestao(
  q: MarcaQuestao,
  cabecalhos: MarcaCabecalho[],
  primeiraQuestaoPos: number
): MarcaCabecalho | null {
  const MAX_ANTES = 12_000;
  let escolhido: MarcaCabecalho | null = null;

  for (const cab of cabecalhos) {
    if (cab.pos > q.pos) continue;
    if (q.pos - cab.pos > MAX_ANTES) continue;
    if (cab.pos < primeiraQuestaoPos && q.pos - cab.pos > 6000) continue;

    if (!escolhido || cab.pos > escolhido.pos) {
      escolhido = cab;
    }
  }
  return escolhido;
}

/** Mapa questão → matéria/assunto inferidos pelos títulos do caderno (PDF). */
export function extrairMapaBlocosDoCaderno(texto: string): Map<number, InfoBlocoCaderno> {
  const mapa = new Map<number, InfoBlocoCaderno>();
  const t = texto.replace(/\r\n/g, "\n");
  if (t.length < 200) return mapa;

  const questoes = marcasQuestoes(t);
  const cabecalhos = marcasCabecalhos(t);
  if (questoes.length === 0 || cabecalhos.length === 0) return mapa;

  const primeiraQuestaoPos = questoes[0].pos;

  for (const q of questoes) {
    const blocoAtual = cabecalhoParaQuestao(q, cabecalhos, primeiraQuestaoPos);
    if (!blocoAtual?.materia) continue;

    const info: InfoBlocoCaderno = {
      numero: q.numero,
      materia: blocoAtual.materia,
      assunto: blocoAtual.assunto,
      areaBloco: blocoAtual.areaBloco,
      tituloCabecalho: blocoAtual.titulo,
    };

    const prev = mapa.get(q.numero);
    if (
      !prev ||
      prioridadeBlocoIdioma(info.materia) > prioridadeBlocoIdioma(prev.materia)
    ) {
      mapa.set(q.numero, info);
    }
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
 * Aplica matéria do cabeçalho só quando o enunciado não contradiz o bloco.
 */
export function aplicarBlocosDoCaderno(
  questoes: QuestaoExtraida[],
  textoCaderno: string,
  opts?: { ignorarBlocoEspanhol?: boolean }
): { questoes: QuestaoExtraida[]; avisos: string[] } {
  const avisos: string[] = [];
  const mapa = extrairMapaBlocosDoCaderno(textoCaderno);
  if (mapa.size === 0) {
    avisos.push(
      "Nenhum cabeçalho de bloco explícito detectado — classificação pela IA e heurísticas."
    );
    return { questoes, avisos };
  }

  let aplicadas = 0;
  let ignoradas = 0;
  const blocosVistos = new Set<string>();

  const ignorarEs = opts?.ignorarBlocoEspanhol !== false;

  for (const q of questoes) {
    const info = mapa.get(q.numero);
    if (!info) continue;

    if (ignorarEs && norm(info.materia) === "espanhol") continue;

    if (info.areaBloco && !info.materia) {
      q.areaBloco = info.areaBloco;
      continue;
    }

    if (!cabecalhoConfiavelParaQuestao(q, info)) {
      ignoradas++;
      if (info.areaBloco) q.areaBloco = info.areaBloco;
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
    `Caderno: ${aplicadas} questão(ões) ancoradas em cabeçalhos (${[...blocosVistos].slice(0, 4).join("; ")}${blocosVistos.size > 4 ? "…" : ""}).`
  );
  if (ignoradas > 0) {
    avisos.push(
      `${ignoradas} questão(ões): cabeçalho do PDF ignorado porque o enunciado indica outra matéria (ex.: Sociologia no índice vs. texto de Português).`
    );
  }
  return { questoes, avisos };
}

export function materiaDoCadernoParaQuestao(
  numero: number,
  textoCaderno: string
): InfoBlocoCaderno | undefined {
  return extrairMapaBlocosDoCaderno(textoCaderno).get(numero);
}
