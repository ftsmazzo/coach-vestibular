/** Extrai texto de PDF no servidor (Node). Usa pdf-parse v2 (classe PDFParse). */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text?.trim() ?? "";
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    throw new Error(`Falha ao ler PDF: ${msg}. Cole o texto manualmente ou use CSV.`);
  }
}
