import { taxonomy } from "./taxonomy";
import type { MetaPoliticaIdiomas } from "./prova-idioma";
import { variantesExigidasPorNumero } from "./prova-idioma";
import { resolverNumerosGradeProva } from "./prova-numeracao";

/** Mapeia texto de matéria/assunto da prova para ids da taxonomia (diagnóstico) */
export function mapMateriaAssuntoToTaxonomy(materia: string, assunto: string) {
  const mNorm = materia
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const aNorm = assunto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  let materiaId: string | undefined;
  if (mNorm.includes("ingles") || mNorm === "english" || mNorm.includes("lingua inglesa")) {
    materiaId = "ingles";
  } else if (mNorm.includes("espanhol") || mNorm === "spanish") {
    materiaId = "espanhol";
  } else if (mNorm.includes("filosof")) {
    materiaId = "filosofia";
  } else if (mNorm.includes("sociolog")) {
    materiaId = "sociologia";
  } else if (mNorm.includes("lingua portuguesa") || mNorm === "lp") {
    materiaId = "portugues";
  }
  for (const m of taxonomy.materias) {
    if (materiaId) break;
    const label = m.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (mNorm.includes(label) || label.includes(mNorm) || mNorm.includes(m.id)) {
      materiaId = m.id;
      break;
    }
  }

  let temaId: string | undefined;
  if (materiaId) {
    const mat = taxonomy.materias.find((m) => m.id === materiaId);
    for (const t of mat?.temas ?? []) {
      const tl = t.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      if (aNorm.includes(tl) || tl.includes(aNorm) || aNorm.includes(t.id.replace(/_/g, " "))) {
        temaId = t.id;
        break;
      }
    }
    if (!temaId && mat?.temas[0]) temaId = mat.temas[0].id;
  }

  return { materiaId, temaId };
}

export function syncProvaGabaritoStatus(
  questoes: Array<{ numero: number; idiomaVariante?: string; gabarito: string | null }>,
  meta?: MetaPoliticaIdiomas & { totalQuestoes?: number; dia?: number | null; banca?: string }
): boolean {
  if (questoes.length === 0) return false;

  const numeros =
    meta?.totalQuestoes != null
      ? resolverNumerosGradeProva({
          totalQuestoes: meta.totalQuestoes,
          dia: meta.dia,
          banca: meta.banca,
          numerosCadastrados: questoes.map((q) => q.numero),
        })
      : [...new Set(questoes.map((q) => q.numero))].sort((a, b) => a - b);

  for (const numero of numeros) {
    for (const variante of variantesExigidasPorNumero(numero, meta ?? {})) {
      const q = questoes.find(
        (x) => x.numero === numero && (x.idiomaVariante ?? "COMUM") === variante
      );
      if (!q?.gabarito || !/^[A-Ea-e]$/.test(q.gabarito)) return false;
    }
  }
  return numeros.length > 0;
}
