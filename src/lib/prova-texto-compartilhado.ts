/** Texto de apoio compartilhado entre questões consecutivas (ex.: "Responda às questões 4 a 8"). */

type QuestaoTextoMin = {
  id: string;
  numero: number;
  idiomaVariante?: string | null;
  enunciado?: string | null;
};

const RE_INTERVALO_QUESTOES =
  /(?:quest(?:ão|ões|ao|oes)|perguntas?)\s*(?:de\s*)?(\d{1,3})\s*(?:a|à|até|-)\s*(\d{1,3})/i;

function enunciadoLen(q: QuestaoTextoMin): number {
  return q.enunciado?.trim().length ?? 0;
}

/** Detecta se o enunciado anuncia intervalo compartilhado que inclui `numero`. */
export function intervaloTextoCompartilhado(
  enunciado: string | null | undefined,
  numero: number
): boolean {
  const t = enunciado?.trim();
  if (!t) return false;
  const m = RE_INTERVALO_QUESTOES.exec(t);
  if (!m) return false;
  const ini = parseInt(m[1], 10);
  const fim = parseInt(m[2], 10);
  return numero >= ini && numero <= fim && numero > ini;
}

/**
 * Para questões do intervalo sem texto longo próprio, reutiliza o texto da questão
 * âncora (ex.: Q4 com "leia o texto… questões 4 a 8") como textoBase na classificação.
 */
export function resolverTextoCompartilhado(
  q: QuestaoTextoMin,
  questoes: QuestaoTextoMin[]
): string | null {
  const en = q.enunciado?.trim() ?? "";
  if (en.length > 500) return null;

  const variante = q.idiomaVariante ?? "COMUM";
  const mesmaTrilha = questoes
    .filter((x) => (x.idiomaVariante ?? "COMUM") === variante)
    .sort((a, b) => a.numero - b.numero);

  const idx = mesmaTrilha.findIndex((x) => x.id === q.id);
  if (idx <= 0) return null;

  for (let i = idx - 1; i >= Math.max(0, idx - 6); i--) {
    const prev = mesmaTrilha[i];
    const prevEn = prev.enunciado?.trim() ?? "";
    if (prevEn.length < 180) continue;

    if (intervaloTextoCompartilhado(prevEn, q.numero)) {
      return prevEn;
    }

    if (en.length < 220 && prevEn.length > en.length + 120 && q.numero === prev.numero + 1) {
      return prevEn;
    }
  }

  return null;
}
