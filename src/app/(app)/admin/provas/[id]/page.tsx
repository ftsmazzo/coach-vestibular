"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminAuditoriaProva } from "@/components/admin-auditoria-prova";
import { AdminTabelaQuestoes } from "@/components/admin-tabela-questoes";
import { AdminExtracaoPipeline } from "@/components/admin-extracao-pipeline";
import { AdminProvaPipelineV2 } from "@/components/admin-prova-pipeline-v2";
import { Button, Card, Input, Label } from "@/components/ui";
import { buildProvaNome } from "@/lib/prova-nome";

interface ProvaQuestao {
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
  totalQuestoes: number;
  questoesCadastradas?: number;
  questoesFaltando?: number[];
  bancoIncompleto?: boolean;
  questoes: ProvaQuestao[];
  temTextoFonte?: boolean;
  tamanhoTextoFonte?: number | null;
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
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvIncluirGabarito, setCsvIncluirGabarito] = useState(false);
  const [csvSoAtualizar, setCsvSoAtualizar] = useState(true);
  const [importandoCsv, setImportandoCsv] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [textoProva, setTextoProva] = useState("");
  const [salvandoTexto, setSalvandoTexto] = useState(false);
  const [textoFaltantes, setTextoFaltantes] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [msg, setMsg] = useState("");
  const [numerosAlerta, setNumerosAlerta] = useState<number[]>([]);
  const [editarQuestaoNumero, setEditarQuestaoNumero] = useState<number | null>(null);
  const [atualizarAuditoria, setAtualizarAuditoria] = useState(0);
  const [meta, setMeta] = useState({
    banca: "",
    ano: "",
    dia: "",
    caderno: "",
    totalQuestoes: "",
    descricao: "",
  });

  const orientacoesSalvas = useMemo(() => {
    if (!prova?.questoes.length) return {};
    return Object.fromEntries(
      prova.questoes
        .filter((q) => q.observacoes?.trim())
        .map((q) => [q.numero, q.observacoes!.trim()])
    );
  }, [prova?.questoes]);

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

  async function classificarTextoParcial(
    texto: string,
    vazioMsg: string,
    onOk?: () => void
  ) {
    if (!texto.trim()) {
      setMsg(vazioMsg);
      return;
    }
    setExtraindo(true);
    setMsg("");
    const fd = new FormData();
    fd.append("aplicar", "true");
    fd.append("modo", "adicionar");
    fd.append("texto", texto.trim());
    const res = await fetch(`/api/admin/provas/${id}/extrair`, { method: "POST", body: fd });
    const data = await res.json();
    setExtraindo(false);
    if (!res.ok) {
      setMsg(data.error ?? "Erro");
      return;
    }
    onOk?.();
    setMsg(
      `Atualizada(s) ${data.adicionadas ?? data.questoes?.length ?? 0} questão(ões) no banco. As demais não foram alteradas. Clique em «Auditar» de novo para ver se a inconsistência sumiu.`
    );
    load();
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

  async function completarFaltantes() {
    await classificarTextoParcial(
      textoFaltantes,
      "Cole o texto das questões que faltam no banco.",
      () => setTextoFaltantes("")
    );
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
    const linhas = gabaritoLote.trim().split(/\n/).filter(Boolean);
    const itens = linhas.map((l) => {
      const [num, gab] = l.split(/[,;\s]+/);
      return { numero: parseInt(num, 10), gabarito: gab.trim() };
    });
    const res = await fetch(`/api/admin/provas/${id}/gabarito`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Gabarito atualizado (${data.updated} itens)` : "Erro");
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
              {prova.questoes.length} de {prova.totalQuestoes} questões no banco
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

      {prova.bancoIncompleto && prova.questoesFaltando && prova.questoesFaltando.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <h2 className="mb-2 font-semibold text-amber-900">Completar questões faltantes</h2>
          <p className="mb-2 text-sm text-amber-900">
            Não precisa reescanear o PDF inteiro. Cole aqui só o enunciado/texto das questões que
            faltam (nº {prova.questoesFaltando.slice(0, 15).join(", ")}
            {prova.questoesFaltando.length > 15 ? "…" : ""}). A IA classifica e{" "}
            <strong>adiciona</strong> sem apagar as que já estão corretas.
          </p>
          <textarea
            className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm"
            rows={6}
            placeholder="Questão 12\n(enunciado completo...)\n\nQuestão 45\n..."
            value={textoFaltantes}
            onChange={(e) => setTextoFaltantes(e.target.value)}
          />
          <Button
            type="button"
            className="mt-3"
            disabled={extraindo}
            onClick={completarFaltantes}
          >
            {extraindo ? "Classificando..." : "Classificar e adicionar faltantes"}
          </Button>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Registro da prova</h2>
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
        </div>
        <Button className="mt-3" type="button" onClick={salvarMetadados}>
          Salvar registro da prova
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-800">PDF da prova</h2>
        <p className="mb-3 text-sm text-slate-600">
          Envie o PDF editado (questões 1–{prova.totalQuestoes}). A classificação usa a OpenAI
          Responses API direto no arquivo — como o seu agente GPT. Requer{" "}
          <code className="text-xs">OPENAI_API_KEY</code>.
        </p>
        <div className="space-y-3">
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
          <div>
            <Label>Ou cole o texto da prova (recomendado: prova inteira, questões 1–65)</Label>
            <textarea
              className="mt-1 w-full rounded-xl border p-3 text-sm font-mono"
              rows={12}
              placeholder="Cole aqui o texto completo da prova (Ctrl+A do PDF). O sistema precisa de dezenas de milhares de caracteres, não só um resumo."
              value={textoProva}
              onChange={(e) => setTextoProva(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-600">
              {textoProva.trim().length > 0
                ? `${textoProva.trim().length.toLocaleString("pt-BR")} caracteres no campo`
                : "Nenhum texto colado — sem isso, o sistema pode usar um texto antigo truncado (~600 caracteres) do servidor."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={salvandoTexto || !textoProva.trim()}
                onClick={salvarTextoFonte}
              >
                {salvandoTexto ? "Salvando…" : "Salvar texto no servidor"}
              </Button>
              {prova?.temTextoFonte && (
                <Button type="button" variant="secondary" onClick={limparTextoFonte}>
                  Limpar texto salvo
                </Button>
              )}
            </div>
          </div>
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

      <details className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Fluxo antigo (extração de enunciados + etapas) — legado
        </summary>
        <div className="mt-3 space-y-3">
          <AdminExtracaoPipeline
            provaId={prova.id}
            textoProva={textoProva}
            pdfFile={pdfFile}
            questoesNoBanco={prova.questoes.length}
            totalQuestoes={prova.totalQuestoes}
            temTextoFonte={prova.temTextoFonte}
            tamanhoTextoFonte={prova.tamanhoTextoFonte ?? 0}
            onMensagem={setMsg}
            onAtualizado={load}
          />
        </div>
      </details>

      {prova.questoes.length > 0 && (
        <AdminTabelaQuestoes
          provaId={prova.id}
          questoes={prova.questoes}
          numerosAlerta={numerosAlerta}
          abrirEdicaoNumero={editarQuestaoNumero}
          onEdicaoAberta={() => setEditarQuestaoNumero(null)}
          onAtualizado={aoAtualizarQuestoes}
          onMensagem={setMsg}
        />
      )}

      {prova.questoes.length > 0 && (
        <AdminAuditoriaProva
          provaId={prova.id}
          textoFonteColado={textoProva}
          orientacoesSalvas={orientacoesSalvas}
          onQuestoesAtualizadas={aoAtualizarQuestoes}
          onAlertasChange={setNumerosAlerta}
          onEditarQuestao={(numero) => setEditarQuestaoNumero(numero)}
          atualizarAuditoria={atualizarAuditoria}
        />
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Importar planilha CSV (alternativa)</h2>
        <p className="mb-3 text-sm text-slate-600">
          Se você já classificou no ChatGPT e exportou CSV, importe aqui — mesmo destino: banco de
          questões. Ou use «Já tenho CSV do ChatGPT» no bloco roxo acima. Template:{" "}
          <code className="text-xs">docs/templates/prova-questoes.csv</code>
        </p>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-teal-800"
          onChange={(e) => setCsvFileName(e.target.files?.[0]?.name ?? "")}
        />
        {csvFileName && (
          <p className="mt-1 text-xs text-slate-600">Arquivo selecionado: {csvFileName}</p>
        )}
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={csvSoAtualizar}
            onChange={(e) => setCsvSoAtualizar(e.target.checked)}
          />
          Só atualizar questões do CSV (recomendado após auditoria — não apaga as demais)
        </label>
        <Button
          type="button"
          className="mt-3"
          onClick={importCsv}
          disabled={importandoCsv || !csvFileName}
        >
          {importandoCsv
            ? "Importando..."
            : csvSoAtualizar
              ? "Importar CSV (atualizar linhas do arquivo)"
              : "Importar CSV (substitui todas as questões)"}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Gabarito oficial (somente admin)</h2>
        <p className="mb-2 text-sm text-slate-600">
          O pipeline de classificação <strong>não inventa</strong> gabarito. Cole o oficial abaixo
          e marque «Aplicar gabarito ao gravar» — o sistema cruza em código ao gravar PDF ou CSV.
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
        <p className="mb-2 text-sm text-slate-600">Uma linha por questão: número e letra. Ex: 1,C</p>
        <textarea
          className="w-full rounded-xl border p-3 font-mono text-sm"
          rows={6}
          placeholder={"1,C\n2,A\n3,B"}
          value={gabaritoLote}
          onChange={(e) => setGabaritoLote(e.target.value)}
        />
        <Button className="mt-2" onClick={salvarGabaritoLote}>
          Salvar gabarito em lote
        </Button>
      </Card>

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
