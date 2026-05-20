/** Data em que o aluno FEZ a prova (não o dia do cadastro no app). */

/** Converte input type="date" (YYYY-MM-DD) para Date estável (meio-dia UTC). */
export function parseDataAplicacao(iso: string): Date {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) throw new Error("DATA_INVALIDA");
    return d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(Date.UTC(y, mo, day, 12, 0, 0, 0));
}

export function formatDataAplicacao(date: Date): string {
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear();
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function dataAplicacaoParaInput(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
