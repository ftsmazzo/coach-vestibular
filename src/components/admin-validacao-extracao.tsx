"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { LinhaExtracaoRelatorio, RelatorioExtracaoProva } from "@/lib/prova-extracao-relatorio";
import { ENUNCIADO_VALIDACAO_MIN_CHARS } from "@/lib/prova-texto-prova";

interface Props {
  provaId: string;
  extracaoValidada: boolean;
  /** Muda após gravar extração ou editar questão — força recarregar relatório. */
  refreshKey?: string;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

function labelVariante(v: string): string {
  if (v === "INGLES") return "EN";
  if (v === "ESPANHOL") return "ES";
  return "";
}

function badgeStatus(status: LinhaExtracaoRelatorio["status"]) {
  if (status === "ok") return "bg-emerald-100 text-emerald-800";
  if (status === "curto") return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-800";
}

function labelStatus(status: LinhaExtracaoRelatorio["status"]) {
  if (status === "ok") return "OK";
  if (status === "curto") return "Curto";
  return "Faltando";
}

async function copiarTexto(texto: string, onOk: () => void) {
  try {
    await navigator.clipboard.writeText(texto);
    onOk();
  } catch {
    /* fallback */
  }
}

function rotuloQuestao(linha: LinhaExtracaoRelatorio): string {
  const v = labelVariante(linha.idiomaVariante);
  return v ? `Questão ${linha.numero} (${v})` : `Questão ${linha.numero}`;
}

export function AdminValidacaoExtracao({
  provaId,
  extracaoValidada,
  refreshKey,
  onMensagem,
  onAtualizado,
}: Props) {
  const [relatorio, setRelatorio] = useState<RelatorioExtracaoProva | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "problemas">("problemas");
  const [editando, setEditando] = useState<string | null>(null);
  const [formEnunciado, setFormEnunciado] = useState("");
  const [formAlternativas, setFormAlternativas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aceitando, setAceitando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/extracao`);
      const data = await res.json();
      if (!res.ok) {
        onMensagem(data.error ?? "Erro ao carregar extração");
        return;
      }
      setRelatorio(data.relatorio ?? null);
      const r = data.relatorio as RelatorioExtracaoProva | undefined;
      if (r && r.curto + r.faltando === 0 && r.ok > 0) {
        setFiltro("todos");
      }
    } catch {
      onMensagem("Falha de rede ao carregar extração.");
    } finally {
      setCarregando(false);
    }
  }, [provaId, onMensagem]);

  useEffect(() => {
    void carregar();
  }, [carregar, extracaoValidada, refreshKey]);

  function abrirEdicao(linha: LinhaExtracaoRelatorio) {
    setEditando(linha.chave);
    setFormEnunciado(linha.enunciado ?? "");
    setFormAlternativas(linha.alternativas ?? "");
  }

  async function salvarLinha(linha: LinhaExtracaoRelatorio) {
    if (formEnunciado.trim().length < 15) {
      onMensagem("Cole o enunciado completo (mínimo 15 caracteres).");
      return;
    }
    setSalvando(true);
    onMensagem("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/extracao/questao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: linha.numero,
          idiomaVariante: linha.idiomaVariante,
          enunciado: formEnunciado.trim(),
          alternativas: formAlternativas.trim() || null,
          areaBloco: linha.areaBloco,
        }),
      });
      const data = await res.json();
      setSalvando(false);
      if (!res.ok) {
        onMensagem(data.error ?? "Erro ao salvar");
        return;
      }
      setEditando(null);
      onMensagem(`Questão ${linha.numero}${labelVariante(linha.idiomaVariante) ? ` ${labelVariante(linha.idiomaVariante)}` : ""} atualizada.`);
      await carregar();
      onAtualizado();
    } catch {
      setSalvando(false);
      onMensagem("Falha de rede ao salvar.");
    }
  }

  async function aceitarLinha(linha: LinhaExtracaoRelatorio) {
    setAceitando(linha.chave);
    onMensagem("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/extracao/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: linha.numero,
          idiomaVariante: linha.idiomaVariante,
        }),
      });
      const data = await res.json();
      setAceitando(null);
      if (!res.ok) {
        onMensagem(data.error ?? "Erro ao aceitar");
        return;
      }
      onMensagem(
        `Questão ${linha.numero}${labelVariante(linha.idiomaVariante) ? ` ${labelVariante(linha.idiomaVariante)}` : ""} aceita como completa.`
      );
      await carregar();
      onAtualizado();
    } catch {
      setAceitando(null);
      onMensagem("Falha de rede.");
    }
  }

  async function validarExtracao() {
    setValidando(true);
    onMensagem("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/extracao/validar`, {
        method: "POST",
      });
      const data = await res.json();
      setValidando(false);
      if (!res.ok) {
        onMensagem(data.error ?? "Não foi possível validar");
        if (data.relatorio) setRelatorio(data.relatorio);
        return;
      }
      onMensagem(data.mensagem ?? "Extração validada.");
      await carregar();
      onAtualizado();
    } catch {
      setValidando(false);
      onMensagem("Falha de rede.");
    }
  }

  if (carregando && !relatorio) {
    return (
      <Card className="border-slate-200">
        <p className="text-sm text-slate-600">Carregando relatório de extração…</p>
      </Card>
    );
  }

  if (!relatorio || relatorio.linhasEsperadas === 0) {
    return null;
  }

  const linhasVisiveis =
    filtro === "problemas"
      ? relatorio.linhas.filter((l) => l.status !== "ok")
      : relatorio.linhas;

  return (
    <Card className="border-teal-200 bg-teal-50/40">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-teal-900">Passo 3 — Validar extração</h2>
          <p className="mt-1 text-sm text-teal-800">
            Revise enunciados e alternativas antes de qualquer classificação. Enunciados com menos de{" "}
            {ENUNCIADO_VALIDACAO_MIN_CHARS} caracteres aparecem como <strong>Curto</strong> — se o
            texto já está completo (comum em matemática), use <strong>Aceitar enunciado</strong> na
            linha. Depois clique <strong>Confirmar extração completa</strong>.
            {relatorio.linhasNoBanco > relatorio.linhasEsperadas && (
              <span className="block text-xs text-teal-700 mt-1">
                {relatorio.linhasNoBanco} linhas no banco ({relatorio.linhasEsperadas} esperadas
                {relatorio.linhasEsperadas < relatorio.totalEsperado + 5 ? " com EN+ES na faixa" : ""}
                ).
              </span>
            )}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {relatorio.ok}/{relatorio.linhasEsperadas} OK · {relatorio.curto} curto(s) ·{" "}
            {relatorio.faltando} faltando
          </p>
        </div>
        {extracaoValidada ? (
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            Extração validada
          </span>
        ) : (
          <Button
            type="button"
            disabled={validando || !relatorio.prontaParaValidar}
            onClick={validarExtracao}
          >
            {validando ? "Validando…" : "Confirmar extração completa"}
          </Button>
        )}
      </div>

      <div className="mb-3 flex gap-2">
        <Button
          type="button"
          variant={filtro === "problemas" ? "primary" : "secondary"}
          className="text-xs"
          onClick={() => setFiltro("problemas")}
        >
          Só problemas ({relatorio.curto + relatorio.faltando})
        </Button>
        <Button
          type="button"
          variant={filtro === "todos" ? "primary" : "secondary"}
          className="text-xs"
          onClick={() => setFiltro("todos")}
        >
          Todas ({relatorio.linhasEsperadas})
        </Button>
        <Button type="button" variant="secondary" className="text-xs" onClick={() => void carregar()}>
          Atualizar
        </Button>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-lg border border-teal-100 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Idioma</th>
              <th className="p-2">Área</th>
              <th className="p-2">Chars</th>
              <th className="p-2">Status</th>
              <th className="p-2">Prévia</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((linha) => (
              <Fragment key={linha.chave}>
                <tr className="border-t align-top">
                  <td className="p-2 font-medium">{linha.numero}</td>
                  <td className="p-2">{labelVariante(linha.idiomaVariante) || "—"}</td>
                  <td className="p-2 max-w-[100px] truncate text-xs">{linha.areaBloco ?? "—"}</td>
                  <td className="p-2">{linha.tamanhoEnunciado}</td>
                  <td className="p-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${badgeStatus(linha.status)}`}
                    >
                      {labelStatus(linha.status)}
                      {linha.aceitoManualmente ? " ✓" : ""}
                    </span>
                  </td>
                  <td className="p-2 max-w-[280px] truncate text-xs text-slate-600">
                    {linha.enunciado?.slice(0, 120) ?? "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        onClick={() => abrirEdicao(linha)}
                      >
                        {linha.status === "faltando" ? "Colar texto" : "Corrigir"}
                      </Button>
                      {linha.status === "curto" && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs px-2 py-1 border-emerald-300 text-emerald-800"
                          disabled={aceitando === linha.chave}
                          title="Enunciado curto mas completo — ex.: matemática direta"
                          onClick={() => void aceitarLinha(linha)}
                        >
                          {aceitando === linha.chave ? "…" : "Aceitar enunciado"}
                        </Button>
                      )}
                      {linha.status !== "ok" && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs px-2 py-1"
                          title="Copia rótulo para colar no PDF ou reportar erro"
                          onClick={() => {
                            void copiarTexto(
                              `${rotuloQuestao(linha)} — área: ${linha.areaBloco ?? "?"} — status: ${labelStatus(linha.status)}\n\n[COLE AQUI o enunciado literal do PDF]\n\nAlternativas:\nA) \nB) \nC) \nD) \nE) `,
                              () => {
                                setCopiado(linha.chave);
                                setTimeout(() => setCopiado(null), 2000);
                              }
                            );
                          }}
                        >
                          {copiado === linha.chave ? "Copiado!" : "Copiar modelo"}
                        </Button>
                      )}
                      {linha.enunciado && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs px-2 py-1"
                          onClick={() => {
                            void copiarTexto(linha.enunciado ?? "", () => {
                              setCopiado(`${linha.chave}-en`);
                              setTimeout(() => setCopiado(null), 2000);
                            });
                          }}
                        >
                          {copiado === `${linha.chave}-en` ? "Copiado!" : "Copiar enunciado"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {editando === linha.chave && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={7} className="p-3">
                      <p className="mb-2 text-xs font-medium text-slate-700">
                        Questão {linha.numero}
                        {labelVariante(linha.idiomaVariante)
                          ? ` (${labelVariante(linha.idiomaVariante)})`
                          : ""}{" "}
                        — cole o texto literal do PDF
                      </p>
                      <label className="mb-1 block text-xs text-slate-500">Enunciado</label>
                      <textarea
                        className="mb-2 w-full rounded border border-slate-200 p-2 font-mono text-xs"
                        rows={8}
                        value={formEnunciado}
                        onChange={(e) => setFormEnunciado(e.target.value)}
                        placeholder="Texto de apoio + comando da questão…"
                      />
                      <label className="mb-1 block text-xs text-slate-500">
                        Alternativas (opcional)
                      </label>
                      <textarea
                        className="mb-3 w-full rounded border border-slate-200 p-2 font-mono text-xs"
                        rows={4}
                        value={formAlternativas}
                        onChange={(e) => setFormAlternativas(e.target.value)}
                        placeholder="A) … B) … C) …"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={salvando}
                          onClick={() => void salvarLinha(linha)}
                        >
                          {salvando ? "Salvando…" : "Salvar questão"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditando(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!extracaoValidada && !relatorio.prontaParaValidar && (
        <p className="mt-3 text-xs text-amber-800">
          Corrija ou cole o texto das questões marcadas como Faltando ou Curto antes de confirmar.
        </p>
      )}
    </Card>
  );
}
