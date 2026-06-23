import { escopoIdParaTaxonomy } from "@/lib/taxonomy-catalog-bridge";
import { mapMateriaAssuntoToTaxonomy } from "@/lib/prova-catalog";
import { derivarClassNode } from "./derivar-class-node";

export type QuestaoComClassificacao = {
  materia: string;
  assunto: string;
  conhecimentoEscopoId?: string | null;
};

/**
 * Deriva materiaId/temaId da taxonomy grossa para UI/relatório.
 * Prioriza escopoId (catálogo N2) via bridge; fallback para strings legadas.
 */
export function taxonomyFromQuestao(questao: QuestaoComClassificacao): {
  materiaId?: string;
  temaId?: string;
} {
  if (questao.conhecimentoEscopoId) {
    const node = derivarClassNode(questao.conhecimentoEscopoId);
    if (node) {
      const tax = escopoIdParaTaxonomy(
        questao.conhecimentoEscopoId,
        node.materiaId
      );
      if (tax) return tax;
    }
  }

  return mapMateriaAssuntoToTaxonomy(questao.materia, questao.assunto);
}
