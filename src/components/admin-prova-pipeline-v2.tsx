"use client";

import { useCallback, useState } from "react";
import { Button, Card } from "@/components/ui";

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
  const [carregando, setCarregando] = useState(false);
  const [excluirEspanhol, setExcluirEspanhol] = useState(false);
  const [preview, setPreview] = useState<{
    rows: PreviewRow[];
    csv: string;
    avisos: string[];
    etapas: string[];
    modeloUsado: string;
  } | null>(null);

  const rodar = useCallback(
    async (aplicar: boolean) => {
      if (!pdfFile) {
        onMensagem("Selecione o PDF da prova no bloco acima.");
        return;
      }

      setCarregando(true);
      onMensagem(aplicar ? "Classificando e gravando…" : "Classificando prova (pode levar alguns minutos)…");

      const fd = new FormData();
      fd.append("file", pdfFile);
      fd.append("aplicar", String(aplicar));
      fd.append("substituir", "true");
      fd.append("incluirGabarito", String(incluirGabarito));
      fd.append("excluirBlocoEspanhol", String(excluirEspanhol));
      if (incluirGabarito && gabaritoLote.trim()) {
        fd.append("gabarito", gabaritoLote.trim());
      }

      try {
        const res = await fetch(`/api/admin/provas/${provaId}/pipeline`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        setCarregando(false);

        if (!res.ok) {
          onMensagem(data.error ?? "Erro no pipeline");
          return;
        }

        if (aplicar) {
          setPreview(null);
          onMensagem(
            `Gravadas ${data.gravadas ?? data.rows?.length ?? 0} questões — modelo ${data.modeloUsado ?? ""}.`
          );
          onAtualizado();
        } else {
          setPreview({
            rows: data.rows ?? [],
            csv: data.csv ?? "",
            avisos: data.avisos ?? [],
            etapas: data.etapas ?? [],
            modeloUsado: data.modeloUsado ?? "",
          });
          onMensagem(
            `Prévia: ${data.rows?.length ?? 0} questões classificadas (esperado ${totalQuestoes}). Revise e grave.`
          );
        }
      } catch {
        setCarregando(false);
        onMensagem("Falha de rede ao processar o PDF.");
      }
    },
    [
      provaId,
      pdfFile,
      gabaritoLote,
      incluirGabarito,
      excluirEspanhol,
      totalQuestoes,
      onMensagem,
      onAtualizado,
    ]
  );

  function baixarCsv() {
    if (!preview?.csv) return;
    const blob = new Blob([preview.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prova-${provaId.slice(0, 8)}-classificacao.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-indigo-200 bg-indigo-50/50">
      <h2 className="mb-2 font-semibold text-indigo-900">
        Classificar prova com IA (recomendado)
      </h2>
      <p className="mb-3 text-sm text-indigo-800">
        Envia o <strong>PDF</strong> direto para a OpenAI (Responses API + saída estruturada).
        Classifica matéria, assunto, conhecimento e dificuldade — <strong>sem extrair enunciado</strong>,
        no mesmo espírito do seu agente GPT. O resultado vira CSV e pode ser gravado no banco.
      </p>

      <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm text-indigo-900">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={excluirEspanhol}
          onChange={(e) => setExcluirEspanhol(e.target.checked)}
        />
        <span>
          Ignorar bloco de Espanhol no PDF (marque só se o PDF ainda tiver inglês + espanhol com a
          mesma numeração).
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={carregando || !pdfFile} onClick={() => rodar(false)}>
          {carregando ? "Processando…" : "Pré-visualizar classificação"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={carregando || !pdfFile}
          onClick={() => rodar(true)}
        >
          Classificar e gravar no banco
        </Button>
      </div>

      {preview && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-3">
          <p className="mb-2 text-xs text-slate-600">
            Modelo: {preview.modeloUsado} · {preview.rows.length} linhas
          </p>
          {preview.etapas.length > 0 && (
            <ul className="mb-2 text-xs text-slate-600">
              {preview.etapas.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
          {preview.avisos.length > 0 && (
            <ul className="mb-2 text-xs text-amber-800">
              {preview.avisos.map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          )}
          <div className="mb-2 flex gap-2">
            <Button type="button" variant="secondary" onClick={baixarCsv}>
              Baixar CSV
            </Button>
            <Button type="button" disabled={carregando} onClick={() => rodar(true)}>
              Gravar no banco
            </Button>
          </div>
          <div className="max-h-64 overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-1 text-left">#</th>
                  <th className="p-1 text-left">Área</th>
                  <th className="p-1 text-left">Matéria</th>
                  <th className="p-1 text-left">Assunto</th>
                  <th className="p-1 text-left">Conhec.</th>
                  <th className="p-1 text-left">Dif.</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 40).map((r) => (
                  <tr key={r.numero} className="border-t">
                    <td className="p-1">{r.numero}</td>
                    <td className="p-1 max-w-[80px] truncate">{r.areaBloco ?? "—"}</td>
                    <td className="p-1">{r.materia}</td>
                    <td className="p-1">{r.assunto}</td>
                    <td className="p-1 max-w-[120px] truncate">{r.conhecimentoExigido ?? "—"}</td>
                    <td className="p-1">{r.nivelDificuldade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 40 && (
              <p className="mt-1 text-slate-500">+ {preview.rows.length - 40} questões…</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
