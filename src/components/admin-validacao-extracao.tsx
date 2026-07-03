"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { LinhaExtracaoRelatorio, RelatorioExtracaoProva } from "@/lib/prova-extracao-relatorio";
import { ENUNCIADO_VALIDACAO_MIN_CHARS } from "@/lib/prova-texto-prova";

interface Props {
  provaId: string;
  extracaoValidada: boolean;
  refreshKey?: string;
  coberturaOk?: boolean;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
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

function rotuloLinha(linha: LinhaExtracaoRelatorio): string {
  return `Ordem ${linha.ordemExtracao} · Q${linha.numero} (caderno)`;
}

export function AdminValidacaoExtracao({
  provaId,
  extracaoValidada,
  refreshKey,
  coberturaOk = true,
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
  const [reabrindo, setReabrindo] = useState(false);
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
    if (!linha.questaoId) {
      onMensagem("Linha sem id no banco — reextraia a prova.");
      return;
    }
    setEditando(linha.chave);
    setFormEnunciado(linha.enunciado ?? "");
    setFormAlternativas(linha.alternativas ?? "");
  }

  async function salvarLinha(linha: LinhaExtracaoRelatorio) {
    if (!linha.questaoId) {
      onMensagem("Linha sem id no banco.");
      return;
    }
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
          questaoId: linha.questaoId,
          enunciado: formEnunciado.trim(),
          alternativas: formAlternativas.trim() || null,
        }),
      });
      const data = await res.json();
      setSalvando(false);
      if (!res.ok) {
        onMensagem(data.error ?? "Erro ao salvar");
        return;
      }
      setEditando(null);
      onMensagem(`${rotuloLinha(linha)} atualizada.`);
      await carregar();
      onAtualizado();
    } catch {
      setSalvando(false);
      onMensagem("Falha de rede ao salvar.");
    }
  }

  async function aceitarLinha(linha: LinhaExtracaoRelatorio) {
    if (!linha.questaoId) return;
    setAceitando(linha.chave);
    onMensagem("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/extracao/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questaoId: linha.questaoId }),
      });
      const data = await res.json();
      setAceitando(null);
      if (!res.ok) {
        onMensagem(data.error ?? "Erro ao aceitar");
        return;
      }
      onMensagem(`${rotuloLinha(linha)} aceita como completa.`);
      await carregar();
      onAtualizado();
    } catch {
      setAceitando(null);
      onMensagem("Falha de rede.");
    }
  }

  async function reabrirExtracao() {
    setReabrindo(true);
    onMensagem("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/extracao/reabrir`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        onMensagem(data.error ?? "Erro ao reabrir extração");
        return;
      }
      onMensagem(data.mensagem ?? "Extração reaberta para correção.");
      onAtualizado();
    } catch {
      onMensagem("Falha de rede.");
    } finally {
      setReabrindo(false);
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

  if (!relatorio || relatorio.linhasFisicas === 0) {
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
          <h2 className="font-semibold text-teal-900">Validar enunciados</h2>
          <p className="mt-1 text-sm text-teal-800">
            Uma linha por ocorrência física no PDF. <strong>Ordem</strong> = posição no caderno;{" "}
            <strong>Q#</strong> = número impresso (pode repetir em blocos EN/ES). Revise antes de
            qualquer classificação. Mínimo {ENUNCIADO_VALIDACAO_MIN_CHARS} caracteres no enunciado.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {relatorio.ok}/{relatorio.linhasFisicas} OK · {relatorio.curto} curto(s) ·{" "}
            {relatorio.faltando} faltando · {relatorio.linhasFisicas} linha(s) física(s) · cadastro{" "}
            {relatorio.totalLogicoCadastro} lógica(s)
            {relatorio.coberturaFaltando > 0 && (
              <> · {relatorio.coberturaFaltando} lógica(s) ausente(s)</>
            )}
            {relatorio.textoIncompleto > 0 && (
              <> · {relatorio.textoIncompleto} texto incompleto</>
            )}
          </p>
          {relatorio.linhasFisicasEsperadas != null &&
            relatorio.linhasFisicas !== relatorio.linhasFisicasEsperadas && (
              <p className="mt-1 text-xs text-amber-800">
                Esperado {relatorio.linhasFisicasEsperadas} linha(s) física(s) para esta prova
                (EN/ES duplicado); no banco há {relatorio.linhasFisicas}.
              </p>
            )}
        </div>
        {extracaoValidada ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white self-center">
              Extração validada
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={reabrindo}
              onClick={() => void reabrirExtracao()}
            >
              {reabrindo ? "Reabrindo…" : "Reabrir correções"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            disabled={validando || !relatorio.prontaParaValidar || !coberturaOk}
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
          Todas ({relatorio.linhasFisicas})
        </Button>
        <Button type="button" variant="secondary" className="text-xs" onClick={() => void carregar()}>
          Atualizar
        </Button>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-lg border border-teal-100 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-2">Ordem</th>
              <th className="p-2">Q#</th>
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
                  <td className="p-2 font-medium">{linha.ordemExtracao}</td>
                  <td className="p-2">{linha.numero || "—"}</td>
                  <td className="p-2">{linha.tamanhoEnunciado}</td>
                  <td className="p-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${badgeStatus(linha.status)}`}
                    >
                      {labelStatus(linha.status)}
                      {linha.aceitoManualmente ? " ✓" : ""}
                    </span>
                  </td>
                  <td className="p-2 max-w-[260px] truncate text-xs text-slate-600">
                    {linha.enunciado?.slice(0, 120) ?? "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        disabled={!linha.questaoId}
                        onClick={() => abrirEdicao(linha)}
                      >
                        {linha.status === "faltando" ? "Colar texto" : "Corrigir"}
                      </Button>
                      {linha.status === "curto" && linha.questaoId && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs px-2 py-1 border-emerald-300 text-emerald-800"
                          disabled={aceitando === linha.chave}
                          onClick={() => void aceitarLinha(linha)}
                        >
                          {aceitando === linha.chave ? "…" : "Aceitar enunciado"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {editando === linha.chave && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={6} className="p-3">
                      <p className="mb-2 text-xs font-medium text-slate-700">
                        {rotuloLinha(linha)} — cole o texto literal do PDF
                      </p>
                      <textarea
                        className="mb-2 w-full rounded border border-slate-200 p-2 font-mono text-xs"
                        rows={8}
                        value={formEnunciado}
                        onChange={(e) => setFormEnunciado(e.target.value)}
                        placeholder="Texto de apoio + comando da questão…"
                      />
                      <textarea
                        className="mb-3 w-full rounded border border-slate-200 p-2 font-mono text-xs"
                        rows={4}
                        value={formAlternativas}
                        onChange={(e) => setFormAlternativas(e.target.value)}
                        placeholder="Alternativas A) … B) …"
                      />
                      <div className="flex gap-2">
                        <Button type="button" disabled={salvando} onClick={() => void salvarLinha(linha)}>
                          {salvando ? "Salvando…" : "Salvar linha"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setEditando(null)}>
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
        <ul className="mt-3 list-inside list-disc text-xs text-amber-800">
          {relatorio.bloqueiosValidacao.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {!extracaoValidada && !coberturaOk && (
        <p className="mt-2 text-xs text-amber-800">
          Complete a cobertura do banco (grade acima) antes de confirmar a extração.
        </p>
      )}
    </Card>
  );
}
