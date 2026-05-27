/** Normaliza telefone para armazenamento (só dígitos, com DDI 55 se BR). */
export function normalizarTelefone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
}

export function formatarTelefoneExibicao(stored: string | null | undefined): string {
  if (!stored) return "";
  const d = stored.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const local = d.slice(2);
    if (local.length === 11) {
      return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
  }
  return `+${d}`;
}
