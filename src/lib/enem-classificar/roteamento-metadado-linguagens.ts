/** Só metadado estrutural (variante EN/ES). Sem regex de conteúdo — roteamento de conteúdo é 100% IA. */

export type RotaDisciplinar = {
  disciplinaId: string;
  criterio: string;
  confianca: number;
  justificativa: string;
  sinalizadorRevisao: boolean;
};

export function aplicarMetadadoVarianteLinguagens(
  idiomaVariante: string | null | undefined,
  idioma: string | null | undefined,
  rota: RotaDisciplinar
): RotaDisciplinar {
  const v = (idiomaVariante ?? idioma ?? "").toLowerCase();

  if (v === "ingles") {
    if (rota.disciplinaId === "ingles") return rota;
    return {
      disciplinaId: "ingles",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.95),
      justificativa: `Metadado variante INGLES; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }

  if (v === "espanhol") {
    if (rota.disciplinaId === "espanhol") return rota;
    return {
      disciplinaId: "espanhol",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.95),
      justificativa: `Metadado variante ESPANHOL; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }

  return rota;
}
