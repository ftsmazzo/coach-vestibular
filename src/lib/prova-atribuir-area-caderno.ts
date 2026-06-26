import { prisma } from "@/lib/prisma";
import { extractTextFromPdf } from "@/lib/pdf-text";
import { areaBlocoIdDeLabel } from "@/lib/areas-bloco";
import { aplicarBlocosDoCaderno } from "@/lib/prova-blocos-caderno";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";
import { readStoredFile, storedFileExists } from "@/lib/upload-storage";

/**
 * Infere areaBloco a partir dos cabeçalhos do PDF salvo (FAMERP, VNSP, UFMS…).
 * Não altera matéria — só preenche área quando ainda está vazia.
 */
export async function atribuirAreasProvaDoCaderno(
  provaId: string
): Promise<{ atualizadas: number; avisos: string[] }> {
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    include: { questoes: true },
  });
  if (!prova) {
    return { atualizadas: 0, avisos: ["Prova não encontrada."] };
  }

  const semArea = prova.questoes.filter((q) => !areaBlocoIdDeLabel(q.areaBloco));
  if (semArea.length === 0) {
    return { atualizadas: 0, avisos: ["Todas as questões já têm área/bloco definido."] };
  }

  if (!prova.cadernoStoragePath || !(await storedFileExists(prova.cadernoStoragePath))) {
    return {
      atualizadas: 0,
      avisos: [
        `${semArea.length} questão(ões) sem área — salve o PDF da prova no servidor (extração Pipeline) para inferir blocos automaticamente.`,
      ],
    };
  }

  const lido = await readStoredFile(prova.cadernoStoragePath);
  const texto = await extractTextFromPdf(lido.buffer);
  if (texto.trim().length < 200) {
    return { atualizadas: 0, avisos: ["PDF salvo não gerou texto suficiente para detectar blocos."] };
  }

  const ordenadas = [...prova.questoes].sort(compararPorOrdemExtracao);
  const extraidas = ordenadas.map((q) => ({
    numero: q.numero,
    trechoEnunciado: q.enunciado?.trim() ?? "",
    materia: q.materia,
    assunto: q.assunto,
    areaBloco: q.areaBloco,
  }));

  const { questoes: comBlocos, avisos } = aplicarBlocosDoCaderno(extraidas, texto);

  let atualizadas = 0;
  for (let i = 0; i < ordenadas.length; i++) {
    const db = ordenadas[i]!;
    const inferida = comBlocos[i]?.areaBloco?.trim();
    if (!inferida || db.areaBloco?.trim() === inferida) continue;
    if (!areaBlocoIdDeLabel(inferida)) continue;

    await prisma.provaQuestao.update({
      where: { id: db.id },
      data: { areaBloco: inferida },
    });
    atualizadas++;
  }

  return {
    atualizadas,
    avisos: [
      ...avisos,
      atualizadas > 0
        ? `${atualizadas} questão(ões) receberam área a partir dos cabeçalhos do PDF.`
        : "Nenhuma área nova atribuída — confira se o PDF tem cabeçalhos de bloco reconhecíveis.",
    ],
  };
}
