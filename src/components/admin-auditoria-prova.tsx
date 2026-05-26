"use client";

import { useCallback, useState } from "react";
import { Button, Card } from "@/components/ui";

interface AlertaAuditoria {
  numero: number;
  severidade: "alta" | "media";
  motivos: string[];
  atual: {
    materia: string;
    assunto: string;
    conhecimentoExigido?: string | null;
  };
  parRemoto?: { numero: number; classificacao: { materia: string; assunto: string } };
  enunciado?: string;
}

interface ResultadoAuditoria {
  suspeitas: number;
  alertas: AlertaAuditoria[];
}

interface Props {
  provaId: string;
  textoFonteColado?: string;
  /** observacoes já salvas por número (tabela editável). */
  orientacoesSalvas?: Record<number, string>;
  onQuestoesAtualizadas?: () => void;
  onAlertasChange?: (numeros: number[]) => void;
}

export function AdminAuditoriaProva({
  provaId,
  textoFonteColado = "",
  orientacoesSalvas = {},
  onQuestoesAtualizadas,
  onAlertasChange,
}: Props) {
  const [auditing, setAuditing] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAuditoria | null>(null);
  const [msg, setMsg] = useState("");
  const [textos, setTextos] = useState<Record<number, string>>({});
  const [orientacoes, setOrientacoes] = useState<Record<number, string>>({});
  const [reclassificando, setReclassificando] = useState<number | null>(null);

  function orientacaoPara(numero: number, motivos?: string[]): string {
    const manual = orientacoes[numero]?.trim() || orientacoesSalvas[numero]?.trim();
    if (manual) return manual;
    if (motivos?.length) {
      return `Auditoria: ${motivos.slice(0, 2).join(" ")}`.slice(0, 500);
    }
    return "";
  }

  const auditar = useCallback(async () => {
    setAuditing(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/auditar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoFonte: textoFonteColado.trim() || undefined,
          salvarTextoFonte: Boolean(textoFonteColado.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Falha na auditoria");
        setResultado(null);
        return;
      }
      const alertas = data.alertas ?? [];
      const nums = alertas.map((a: { numero: number }) => a.numero);
      setResultado({ suspeitas: data.suspeitas, alertas });
      onAlertasChange?.(nums);
      setMsg(
        data.suspeitas === 0
          ? "Nenhuma inconsistência nas regras estruturais."
          : `${data.suspeitas} questão(ões) com problema (bloco×matéria, biologia, campos vazios, idioma…). Corrija na tabela abaixo ou reclassifique.`
      );
    } catch {
      setMsg("Erro de rede ao auditar.");
    } finally {
      setAuditing(false);
    }
  }, [provaId, textoFonteColado, onAlertasChange]);

  async function reclassificar(numero: number) {
    const texto = textos[numero]?.trim();
    if (!texto) {
      setMsg(`Cole o texto da questão ${numero} no campo abaixo dela.`);
      return;
    }
    setReclassificando(numero);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/reclassificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero,
          texto,
          observacoes: orientacaoPara(numero, resultado?.alertas.find((x) => x.numero === numero)?.motivos) || undefined,
          salvarOrientacao: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao reclassificar");
        return;
      }
      setTextos((t) => {
        const next = { ...t };
        delete next[numero];
        return next;
      });
      onQuestoesAtualizadas?.();
      setMsg(
        `Questão ${numero} atualizada (${data.modeloUsado ?? "IA"}): ${data.materia} — ${data.assunto}. Conferindo auditoria…`
      );
      await auditar();
    } catch {
      setMsg("Erro de rede ao reclassificar.");
    } finally {
      setReclassificando(null);
    }
  }

  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <h2 className="mb-2 font-semibold text-violet-900">Auditoria e correção</h2>
      <p className="mb-3 text-sm text-violet-900">
        Audita <strong>todas</strong> as questões. Corrija na tabela ou use{" "}
        <strong>Reclassificar</strong> com enunciado +{" "}
        <strong>orientação para a IA</strong> (o que ela errou). Sem orientação, só o texto da
        questão.
      </p>
      <Button type="button" disabled={auditing} onClick={auditar}>
        {auditing ? "Analisando..." : "Auditar classificações"}
      </Button>
      {msg && <p className="mt-2 text-sm text-violet-900">{msg}</p>}

      {resultado && resultado.suspeitas > 0 && (
        <ul className="mt-4 space-y-4">
          {resultado.alertas.map((a) => (
            <li
              key={a.numero}
              className={`rounded-xl border p-4 ${
                a.severidade === "alta"
                  ? "border-rose-300 bg-white"
                  : "border-amber-300 bg-white"
              }`}
            >
              <div className="mb-2">
                <span className="text-lg font-bold text-slate-900">Questão {a.numero}</span>
                <span className="ml-2 text-sm text-slate-600">
                  hoje: {a.atual.materia} — {a.atual.assunto}
                </span>
              </div>
              <p className="mb-2 text-xs text-slate-600">{a.motivos.join(" ")}</p>
              {a.parRemoto && (
                <p className="mb-2 text-xs text-teal-800">
                  (Parece repetir classificação da q.{a.parRemoto.numero}, não dos vizinhos.)
                </p>
              )}
              <label className="mb-1 block text-sm font-medium text-slate-800">
                Cole aqui o texto completo desta questão (do caderno/PDF em texto)
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                rows={6}
                placeholder={`Enunciado, alternativas e tudo que aparecer na questão ${a.numero}…`}
                value={textos[a.numero] ?? a.enunciado ?? ""}
                onChange={(e) =>
                  setTextos((t) => ({ ...t, [a.numero]: e.target.value }))
                }
              />
              <label className="mb-1 mt-3 block text-sm font-medium text-slate-800">
                Orientação para a IA (opcional — salva ao reclassificar)
              </label>
              <textarea
                className="w-full rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm"
                rows={2}
                placeholder="Ex.: Matéria correta: Geografia (clima/relevo). Não é Biologia."
                value={
                  orientacoes[a.numero] ??
                  orientacoesSalvas[a.numero] ??
                  ""
                }
                onChange={(e) =>
                  setOrientacoes((t) => ({ ...t, [a.numero]: e.target.value }))
                }
              />
              <p className="mt-1 text-xs text-slate-500">
                Se vazio, usa motivos da auditoria como dica. Para persistir sem reclassificar,
                salve na tabela editável abaixo.
              </p>
              <Button
                type="button"
                className="mt-2"
                disabled={reclassificando !== null}
                onClick={() => reclassificar(a.numero)}
              >
                {reclassificando === a.numero
                  ? "Reclassificando…"
                  : `Reclassificar questão ${a.numero}`}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {resultado && resultado.suspeitas === 0 && (
        <p className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          Tudo certo nas regras automáticas — nenhuma questão suspeita.
        </p>
      )}
    </Card>
  );
}
