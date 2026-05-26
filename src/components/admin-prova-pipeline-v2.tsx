"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { gerarCsvProvaQuestoes } from "@/lib/prova-csv-export";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";

interface Props {
  provaId: string;
  totalQuestoes: number;
  pdfFile: File | null;
  gabaritoLote: string;
  incluirGabarito: boolean;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

interface PreviewRow {
  numero: number;
  materia: string;
  assunto: string;
  areaBloco?: string;
  conhecimentoExigido?: string;
  nivelDificuldade?: string;
  gabarito?: string;
}

export function AdminProvaPipelineV2({
  provaId,
  totalQuestoes,
  pdfFile,
  gabaritoLote,
  incluirGabarito,
  onMensagem,
  onAtualizado,
}: Props) {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [importandoCsv, setImportandoCsv] = useState(false);
  const [incluirBlocoEspanhol, setIncluirBlocoEspanhol] = useState(false);
  const [preview, setPreview] = useState<{
    rows: PreviewRow[];
    avisos: string[];
    etapas: string[];
    modeloUsado: string;
  } | null>(null);

  const montarFormData = useCallback(
    (aplicar: boolean) => {
      const fd = new FormData();
      if (!pdfFile) throw new Error("PDF");
      fd.append("file", pdfFile);
      fd.append("aplicar", String(aplicar));
      fd.append("substituir", "true");
      const temGabarito = gabaritoLote.trim().length > 0;
      fd.append("incluirGabarito", String(temGabarito || incluirGabarito));
      fd.append("incluirBlocoEspanhol", String(incluirBlocoEspanhol));
      if (temGabarito) {
        fd.append("gabarito", gabaritoLote.trim());
      }
      return fd;
    },
    [pdfFile, incluirGabarito, incluirBlocoEspanhol, gabaritoLote]
  );

  const classificarPdf = useCallback(
    async (aplicar: boolean) => {
      if (!pdfFile) {
        onMensagem("Selecione o PDF da prova acima.");
        return;
      }

      setCarregando(true);
      onMensagem(
        aplicar
          ? "Lendo o PDF, classificando e gravando no banco… (alguns minutos)"
          : "Classificando prova para pré-visualização…"
      );

      try {
        const res = await fetch(`/api/admin/provas/${provaId}/pipeline`, {
          method: "POST",
          body: montarFormData(aplicar),
        });
        const data = await res.json();
        setCarregando(false);

        if (!res.ok) {
          onMensagem(data.error ?? "Erro na classificação");
          return;
        }

        if (aplicar) {
          setPreview(null);
          onMensagem(
            `${data.gravadas ?? data.totalClassificadas ?? 0} questões gravadas no banco (modelo ${data.modeloUsado ?? ""}). Use «Auditar» abaixo se quiser revisar.`
          );
          onAtualizado();
        } else {
          setPreview({
            rows: data.rows ?? [],
            avisos: data.avisos ?? [],
            etapas: data.etapas ?? [],
            modeloUsado: data.modeloUsado ?? "",
          });
          onMensagem(
            `Prévia: ${data.rows?.length ?? 0} questões (cadastro espera ${totalQuestoes}). Confira e clique em gravar.`
          );
        }
      } catch {
        setCarregando(false);
        onMensagem("Falha de rede.");
      }
    },
    [provaId, pdfFile, montarFormData, totalQuestoes, onMensagem, onAtualizado]
  );

  async function gravarPreview() {
    await classificarPdf(true);
  }

  function baixarCsvPreview() {
    if (!preview?.rows.length) return;
    const rows = preview.rows as ProvaQuestaoRow[];
    const csv = gerarCsvProvaQuestoes(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prova-classificacao.csv`;
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
        `${data.imported ?? 0} questões gravadas no banco a partir do CSV (mesma validação do pipeline).`
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
      <h2 className="mb-2 font-semibold text-indigo-900">Classificar prova (IA → banco)</h2>
      <p className="mb-3 text-sm text-indigo-800">
        Envie o PDF de qualquer prova ou simulado (ENEM, vestibular, cursinho, listas). A IA detecta
        a estrutura do documento (blocos, numeração, idiomas) e grava matéria, assunto, conhecimento e
        dificuldade <strong>direto no banco</strong>. O cadastro da prova (banca, tipo, total) é
        referência — o PDF manda na lista de questões.
      </p>

      <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm text-indigo-900">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={incluirBlocoEspanhol}
          onChange={(e) => setIncluirBlocoEspanhol(e.target.checked)}
        />
        <span>
          Incluir bloco em espanhol quando o PDF tiver inglês e espanhol com a mesma numeração (padrão:
          mantém só inglês, detectado automaticamente).
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={carregando || !pdfFile}
          onClick={() => classificarPdf(true)}
        >
          {carregando ? "Processando…" : "Classificar PDF e gravar no banco"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={carregando || !pdfFile}
          onClick={() => classificarPdf(false)}
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
          <div className="max-h-48 overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-1 text-left">#</th>
                  <th className="p-1 text-left">Matéria</th>
                  <th className="p-1 text-left">Assunto</th>
                  <th className="p-1 text-left">Conhec.</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 25).map((r) => (
                  <tr key={r.numero} className="border-t">
                    <td className="p-1">{r.numero}</td>
                    <td className="p-1">{r.materia}</td>
                    <td className="p-1">{r.assunto}</td>
                    <td className="p-1 max-w-[140px] truncate">{r.conhecimentoExigido ?? "—"}</td>
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
          Importa direto no banco com a mesma normalização de taxonomia — sem rodar a IA de novo.
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
