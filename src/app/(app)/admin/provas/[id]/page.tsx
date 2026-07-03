"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminProvaAbaPedagogia } from "@/components/admin-prova/admin-prova-aba-pedagogia";
import { AdminProvaAbaProva } from "@/components/admin-prova/admin-prova-aba-prova";
import { AdminProvaAbaQuestoes } from "@/components/admin-prova/admin-prova-aba-questoes";
import { AdminProvaMensagem } from "@/components/admin-prova/admin-prova-mensagem";
import { AdminProvaQuestaoModal } from "@/components/admin-prova/admin-prova-questao-modal";
import { AdminProvaResumoStatus } from "@/components/admin-prova/admin-prova-resumo-status";
import { AdminProvaTabNav } from "@/components/admin-prova/admin-prova-tab-nav";
import type { AbaProvaAdmin, ProvaAdmin, ProvaMetaForm } from "@/components/admin-prova/types";
import { numerosLogicosRevisaoImagem } from "@/lib/prova-revisao-imagem";
import {
  calcularPendenciasProva,
  hrefAdminProva,
  parseAbaProvaUrl,
  parseFiltroTabelaPedagogia,
  resumoPendenciasQuestoes,
} from "@/lib/prova-pendencias-admin";
import { statsFasesProva } from "@/lib/prova-classificacao-stats";
import {
  buildGradeRevisao,
  gradeFromQuestoesGabarito,
  itensGabaritoOficialFromGrade,
  respostasParaGabaritoLote,
  type LinhaRevisaoGabarito,
} from "@/lib/extrair-gabarito-aluno";
import { resolverFaixaIdiomaDualDeQuestoes } from "@/lib/prova-idioma";
import { parseGabaritoLoteDual } from "@/lib/gabarito";
import { resolverNumerosGradeProva } from "@/lib/prova-numeracao";
import { Button, Card } from "@/components/ui";

function ForcarRecalculoButton({ examId }: { examId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRecalculate = async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/exams/${examId}/recalcular`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao recalcular");
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        disabled={status === "loading"}
        onClick={handleRecalculate}
        variant={status === "success" ? "primary" : status === "error" ? "danger" : "secondary"}
        className="px-3 py-1.5 text-xs font-bold"
      >
        {status === "loading" && "Recalculando…"}
        {status === "success" && "✓ Sucesso!"}
        {status === "error" && "✗ Erro"}
        {status === "idle" && "Recalcular plano (Coach IA)"}
      </Button>
      {errorMessage && (
        <span className="max-w-[200px] truncate text-[10px] font-medium text-rose-600">{errorMessage}</span>
      )}
    </div>
  );
}

export default function AdminProvaDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const filtroPedagogiaUrl = searchParams.get("filtro");
  const [urlInicialLida, setUrlInicialLida] = useState(false);
  const [prova, setProva] = useState<ProvaAdmin | null>(null);
  const [aba, setAba] = useState<AbaProvaAdmin>("questoes");
  const [modalNumero, setModalNumero] = useState<number | null>(null);
  const [gabaritoLote, setGabaritoLote] = useState("");
  const [gradeGabarito, setGradeGabarito] = useState<LinhaRevisaoGabarito[] | null>(null);
  const [arquivosGabarito, setArquivosGabarito] = useState<File[]>([]);
  const [extraindoGabaritoFoto, setExtraindoGabaritoFoto] = useState(false);
  const [avisosExtracaoGabarito, setAvisosExtracaoGabarito] = useState<string[]>([]);
  const [lidasIaGabarito, setLidasIaGabarito] = useState<number | undefined>();
  const [csvIncluirGabarito, setCsvIncluirGabarito] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [cadernoFile, setCadernoFile] = useState<File | null>(null);
  const [salvandoCaderno, setSalvandoCaderno] = useState(false);
  const [msg, setMsg] = useState("");
  const [alertaChaves, setAlertaChaves] = useState<string[]>([]);
  const [editarQuestaoAlvo, setEditarQuestaoAlvo] = useState<{
    numero: number;
    idiomaVariante?: string;
  } | null>(null);
  const [meta, setMeta] = useState<ProvaMetaForm>({
    banca: "",
    ano: "",
    dia: "",
    caderno: "",
    totalQuestoes: "",
    descricao: "",
    ordemIdiomasFaixa: "INGLES_PRIMEIRO",
    politicaIdiomas: "NENHUMA",
    idiomaQuestaoInicio: "",
    idiomaQuestaoFim: "",
  });
  const [detectandoFaixa, setDetectandoFaixa] = useState(false);

  const extracaoRefreshKey = useMemo(() => {
    if (!prova) return "init";
    const chars = prova.questoes.reduce((s, q) => s + (q.enunciado?.length ?? 0), 0);
    return `${prova.questoes.length}:${prova.politicaIdiomas ?? ""}:${chars}:${prova.extracaoValidada ?? false}`;
  }, [prova]);

  const numerosGrade = useMemo(() => {
    if (!prova) return [];
    return resolverNumerosGradeProva({
      totalQuestoes: prova.totalQuestoes,
      dia: prova.dia,
      banca: prova.banca,
      numerosCadastrados: prova.questoes.map((q) => q.numero),
    });
  }, [prova]);

  const faixaIdiomaDual = useMemo(() => {
    if (!prova) return null;
    return resolverFaixaIdiomaDualDeQuestoes(prova.questoes, prova, prova.totalQuestoes);
  }, [prova]);

  const revisaoImagem = useMemo(
    () => prova?.questoesRevisaoImagem ?? numerosLogicosRevisaoImagem(prova?.questoes ?? []),
    [prova?.questoes, prova?.questoesRevisaoImagem]
  );

  const pendencias = useMemo(
    () =>
      prova
        ? calcularPendenciasProva({
            totalQuestoes: prova.totalQuestoes,
            questoesCadastradas: prova.questoesCadastradas,
            questoesFaltando: prova.questoesFaltando,
            questoesRevisaoImagem: revisaoImagem,
            questoes: prova.questoes,
            extracaoValidada: prova.extracaoValidada,
            gabaritoCompleto: prova.gabaritoCompleto,
            temTextoFonte: prova.temTextoFonte,
          })
        : null,
    [prova, revisaoImagem]
  );

  const statsClassificacao = useMemo(
    () => (prova?.questoes.length ? statsFasesProva(prova.questoes) : null),
    [prova?.questoes]
  );

  const questaoModal = useMemo(() => {
    if (modalNumero == null || !prova) return null;
    return (
      prova.questoes.find(
        (q) =>
          q.numero === modalNumero &&
          (q.idiomaVariante === "COMUM" || !q.idiomaVariante)
      ) ??
      prova.questoes.find((q) => q.numero === modalNumero) ??
      null
    );
  }, [modalNumero, prova]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/provas/${id}`);
    if (res.ok) {
      const data: ProvaAdmin = await res.json();
      setProva(data);
      setMeta({
        banca: data.banca,
        ano: data.ano != null ? String(data.ano) : "",
        dia: data.dia != null ? String(data.dia) : "",
        caderno: data.caderno ?? "",
        totalQuestoes: String(data.totalQuestoes),
        descricao: data.descricao ?? "",
        ordemIdiomasFaixa: data.ordemIdiomasFaixa ?? "INGLES_PRIMEIRO",
        politicaIdiomas:
          data.politicaIdiomas === "DUPLICATA_EN_ES" ? "DUPLICATA_EN_ES" : "NENHUMA",
        idiomaQuestaoInicio:
          data.idiomaQuestaoInicio != null ? String(data.idiomaQuestaoInicio) : "",
        idiomaQuestaoFim: data.idiomaQuestaoFim != null ? String(data.idiomaQuestaoFim) : "",
      });
    }
  }, [id]);

  const aoAtualizarQuestoes = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (urlInicialLida) return;
    const abaParam = parseAbaProvaUrl(searchParams.get("aba"));
    if (abaParam) setAba(abaParam);
    const qRaw = searchParams.get("q");
    if (qRaw) {
      const n = parseInt(qRaw, 10);
      if (Number.isFinite(n) && n >= 1) setModalNumero(n);
    }
    setUrlInicialLida(true);
  }, [searchParams, urlInicialLida]);

  const syncUrl = useCallback(
    (opts: { aba?: AbaProvaAdmin; q?: number | null; filtro?: string | null }) => {
      const abaAtual = opts.aba ?? aba;
      const qAtual = opts.q === null ? undefined : (opts.q ?? modalNumero ?? undefined);
      const filtroAtual =
        opts.filtro === null
          ? undefined
          : (opts.filtro ?? filtroPedagogiaUrl ?? undefined);
      router.replace(
        hrefAdminProva(id, { aba: abaAtual, q: qAtual, filtro: filtroAtual }),
        { scroll: false }
      );
    },
    [aba, filtroPedagogiaUrl, id, modalNumero, router]
  );

  function mudarAba(nova: AbaProvaAdmin) {
    setAba(nova);
    syncUrl({ aba: nova });
  }

  function abrirModalQuestao(numero: number) {
    setModalNumero(numero);
    syncUrl({ q: numero });
  }

  function fecharModalQuestao() {
    setModalNumero(null);
    syncUrl({ q: null });
  }

  const filtroTabelaPedagogia = parseFiltroTabelaPedagogia(filtroPedagogiaUrl);

  useEffect(() => {
    if (!prova?.extracaoValidada || numerosGrade.length === 0) {
      setGradeGabarito(null);
      return;
    }
    setGradeGabarito(gradeFromQuestoesGabarito(numerosGrade, prova.questoes, faixaIdiomaDual));
  }, [prova, numerosGrade, faixaIdiomaDual]);

  function atualizarGradeGabarito(linhas: LinhaRevisaoGabarito[]) {
    setGradeGabarito(linhas);
    setGabaritoLote(
      respostasParaGabaritoLote(
        linhas.filter((l) => l.letra).map((l) => ({ numero: l.numero, letra: l.letra }))
      )
    );
  }

  async function lerGabaritoDaFoto() {
    if (!prova?.extracaoValidada) {
      setMsg("Valide a extração na aba Questões antes de montar o gabarito.");
      return;
    }
    if (!prova || arquivosGabarito.length === 0) {
      setMsg("Anexe um PDF ou foto do gabarito oficial.");
      return;
    }
    setExtraindoGabaritoFoto(true);
    setMsg("");
    const fd = new FormData();
    for (const f of arquivosGabarito) fd.append("file", f);
    try {
      const res = await fetch(`/api/admin/provas/${id}/extrair-gabarito`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Não foi possível ler o gabarito");
        return;
      }
      atualizarGradeGabarito(buildGradeRevisao(numerosGrade, data.respostas ?? []));
      setAvisosExtracaoGabarito(Array.isArray(data.avisos) ? data.avisos : []);
      setLidasIaGabarito(typeof data.lidas === "number" ? data.lidas : undefined);
      setMsg(`IA leu ${data.lidas ?? 0} resposta(s). Revise e salve.`);
    } catch {
      setMsg("Falha de rede ao ler gabarito.");
    } finally {
      setExtraindoGabaritoFoto(false);
    }
  }

  function aplicarTextoColadoNoGrid() {
    if (!prova?.extracaoValidada || numerosGrade.length === 0) return;
    const dualMap = parseGabaritoLoteDual(gabaritoLote);
    if (dualMap.size === 0) {
      setMsg("Nenhuma linha válida no texto colado.");
      return;
    }
    const base =
      gradeGabarito ?? gradeFromQuestoesGabarito(numerosGrade, prova.questoes, faixaIdiomaDual);
    const grade = base.map((linha) => {
      const item = dualMap.get(linha.numero);
      if (!item) return linha;
      const naFaixa =
        faixaIdiomaDual &&
        linha.numero >= faixaIdiomaDual.inicio &&
        linha.numero <= faixaIdiomaDual.fim;
      if (naFaixa && (item.ingles || item.espanhol)) {
        return {
          ...linha,
          letraEn: item.ingles ?? linha.letraEn ?? "",
          letraEs: item.espanhol ?? linha.letraEs ?? "",
          anuladaEn: item.ingles === "*",
          anuladaEs: item.espanhol === "*",
        };
      }
      if (item.comum) return { ...linha, letra: item.comum, anulada: item.comum === "*" };
      return linha;
    });
    setGradeGabarito(grade);
    setMsg(`Aplicadas ${dualMap.size} resposta(s) no grid.`);
  }

  async function detectarFaixaIdioma(aplicar: boolean) {
    setDetectandoFaixa(true);
    try {
      const inicio = meta.idiomaQuestaoInicio ? parseInt(meta.idiomaQuestaoInicio, 10) : undefined;
      const fim = meta.idiomaQuestaoFim ? parseInt(meta.idiomaQuestaoFim, 10) : undefined;
      const res = await fetch(`/api/admin/provas/${id}/detectar-faixa-idioma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aplicar,
          ...(inicio && fim && fim >= inicio ? { inicio, fim } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Não foi possível detectar a faixa.");
        return;
      }
      const p = data.proposta;
      if (p?.faixa) {
        setMeta((m) => ({
          ...m,
          politicaIdiomas: "DUPLICATA_EN_ES",
          idiomaQuestaoInicio: String(p.faixa.inicio),
          idiomaQuestaoFim: String(p.faixa.fim),
        }));
      }
      setMsg(aplicar ? `Faixa Q${p.faixa.inicio}–${p.faixa.fim} aplicada.` : `Sugestão: Q${p.faixa.inicio}–${p.faixa.fim}.`);
      if (aplicar) await load();
    } catch {
      setMsg("Falha de rede.");
    } finally {
      setDetectandoFaixa(false);
    }
  }

  async function salvarMetadados() {
    const inicio = meta.idiomaQuestaoInicio ? parseInt(meta.idiomaQuestaoInicio, 10) : null;
    const fim = meta.idiomaQuestaoFim ? parseInt(meta.idiomaQuestaoFim, 10) : null;
    const res = await fetch(`/api/admin/provas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        banca: meta.banca,
        ano: meta.ano ? parseInt(meta.ano, 10) : null,
        dia: meta.dia ? parseInt(meta.dia, 10) : null,
        caderno: meta.caderno || null,
        totalQuestoes: meta.totalQuestoes ? parseInt(meta.totalQuestoes, 10) : undefined,
        descricao: meta.descricao || null,
        politicaIdiomas: meta.politicaIdiomas,
        idiomaQuestaoInicio:
          meta.politicaIdiomas === "DUPLICATA_EN_ES" && inicio && fim && fim >= inicio ? inicio : null,
        idiomaQuestaoFim:
          meta.politicaIdiomas === "DUPLICATA_EN_ES" && inicio && fim && fim >= inicio ? fim : null,
        ...(meta.politicaIdiomas === "DUPLICATA_EN_ES"
          ? { ordemIdiomasFaixa: meta.ordemIdiomasFaixa }
          : {}),
      }),
    });
    setMsg(res.ok ? "Cadastro salvo." : "Erro ao salvar");
    load();
  }

  async function togglePublicada() {
    if (!prova) return;
    await fetch(`/api/admin/provas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicada: !prova.publicada }),
    });
    load();
  }

  async function enviarCaderno() {
    if (!cadernoFile) return;
    setSalvandoCaderno(true);
    const fd = new FormData();
    fd.append("file", cadernoFile);
    const res = await fetch(`/api/admin/provas/${id}/caderno`, { method: "POST", body: fd });
    const data = await res.json();
    setSalvandoCaderno(false);
    setMsg(res.ok ? (data.mensagem ?? "Caderno salvo.") : (data.error ?? "Erro"));
    if (res.ok) {
      setCadernoFile(null);
      load();
    }
  }

  async function removerCaderno() {
    if (!confirm("Remover o caderno do download dos alunos?")) return;
    const res = await fetch(`/api/admin/provas/${id}/caderno`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function limparGabaritos() {
    if (!confirm("Zerar o gabarito de TODAS as questões?")) return;
    const res = await fetch(`/api/admin/provas/${id}/gabarito`, { method: "DELETE" });
    const data = await res.json();
    setMsg(res.ok ? `Gabarito zerado (${data.removidos} questões).` : (data.error ?? "Erro"));
    load();
  }

  async function zerarQuestoes() {
    if (!confirm("Apagar TODAS as questões? A prova será despublicada.")) return;
    const res = await fetch(`/api/admin/provas/${id}/questoes`, { method: "DELETE" });
    if (res.ok) {
      setMsg("Questões removidas.");
      load();
    }
  }

  async function excluirProva() {
    if (!confirm(`Excluir "${prova?.nome}" permanentemente?`)) return;
    const res = await fetch(`/api/admin/provas/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/provas");
      router.refresh();
    }
  }

  async function salvarGabaritoLote() {
    if (!prova?.extracaoValidada) {
      setMsg("Valide a extração na aba Questões antes de salvar o gabarito.");
      return;
    }
    if (!gradeGabarito?.length) {
      setMsg("Marque ao menos uma alternativa no grid.");
      return;
    }
    const itens = itensGabaritoOficialFromGrade(gradeGabarito, faixaIdiomaDual);
    const res = await fetch(`/api/admin/provas/${id}/gabarito`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Gabarito salvo (${data.updated} itens).` : (data.error ?? "Erro"));
    load();
  }

  if (!prova || !pendencias) return <p className="text-slate-500">Carregando…</p>;

  const hintQuestoes = resumoPendenciasQuestoes(pendencias);
  const hintPedagogia = pendencias.gabaritoPendente ? "Gabarito incompleto" : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/admin/provas" className="text-sm text-teal-700 hover:underline">
        ← Banco de provas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{prova.nome}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {prova.banca}
            {prova.ano ? ` · ${prova.ano}` : ""}
            {prova.caderno ? ` · ${prova.caderno}` : ""}
          </p>
          <div className="mt-3">
            <AdminProvaResumoStatus
              pendencias={pendencias}
              publicada={prova.publicada}
              extracaoValidada={prova.extracaoValidada ?? false}
              comN1={statsClassificacao?.comN1 ?? 0}
              totalLinhasBanco={prova.questoes.length}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={togglePublicada}>
            {prova.publicada ? "Despublicar" : "Publicar"}
          </Button>
        </div>
      </div>

      {msg && <AdminProvaMensagem mensagem={msg} onFechar={() => setMsg("")} />}

      <AdminProvaTabNav
        aba={aba}
        onChange={mudarAba}
        alertaQuestoes={pendencias.alertaAbaQuestoes}
        alertaPedagogia={pendencias.alertaAbaPedagogia}
        hintQuestoes={hintQuestoes}
        hintPedagogia={hintPedagogia}
      />

      <div className="pt-2">
        {aba === "prova" && (
          <>
            <AdminProvaAbaProva
              prova={prova}
              meta={meta}
              setMeta={setMeta}
              cadernoFile={cadernoFile}
              setCadernoFile={setCadernoFile}
              salvandoCaderno={salvandoCaderno}
              detectandoFaixa={detectandoFaixa}
              onSalvarMetadados={salvarMetadados}
              onEnviarCaderno={enviarCaderno}
              onRemoverCaderno={removerCaderno}
              onDetectarFaixa={detectarFaixaIdioma}
              onZerarQuestoes={zerarQuestoes}
              onExcluirProva={excluirProva}
            />
            {prova.tentativas && prova.tentativas.length > 0 && (
              <Card className="mt-6">
                <h2 className="mb-3 font-semibold">Tentativas de alunos</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="p-2">Aluno</th>
                        <th className="p-2">Data</th>
                        <th className="p-2 text-center">Nota</th>
                        <th className="p-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prova.tentativas.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="p-2">{t.user.name}</td>
                          <td className="p-2 text-slate-600">
                            {new Date(t.data).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-2 text-center font-medium">
                            {t.nota != null ? `${t.nota.toFixed(1)}%` : "—"}
                          </td>
                          <td className="p-2 text-right">
                            <ForcarRecalculoButton examId={t.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {aba === "questoes" && (
          <AdminProvaAbaQuestoes
            prova={prova}
            pdfFile={pdfFile}
            setPdfFile={setPdfFile}
            gabaritoLote={gabaritoLote}
            csvIncluirGabarito={csvIncluirGabarito}
            extracaoRefreshKey={extracaoRefreshKey}
            onAdicionarQuestao={abrirModalQuestao}
            onEditarQuestao={abrirModalQuestao}
            onMensagem={setMsg}
            onAtualizado={load}
          />
        )}

        {aba === "pedagogia" && (
          <AdminProvaAbaPedagogia
            prova={prova}
            provaId={id}
            faixaIdiomaDual={faixaIdiomaDual}
            gradeGabarito={gradeGabarito}
            numerosGrade={numerosGrade}
            statsClassificacao={statsClassificacao}
            gabaritoLote={gabaritoLote}
            csvIncluirGabarito={csvIncluirGabarito}
            arquivosGabarito={arquivosGabarito}
            extraindoGabaritoFoto={extraindoGabaritoFoto}
            avisosExtracaoGabarito={avisosExtracaoGabarito}
            lidasIaGabarito={lidasIaGabarito}
            alertaChaves={alertaChaves}
            editarQuestaoAlvo={editarQuestaoAlvo}
            onGradeChange={atualizarGradeGabarito}
            onGabaritoLoteChange={setGabaritoLote}
            onCsvIncluirGabaritoChange={setCsvIncluirGabarito}
            onArquivosGabaritoChange={setArquivosGabarito}
            onLerGabaritoFoto={lerGabaritoDaFoto}
            onAplicarTextoColado={aplicarTextoColadoNoGrid}
            onLimparGabaritos={limparGabaritos}
            onSalvarGabarito={salvarGabaritoLote}
            onAtualizarQuestoes={aoAtualizarQuestoes}
            onMensagem={setMsg}
            onEditarQuestaoAlvo={setEditarQuestaoAlvo}
            onEditarTextoQuestao={abrirModalQuestao}
            filtroTabelaInicial={filtroTabelaPedagogia}
            onAlertasChange={setAlertaChaves}
          />
        )}
      </div>

      <AdminProvaQuestaoModal
        provaId={id}
        aberto={modalNumero != null}
        numeroInicial={modalNumero ?? 1}
        questaoExistente={questaoModal}
        onFechar={fecharModalQuestao}
        onSalvo={aoAtualizarQuestoes}
        onMensagem={setMsg}
      />
    </div>
  );
}
