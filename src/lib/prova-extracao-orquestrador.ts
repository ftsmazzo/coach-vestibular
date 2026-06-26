import { executarExtracaoProvaV2 } from "@/lib/prova-pipeline-v2";
import type { ProvaPipelineContext } from "@/lib/prova-pipeline-contexto";
import {
  chamarN8nExtracaoProva,
  n8nExtracaoDisponivel,
  validarCoberturaExtracaoN8n,
} from "@/lib/prova-extracao-n8n";
import { n8nItensParaRows } from "@/lib/prova-atribuir-area-bloco";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import type { PipelineV2Result } from "@/lib/prova-pipeline-v2";

export type FonteExtracaoProva = "n8n" | "pipeline";

export type ResultadoExtracaoOrquestrada = {
  fonte: FonteExtracaoProva;
  rows: ProvaQuestaoRow[];
  etapas: string[];
  avisos: string[];
  motivoFallback?: string;
  metricasN8n?: {
    total_validas?: number;
    numeros_unicos?: number;
    total_esperado?: number | null;
  };
  pipeline?: Pick<PipelineV2Result, "modeloUsado" | "csv" | "etapas">;
};

export async function extrairProvaOrquestrada(
  pdfBuffer: Buffer,
  pdfNome: string,
  provaId: string,
  ctx: ProvaPipelineContext,
  opts?: { gabaritoTexto?: string; incluirGabarito?: boolean; gerarCsv?: boolean }
): Promise<ResultadoExtracaoOrquestrada> {
  const etapas: string[] = [];
  const avisos: string[] = [];

  if (n8nExtracaoDisponivel()) {
    etapas.push("Passo A — tentativa via n8n (fast path)…");
    try {
      const resposta = await chamarN8nExtracaoProva({
        pdfBuffer,
        pdfNome,
        provaId,
        totalQuestoes: ctx.totalEsperado,
      });

      if (resposta.status === "fallback_pipeline") {
        etapas.push(
          `n8n solicitou fallback: ${resposta.motivo}${resposta.mensagem ? ` — ${resposta.mensagem}` : ""}`
        );
      } else {
        const rows = n8nItensParaRows(resposta.questoes);
        const cobertura = validarCoberturaExtracaoN8n(rows, ctx.totalEsperado);

        if (cobertura.ok) {
          etapas.push(
            `n8n OK — ${rows.length} linha(s), ${new Set(rows.map((r) => r.numero)).size} número(s) único(s).`
          );
          return {
            fonte: "n8n",
            rows,
            etapas,
            avisos,
            metricasN8n: resposta.metricas,
          };
        }

        etapas.push(`n8n retornou questões, mas cobertura insuficiente: ${cobertura.motivo}`);
        avisos.push(cobertura.motivo ?? "Cobertura insuficiente após n8n.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido no n8n";
      etapas.push(`n8n indisponível ou falhou (${msg}) — usando Pipeline V2.`);
      avisos.push(msg);
    }
  } else {
    etapas.push("N8N_EXTRACAO_WEBHOOK_URL não configurada — Pipeline V2 direto.");
  }

  etapas.push("Passo B — Pipeline V2 (OpenAI)…");
  const pipeline = await executarExtracaoProvaV2(
    pdfBuffer,
    ctx,
    {
      gabaritoTexto: opts?.gabaritoTexto,
      incluirGabarito: opts?.incluirGabarito,
      gerarCsv: opts?.gerarCsv,
    }
  );

  etapas.push(...pipeline.etapas);

  return {
    fonte: "pipeline",
    rows: pipeline.rows,
    etapas,
    avisos: [...avisos, ...pipeline.avisos],
    motivoFallback: etapas.find((e) => e.includes("fallback") || e.includes("insuficiente")),
    pipeline: {
      modeloUsado: pipeline.modeloUsado,
      csv: pipeline.csv,
      etapas: pipeline.etapas,
    },
  };
}
