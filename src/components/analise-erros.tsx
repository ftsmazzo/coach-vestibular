"use client";

import { useState } from "react";
import { taxonomy } from "@/lib/taxonomy";
import {
  buildMetadadosFromForm,
  CONFIANCA_LABELS,
  ESTADOS_DURANTE_QUESTAO_UI,
  ETAPAS_DO_ERRO_UI,
  metadadosFormFromAttempt,
  sugerirEtapaDeTipoErro,
  type MetadadosErroForm,
} from "@/lib/metadados-cognitivos-labels";
import { formatClassificacaoTresNiveis } from "@/lib/escopo-display";
import { Card, Button, Badge } from "./ui";

interface Attempt {
  id: string;
  numero: number;
  correto: boolean;
  tipoErro: string | null;
  observacao: string | null;
  metadadosCognitivosJson?: string | null;
  materiaId: string | null;
  temaId: string | null;
  respostaAluno?: string | null;
  provaQuestao?: {
    materia: string;
    assunto: string;
    gabarito?: string | null;
    conhecimentoExigido?: string | null;
    conhecimentoEscopoId?: string | null;
    conhecimentoDominioId?: string | null;
    classificacaoN1Json?: string | null;
    classificacaoConfianca?: number | null;
  } | null;
}

interface AnaliseErrosProps {
  examId: string;
  attempts: Attempt[];
}

const STUDENT_ERROR_LABELS: Record<string, string> = {
  CONCEITO_TEORICO: "Não sabia a matéria / Falta de Conceito",
  CALCULO_BOBEIRA: "Erro de Cálculo ou Distração",
  INTERPRETACAO_ENUNCIADO: "Interpretação do Enunciado",
  DUVIDA_CRUCIAL: "Fiquei entre duas e escolhi a errada",
  CHUTE_TOTAL: "Chute total (Não fazia ideia)",
  FALTA_TEMPO: "Não deu tempo de fazer",
};

const ERROR_OPTIONS = [
  { value: "", label: "Selecione o tipo de erro..." },
  ...taxonomy.tiposErro.map((t) => ({
    value: t.id,
    label: STUDENT_ERROR_LABELS[t.id] ?? t.label,
  })),
];

function escopoLabelCurto(escopoId: string | null | undefined): string | null {
  if (!escopoId?.trim()) return null;
  const parts = escopoId.split(".");
  return parts[parts.length - 1]?.replace(/_/g, " ") ?? escopoId;
}

function ClassificacaoBloco({ q }: { q: Attempt }) {
  const cls = formatClassificacaoTresNiveis({
    classificacaoN1Json: q.provaQuestao?.classificacaoN1Json,
    materia: q.provaQuestao?.materia,
    conhecimentoEscopoId: q.provaQuestao?.conhecimentoEscopoId,
    conhecimentoDominioId: q.provaQuestao?.conhecimentoDominioId,
    conhecimentoExigido: q.provaQuestao?.conhecimentoExigido,
    classificacaoConfianca: q.provaQuestao?.classificacaoConfianca,
  });

  return (
    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
      <p>
        <span className="font-semibold text-slate-600">N1 </span>
        {cls.n1Catalogo ?? cls.n1Area ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-teal-700">N2 </span>
        {cls.n2EscopoLabel ?? "Sem escopo — classifique no admin"}
      </p>
      {cls.n3Conhecimento && (
        <p className="text-slate-600 line-clamp-2">
          <span className="font-semibold text-slate-600">N3 </span>
          {cls.n3Conhecimento}
        </p>
      )}
      {cls.confianca != null && (
        <p className="text-[10px] text-slate-400">
          Confiança classificação: {Math.round(cls.confianca * 100)}%
        </p>
      )}
    </div>
  );
}

export function AnaliseErros({ examId, attempts }: AnaliseErrosProps) {
  const erradas = attempts.filter((q) => !q.correto).sort((a, b) => a.numero - b.numero);

  const [formData, setFormData] = useState<Record<string, MetadadosErroForm>>(
    erradas.reduce(
      (acc, curr) => {
        acc[curr.id] = metadadosFormFromAttempt(curr);
        return acc;
      },
      {} as Record<string, MetadadosErroForm>
    )
  );

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error" | "saved_no_recalc"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const patchForm = (attemptId: string, patch: Partial<MetadadosErroForm>) => {
    setFormData((prev) => ({
      ...prev,
      [attemptId]: { ...prev[attemptId]!, ...patch },
    }));
    if (saveStatus === "saved" || saveStatus === "saved_no_recalc") {
      setSaveStatus("idle");
    }
  };

  const handleChangeError = (attemptId: string, value: string) => {
    const sugestao = value ? sugerirEtapaDeTipoErro(value) : "";
    const atual = formData[attemptId];
    patchForm(attemptId, {
      tipoErro: value,
      etapaDoErro:
        !atual?.etapaDoErro && sugestao ? sugestao : atual?.etapaDoErro ?? "",
    });
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMessage("");

    try {
      const payload = {
        attempts: Object.entries(formData).map(([id, data]) => {
          const metadadosCognitivos = buildMetadadosFromForm(data);
          return {
            id,
            tipoErro: data.tipoErro || null,
            observacao: data.observacao || null,
            metadadosCognitivos,
          };
        }),
      };

      const resClassify = await fetch(`/api/exams/${examId}/classificar-erro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resClassify.ok) {
        throw new Error("Falha ao salvar as alterações.");
      }

      const resRecalc = await fetch(`/api/exams/${examId}/recalcular`, {
        method: "POST",
      });

      if (!resRecalc.ok) {
        const recalcData = await resRecalc.json();
        if (recalcData.error) {
          setSaveStatus("saved_no_recalc");
          setErrorMessage(recalcData.error);
          return;
        }
        throw new Error("Falha ao atualizar o plano de estudos.");
      }

      setSaveStatus("saved");
    } catch (err: unknown) {
      console.error(err);
      setSaveStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido ao salvar.");
    }
  };

  if (erradas.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30 text-center py-8">
        <span className="text-4xl">🎯</span>
        <h3 className="mt-3 text-lg font-semibold text-emerald-950">Desempenho Excelente!</h3>
        <p className="mt-1 text-sm text-emerald-800">
          Você acertou 100% das questões neste simulado! Não há erros para classificar.
        </p>
      </Card>
    );
  }

  return (
    <div className="has-sticky-action-mobile space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <span>🧠</span> Análise Metacognitiva de Erros
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Conte <strong>em que etapa</strong> travou e <strong>quão seguro</strong> estava — isso
          alimenta o motor de aprendizagem e prioriza seu plano por escopo (N2).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {erradas.map((q) => {
          const escopo = escopoLabelCurto(q.provaQuestao?.conhecimentoEscopoId);
          const form = formData[q.id];

          return (
            <Card
              key={q.id}
              className="border-rose-100 bg-gradient-to-br from-white to-rose-50/20 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-sm font-bold text-rose-700">
                      Q{q.numero}
                    </span>
                    <Badge tone="danger">Incorreta</Badge>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Q{q.numero}
                  </span>
                </div>

                <div className="mb-4">
                  <ClassificacaoBloco q={q} />
                  {escopo && (
                    <p className="mt-1 font-mono text-[10px] text-slate-400">{escopo}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                      Você marcou {q.respostaAluno ?? "—"}
                    </span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                      Gabarito {q.provaQuestao?.gabarito ?? "—"}
                    </span>
                  </div>
                  {q.provaQuestao?.conhecimentoExigido && !q.provaQuestao?.conhecimentoEscopoId && (
                    <p className="mt-2 text-xs leading-snug text-slate-500 line-clamp-3">
                      <span className="font-medium text-slate-600">Conhecimento: </span>
                      {q.provaQuestao.conhecimentoExigido}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Em que etapa você errou? <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form?.etapaDoErro ?? ""}
                      onChange={(e) => patchForm(q.id, { etapaDoErro: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:py-2 sm:text-sm"
                    >
                      <option value="">O que mais aconteceu?</option>
                      {ETAPAS_DO_ERRO_UI.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                      Quão seguro você estava da resposta?
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {([1, 2, 3, 4, 5] as const).map((n) => {
                        const selected = form?.confiancaNaResposta === String(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            title={CONFIANCA_LABELS[n]}
                            onClick={() =>
                              patchForm(q.id, {
                                confiancaNaResposta: selected ? "" : String(n),
                              })
                            }
                            className={`min-w-[2.25rem] rounded-lg border px-2 py-2 text-sm font-bold transition sm:py-1.5 ${
                              selected
                                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      1 = chute · 5 = certeza total
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Tipo de erro (visão geral)
                    </label>
                    <select
                      value={form?.tipoErro ?? ""}
                      onChange={(e) => handleChangeError(q.id, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:py-2 sm:text-sm"
                    >
                      {ERROR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Como você estava na hora da questão?
                    </label>
                    <select
                      value={form?.estadoDuranteQuestao ?? ""}
                      onChange={(e) =>
                        patchForm(q.id, { estadoDuranteQuestao: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:py-2 sm:text-sm"
                    >
                      <option value="">Opcional</option>
                      {ESTADOS_DURANTE_QUESTAO_UI.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Anotação livre
                    </label>
                    <textarea
                      placeholder="Ex.: confundi com outro conceito, errei sinal na fórmula..."
                      value={form?.observacao ?? ""}
                      onChange={(e) => patchForm(q.id, { observacao: e.target.value })}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 transition placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 resize-none sm:py-2 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="sticky-action-mobile md:static md:border-t md:border-slate-100 md:pt-5">
        <div className="mb-3 md:mb-0">
          {saveStatus === "saved" && (
            <p className="text-sm font-medium text-emerald-600 flex items-center gap-1.5 animate-fade-in">
              <span>✓</span> Análise salva e plano da semana atualizado com sucesso!
            </p>
          )}
          {saveStatus === "saved_no_recalc" && (
            <p className="text-sm font-medium text-amber-600 flex flex-col gap-0.5 animate-fade-in">
              <span className="flex items-center gap-1.5">
                <span>✓</span> Análise salva com sucesso!
              </span>
              <span className="text-xs text-slate-500 font-normal">
                Nota: O plano não pôde ser recalculado ({errorMessage}).
              </span>
            </p>
          )}
          {saveStatus === "error" && (
            <p className="text-sm font-medium text-rose-600 flex items-center gap-1.5">
              <span>✗</span> {errorMessage || "Erro ao salvar análise."}
            </p>
          )}
          {saveStatus === "saving" && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Processando análise e recalculando seu plano de estudos...
            </p>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="w-full px-4 py-3 text-sm font-bold shadow-sm md:w-auto md:px-6 md:py-2.5"
        >
          {saveStatus === "saving" ? "Atualizando..." : "Salvar análise e plano"} 🧠
        </Button>
      </div>
    </div>
  );
}
