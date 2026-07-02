"use client";

import { AdminClassificacaoProva } from "@/components/admin-classificacao-prova";
import { AdminTabelaQuestoes } from "@/components/admin-tabela-questoes";
import { AdminProvaGabaritoSection } from "./admin-prova-gabarito-section";
import type { LinhaRevisaoGabarito } from "@/lib/extrair-gabarito-aluno";
import type { FaixaIdiomaOpcional } from "@/lib/prova-idioma";
import type { FiltroTabelaPedagogia } from "@/lib/prova-pendencias-admin";
import type { ProvaAdmin, ProvaQuestaoAdmin } from "./types";

interface Props {
  prova: ProvaAdmin;
  provaId: string;
  faixaIdiomaDual: FaixaIdiomaOpcional | null;
  gradeGabarito: LinhaRevisaoGabarito[] | null;
  numerosGrade: number[];
  statsClassificacao: {
    comN1: number;
    comN2Real: number;
    comN2Fallback: number;
    comN3: number;
  } | null;
  gabaritoLote: string;
  csvIncluirGabarito: boolean;
  arquivosGabarito: File[];
  extraindoGabaritoFoto: boolean;
  avisosExtracaoGabarito: string[];
  lidasIaGabarito?: number;
  alertaChaves: string[];
  editarQuestaoAlvo: { numero: number; idiomaVariante?: string } | null;
  onGradeChange: (linhas: LinhaRevisaoGabarito[]) => void;
  onGabaritoLoteChange: (v: string) => void;
  onCsvIncluirGabaritoChange: (v: boolean) => void;
  onArquivosGabaritoChange: (files: File[]) => void;
  onLerGabaritoFoto: () => void;
  onAplicarTextoColado: () => void;
  onLimparGabaritos: () => void;
  onSalvarGabarito: () => void;
  onAtualizarQuestoes: () => void;
  onMensagem: (msg: string) => void;
  onEditarQuestaoAlvo: (v: { numero: number; idiomaVariante?: string } | null) => void;
  onEditarTextoQuestao?: (numero: number) => void;
  filtroTabelaInicial?: FiltroTabelaPedagogia | null;
  onAlertasChange: (chaves: string[]) => void;
}

export function AdminProvaAbaPedagogia({
  prova,
  provaId,
  faixaIdiomaDual,
  gradeGabarito,
  numerosGrade,
  statsClassificacao,
  gabaritoLote,
  csvIncluirGabarito,
  arquivosGabarito,
  extraindoGabaritoFoto,
  avisosExtracaoGabarito,
  lidasIaGabarito,
  alertaChaves,
  editarQuestaoAlvo,
  onGradeChange,
  onGabaritoLoteChange,
  onCsvIncluirGabaritoChange,
  onArquivosGabaritoChange,
  onLerGabaritoFoto,
  onAplicarTextoColado,
  onLimparGabaritos,
  onSalvarGabarito,
  onAtualizarQuestoes,
  onMensagem,
  onEditarQuestaoAlvo,
  onEditarTextoQuestao,
  filtroTabelaInicial,
  onAlertasChange,
}: Props) {
  if (prova.questoes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
        <p className="font-medium">Nenhuma questão no banco ainda.</p>
        <p className="mt-1 text-sm">Extraia o PDF ou adicione questões manualmente na aba Questões.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminProvaGabaritoSection
        prova={prova}
        faixaIdiomaDual={faixaIdiomaDual}
        gradeGabarito={gradeGabarito}
        numerosGrade={numerosGrade}
        gabaritoLote={gabaritoLote}
        csvIncluirGabarito={csvIncluirGabarito}
        arquivosGabarito={arquivosGabarito}
        extraindoGabaritoFoto={extraindoGabaritoFoto}
        avisosExtracaoGabarito={avisosExtracaoGabarito}
        lidasIaGabarito={lidasIaGabarito}
        onGradeChange={onGradeChange}
        onGabaritoLoteChange={onGabaritoLoteChange}
        onCsvIncluirGabaritoChange={onCsvIncluirGabaritoChange}
        onArquivosGabaritoChange={onArquivosGabaritoChange}
        onLerGabaritoFoto={onLerGabaritoFoto}
        onAplicarTextoColado={onAplicarTextoColado}
        onLimparGabaritos={onLimparGabaritos}
        onSalvarGabarito={onSalvarGabarito}
      />

      <AdminClassificacaoProva
        provaId={provaId}
        totalQuestoes={prova.questoes.length}
        extracaoValidada={prova.extracaoValidada ?? false}
        comN1={statsClassificacao?.comN1 ?? 0}
        comN2Real={statsClassificacao?.comN2Real ?? 0}
        comN2Fallback={statsClassificacao?.comN2Fallback ?? 0}
        comN3={statsClassificacao?.comN3 ?? 0}
        onMensagem={onMensagem}
        onAtualizado={onAtualizarQuestoes}
      />

      <AdminTabelaQuestoes
        provaId={provaId}
        questoes={prova.questoes as ProvaQuestaoAdmin[]}
        alertaChaves={alertaChaves}
        abrirEdicao={editarQuestaoAlvo}
        onEdicaoAberta={() => onEditarQuestaoAlvo(null)}
        onEditarTexto={onEditarTextoQuestao}
        filtroInicial={filtroTabelaInicial ?? undefined}
        onAtualizado={onAtualizarQuestoes}
        onMensagem={onMensagem}
      />
    </div>
  );
}
