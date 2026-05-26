/** Extrai trechos de enunciado por número a partir do texto bruto da prova (PDF/cola). */

export function extrairTrechosPorNumero(
  texto: string,
  numerosAlvo?: number[],
  opts?: { maxTrecho?: number }
): Map<number, string> {
  const maxTrecho = opts?.maxTrecho ?? 2500;
  const textoNorm = texto.replace(/\r\n/g, "\n").trim();
  if (!textoNorm) return new Map();

  const marcas: Array<{ numero: number; start: number }> = [];
  const re =
    /(?:^|\n)\s*(?:(?:Questão|QUESTÃO|Questao)\s*)?(\d{1,3})\s*[.)]\s*/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(textoNorm)) !== null) {
    const numero = parseInt(m[1], 10);
    if (numero > 0 && numero <= 300) {
      marcas.push({ numero, start: m.index });
    }
  }

  if (marcas.length === 0) {
    const re2 = /(?:^|\n)\s*(\d{1,2})\s*[.)]\s+/g;
    while ((m = re2.exec(textoNorm)) !== null) {
      const numero = parseInt(m[1], 10);
      if (numero > 0 && numero <= 300) {
        marcas.push({ numero, start: m.index });
      }
    }
  }

  marcas.sort((a, b) => a.start - b.start);

  const map = new Map<number, string>();
  for (let i = 0; i < marcas.length; i++) {
    const { numero, start } = marcas[i];
    const end = i + 1 < marcas.length ? marcas[i + 1].start : textoNorm.length;
    let trecho = textoNorm.slice(start, end).trim();
    if (maxTrecho > 0 && trecho.length > maxTrecho) {
      trecho = `${trecho.slice(0, maxTrecho)}…`;
    }
    if (!map.has(numero)) map.set(numero, trecho);
  }

  if (!numerosAlvo?.length) return map;

  const filtrado = new Map<number, string>();
  for (const n of numerosAlvo) {
    const t = map.get(n);
    if (t) filtrado.set(n, t);
  }
  return filtrado;
}
