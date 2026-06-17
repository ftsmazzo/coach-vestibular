"use client";

import { useState } from "react";
import { taxonomy } from "@/lib/taxonomy";
import { Card, Button, Badge } from "./ui";

interface Attempt {
  id: string;
  numero: number;
  correto: boolean;
  tipoErro: string | null;
  observacao: string | null;
  materiaId: string | null;
  temaId: string | null;
  respostaAluno?: string | null;
  provaQuestao?: {
    materia: string;
    assunto: string;
    gabarito?: string | null;
    conhecimentoExigido?: string | null;
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

export function AnaliseErros({ examId, attempts }: AnaliseErrosProps) {
  // Only filter incorrect attempts
  const erradas = attempts.filter((q) => !q.correto).sort((a, b) => a.numero - b.numero);
  
  const [formData, setFormData] = useState<Record<string, { tipoErro: string; observacao: string }>>(
    erradas.reduce((acc, curr) => {
      acc[curr.id] = {
        tipoErro: curr.tipoErro || "",
        observacao: curr.observacao || "",
      };
      return acc;
    }, {} as Record<string, { tipoErro: string; observacao: string }>)
  );

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error" | "saved_no_recalc">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChangeError = (attemptId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [attemptId]: {
        ...prev[attemptId],
        tipoErro: value,
      },
    }));
    if (saveStatus === "saved" || saveStatus === "saved_no_recalc") setSaveStatus("idle");
  };

  const handleChangeObservation = (attemptId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [attemptId]: {
        ...prev[attemptId],
        observacao: value,
      },
    }));
    if (saveStatus === "saved" || saveStatus === "saved_no_recalc") setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMessage("");

    try {
      const payload = {
        attempts: Object.entries(formData).map(([id, data]) => ({
          id,
          tipoErro: data.tipoErro || null,
          observacao: data.observacao || null,
        })),
      };

      // 1. Save classification
      const resClassify = await fetch(`/api/exams/${examId}/classificar-erro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resClassify.ok) {
        throw new Error("Falha ao salvar as alterações.");
      }

      // 2. Recalculate study plan using the endpoint
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
    } catch (err: any) {
      console.error(err);
      setSaveStatus("error");
      setErrorMessage(err.message || "Erro desconhecido ao salvar.");
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
          Classifique seus erros para treinar o coach e ajustar as prioridades do seu plano de estudos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {erradas.map((q) => {
          const materia = q.provaQuestao?.materia || q.materiaId || "Materia Geral";
          const assunto = q.provaQuestao?.assunto || q.temaId || "Assunto Geral";
          
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
                    {materia}
                  </span>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{assunto}</h4>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                      Você marcou {q.respostaAluno ?? "—"}
                    </span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                      Gabarito {q.provaQuestao?.gabarito ?? "—"}
                    </span>
                  </div>
                  {q.provaQuestao?.conhecimentoExigido && (
                    <p className="mt-2 text-xs leading-snug text-slate-500 line-clamp-3">
                      <span className="font-medium text-slate-600">Conhecimento exigido: </span>
                      {q.provaQuestao.conhecimentoExigido}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Por que você errou essa questão?
                    </label>
                    <select
                      value={formData[q.id]?.tipoErro}
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
                      Anotação metacognitiva
                    </label>
                    <textarea
                      placeholder="Adicionar anotação pessoal sobre este erro..."
                      value={formData[q.id]?.observacao}
                      onChange={(e) => handleChangeObservation(q.id, e.target.value)}
                      rows={3}
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
              <span className="flex items-center gap-1.5"><span>✓</span> Análise salva com sucesso!</span>
              <span className="text-xs text-slate-500 font-normal">Nota: O plano não pôde ser recalculado ({errorMessage}).</span>
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
