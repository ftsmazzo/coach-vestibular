import type { AreaBlocoId } from "@/lib/areas-bloco";
import { areaBlocoIdDeLabel, inferirAreaBlocoPorMateria } from "@/lib/areas-bloco";
import {
  heuristicaHumanasDisciplina,
  heuristicaLinguagensDisciplina,
} from "@/lib/enem-classificar/heuristica-roteamento-disciplina";
import { triarMateriaNatureza } from "@/lib/enem-classificar/triagem-natureza";
import { triarNaturezaTransversal } from "@/lib/enem-classificar/triagem-natureza-transversal";
import { fisicaPrevaleceSobreMatematica } from "@/lib/enem-classificar/fisica-vs-matematica";
import { inferirMateriaPorEnunciado } from "@/lib/prova-heuristicas";
import {
  detectarPassagemEspanhol,
  detectarPassagemIngles,
  textoIndicaPortuguesInterpretacao,
} from "@/lib/prova-materia-ajuste";

export type AreaMacro = AreaBlocoId;

export type ResultadoAreaMacro = {
  area: AreaMacro;
  confianca: number;
  motivo: string;
  via: "conteudo" | "area_bloco" | "materia_legada";
};

const MATERIA_PARA_AREA: Record<string, AreaMacro> = {
  Português: "linguagens",
  Literatura: "linguagens",
  Inglês: "linguagens",
  Espanhol: "linguagens",
  História: "humanas",
  Geografia: "humanas",
  Filosofia: "humanas",
  Sociologia: "humanas",
  Biologia: "natureza",
  Física: "natureza",
  Química: "natureza",
  Matemática: "exatas",
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function pontuarPadroes(texto: string, padroes: RegExp[]): number {
  const t = norm(texto);
  let n = 0;
  for (const p of padroes) {
    if (p.test(t)) n++;
  }
  return n;
}

/** Pontua as 4 áreas macro a partir do texto da questão (enunciado + alternativas). */
export function pontuarAreasMacroPorConteudo(
  texto: string,
  opts?: { idiomaVariante?: string | null }
): Record<AreaMacro, { score: number; motivos: string[] }> {
  const out: Record<AreaMacro, { score: number; motivos: string[] }> = {
    linguagens: { score: 0, motivos: [] },
    humanas: { score: 0, motivos: [] },
    natureza: { score: 0, motivos: [] },
    exatas: { score: 0, motivos: [] },
  };

  const t = texto.trim();
  if (t.length < 20) return out;

  const v = opts?.idiomaVariante ?? "COMUM";
  if (v === "INGLES" || v === "ESPANHOL") {
    out.linguagens.score += 4;
    out.linguagens.motivos.push(`variante ${v}`);
  }

  const lingHeur = heuristicaLinguagensDisciplina(t);
  if (lingHeur) {
    out.linguagens.score += lingHeur.confianca * 4;
    out.linguagens.motivos.push(lingHeur.motivo);
  }

  if (detectarPassagemIngles(t) || detectarPassagemEspanhol(t)) {
    out.linguagens.score += 2.5;
    out.linguagens.motivos.push("passagem em língua estrangeira");
  }

  if (textoIndicaPortuguesInterpretacao(t)) {
    out.linguagens.score += 1.8;
    out.linguagens.motivos.push("interpretação de texto em português");
  }

  const humHeur = heuristicaHumanasDisciplina(t);
  if (humHeur) {
    out.humanas.score += humHeur.confianca * 4;
    out.humanas.motivos.push(humHeur.motivo);
  }

  const materiaHeur = inferirMateriaPorEnunciado(t);
  if (materiaHeur) {
    const area = MATERIA_PARA_AREA[materiaHeur];
    if (area) {
      out[area].score += 3;
      out[area].motivos.push(`matéria inferida: ${materiaHeur}`);
    }
  }

  const natTri = triarMateriaNatureza(t);
  if (natTri.materia && natTri.materia !== "Transversal") {
    out.natureza.score += natTri.confianca * 4;
    out.natureza.motivos.push(`triagem natureza: ${natTri.materia}`);
  }

  const natTrans = triarNaturezaTransversal(t);
  if (natTrans.catalogoId) {
    out.natureza.score += natTrans.confianca * 3.5;
    out.natureza.motivos.push(`natureza transversal: ${natTrans.motivo}`);
  }

  const matScore = pontuarPadroes(t, [
    /\bfuncao de variavel\b/,
    /\by\s*=\s*f\s*\(/,
    /\bmatriz quadrada\b/,
    /\bdeterminante\b/,
    /\btetraedro\b/,
    /\bporcentagem\b/,
    /\bproporcao\b/,
    /\bregra de tres\b/,
    /\bgrafico\b.*\b(eixo|funcao|valor)\b/,
    /\bsistema de equacoes\b/,
    /\bgeometria (plana|espacial)\b/,
    /\bprobabilidade\b/,
    /\bcombinatoria\b/,
    /\blogaritmo\b/,
    /\bprogressao (aritmetica|geometrica)\b/,
  ]);
  if (matScore > 0) {
    out.exatas.score += matScore * 1.5;
    out.exatas.motivos.push(`sinais matemáticos (${matScore})`);
  }

  const fisPrev = fisicaPrevaleceSobreMatematica(t);
  if (fisPrev.prevalece) {
    out.natureza.score += fisPrev.confianca * 3.5;
    out.natureza.motivos.push(`física prevalece: ${fisPrev.motivo}`);
    out.exatas.score = Math.max(0, out.exatas.score - 1);
  }

  const humGeral = pontuarPadroes(t, [
    /\bbrasil (republica|imperio|colonia|império|colônia)\b/,
    /\brevolucao (francesa|industrial|russa)\b/,
    /\bguerra (mundial|fria)\b/,
    /\bimperialismo\b/,
    /\bditadura\b/,
    /\bestado (novo|democratico|nacao)\b/,
    /\bmovimento (social|operario|operário)\b/,
    /\b(cidadania|democracia|constituicao|constituição)\b/,
    /\b(kant|platão|platao|aristoteles|descartes|nietzsche)\b/,
    /\b(etica|moral|filosofia)\b/,
  ]);
  if (humGeral > 0) {
    out.humanas.score += humGeral * 1.2;
    out.humanas.motivos.push(`contexto humanas (${humGeral})`);
  }

  return out;
}

/** Inferência de área só pelo conteúdo (Fase 4 — sem areaBloco/materia). */
export function inferirAreaMacroPorConteudo(
  texto: string,
  opts?: { idiomaVariante?: string | null; confiancaMinima?: number }
): ResultadoAreaMacro | null {
  const min = opts?.confiancaMinima ?? 0.45;
  const scores = pontuarAreasMacroPorConteudo(texto, opts);

  const ranked = (Object.entries(scores) as [AreaMacro, { score: number; motivos: string[] }][])
    .filter(([, v]) => v.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (ranked.length === 0) return null;

  const [area, best] = ranked[0]!;
  const segundo = ranked[1]?.[1].score ?? 0;
  const margem = best.score - segundo;
  const confianca = Math.min(0.98, best.score / 5 + margem * 0.08);

  if (confianca < min && best.score < 1.8) return null;

  return {
    area,
    confianca,
    motivo: best.motivos.slice(0, 2).join("; ") || `score=${best.score.toFixed(1)}`,
    via: "conteudo",
  };
}

/**
 * Resolve área macro para N1/N2: conteúdo primeiro, cadastro legado só como fallback.
 */
export function resolverAreaMacroQuestao(
  texto: string,
  opts?: {
    areaBloco?: string | null;
    materia?: string | null;
    idiomaVariante?: string | null;
  }
): ResultadoAreaMacro | null {
  const porConteudo = inferirAreaMacroPorConteudo(texto, {
    idiomaVariante: opts?.idiomaVariante,
    confiancaMinima: 0.48,
  });
  if (porConteudo && porConteudo.confianca >= 0.52) {
    return porConteudo;
  }

  const areaCadastro = areaBlocoIdDeLabel(opts?.areaBloco);
  if (areaCadastro) {
    return {
      area: areaCadastro,
      confianca: 0.85,
      motivo: `areaBloco cadastrado (${opts?.areaBloco})`,
      via: "area_bloco",
    };
  }

  const materia = opts?.materia?.trim();
  if (materia && materia !== "A classificar") {
    const areaMateria = areaBlocoIdDeLabel(inferirAreaBlocoPorMateria(materia));
    if (areaMateria) {
      return {
        area: areaMateria,
        confianca: 0.75,
        motivo: `matéria legada (${materia})`,
        via: "materia_legada",
      };
    }
  }

  if (porConteudo) return porConteudo;

  return null;
}
