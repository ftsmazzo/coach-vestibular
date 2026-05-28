import { extrairTrechosPorNumero } from "@/lib/prova-texto-parse";

/** Mínimo de caracteres esperado no texto da prova para extração confiável. */
export function minCaracteresTextoProva(totalQuestoes: number): number {
  const n = Math.max(1, totalQuestoes);
  return Math.max(1500, Math.min(n * 80, 400_000));
}

export function textoProvaPareceIncompleto(
  caracteres: number,
  totalQuestoes: number
): boolean {
  return caracteres < minCaracteresTextoProva(totalQuestoes);
}

/** Estima quantas questões aparecem no trecho colado (completar faltantes / uma questão). */
export function estimarQuestoesNoTexto(texto: string): number {
  const trechos = extrairTrechosPorNumero(texto.trim(), undefined, { maxTrecho: 0 });
  if (trechos.size > 0) return trechos.size;
  const marcas = texto.match(/(?:^|\n)\s*(?:quest[ãa]o\s*)?(\d{1,3})\s*[.)]/gim);
  return Math.max(1, marcas?.length ?? 1);
}

/** Mínimo ao adicionar só questões faltantes — não exige a prova inteira. */
export function minCaracteresTextoParcial(texto: string, totalQuestoes: number): number {
  const n = estimarQuestoesNoTexto(texto);
  return Math.min(minCaracteresTextoProva(totalQuestoes), Math.max(80, n * 45));
}

export function textoParcialPareceIncompleto(
  caracteres: number,
  texto: string,
  totalQuestoes: number
): boolean {
  return caracteres < minCaracteresTextoParcial(texto, totalQuestoes);
}
