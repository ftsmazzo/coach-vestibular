"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { taxonomy } from "@/lib/taxonomy";

export interface QuestaoRow {
  id: string;
  numero: number;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  gabarito: string | null;
}

const DIFICULDADES = ["", "Fácil", "Média", "Difícil"];

interface Props {
  provaId: string;
  questoes: QuestaoRow[];
  numerosAlerta?: number[];
  onAtualizado: () => void;
  onMensagem?: (msg: string) => void;
}

export function AdminTabelaQuestoes({
  provaId,
  questoes,
  numerosAlerta = [],
  onAtualizado,
  onMensagem,
}: Props) {
  const alertaSet = useMemo(() => new Set(numerosAlerta), [numerosAlerta]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "alerta">("todas");

  const materias = taxonomy.materias.map((m) => m.label);

  const lista =
    filtro === "alerta"
      ? questoes.filter((q) => alertaSet.has(q.numero))
      : questoes;

  async function salvarLinha(q: QuestaoRow, form: HTMLFormElement) {
    const fd = new FormData(form);
    setSalvandoId(q.id);
    onMensagem?.("");
    try {
      const res = await fetch(
        `/api/admin/provas/${provaId}/questoes/${q.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            areaBloco: String(fd.get("areaBloco") ?? "").trim() || null,
            materia: String(fd.get("materia") ?? "").trim(),
            assunto: String(fd.get("assunto") ?? "").trim(),
            conhecimentoExigido:
              String(fd.get("conhecimento") ?? "").trim() || null,
            nivelDificuldade:
              String(fd.get("dificuldade") ?? "").trim() || null,
            observacoes: String(fd.get("observacoes") ?? "").trim() || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onMensagem?.(data.error ?? "Erro ao salvar");
        return;
      }
      onMensagem?.(`Questão ${q.numero} salva.`);
      onAtualizado();
    } catch {
      onMensagem?.("Falha de rede ao salvar.");
    } finally {
      setSalvandoId(null);
    }
  }

  function temasDaMateria(materiaLabel: string): string[] {
    const m = taxonomy.materias.find((x) => x.label === materiaLabel);
    return m?.temas.map((t) => t.label) ?? [];
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Editar questões (antes de publicar)</h2>
          <p className="text-sm text-slate-600">
            Corrija matéria, assunto, conhecimento e dificuldade na hora. Em{" "}
            <strong>Observações para a IA</strong>, escreva o que a máquina errou (ex.: «é
            Geografia, mapa climático, não Biologia») — isso entra no prompt ao{" "}
            <strong>Reclassificar</strong>. Linhas em destaque = alertas da auditoria.
          </p>
        </div>
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
            disabled={numerosAlerta.length === 0}
          >
            Só alertas ({numerosAlerta.length})
          </Button>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filtro === "alerta"
            ? "Nenhum alerta — rode «Auditar» ou ajuste o filtro."
            : "Nenhuma questão no banco."}
        </p>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {lista.map((q) => (
            <form
              key={q.id}
              className={`rounded-xl border p-3 ${
                alertaSet.has(q.numero)
                  ? "border-amber-400 bg-amber-50/80"
                  : "border-slate-200 bg-white"
              }`}
              onSubmit={(e) => {
                e.preventDefault();
                salvarLinha(q, e.currentTarget);
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-lg font-bold text-slate-900">
                  Questão {q.numero}
                </span>
                <Button
                  type="submit"
                  disabled={salvandoId === q.id}
                >
                  {salvandoId === q.id ? "Salvando…" : "Salvar"}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs text-slate-600">
                  Área/Bloco
                  <input
                    name="areaBloco"
                    className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                    defaultValue={q.areaBloco ?? ""}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Matéria
                  <select
                    name="materia"
                    className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                    defaultValue={q.materia}
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
                    name="assunto"
                    list={`assuntos-list-${q.id}`}
                    className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                    defaultValue={q.assunto}
                  />
                  <datalist id={`assuntos-list-${q.id}`}>
                    {temasDaMateria(q.materia).map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Conhecimento exigido
                  <input
                    name="conhecimento"
                    className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                    defaultValue={q.conhecimentoExigido ?? ""}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Dificuldade
                  <select
                    name="dificuldade"
                    className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                    defaultValue={q.nivelDificuldade ?? ""}
                  >
                    {DIFICULDADES.map((d) => (
                      <option key={d || "vazio"} value={d}>
                        {d || "—"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2 lg:col-span-3">
                  Observações para a IA (orientação do revisor)
                  <textarea
                    name="observacoes"
                    rows={2}
                    className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                    placeholder="Ex.: Texto-base em inglês; matéria correta é Inglês, não Português. / É Filosofia (ética), não Sociologia."
                    defaultValue={q.observacoes ?? ""}
                  />
                </label>
              </div>
            </form>
          ))}
        </div>
      )}
    </Card>
  );
}
