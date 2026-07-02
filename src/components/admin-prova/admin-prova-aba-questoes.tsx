"use client";

import { useMemo } from "react";
import { Card, Input, Label } from "@/components/ui";
import { AdminProvaPipelineV2 } from "@/components/admin-prova-pipeline-v2";
import { AdminValidacaoExtracao } from "@/components/admin-validacao-extracao";
import { AdminProvaCobertura } from "./admin-prova-cobertura";
import type { ProvaAdmin } from "./types";

interface Props {
  prova: ProvaAdmin;
  pdfFile: File | null;
  setPdfFile: (f: File | null) => void;
  gabaritoLote: string;
  csvIncluirGabarito: boolean;
  extracaoRefreshKey: string;
  onAdicionarQuestao: (numero: number) => void;
  onEditarQuestao: (numero: number) => void;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

export function AdminProvaAbaQuestoes({
  prova,
  pdfFile,
  setPdfFile,
  gabaritoLote,
  csvIncluirGabarito,
  extracaoRefreshKey,
  onAdicionarQuestao,
  onEditarQuestao,
  onMensagem,
  onAtualizado,
}: Props) {
  const numerosLogicos = useMemo(() => {
    const set = new Set<number>();
    for (const q of prova.questoes) {
      if (q.idiomaVariante === "ESPANHOL") continue;
      set.add(q.numero);
    }
    return set;
  }, [prova.questoes]);

  const cadastradas = prova.questoesCadastradas ?? numerosLogicos.size;
  const faltando = prova.questoesFaltando ?? [];

  return (
    <div className="space-y-6">
      <AdminProvaCobertura
        totalQuestoes={prova.totalQuestoes}
        cadastradas={cadastradas}
        faltando={faltando}
        numerosExistentes={numerosLogicos}
        onAdicionar={onAdicionarQuestao}
        onEditar={onEditarQuestao}
      />

      <Card>
        <h2 className="mb-1 font-semibold text-slate-900">Extrair do PDF</h2>
        <p className="mb-3 text-sm text-slate-600">
          Fluxo principal: <strong>n8n</strong> (rápido) com fallback para Pipeline IA. Depois valide
          enunciados e complete lacunas manualmente.
        </p>
        <div className="mb-4">
          <Label>PDF da prova</Label>
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
          {pdfFile && (
            <p className="mt-1 text-xs text-slate-600">
              {pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>
        <AdminProvaPipelineV2
          provaId={prova.id}
          totalQuestoes={prova.totalQuestoes}
          pdfFile={pdfFile}
          temCadernoSalvo={Boolean(prova.cadernoStoragePath && prova.cadernoFileName)}
          cadernoFileName={prova.cadernoFileName}
          questoesGravadas={prova.questoes.length}
          gabaritoLote={gabaritoLote}
          incluirGabarito={csvIncluirGabarito}
          onMensagem={onMensagem}
          onAtualizado={onAtualizado}
          embedded
        />
      </Card>

      {(prova.questoes.length > 0 || prova.totalQuestoes > 0) && (
        <AdminValidacaoExtracao
          provaId={prova.id}
          extracaoValidada={prova.extracaoValidada ?? false}
          refreshKey={extracaoRefreshKey}
          onMensagem={onMensagem}
          onAtualizado={onAtualizado}
        />
      )}
    </div>
  );
}
