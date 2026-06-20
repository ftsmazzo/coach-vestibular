"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

interface AlertaAuditoria {
  numero: number;
  idiomaVariante?: string;
  severidade: "alta" | "media";
  motivos: string[];
  atual: {
    materia: string;
    assunto: string;
  };
}

interface ResultadoAuditoria {
  suspeitas: number;
  alertas: AlertaAuditoria[];
}

interface Props {
  provaId: string;
  textoFonteColado?: string;
  orientacoesSalvas?: Record<number, string>;
  onQuestoesAtualizadas?: () => void;
  onAlertasChange?: (chaves: string[]) => void;
  onEditarQuestao?: (numero: number, idiomaVariante?: string) => void;
  /** Incrementa após salvar questão — reexecuta auditoria se já rodou antes. */
  atualizarAuditoria?: number;
}

export function AdminAuditoriaProva({
  provaId,
  textoFonteColado = "",
  orientacoesSalvas = {},
  onQuestoesAtualizadas,
  onAlertasChange,
  onEditarQuestao,
  atualizarAuditoria = 0,
}: Props) {
  const [auditing, setAuditing] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAuditoria | null>(null);
  const [msg, setMsg] = useState("");
  const [reclassificarAlvo, setReclassificarAlvo] = useState<{
    numero: number;
    idiomaVariante?: string;
  } | null>(null);
  const [textoReclassificar, setTextoReclassificar] = useState("");
  const [orientacaoReclassificar, setOrientacaoReclassificar] = useState("");
  const [reclassificando, setReclassificando] = useState(false);
  const [normalizandoAreas, setNormalizandoAreas] = useState(false);

  async function normalizarAreas() {
    setNormalizandoAreas(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/normalizar-areas`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setMsg(data.mensagem ?? "Áreas padronizadas.");
      onQuestoesAtualizadas?.();
      if (resultado) await auditar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao padronizar áreas.");
    } finally {
      setNormalizandoAreas(false);
    }
  }

  const auditar = useCallback(async () => {
    setAuditing(true);
    setMsg("");
    setReclassificarAlvo(null);
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
        onAlertasChange?.([]);
        return;
      }
      const alertas = data.alertas ?? [];
      const chaves = alertas.map(
        (a: { numero: number; idiomaVariante?: string }) =>
          `${a.numero}:${a.idiomaVariante ?? "COMUM"}`
      );
      setResultado({ suspeitas: data.suspeitas, alertas });
      onAlertasChange?.(chaves);
      setMsg(
        data.suspeitas === 0
          ? "Nenhuma inconsistência grave encontrada."
          : `${data.suspeitas} questão(ões) com possível erro — veja a lista abaixo e use Editar na tabela.`
      );
    } catch {
      setMsg("Erro de rede ao auditar.");
    } finally {
      setAuditing(false);
    }
  }, [provaId, textoFonteColado, onAlertasChange]);

  useEffect(() => {
    if (atualizarAuditoria > 0 && resultado !== null) {
      void auditar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reauditar após salvar
  }, [atualizarAuditoria]);

  function abrirReclassificar(a: AlertaAuditoria) {
    setReclassificarAlvo({ numero: a.numero, idiomaVariante: a.idiomaVariante });
    setTextoReclassificar("");
    setOrientacaoReclassificar(
      orientacoesSalvas[a.numero]?.trim() ||
        (a.motivos.length ? `Auditoria: ${a.motivos[0]}` : "")
    );
  }

  function chaveAlerta(a: AlertaAuditoria): string {
    return `${a.numero}:${a.idiomaVariante ?? "COMUM"}`;
  }

  async function confirmarReclassificar() {
    if (reclassificarAlvo == null) return;
    const { numero, idiomaVariante } = reclassificarAlvo;
    const texto = textoReclassificar.trim();
    if (!texto) {
      setMsg(`Cole o enunciado da questão ${numero}.`);
      return;
    }
    setReclassificando(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/reclassificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero,
          idiomaVariante: idiomaVariante ?? "COMUM",
          texto,
          observacoes: orientacaoReclassificar.trim() || undefined,
          salvarOrientacao: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao reclassificar");
        return;
      }
      setReclassificarAlvo(null);
      onQuestoesAtualizadas?.();
      const rotulo =
        idiomaVariante && idiomaVariante !== "COMUM"
          ? `${data.numero} (${idiomaVariante === "INGLES" ? "EN" : "ES"})`
          : `${data.numero}`;
      setMsg(`Questão ${rotulo} atualizada: ${data.materia} — ${data.assunto}.`);
      await auditar();
    } catch {
      setMsg("Erro de rede ao reclassificar.");
    } finally {
      setReclassificando(false);
    }
  }

  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <h2 className="mb-2 font-semibold text-violet-900">Auditoria</h2>
      <p className="mb-3 text-sm text-violet-900">
        Verifica inconsistências graves (bloco×matéria, idioma, classificação errada). Áreas usam
        só 4 rótulos internos: Línguas e códigos, Ciências Humanas, Ciências Naturais, Exatas.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={auditing} onClick={auditar}>
          {auditing ? "Analisando..." : "Auditar classificações"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={normalizandoAreas || auditing}
          onClick={normalizarAreas}
        >
          {normalizandoAreas ? "Padronizando..." : "Padronizar áreas (4 blocos)"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-sm text-violet-900">{msg}</p>}

      {resultado && resultado.suspeitas > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-violet-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-violet-50/80 text-slate-600">
                <th className="p-2">#</th>
                <th className="p-2">Atual</th>
                <th className="p-2">Motivo</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {resultado.alertas.map((a) => (
                <tr key={chaveAlerta(a)} className="border-b border-slate-100">
                  <td className="p-2 font-medium">
                    {a.numero}
                    {a.idiomaVariante && a.idiomaVariante !== "COMUM" && (
                      <span className="ml-1 text-[10px] font-normal text-slate-500">
                        {a.idiomaVariante === "INGLES" ? "EN" : "ES"}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-slate-700">
                    {a.atual.materia} — {a.atual.assunto}
                  </td>
                  <td className="p-2 max-w-md text-xs text-slate-600">
                    {a.motivos[0]}
                    {a.motivos.length > 1 ? ` (+${a.motivos.length - 1})` : ""}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="secondary"
                      className="mr-1 px-2 py-1 text-xs"
                      onClick={() => onEditarQuestao?.(a.numero, a.idiomaVariante)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() =>
                        reclassificarAlvo?.numero === a.numero &&
                        (reclassificarAlvo?.idiomaVariante ?? "COMUM") ===
                          (a.idiomaVariante ?? "COMUM")
                          ? setReclassificarAlvo(null)
                          : abrirReclassificar(a)
                      }
                    >
                      {reclassificarAlvo?.numero === a.numero &&
                      (reclassificarAlvo?.idiomaVariante ?? "COMUM") ===
                        (a.idiomaVariante ?? "COMUM")
                        ? "Fechar IA"
                        : "IA"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reclassificarAlvo != null && (
        <div className="mt-4 rounded-xl border border-violet-300 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">
            Reclassificar questão {reclassificarAlvo.numero}
            {reclassificarAlvo.idiomaVariante &&
              reclassificarAlvo.idiomaVariante !== "COMUM" && (
                <span className="ml-1 text-slate-500">
                  ({reclassificarAlvo.idiomaVariante === "INGLES" ? "Inglês" : "Espanhol"})
                </span>
              )}{" "}
            com IA
          </p>
          <textarea
            className="mb-2 w-full rounded-lg border p-2 text-sm"
            rows={5}
            placeholder="Cole o enunciado completo desta questão…"
            value={textoReclassificar}
            onChange={(e) => setTextoReclassificar(e.target.value)}
          />
          <textarea
            className="mb-2 w-full rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-sm"
            rows={2}
            placeholder="Orientação opcional para a IA…"
            value={orientacaoReclassificar}
            onChange={(e) => setOrientacaoReclassificar(e.target.value)}
          />
          <Button
            type="button"
            disabled={reclassificando}
            onClick={confirmarReclassificar}
          >
            {reclassificando ? "Reclassificando…" : "Reclassificar"}
          </Button>
        </div>
      )}

      {resultado && resultado.suspeitas === 0 && (
        <p className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          Nenhuma inconsistência grave detectada.
        </p>
      )}
    </Card>
  );
}
