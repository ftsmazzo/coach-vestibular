"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminAuditoriaProva } from "@/components/admin-auditoria-prova";
import { AdminTabelaQuestoes } from "@/components/admin-tabela-questoes";
import { AdminProvaPipelineV2 } from "@/components/admin-prova-pipeline-v2";
import { AdminValidacaoExtracao } from "@/components/admin-validacao-extracao";
import { AdminClassificacaoProva } from "@/components/admin-classificacao-prova";
import { statsFasesProva } from "@/lib/prova-classificacao-fases";
import { GabaritoRevisaoGrid } from "@/components/gabarito-revisao-grid";
import { Button, Card, Input, Label } from "@/components/ui";
import {
  buildGradeRevisao,
  gradeFromQuestoesGabarito,
  itensGabaritoOficialFromGrade,
  respostasParaGabaritoLote,
  type LinhaRevisaoGabarito,
} from "@/lib/extrair-gabarito-aluno";
import { faixaIdiomaProva, temDuplicataEnEs } from "@/lib/prova-idioma";
import { parseGabaritoLote } from "@/lib/gabarito";
import { buildProvaNome } from "@/lib/prova-nome";
import { normalizarMapaGabarito, resolverNumerosGradeProva } from "@/lib/prova-numeracao";

interface ProvaQuestao {
  id: string;
  numero: number;
  idiomaVariante?: string;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  enunciado?: string | null;
  alternativas?: string | null;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  gabarito: string | null;
  conhecimentoEscopoId?: string | null;
  classificacaoN1Json?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoVersao?: string | null;
}


interface Prova {
  id: string;
  nome: string;
  banca: string;
  tipo: string;
  ano: number | null;
  dia: number | null;
  caderno: string | null;
  descricao: string | null;
  publicada: boolean;
  gabaritoCompleto: boolean;
  extracaoValidada?: boolean;
  totalQuestoes: number;
  politicaIdiomas?: string;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
  ordemIdiomasFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO";
  questoesCadastradas?: number;
  questoesFaltando?: number[];
  bancoIncompleto?: boolean;
  questoes: ProvaQuestao[];
  temTextoFonte?: boolean;
  tamanhoTextoFonte?: number | null;
  cadernoFileName?: string | null;
  cadernoStoragePath?: string | null;
  tentativas?: {
    id: string;
    data: string;
    nota: number | null;
    user: {
      name: string;
      email: string;
    };
  }[];
}

function PassosProvaAdmin({
  extracaoValidada,
  temQuestoes,
  gabaritoCompleto,
}: {
  extracaoValidada: boolean;
  temQuestoes: boolean;
  gabaritoCompleto: boolean;
}) {
  const itens = [
    { n: 1, label: "Cadastro", estado: "done" as const },
    {
      n: 2,
      label: "Extrair PDF",
      estado: temQuestoes ? ("done" as const) : ("active" as const),
    },
    {
      n: 3,
      label: "Validar extração",
      estado: extracaoValidada
        ? ("done" as const)
        : temQuestoes
          ? ("active" as const)
          : ("pending" as const),
    },
    {
      n: 4,
      label: "Gabarito",
      estado: gabaritoCompleto ? ("done" as const) : temQuestoes ? ("active" as const) : ("pending" as const),
    },
    {
      n: 5,
      label: "Classificar",
      estado: extracaoValidada ? ("pending" as const) : ("locked" as const),
    },
  ];

  return (
    <ol className="flex flex-wrap gap-2">
      {itens.map((p) => {
        const cls =
          p.estado === "done"
            ? "bg-emerald-100 text-emerald-900 border-emerald-200"
            : p.estado === "active"
              ? "bg-indigo-100 text-indigo-900 border-indigo-300 ring-1 ring-indigo-300"
              : p.estado === "locked"
                ? "bg-slate-100 text-slate-400 border-slate-200"
                : "bg-white text-slate-500 border-slate-200";
        return (
          <li
            key={p.n}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
          >
            {p.n}. {p.label}
            {p.estado === "done" ? " ✓" : p.estado === "locked" ? " 🔒" : ""}
          </li>
        );
      })}
    </ol>
  );
}

function ForcarRecalculoButton({ examId }: { examId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRecalculate = async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/exams/${examId}/recalcular`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao recalcular");
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Erro desconhecido");
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        disabled={status === "loading"}
        onClick={handleRecalculate}
        variant={status === "success" ? "primary" : status === "error" ? "danger" : "secondary"}
        className={`px-3 py-1.5 text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
          status === "success"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : status === "idle"
            ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
            : ""
        }`}
      >
        {status === "loading" && (
          <span className="h-3 w-3 animate-spin rounded-full border border-teal-600 border-t-transparent" />
        )}
        {status === "loading" && "Recalculando..."}
        {status === "success" && "✓ Sucesso!"}
        {status === "error" && "✗ Erro"}
        {status === "idle" && "Forçar recálculo de plano (Coach IA)"}
      </Button>
      {errorMessage && (
        <span className="text-[10px] font-medium text-rose-600 max-w-[200px] text-right truncate" title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </div>
  );
}

export default function AdminProvaDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [prova, setProva] = useState<Prova | null>(null);
  const [gabaritoLote, setGabaritoLote] = useState("");
  const [gradeGabarito, setGradeGabarito] = useState<LinhaRevisaoGabarito[] | null>(null);
  const [arquivosGabarito, setArquivosGabarito] = useState<File[]>([]);
  const [extraindoGabaritoFoto, setExtraindoGabaritoFoto] = useState(false);
  const [avisosExtracaoGabarito, setAvisosExtracaoGabarito] = useState<string[]>([]);
  const [lidasIaGabarito, setLidasIaGabarito] = useState<number | undefined>();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvIncluirGabarito, setCsvIncluirGabarito] = useState(false);
  const [csvSoAtualizar, setCsvSoAtualizar] = useState(true);
  const [importandoCsv, setImportandoCsv] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [cadernoFile, setCadernoFile] = useState<File | null>(null);
  const [salvandoCaderno, setSalvandoCaderno] = useState(false);
  const [textoProva, setTextoProva] = useState("");
  const [salvandoTexto, setSalvandoTexto] = useState(false);
  const [msg, setMsg] = useState("");
  const [alertaChaves, setAlertaChaves] = useState<string[]>([]);
  const [editarQuestaoAlvo, setEditarQuestaoAlvo] = useState<{
    numero: number;
    idiomaVariante?: string;
  } | null>(null);
  const [atualizarAuditoria, setAtualizarAuditoria] = useState(0);
  const [meta, setMeta] = useState({
    banca: "",
    ano: "",
    dia: "",
    caderno: "",
    totalQuestoes: "",
    descricao: "",
    ordemIdiomasFaixa: "INGLES_PRIMEIRO" as "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO",
  });

  const orientacoesSalvas = useMemo(() => {
    if (!prova?.questoes.length) return {};
    return Object.fromEntries(
      prova.questoes
        .filter((q) => q.observacoes?.trim())
        .map((q) => [q.numero, q.observacoes!.trim()])
    );
  }, [prova?.questoes]);

  /** Recarrega validação quando questões/enunciados mudam após extração. */
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

  const faixaIdiomaDual = useMemo(() => faixaIdiomaProva(prova ?? undefined), [prova]);

  const statsClassificacao = useMemo(
    () => (prova?.questoes.length ? statsFasesProva(prova.questoes) : null),
    [prova?.questoes]
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/provas/${id}`);
    if (res.ok) {
      const data: Prova = await res.json();
      setProva(data);
      setMeta({
        banca: data.banca,
        ano: data.ano != null ? String(data.ano) : "",
        dia: data.dia != null ? String(data.dia) : "",
        caderno: data.caderno ?? "",
        totalQuestoes: String(data.totalQuestoes),
        descricao: data.descricao ?? "",
        ordemIdiomasFaixa: data.ordemIdiomasFaixa ?? "INGLES_PRIMEIRO",
      });
    }
  }, [id]);

  const aoAtualizarQuestoes = useCallback(async () => {
    await load();
    setAtualizarAuditoria((n) => n + 1);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!prova || numerosGrade.length === 0) return;
    const grade = gradeFromQuestoesGabarito(numerosGrade, prova.questoes, faixaIdiomaDual);
    setGradeGabarito(grade);
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
    if (!prova) return;
    if (arquivosGabarito.length === 0) {
      setMsg("Anexe um PDF ou foto do gabarito oficial.");
      return;
    }
    setExtraindoGabaritoFoto(true);
    setMsg("");
    const fd = new FormData();
    for (const f of arquivosGabarito) fd.append("file", f);

    try {
      const res = await fetch(`/api/admin/provas/${id}/extrair-gabarito`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Não foi possível ler o gabarito");
        return;
      }
      const grade = buildGradeRevisao(numerosGrade, data.respostas ?? []);
      atualizarGradeGabarito(grade);
      setAvisosExtracaoGabarito(Array.isArray(data.avisos) ? data.avisos : []);
      setLidasIaGabarito(typeof data.lidas === "number" ? data.lidas : undefined);
      setMsg(
        `IA leu ${data.lidas ?? grade.filter((l) => l.letra).length} resposta(s). Revise o grid e clique em Salvar.`
      );
    } catch {
      setMsg("Falha de rede ao ler gabarito — tente de novo.");
    } finally {
      setExtraindoGabaritoFoto(false);
    }
  }

  function aplicarTextoColadoNoGrid() {
    if (!prova || numerosGrade.length === 0) return;
    const mapa = normalizarMapaGabarito(parseGabaritoLote(gabaritoLote), numerosGrade);
    if (mapa.size === 0) {
      setMsg("Nenhuma linha válida. Use o formato número,letra (ex.: 91,C).");
      return;
    }
    const grade = gradeFromQuestoesGabarito(
      numerosGrade,
      [...mapa.entries()].map(([numero, gabarito]) => ({ numero, gabarito }))
    );
    setGradeGabarito(grade);
    setGabaritoLote(
      respostasParaGabaritoLote(
        grade.filter((l) => l.letra).map((l) => ({ numero: l.numero, letra: l.letra }))
      )
    );
    setMsg(`Aplicadas ${mapa.size} resposta(s) no grid. Revise e clique em Salvar.`);
  }

  async function salvarMetadados() {
    const res = await fetch(`/api/admin/provas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        banca: meta.banca,
        ano: meta.ano ? parseInt(meta.ano, 10) : null,
        dia: meta.dia ? parseInt(meta.dia, 10) : null,
        caderno: meta.caderno || null,
        totalQuestoes: meta.totalQuestoes
          ? parseInt(meta.totalQuestoes, 10)
          : undefined,
        descricao: meta.descricao || null,
        ...(temDuplicataEnEs(prova ?? undefined)
          ? { ordemIdiomasFaixa: meta.ordemIdiomasFaixa }
          : {}),
      }),
    });
    setMsg(res.ok ? "Dados da prova salvos." : "Erro ao salvar prova");
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

  async function importCsv() {
    const file = csvInputRef.current?.files?.[0];
    if (!file) {
      setMsg("Selecione um arquivo .csv antes de importar.");
      return;
    }
    setImportandoCsv(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    if (csvIncluirGabarito) fd.append("incluirGabarito", "true");
    if (csvSoAtualizar) fd.append("modo", "adicionar");
    try {
      const res = await fetch(`/api/admin/provas/${id}/questoes`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        const detalhe =
          Array.isArray(data.avisos) && data.avisos.length > 0
            ? ` ${data.avisos.join(" ")}`
            : "";
        setMsg(`${data.error ?? "Erro no import"}${detalhe}`);
        return;
      }
      const avisoCsv =
        Array.isArray(data.avisos) && data.avisos.length > 0
          ? ` ${data.avisos.join(" ")}`
          : "";
      setMsg(
        `Importadas ${data.imported} questões${
          data.substituiu ? " (substituiu todas as linhas anteriores)" : " (atualizou só os números do CSV)"
        }.${avisoCsv}`
      );
      if (csvInputRef.current) csvInputRef.current.value = "";
      setCsvFileName("");
      load();
    } catch {
      setMsg("Falha de rede ao importar CSV — tente de novo.");
    } finally {
      setImportandoCsv(false);
    }
  }

  async function salvarTextoFonte() {
    if (!textoProva.trim()) {
      setMsg("Cole o texto da prova antes de salvar.");
      return;
    }
    setSalvandoTexto(true);
    setMsg("");
    const res = await fetch(`/api/admin/provas/${id}/texto-fonte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: textoProva.trim() }),
    });
    const data = await res.json();
    setSalvandoTexto(false);
    setMsg(res.ok ? data.mensagem ?? "Texto salvo." : data.error ?? "Erro ao salvar texto");
    if (res.ok) load();
  }

  async function limparTextoFonte() {
    if (!confirm("Remover o texto da prova salvo no servidor?")) return;
    const res = await fetch(`/api/admin/provas/${id}/texto-fonte`, { method: "DELETE" });
    const data = await res.json();
    setMsg(res.ok ? data.mensagem ?? "Texto removido." : data.error ?? "Erro");
    if (res.ok) load();
  }

  async function enviarCaderno() {
    if (!cadernoFile) {
      setMsg("Selecione o arquivo do caderno.");
      return;
    }
    setSalvandoCaderno(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", cadernoFile);
    const res = await fetch(`/api/admin/provas/${id}/caderno`, { method: "POST", body: fd });
    const data = await res.json();
    setSalvandoCaderno(false);
    setMsg(res.ok ? data.mensagem ?? "Caderno salvo." : data.error ?? "Erro ao salvar caderno");
    if (res.ok) {
      setCadernoFile(null);
      load();
    }
  }

  async function removerCaderno() {
    if (!confirm("Remover o caderno do download dos alunos?")) return;
    const res = await fetch(`/api/admin/provas/${id}/caderno`, { method: "DELETE" });
    const data = await res.json();
    setMsg(res.ok ? data.mensagem ?? "Caderno removido." : data.error ?? "Erro");
    if (res.ok) load();
  }

  async function limparGabaritos() {
    if (
      !confirm(
        "Zerar o gabarito de TODAS as questões desta prova? Use depois do gabarito oficial em lote."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/provas/${id}/gabarito`, { method: "DELETE" });
    const data = await res.json();
    setMsg(
      res.ok
        ? `Gabarito zerado em ${data.removidos} questão(ões). Preencha o oficial em lote quando tiver.`
        : data.error ?? "Erro"
    );
    load();
  }

  async function zerarQuestoes() {
    if (
      !confirm(
        "Apagar TODAS as questões desta prova? O cadastro (nome, ano, caderno) permanece. A prova será despublicada. Depois extraia ou importe de novo."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/provas/${id}/questoes`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Banco zerado (${data.removidas} questões removidas). Pode reimportar ou extrair de novo.`);
      load();
    } else {
      setMsg(data.error ?? "Erro ao zerar");
    }
  }

  async function excluirProva() {
    if (
      !confirm(
        `Excluir a prova "${prova?.nome}" e todas as questões? Tentativas de alunos ficam sem vínculo com esta prova. Esta ação não tem volta.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/provas/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/provas");
      router.refresh();
    } else {
      const data = await res.json();
      setMsg(data.error ?? "Erro ao excluir");
    }
  }

  async function salvarGabaritoLote() {
    if (!gradeGabarito?.length) {
      setMsg("Marque ao menos uma alternativa (A–E) no grid.");
      return;
    }
    const itens = itensGabaritoOficialFromGrade(gradeGabarito, faixaIdiomaDual);
    if (itens.length === 0) {
      setMsg("Marque ao menos uma alternativa (A–E) ou cole linhas no formato 1,C.");
      return;
    }
    const res = await fetch(`/api/admin/provas/${id}/gabarito`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Gabarito atualizado (${data.updated} itens)` : (data.error ?? "Erro"));
    load();
  }

  if (!prova) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Link href="/admin/provas" className="text-sm text-teal-700 hover:underline">
        ← Voltar
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{prova.nome}</h1>
          <p className="text-slate-600">
            <span className={prova.bancoIncompleto ? "font-medium text-amber-800" : ""}>
              {prova.questoesCadastradas ?? prova.questoes.length} de {prova.totalQuestoes} questões
              lógicas no banco
              {temDuplicataEnEs(prova) && (
                <span className="text-slate-500"> ({prova.questoes.length} linhas EN+ES)</span>
              )}
            </span>
            {" · "}
            Gabarito {prova.gabaritoCompleto ? "completo" : "pendente (use lote abaixo)"}
          </p>
          {prova.bancoIncompleto && prova.questoesFaltando && prova.questoesFaltando.length > 0 && (
            <p className="text-sm text-amber-700">
              A IA ou o import pode ter pulado questões. Faltam no banco: nº{" "}
              {prova.questoesFaltando.slice(0, 20).join(", ")}
              {prova.questoesFaltando.length > 20
                ? ` (+${prova.questoesFaltando.length - 20})`
                : ""}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={togglePublicada}>
          {prova.publicada ? "Despublicar" : "Publicar para alunos"}
        </Button>
      </div>

      {msg && (
        <p
          className={`text-sm ${msg.includes("Erro") || msg.includes("Falha") || msg.includes("inválido") ? "text-rose-700" : "text-teal-700"}`}
        >
          {msg}
        </p>
      )}

      <PassosProvaAdmin
        extracaoValidada={prova.extracaoValidada ?? false}
        temQuestoes={prova.questoes.length > 0}
        gabaritoCompleto={prova.gabaritoCompleto}
      />

      <Card>
        <h2 className="mb-2 font-semibold">Passo 1 — Registro da prova</h2>
        <p className="mb-3 text-sm text-slate-600">
          Vestibular, ano e caderno ficam aqui — o aluno escolhe esta prova ao registrar o simulado.
          A IA não repete esses dados por questão.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome da prova (gerado ao salvar)</Label>
            <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {buildProvaNome({
                banca: meta.banca,
                ano: meta.ano ? parseInt(meta.ano, 10) : null,
                dia: meta.dia ? parseInt(meta.dia, 10) : null,
                caderno: meta.caderno || null,
              })}
            </p>
          </div>
          <div>
            <Label>Banca / vestibular</Label>
            <Input
              value={meta.banca}
              onChange={(e) => setMeta({ ...meta, banca: e.target.value })}
            />
          </div>
          <div>
            <Label>Ano</Label>
            <Input
              type="number"
              value={meta.ano}
              onChange={(e) => setMeta({ ...meta, ano: e.target.value })}
            />
          </div>
          <div>
            <Label>Caderno / tipo</Label>
            <Input
              value={meta.caderno}
              onChange={(e) => setMeta({ ...meta, caderno: e.target.value })}
              placeholder="Azul, Tipo 1..."
            />
          </div>
          <div>
            <Label>Dia (ENEM)</Label>
            <Input
              type="number"
              value={meta.dia}
              onChange={(e) => setMeta({ ...meta, dia: e.target.value })}
            />
          </div>
          <div>
            <Label>Total esperado de questões</Label>
            <Input
              type="number"
              value={meta.totalQuestoes}
              onChange={(e) => setMeta({ ...meta, totalQuestoes: e.target.value })}
              placeholder="90, 45, 60..."
            />
            <p className="mt-1 text-xs text-slate-500">
              Meta da prova (ex.: 90 no ENEM por dia). Não muda ao importar — só linhas no banco.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={meta.descricao}
              onChange={(e) => setMeta({ ...meta, descricao: e.target.value })}
            />
          </div>
          {temDuplicataEnEs(prova) && (
            <div className="sm:col-span-2">
              <Label>Ordem no caderno (faixa EN/ES)</Label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={meta.ordemIdiomasFaixa}
                onChange={(e) =>
                  setMeta({
                    ...meta,
                    ordemIdiomasFaixa: e.target.value as "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO",
                  })
                }
              >
                <option value="INGLES_PRIMEIRO">Inglês antes do Espanhol (padrão ENEM)</option>
                <option value="ESPANHOL_PRIMEIRO">Espanhol antes do Inglês</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Afeta a ordem na tabela e na auditoria. O gabarito de cada trilha (EN/ES) continua
                separado — ao corrigir matéria na faixa 1–5, conteúdo e gabarito trocam de linha
                automaticamente.
              </p>
            </div>
          )}
        </div>
        <Button className="mt-3" type="button" onClick={salvarMetadados}>
          Salvar registro da prova
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-800">Passo 2 — PDF da prova</h2>
        <p className="mb-3 text-sm text-slate-600">
          Selecione o PDF e use o bloco abaixo para extrair enunciados e alternativas (OpenAI
          Responses API — requer <code className="text-xs">OPENAI_API_KEY</code>).
        </p>
        <div>
          <Label>Arquivo PDF</Label>
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
          {pdfFile && (
            <p className="mt-1 text-xs text-slate-600">
              Selecionado: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-800">Caderno para o aluno baixar</h2>
        <p className="mb-3 text-sm text-slate-600">
          Envie o PDF (ou imagem) do caderno desta prova. O aluno verá um botão{" "}
          <strong>⬇ Caderno</strong> no card de Atividades para baixar e fazer a prova. É opcional e
          separado da extração de questões.
        </p>
        {prova.cadernoFileName ? (
          <p className="mb-2 text-sm font-medium text-emerald-700">
            Caderno atual: {prova.cadernoFileName}
          </p>
        ) : (
          <p className="mb-2 text-sm text-slate-500">Nenhum caderno enviado ainda.</p>
        )}
        <Input
          type="file"
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setCadernoFile(e.target.files?.[0] ?? null)}
        />
        {cadernoFile && (
          <p className="mt-1 text-xs text-slate-600">
            Selecionado: {cadernoFile.name} ({(cadernoFile.size / 1024).toFixed(0)} KB)
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={salvandoCaderno || !cadernoFile} onClick={enviarCaderno}>
            {salvandoCaderno ? "Enviando…" : "Salvar caderno"}
          </Button>
          {prova.cadernoFileName && (
            <Button type="button" variant="secondary" onClick={removerCaderno}>
              Remover caderno
            </Button>
          )}
        </div>
      </Card>

      <AdminProvaPipelineV2
        provaId={prova.id}
        totalQuestoes={prova.totalQuestoes}
        pdfFile={pdfFile}
        gabaritoLote={gabaritoLote}
        incluirGabarito={csvIncluirGabarito}
        onMensagem={setMsg}
        onAtualizado={load}
      />

      {(prova.questoes.length > 0 || prova.totalQuestoes > 0) && (
        <AdminValidacaoExtracao
          provaId={prova.id}
          extracaoValidada={prova.extracaoValidada ?? false}
          refreshKey={extracaoRefreshKey}
          onMensagem={setMsg}
          onAtualizado={load}
        />
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Passo 4 — Gabarito oficial (somente admin)</h2>
        <p className="mb-2 text-sm text-slate-600">
          A extração <strong>não inventa</strong> gabarito. Envie foto/PDF do oficial, revise no grid
          ou cole texto — opcionalmente marque «Aplicar gabarito ao gravar» ao extrair o PDF.
        </p>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={csvIncluirGabarito}
            onChange={(e) => setCsvIncluirGabarito(e.target.checked)}
          />
          Aplicar gabarito ao gravar (pipeline PDF ou import CSV)
        </label>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={limparGabaritos}>
            Zerar todos os gabaritos
          </Button>
          {prova.questoes.some((q) => q.gabarito) && (
            <span className="self-center text-xs text-amber-700">
              {prova.questoes.filter((q) => q.gabarito).length} questão(ões) com gabarito preenchido
            </span>
          )}
        </div>
        <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div>
            <Label>PDF ou foto do gabarito oficial</Label>
            <p className="mt-1 text-xs text-slate-500">
              Tabela da banca, PDF do INEP ou folha de respostas modelo. Até 4 arquivos (páginas). A
              IA sugere as respostas — você revisa no grid antes de salvar.
            </p>
            <Input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              multiple
              className="mt-2"
              onChange={(e) => {
                setArquivosGabarito(Array.from(e.target.files ?? []));
                setAvisosExtracaoGabarito([]);
                setLidasIaGabarito(undefined);
              }}
            />
            {arquivosGabarito.length > 0 && (
              <p className="mt-1 text-xs text-slate-600">
                {arquivosGabarito.length} arquivo(s):{" "}
                {arquivosGabarito.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={extraindoGabaritoFoto || arquivosGabarito.length === 0}
            onClick={lerGabaritoDaFoto}
          >
            {extraindoGabaritoFoto ? "Lendo gabarito…" : "Ler gabarito da foto/PDF"}
          </Button>
        </div>
        <p className="mb-3 text-sm text-slate-600">
          Toque na letra correta de cada questão — o mesmo grid usado pelo aluno. O texto para o
          pipeline atualiza automaticamente conforme você marca.
        </p>
        {gradeGabarito && gradeGabarito.length > 0 ? (
          <GabaritoRevisaoGrid
            linhas={gradeGabarito}
            onChange={atualizarGradeGabarito}
            avisos={avisosExtracaoGabarito}
            lidas={lidasIaGabarito}
            faixaIdiomaDual={faixaIdiomaDual}
            permitirMarcarAnulada
          />
        ) : (
          <p className="text-sm text-slate-500">Defina o total de questões da prova para exibir o grid.</p>
        )}
        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Colar texto em lote (opcional)
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Uma linha por questão: número e letra. Ex.: 1,C — depois clique em «Aplicar no grid».
          </p>
          <textarea
            className="mt-2 w-full rounded-xl border p-3 font-mono text-sm"
            rows={5}
            placeholder={"1,C\n2,A\n3,B"}
            value={gabaritoLote}
            onChange={(e) => setGabaritoLote(e.target.value)}
          />
          <Button type="button" variant="secondary" className="mt-2" onClick={aplicarTextoColadoNoGrid}>
            Aplicar no grid
          </Button>
        </details>
        <Button className="mt-4" onClick={salvarGabaritoLote}>
          Salvar gabarito oficial
        </Button>
      </Card>

      {prova.extracaoValidada ? (
        <>
          <AdminClassificacaoProva
            provaId={prova.id}
            totalQuestoes={prova.questoes.length}
            comN1={statsClassificacao?.comN1 ?? 0}
            comN2Real={statsClassificacao?.comN2Real ?? 0}
            comN2Fallback={statsClassificacao?.comN2Fallback ?? 0}
            comN3={statsClassificacao?.comN3 ?? 0}
            onMensagem={setMsg}
            onAtualizado={aoAtualizarQuestoes}
          />

          {prova.questoes.length > 0 && (
            <AdminTabelaQuestoes
              provaId={prova.id}
              questoes={prova.questoes}
              alertaChaves={alertaChaves}
              abrirEdicao={editarQuestaoAlvo}
              onEdicaoAberta={() => setEditarQuestaoAlvo(null)}
              onAtualizado={aoAtualizarQuestoes}
              onMensagem={setMsg}
            />
          )}

          {prova.questoes.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Auditoria legada (opcional)
              </summary>
              <div className="mt-3">
                <AdminAuditoriaProva
                  provaId={prova.id}
                  textoFonteColado={textoProva}
                  orientacoesSalvas={orientacoesSalvas}
                  onQuestoesAtualizadas={aoAtualizarQuestoes}
                  onAlertasChange={setAlertaChaves}
                  onEditarQuestao={(numero, idiomaVariante) =>
                    setEditarQuestaoAlvo({ numero, idiomaVariante })
                  }
                  atualizarAuditoria={atualizarAuditoria}
                />
              </div>
            </details>
          )}

          <details className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Importar CSV / texto colado (alternativas legadas)
            </summary>
            <div className="mt-3 space-y-4">
              <div>
                <Label>Ou cole o texto da prova no servidor</Label>
                <textarea
                  className="mt-1 w-full rounded-xl border p-3 text-sm font-mono"
                  rows={6}
                  placeholder="Texto completo da prova (legado)…"
                  value={textoProva}
                  onChange={(e) => setTextoProva(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={salvandoTexto || !textoProva.trim()}
                    onClick={salvarTextoFonte}
                  >
                    {salvandoTexto ? "Salvando…" : "Salvar texto no servidor"}
                  </Button>
                  {prova.temTextoFonte && (
                    <Button type="button" variant="secondary" onClick={limparTextoFonte}>
                      Limpar texto salvo
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-600">
                  CSV exportado do ChatGPT — template:{" "}
                  <code className="text-xs">docs/templates/prova-questoes.csv</code>
                </p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  onChange={(e) => setCsvFileName(e.target.files?.[0]?.name ?? "")}
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={csvSoAtualizar}
                    onChange={(e) => setCsvSoAtualizar(e.target.checked)}
                  />
                  Só atualizar questões do CSV
                </label>
                <Button
                  type="button"
                  className="mt-2"
                  onClick={importCsv}
                  disabled={importandoCsv || !csvFileName}
                >
                  {importandoCsv ? "Importando…" : "Importar CSV"}
                </Button>
              </div>
            </div>
          </details>
        </>
      ) : (
        <Card className="border-slate-200 bg-slate-50/80">
          <h2 className="mb-2 font-semibold text-slate-700">Passo 5 — Classificação 🔒</h2>
          <p className="text-sm text-slate-600">
            Confirme a extração completa no passo 3 para liberar classificação, auditoria e import
            CSV.
          </p>
        </Card>
      )}

      {/* Histórico de Tentativas dos Alunos */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📊</span> Histórico de Tentativas de Alunos
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Gerenciamento das tentativas realizadas pelos alunos e atualização de diagnóstico e plano (Coach IA).
            </p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
            {prova.tentativas?.length ?? 0} { (prova.tentativas?.length ?? 0) === 1 ? "tentativa" : "tentativas" }
          </span>
        </div>

        {prova.tentativas && prova.tentativas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-3 font-semibold text-xs uppercase tracking-wider">Aluno</th>
                  <th className="p-3 font-semibold text-xs uppercase tracking-wider">E-mail</th>
                  <th className="p-3 font-semibold text-xs uppercase tracking-wider">Data de Realização</th>
                  <th className="p-3 font-semibold text-xs uppercase tracking-wider text-center">Nota / Acertos</th>
                  <th className="p-3 font-semibold text-xs uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prova.tentativas.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-medium text-slate-900">{attempt.user.name}</td>
                    <td className="p-3 text-slate-600">{attempt.user.email}</td>
                    <td className="p-3 text-slate-600">
                      {new Date(attempt.data).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 text-slate-900 font-bold text-center">
                      {attempt.nota != null ? `${attempt.nota.toFixed(1)}%` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <ForcarRecalculoButton examId={attempt.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">Nenhum aluno realizou esta prova ainda.</p>
            <p className="text-xs text-slate-400 mt-1">As tentativas aparecerão aqui assim que forem finalizadas.</p>
          </div>
        )}
      </Card>

      <Card className="border-red-200 bg-red-50/40">
        <h2 className="mb-2 font-semibold text-red-900">Recomeçar do zero</h2>
        <p className="mb-3 text-sm text-red-900">
          Se a prova foi gravada com o formato antigo da tabela, use uma das opções abaixo e importe
          de novo com o fluxo atual (sem gabarito na IA).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={zerarQuestoes}>
            Zerar só as questões (mantém cadastro da prova)
          </Button>
          <Button type="button" variant="danger" onClick={excluirProva}>
            Excluir prova inteira
          </Button>
        </div>
        <p className="mt-2 text-xs text-red-800">
          <strong>Zerar questões:</strong> apaga linhas e despublica; você reextrai o PDF na mesma
          prova. <strong>Excluir prova:</strong> remove tudo e volta à lista para criar outra.
        </p>
      </Card>
    </div>
  );
}
