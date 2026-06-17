"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { inferirAreaBlocoPorMateria, normalizarAreaBloco, opcoesAreaBlocoAdmin } from "@/lib/areas-bloco";
import { taxonomy } from "@/lib/taxonomy";
import {
  marcarObservacoesConferidas,
  questaoConferidaPeloRevisor,
} from "@/lib/prova-auditoria";

export interface QuestaoRow {
  id: string;
  numero: number;
  idiomaVariante?: string;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  gabarito: string | null;
}

const DIFICULDADES = ["", "Fácil", "Média", "Difícil"];

type FormEdicao = {
  areaBloco: string;
  materia: string;
  assunto: string;
  conhecimento: string;
  dificuldade: string;
  observacoes: string;
};

interface Props {
  provaId: string;
  questoes: QuestaoRow[];
  numerosAlerta?: number[];
  /** Abre o modal de edição desta questão (ex.: vindo da auditoria). */
  abrirEdicaoNumero?: number | null;
  onEdicaoAberta?: () => void;
  onAtualizado: () => void;
  onMensagem?: (msg: string) => void;
}

function formDeQuestao(q: QuestaoRow): FormEdicao {
  const materia = q.materia;
  return {
    areaBloco:
      normalizarAreaBloco(q.areaBloco, materia) ??
      inferirAreaBlocoPorMateria(materia) ??
      "",
    materia: q.materia,
    assunto: q.assunto,
    conhecimento: q.conhecimentoExigido ?? "",
    dificuldade: q.nivelDificuldade ?? "",
    observacoes: (q.observacoes ?? "").replace(/\[CONFERIDO\]\s*/gi, "").trim(),
  };
}

export function AdminTabelaQuestoes({
  provaId,
  questoes,
  numerosAlerta = [],
  abrirEdicaoNumero = null,
  onEdicaoAberta,
  onAtualizado,
  onMensagem,
}: Props) {
  const alertaSet = useMemo(() => new Set(numerosAlerta), [numerosAlerta]);
  const [editando, setEditando] = useState<QuestaoRow | null>(null);
  const [form, setForm] = useState<FormEdicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conferida, setConferida] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "alerta">("todas");

  const materias = taxonomy.materias.map((m) => m.label);
  const opcoesArea = opcoesAreaBlocoAdmin();

  const lista =
    filtro === "alerta"
      ? questoes.filter((q) => alertaSet.has(q.numero))
      : questoes;

  useEffect(() => {
    if (abrirEdicaoNumero == null) return;
    const q = questoes.find((x) => x.numero === abrirEdicaoNumero);
    if (q) {
      setEditando(q);
      setForm(formDeQuestao(q));
      onEdicaoAberta?.();
    }
  }, [abrirEdicaoNumero, questoes, onEdicaoAberta]);

  function abrirModal(q: QuestaoRow) {
    setEditando(q);
    setForm(formDeQuestao(q));
    setConferida(
      questaoConferidaPeloRevisor(q.observacoes) || !q.observacoes?.trim()
    );
  }

  function fecharModal() {
    setEditando(null);
    setForm(null);
  }

  async function salvarModal() {
    if (!editando || !form) return;
    setSalvando(true);
    onMensagem?.("");
    try {
      const res = await fetch(
        `/api/admin/provas/${provaId}/questoes/${editando.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            areaBloco: form.areaBloco.trim() || null,
            materia: form.materia.trim(),
            assunto: form.assunto.trim(),
            conhecimentoExigido: form.conhecimento.trim() || null,
            nivelDificuldade: form.dificuldade.trim() || null,
            observacoes:
              marcarObservacoesConferidas(form.observacoes, conferida) || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onMensagem?.(data.error ?? "Erro ao salvar");
        return;
      }
      onMensagem?.(`Questão ${editando.numero} salva.`);
      fecharModal();
      onAtualizado();
    } catch {
      onMensagem?.("Falha de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function temasDaMateria(materiaLabel: string): string[] {
    const m = taxonomy.materias.find((x) => x.label === materiaLabel);
    return m?.temas.map((t) => t.label) ?? [];
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Tabela de questões</h2>
            <p className="text-sm text-slate-600">
              Dados gravados no banco. Use <strong>Editar</strong> na linha para abrir um formulário
              (uma questão por vez). Linha em destaque = alerta da auditoria.
            </p>
          </div>
          {numerosAlerta.length > 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={filtro === "todas" ? "primary" : "secondary"}
                onClick={() => setFiltro("todas")}
              >
                Todas ({questoes.length})
              </Button>
              <Button
                type="button"
                variant={filtro === "alerta" ? "primary" : "secondary"}
                onClick={() => setFiltro("alerta")}
              >
                Só alertas ({numerosAlerta.length})
              </Button>
            </div>
          )}
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">
            {filtro === "alerta"
              ? "Nenhum alerta — rode «Auditar» ou volte para todas."
              : "Nenhuma questão no banco."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-2">#</th>
                  <th className="p-2">Área/Bloco</th>
                  <th className="p-2">Matéria</th>
                  <th className="p-2">Assunto</th>
                  <th className="p-2">Conhecimento</th>
                  <th className="p-2">Dific.</th>
                  <th className="p-2">Gabarito</th>
                  <th className="p-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((q) => (
                  <tr
                    key={q.id}
                    className={`border-b border-slate-100 ${
                      alertaSet.has(q.numero) ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="p-2 font-medium">
                      {q.numero}
                      {q.idiomaVariante && q.idiomaVariante !== "COMUM" && (
                        <span className="ml-1 text-[10px] font-normal text-slate-500">
                          {q.idiomaVariante === "INGLES" ? "EN" : "ES"}
                        </span>
                      )}
                    </td>
                    <td className="p-2 max-w-[8rem] truncate" title={q.areaBloco ?? ""}>
                      {q.areaBloco ?? "—"}
                    </td>
                    <td className="p-2">{q.materia}</td>
                    <td className="p-2 max-w-[10rem] truncate" title={q.assunto}>
                      {q.assunto}
                    </td>
                    <td className="p-2 max-w-xs truncate" title={q.conhecimentoExigido ?? ""}>
                      {q.conhecimentoExigido ?? "—"}
                    </td>
                    <td className="p-2">{q.nivelDificuldade ?? "—"}</td>
                    <td className="p-2 font-mono font-bold">
                      {q.gabarito === "*" ? (
                        <span className="text-slate-500" title="Anulada pela banca">
                          *
                        </span>
                      ) : (
                        (q.gabarito ?? "—")
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => abrirModal(q)}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-editar-questao"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="modal-editar-questao" className="text-lg font-bold">
                Questão {editando.numero}
              </h3>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3">
              <label className="text-xs text-slate-600">
                Área (padrão interno)
                <select
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.areaBloco}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, areaBloco: e.target.value })
                  }
                >
                  <option value="">— Não definida —</option>
                  {opcoesArea.map((o) => (
                    <option key={o.id} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Matéria
                <select
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.materia}
                  onChange={(e) => {
                    const materia = e.target.value;
                    setForm((f) => {
                      if (!f) return f;
                      const canon = opcoesArea.some((o) => o.value === f.areaBloco);
                      const sugerida = inferirAreaBlocoPorMateria(materia);
                      return {
                        ...f,
                        materia,
                        areaBloco: canon ? f.areaBloco : sugerida ?? f.areaBloco,
                      };
                    });
                  }}
                >
                  {materias.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Assunto
                <input
                  list="assuntos-modal"
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.assunto}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, assunto: e.target.value })
                  }
                />
                <datalist id="assuntos-modal">
                  {temasDaMateria(form.materia).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label className="text-xs text-slate-600">
                Conhecimento exigido
                <input
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.conhecimento}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, conhecimento: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-slate-600">
                Dificuldade
                <select
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.dificuldade}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, dificuldade: e.target.value })
                  }
                >
                  {DIFICULDADES.map((d) => (
                    <option key={d || "vazio"} value={d}>
                      {d || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Observações para a IA (ao reclassificar)
                <textarea
                  rows={2}
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                  value={form.observacoes.replace(/\[CONFERIDO\]\s*/gi, "")}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, observacoes: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={conferida}
                  onChange={(e) => setConferida(e.target.checked)}
                />
                Conferida por mim — remove alertas de heurística (mantém só erro grave
                de bloco/taxonomia)
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button type="button" disabled={salvando} onClick={salvarModal}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
