"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { gerarCsvProvaQuestoes } from "@/lib/prova-csv-export";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";

interface Props {
  provaId: string;
  totalQuestoes: number;
  pdfFile: File | null;
  temCadernoSalvo?: boolean;
  cadernoFileName?: string | null;
  questoesGravadas?: number;
  gabaritoLote: string;
  incluirGabarito: boolean;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

interface PreviewRow {
  numero: number;
  enunciado?: string;
  alternativas?: string;
  gabarito?: string;
}

export function AdminProvaPipelineV2({
  provaId,
  totalQuestoes,
  pdfFile,
  temCadernoSalvo = false,
  cadernoFileName,
  questoesGravadas = 0,
  gabaritoLote,
  incluirGabarito,
  onMensagem,
  onAtualizado,
}: Props) {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [importandoCsv, setImportandoCsv] = useState(false);
  const [preview, setPreview] = useState<{
    rows: PreviewRow[];
    avisos: string[];
    etapas: string[];
    modeloUsado: string;
  } | null>(null);

  const montarFormData = useCallback(
    (aplicar: boolean, origem: "upload" | "salvo") => {
      const fd = new FormData();
      if (origem === "upload") {
        if (!pdfFile) throw new Error("PDF");
        fd.append("file", pdfFile);
      } else {
        fd.append("usarCadernoSalvo", "true");
      }
      fd.append("aplicar", String(aplicar));
      fd.append("substituir", "true");
      const temGabarito = gabaritoLote.trim().length > 0;
      fd.append("incluirGabarito", String(temGabarito || incluirGabarito));
      if (temGabarito) {
        fd.append("gabarito", gabaritoLote.trim());
      }
      return fd;
    },
    [pdfFile, incluirGabarito, gabaritoLote]
  );

  const podeExtrair = Boolean(pdfFile) || temCadernoSalvo;

  const extrairPdf = useCallback(
    async (aplicar: boolean, origem: "upload" | "salvo" = pdfFile ? "upload" : "salvo") => {
      if (!pdfFile && !temCadernoSalvo) {
        onMensagem("Selecione o PDF da prova acima ou use o caderno já salvo no servidor.");
        return;
      }

      setCarregando(true);
      onMensagem(
        aplicar
          ? "Enviando PDF — n8n primeiro, Pipeline IA se necessário…"
          : "Extraindo prova para pré-visualização…"
      );

      try {
        const res = await fetch(`/api/admin/provas/${provaId}/extrair-hibrido`, {
          method: "POST",
          body: montarFormData(aplicar, origem),
        });
        const data = await res.json();
        setCarregando(false);

        if (!res.ok) {
          onMensagem(data.error ?? "Erro na extração");
          return;
        }

        if (aplicar) {
          setPreview(null);
          const fonte =
            data.fonte === "n8n"
              ? "n8n (fast path)"
              : data.fonte === "pipeline"
                ? "Pipeline IA (fallback)"
                : "";
          const resumoStr =
            typeof data.resumoExtracao === "string"
              ? data.resumoExtracao
              : data.relatorio
                ? `${data.relatorio.ok}/${data.relatorio.linhasFisicas} OK · ${data.relatorio.curto} curto(s) · ${data.relatorio.faltando} faltando`
                : null;
          const msgResumo = resumoStr
            ? `${data.gravadas ?? 0} questões gravadas via ${fonte} · ${resumoStr}. Revise abaixo e confirme a extração.`
            : `${data.gravadas ?? 0} questões gravadas via ${fonte}. Revise a validação abaixo.`;
          onMensagem(msgResumo);
          onAtualizado();
        } else {
          setPreview({
            rows: data.rows ?? [],
            avisos: [
              ...(data.avisos ?? []),
              data.fonte ? `Fonte: ${data.fonte}` : "",
              ...(data.etapas ?? []).slice(-3),
            ].filter(Boolean),
            etapas: data.etapas ?? [],
            modeloUsado: data.modeloUsado ?? data.fonte ?? "",
          });
          onMensagem(
            `Prévia: ${data.rows?.length ?? 0} questões extraídas (cadastro espera ${totalQuestoes}). Confira enunciados e grave.`
          );
        }
      } catch {
        setCarregando(false);
        onMensagem("Falha de rede.");
      }
    },
    [provaId, pdfFile, temCadernoSalvo, montarFormData, totalQuestoes, onMensagem, onAtualizado]
  );

  async function gravarPreview() {
    await extrairPdf(true, pdfFile ? "upload" : "salvo");
  }

  function baixarCsvPreview() {
    if (!preview?.rows.length) return;
    const rows = preview.rows as ProvaQuestaoRow[];
    const csv = gerarCsvProvaQuestoes(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prova-extracao.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importarCsvGpt() {
    const file = csvInputRef.current?.files?.[0];
    if (!file) {
      onMensagem("Selecione o CSV exportado do ChatGPT.");
      return;
    }
    setImportandoCsv(true);
    onMensagem("");
    const fd = new FormData();
    fd.append("file", file);
    if (incluirGabarito) fd.append("incluirGabarito", "true");
    fd.append("modo", "substituir");

    try {
      const res = await fetch(`/api/admin/provas/${provaId}/questoes`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setImportandoCsv(false);
      if (!res.ok) {
        onMensagem(data.error ?? "Erro no import");
        return;
      }
      onMensagem(
        `${data.imported ?? 0} questões gravadas no banco a partir do CSV. Classificação será feita depois da validação.`
      );
      if (csvInputRef.current) csvInputRef.current.value = "";
      onAtualizado();
    } catch {
      setImportandoCsv(false);
      onMensagem("Falha de rede ao importar CSV.");
    }
  }

  return (
    <Card className="border-indigo-200 bg-indigo-50/50">
      <h2 className="mb-2 font-semibold text-indigo-900">Passo 2 — Extrair prova (PDF → banco)</h2>
      <p className="mb-3 text-sm text-indigo-800">
        Envie o PDF. O sistema tenta primeiro o <strong>n8n</strong> (rápido, EN/ES) e, se a cobertura
        for insuficiente, usa o <strong>Pipeline IA</strong> automaticamente. Extração pura — valide abaixo
        antes de classificar.
      </p>

      {temCadernoSalvo && (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <strong>PDF persistido:</strong> {cadernoFileName}
          {questoesGravadas > 0
            ? ` · ${questoesGravadas} questão(ões) no banco`
            : " · ainda sem questões no banco"}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={carregando || !podeExtrair}
          onClick={() => extrairPdf(true, pdfFile ? "upload" : "salvo")}
        >
          {carregando ? "Extraindo…" : pdfFile ? "Extrair prova (n8n → IA)" : "Reextrair do PDF salvo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={carregando || !podeExtrair}
          onClick={() => extrairPdf(false, pdfFile ? "upload" : "salvo")}
        >
          Só pré-visualizar
        </Button>
      </div>

      {preview && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-3">
          <p className="mb-2 text-xs text-slate-600">
            Modelo: {preview.modeloUsado} · {preview.rows.length} questões na prévia
          </p>
          {preview.avisos.length > 0 && (
            <ul className="mb-2 text-xs text-amber-800">
              {preview.avisos.map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          )}
          <div className="mb-2 flex flex-wrap gap-2">
            <Button type="button" onClick={gravarPreview}>
              Gravar esta prévia no banco
            </Button>
            <Button type="button" variant="secondary" onClick={baixarCsvPreview}>
              Exportar CSV (opcional)
            </Button>
          </div>
          <div className="max-h-64 overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-1 text-left">#</th>
                  <th className="p-1 text-left">Enunciado (início)</th>
                  <th className="p-1 text-left">Alt.</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 30).map((r, i) => (
                  <tr key={`${r.numero}-${i}`} className="border-t">
                    <td className="p-1">{r.numero}</td>
                    <td className="p-1 max-w-[360px] truncate">{r.enunciado?.slice(0, 100) ?? "—"}</td>
                    <td className="p-1 max-w-[80px] truncate">
                      {r.alternativas ? `${r.alternativas.length} chars` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="mt-4 rounded-lg border border-indigo-100 bg-white/80 p-3">
        <summary className="cursor-pointer text-sm font-medium text-indigo-900">
          Já tenho CSV do ChatGPT
        </summary>
        <p className="mt-2 text-xs text-slate-600">
          Importa direto no banco — útil se você já extraiu fora. Classificação só após validação.
        </p>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="mt-2 w-full text-sm"
        />
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          disabled={importandoCsv}
          onClick={importarCsvGpt}
        >
          {importandoCsv ? "Importando…" : "Importar CSV no banco"}
        </Button>
      </details>
    </Card>
  );
}
