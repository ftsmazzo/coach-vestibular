/**
 * Funções puras de comparação — Etapa 4E-A (sem dependências server-only).
 */
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import type { EscopoAgregadoCanonica } from "@/lib/jornada-evidencia-canonica";

export type DivergenciaAuditoria = {
  origem: string;
  escopoId: string;
  label: string;
  campo: string;
  canonico: number | string;
  encontrado: number | string;
  detalhe: string;
};

function compararCampoNumerico(
  divergencias: DivergenciaAuditoria[],
  origem: string,
  escopoId: string,
  label: string,
  campo: string,
  canonico: number,
  encontrado: number | undefined | null
) {
  if (encontrado == null) return;
  if (canonico !== encontrado) {
    divergencias.push({
      origem,
      escopoId,
      label,
      campo,
      canonico,
      encontrado,
      detalhe: `${origem}: ${campo} canônico=${canonico}, encontrado=${encontrado}`,
    });
  }
}

export function compararDiagnosticoComCanonica(
  agregado: EscopoAgregadoCanonica[],
  baselinePorEscopo: Array<{
    escopoId: string;
    total: number;
    erros: number;
    provasComErro: number;
  }>
): DivergenciaAuditoria[] {
  const divergencias: DivergenciaAuditoria[] = [];
  const canonMap = new Map(agregado.map((e) => [e.escopoId, e]));
  const escoposIndex = indexGlobalEscopos();

  for (const linha of baselinePorEscopo) {
    const canon = canonMap.get(linha.escopoId);
    const label = escoposIndex.get(linha.escopoId)?.escopoLabel ?? linha.escopoId;
    if (!canon) continue;
    compararCampoNumerico(
      divergencias,
      "DiagnosticoInicial.baseline",
      linha.escopoId,
      label,
      "erros",
      canon.erros,
      linha.erros
    );
    compararCampoNumerico(
      divergencias,
      "DiagnosticoInicial.baseline",
      linha.escopoId,
      label,
      "total",
      canon.total,
      linha.total
    );
    compararCampoNumerico(
      divergencias,
      "DiagnosticoInicial.baseline",
      linha.escopoId,
      label,
      "provasComErro",
      canon.provasComErro,
      linha.provasComErro
    );
  }

  return divergencias;
}

export function compararCicloComCanonica(
  agregado: EscopoAgregadoCanonica[],
  metaEscopoId: string | null,
  errosNoEscopo: number | null,
  totalQuestoesNoEscopo: number | null
): DivergenciaAuditoria[] {
  if (!metaEscopoId) return [];
  const canon = agregado.find((e) => e.escopoId === metaEscopoId);
  if (!canon) return [];
  const divergencias: DivergenciaAuditoria[] = [];
  compararCampoNumerico(
    divergencias,
    "CicloInicial.baseline",
    canon.escopoId,
    canon.label,
    "errosNoEscopo",
    canon.erros,
    errosNoEscopo
  );
  compararCampoNumerico(
    divergencias,
    "CicloInicial.baseline",
    canon.escopoId,
    canon.label,
    "totalQuestoesNoEscopo",
    canon.total,
    totalQuestoesNoEscopo
  );
  return divergencias;
}

export type ExamEscopoGrafico = {
  escopoId: string;
  label: string;
  total: number;
  erros: number;
};

export function compararGraficoProvaComCanonica(
  porProvaNome: string,
  escoposCanonica: Array<{ escopoId: string; label: string; total: number; erros: number }>,
  escoposGrafico: ExamEscopoGrafico[]
): DivergenciaAuditoria[] {
  const divergencias: DivergenciaAuditoria[] = [];

  for (const escopoCanon of escoposCanonica) {
    const escopoGrafico = escoposGrafico.find((e) => e.escopoId === escopoCanon.escopoId);
    if (!escopoGrafico) {
      if (escopoCanon.erros > 0) {
        divergencias.push({
          origem: "ExamGraficos",
          escopoId: escopoCanon.escopoId,
          label: escopoCanon.label,
          campo: "escopoAusente",
          canonico: escopoCanon.erros,
          encontrado: 0,
          detalhe: `Gráfico da prova não listou escopo presente na auditoria canônica (${porProvaNome})`,
        });
      }
      continue;
    }
    compararCampoNumerico(
      divergencias,
      `ExamGraficos:${porProvaNome}`,
      escopoCanon.escopoId,
      escopoCanon.label,
      "erros",
      escopoCanon.erros,
      escopoGrafico.erros
    );
    compararCampoNumerico(
      divergencias,
      `ExamGraficos:${porProvaNome}`,
      escopoCanon.escopoId,
      escopoCanon.label,
      "total",
      escopoCanon.total,
      escopoGrafico.total
    );
  }

  return divergencias;
}
