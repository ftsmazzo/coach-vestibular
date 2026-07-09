/**
 * Rótulos amigáveis para UI da Jornada — sem códigos internos (mat, quim, …).
 */
import { getMateriaLabel } from "@/lib/taxonomy";

const N1_CATALOGO: Record<string, string> = {
  mat: "Matemática",
  matematica: "Matemática",
  bio: "Biologia",
  biologia: "Biologia",
  quim: "Química",
  quimica: "Química",
  fis: "Física",
  fisica: "Física",
  hist: "História",
  historia: "História",
  geo: "Geografia",
  geografia: "Geografia",
  soc: "Sociologia",
  sociologia: "Sociologia",
  fil: "Filosofia",
  filosofia: "Filosofia",
  ing: "Inglês",
  ingles: "Inglês",
  port: "Português",
  portugues: "Português",
};

/** Abrevia nome longo de prova para resumos (UNESP, FAMERP, …). */
export function abreviarNomeProva(nome: string): string {
  const upper = nome.toUpperCase();
  if (upper.includes("UNESP")) return "UNESP";
  if (upper.includes("FAMERP")) return "FAMERP";
  if (upper.includes("ENEM")) return "ENEM";
  if (upper.includes("FUVEST")) return "Fuvest";
  if (upper.includes("UNICAMP")) return "Unicamp";
  const trecho = nome.split(" — ")[0]?.trim() || nome.split(" - ")[0]?.trim();
  if (trecho && trecho.length <= 28) return trecho;
  return nome.length > 28 ? `${nome.slice(0, 25)}…` : nome;
}

export function labelMateriaEscopo(escopoId: string | null | undefined): string | null {
  if (!escopoId?.trim()) return null;
  const n1 = escopoId.split(".")[0]?.toLowerCase();
  if (!n1) return null;
  const label = N1_CATALOGO[n1] ?? getMateriaLabel(n1);
  if (label === n1 || label === escopoId) return N1_CATALOGO[n1] ?? null;
  return label;
}

/** Rótulo de matéria/área para cabeçalhos — nunca exibe "mat" cru. */
/** Rótulo amigável para metaMateria persistida (ex.: "mat" → "Matemática · Geometria plana"). */
export function formatarRotuloMateriaCiclo(
  metaMateria: string | null | undefined,
  metaEscopoId?: string | null,
  metaTitulo?: string | null
): string | null {
  if (!metaMateria && !metaEscopoId) return null;
  const escopoLabel =
    metaTitulo?.replace(/^Semana \d+:\s*/i, "").replace(/^Dominar:\s*/i, "").trim() ?? "";
  return rotuloFocoMateria(metaEscopoId, escopoLabel, metaMateria);
}

export function rotuloFocoMateria(
  escopoId: string | null | undefined,
  escopoLabel: string,
  materiaFallback?: string | null
): string {
  const materia = labelMateriaEscopo(escopoId) ?? materiaFallback ?? null;
  if (!materia) return escopoLabel;
  if (isEscopoGeometriaPlana(escopoId ?? "", escopoLabel)) {
    return `${materia} · Geometria plana`;
  }
  if (materia.toLowerCase() === escopoLabel.toLowerCase()) return materia;
  return materia;
}

function isEscopoGeometriaPlana(escopoId: string, label: string): boolean {
  const s = `${escopoId} ${label}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    s.includes("soma_angulos") ||
    s.includes("soma de angulos") ||
    s.includes("angulos_poligonos") ||
    s.includes("geometria_plana")
  );
}
