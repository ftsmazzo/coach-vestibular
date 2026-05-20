/** Extrai texto de PDF no servidor (Node). */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const mod = await import("pdf-parse");
    const pdfParse =
      typeof mod === "function"
        ? mod
        : (mod as { default?: (data: Buffer) => Promise<{ text: string }> }).default;
    if (!pdfParse) throw new Error("módulo pdf-parse indisponível");
    const result = await pdfParse(buffer);
    return result.text?.trim() ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    throw new Error(`Falha ao ler PDF: ${msg}. Cole o texto manualmente ou use CSV.`);
  }
}
