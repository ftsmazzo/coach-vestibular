"use client";

import { useEffect, useState } from "react";
import { Button, Label } from "@/components/ui";
import { AdminZonaColarImagem } from "./admin-zona-colar-imagem";
import { AREAS_BLOCO } from "@/lib/areas-bloco";
import { LABEL_TEXTO_INCOMPLETO } from "@/lib/prova-pendencias-admin";
import type { ProvaQuestaoAdmin } from "./types";

interface Props {
  provaId: string;
  aberto: boolean;
  numeroInicial: number;
  questaoExistente?: ProvaQuestaoAdmin | null;
  onFechar: () => void;
  onSalvo: () => void;
  onMensagem: (msg: string) => void;
}

export function AdminProvaQuestaoModal({
  provaId,
  aberto,
  numeroInicial,
  questaoExistente,
  onFechar,
  onSalvo,
  onMensagem,
}: Props) {
  const [numero, setNumero] = useState(numeroInicial);
  const [enunciado, setEnunciado] = useState("");
  const [alternativas, setAlternativas] = useState("");
  const [areaBloco, setAreaBloco] = useState("");
  const [gabarito, setGabarito] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [lendoImagem, setLendoImagem] = useState(false);
  const [avisosIa, setAvisosIa] = useState<string[]>([]);
  const [arquivoPrint, setArquivoPrint] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    setNumero(numeroInicial);
    setEnunciado(questaoExistente?.enunciado?.trim() ?? "");
    setAlternativas(questaoExistente?.alternativas?.trim() ?? "");
    setAreaBloco(questaoExistente?.areaBloco ?? "");
    setGabarito(questaoExistente?.gabarito?.toUpperCase() ?? "");
    setAvisosIa([]);
    setArquivoPrint(null);
    setFileInputKey((k) => k + 1);
  }, [aberto, numeroInicial, questaoExistente]);

  if (!aberto) return null;

  async function lerPrintComIa() {
    if (!arquivoPrint) {
      onMensagem("Selecione uma foto ou PDF da questão.");
      return;
    }
    setLendoImagem(true);
    setAvisosIa([]);
    onMensagem("");
    try {
      const fd = new FormData();
      fd.append("file", arquivoPrint);
      fd.append("numero", String(numero));
      const res = await fetch(`/api/admin/provas/${provaId}/questoes/extrair-imagem`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        onMensagem(data.error ?? "Não foi possível ler a imagem.");
        return;
      }
      if (data.numero && !questaoExistente) setNumero(data.numero);
      if (data.enunciado) setEnunciado(data.enunciado);
      if (data.alternativas) setAlternativas(data.alternativas);
      if (data.areaBloco) setAreaBloco(data.areaBloco);
      setAvisosIa(Array.isArray(data.avisos) ? data.avisos : []);
      onMensagem(
        data.precisaRevisaoImagem
          ? `Texto extraído — revise trechos marcados (${LABEL_TEXTO_INCOMPLETO.toLowerCase()}).`
          : "Texto extraído. Revise e salve."
      );
    } catch {
      onMensagem("Falha de rede ao ler imagem.");
    } finally {
      setLendoImagem(false);
    }
  }

  async function salvar() {
    if (!enunciado.trim() || enunciado.trim().length < 10) {
      onMensagem("Enunciado muito curto (mínimo 10 caracteres).");
      return;
    }
    setSalvando(true);
    onMensagem("");
    try {
      if (questaoExistente?.id) {
        const res = await fetch(
          `/api/admin/provas/${provaId}/questoes/${questaoExistente.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enunciado: enunciado.trim(),
              alternativas: alternativas.trim() || null,
              areaBloco: areaBloco || null,
              gabarito: gabarito || null,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          onMensagem(data.error ?? "Erro ao salvar");
          return;
        }
        onMensagem(`Questão ${numero} atualizada.`);
      } else {
        const res = await fetch(`/api/admin/provas/${provaId}/questoes/manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numero,
            enunciado: enunciado.trim(),
            alternativas: alternativas.trim() || null,
            areaBloco: areaBloco || null,
            gabarito: gabarito || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          onMensagem(data.error ?? "Erro ao criar questão");
          return;
        }
        onMensagem(data.mensagem ?? `Questão ${numero} gravada.`);
      }
      onSalvo();
      onFechar();
    } catch {
      onMensagem("Falha de rede ao salvar questão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-labelledby="modal-questao-titulo"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="modal-questao-titulo" className="text-lg font-bold text-slate-900">
            {questaoExistente ? `Editar questão ${numero}` : `Adicionar questão ${numero}`}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Corrija enunciado e alternativas manualmente ou envie um recorte para a IA transcrever.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <details className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">
              Ler de foto ou PDF (opcional)
            </summary>
            <p className="mt-2 text-xs text-slate-600">
              Útil quando a extração automática deixou lacunas — figuras, fórmulas ou layout atípico
              de qualquer vestibular.
            </p>
            <AdminZonaColarImagem
              arquivo={arquivoPrint}
              onArquivo={setArquivoPrint}
              inputKey={fileInputKey}
              ativo={aberto}
              dica="Cole aqui (Ctrl+V) após printar a questão, ou arraste a imagem"
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              disabled={lendoImagem || !arquivoPrint}
              onClick={lerPrintComIa}
            >
              {lendoImagem ? "Lendo com IA…" : "Extrair texto da imagem"}
            </Button>
            {avisosIa.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {avisosIa.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            )}
          </details>

          {!questaoExistente && (
            <div>
              <Label>Número da questão</Label>
              <Input
                type="number"
                min={1}
                value={numero}
                onChange={(e) => setNumero(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          )}

          <div>
            <Label>Enunciado</Label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
              rows={6}
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              placeholder="Texto da questão…"
            />
          </div>

          <div>
            <Label>Alternativas (A–E)</Label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
              rows={5}
              value={alternativas}
              onChange={(e) => setAlternativas(e.target.value)}
              placeholder={"(A) Primeira opção\n(B) Segunda opção\n(C) …"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Área (opcional)</Label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={areaBloco}
                onChange={(e) => setAreaBloco(e.target.value)}
              >
                <option value="">— Detectar depois —</option>
                {AREAS_BLOCO.map((a) => (
                  <option key={a.id} value={a.label}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Gabarito (opcional)</Label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={gabarito}
                onChange={(e) => setGabarito(e.target.value)}
              >
                <option value="">—</option>
                {["A", "B", "C", "D", "E"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onFechar} disabled={salvando || lendoImagem}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando || lendoImagem}>
            {salvando ? "Salvando…" : "Salvar questão"}
          </Button>
        </div>
      </div>
    </div>
  );
}
