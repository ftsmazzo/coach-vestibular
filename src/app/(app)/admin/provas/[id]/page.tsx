"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

interface QuestaoPreview {
  numero: number;
  areaBloco?: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  observacoes?: string | null;
}

interface ExtracaoPreview {
  questoes: QuestaoPreview[];
  avisos: string[];
  resumo?: string;
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
}

export default function AdminProvaDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [prova, setProva] = useState<Prova | null>(null);
  const [gabaritoLote, setGabaritoLote] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvIncluirGabarito, setCsvIncluirGabarito] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [textoProva, setTextoProva] = useState("");
  const [textoFaltantes, setTextoFaltantes] = useState("");
  const [preview, setPreview] = useState<ExtracaoPreview | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [msg, setMsg] = useState("");
  const [meta, setMeta] = useState({
    banca: "",
    ano: "",
    dia: "",
    caderno: "",
    totalQuestoes: "",
    descricao: "",
  });

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
    if (!csvFile) return;
    const fd = new FormData();
    fd.append("file", csvFile);
    if (csvIncluirGabarito) fd.append("incluirGabarito", "true");
    const res = await fetch(`/api/admin/provas/${id}/questoes`, { method: "POST", body: fd });
    const data = await res.json();
    setMsg(res.ok ? `Importadas ${data.imported} questões` : data.error);
    load();
  }

  async function completarFaltantes() {
    if (!textoFaltantes.trim()) {
      setMsg("Cole o texto das questões que faltam no banco.");
      return;
    }
    setExtraindo(true);
    setMsg("");
    const fd = new FormData();
    fd.append("aplicar", "true");
    fd.append("modo", "adicionar");
    fd.append("texto", textoFaltantes.trim());
    const res = await fetch(`/api/admin/provas/${id}/extrair`, { method: "POST", body: fd });
    const data = await res.json();
    setExtraindo(false);
    if (!res.ok) {
      setMsg(data.error ?? "Erro");
      return;
    }
    setTextoFaltantes("");
    setMsg(
      `Adicionadas/atualizadas ${data.adicionadas ?? data.questoes?.length ?? 0} questão(ões). As demais permanecem no banco.`
    );
    load();
  }

  async function extrairIA(aplicar: boolean) {
    setExtraindo(true);
    setMsg("");
    const fd = new FormData();
    fd.append("aplicar", String(aplicar));
    fd.append("modo", "substituir");
    if (textoProva.trim()) fd.append("texto", textoProva.trim());
    else if (pdfFile) fd.append("file", pdfFile);
    else {
      setMsg("Cole o texto da prova ou envie um PDF.");
      setExtraindo(false);
      return;
    }
    const res = await fetch(`/api/admin/provas/${id}/extrair`, { method: "POST", body: fd });
    const data = await res.json();
    setExtraindo(false);
    if (!res.ok) {
      setMsg(data.error ?? "Erro na extração");
      return;
    }
    if (aplicar) {
      setPreview(null);
      setMsg(`IA aplicou ${data.questoes?.length ?? 0} questões no banco.`);
      load();
    } else {
      setPreview({
        questoes: data.questoes,
        avisos: data.avisos ?? [],
        resumo: data.resumo,
      });
      setMsg(`Prévia: ${data.questoes.length} questões extraídas. Revise e clique em Aplicar.`);
    }
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

      {msg && <p className="text-sm text-teal-700">{msg}</p>}

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
            placeholder="Questão 12\n(enunciado...)\n\nQuestão 45\n..."
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

      <Card className="border-teal-200 bg-teal-50/40">
        <h2 className="mb-2 font-semibold text-teal-900">Extração com IA (principal)</h2>
        <p className="mb-3 text-sm text-teal-800">
          Envie o PDF da prova ou cole o texto completo. <strong>Substitui</strong> todas as questões
          ao aplicar. Para só as faltantes, use o bloco amarelo acima. Não preenche gabarito.
        </p>
        <p className="mb-3 text-xs text-teal-700">
          Requer <code>OPENAI_API_KEY</code> no servidor. Alternativa: exporte CSV do GPT e importe
          abaixo.
        </p>
        <div className="space-y-3">
          <div>
            <Label>PDF da prova</Label>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Ou cole o texto da prova</Label>
            <textarea
              className="mt-1 w-full rounded-xl border p-3 text-sm"
              rows={5}
              placeholder="Texto extraído do PDF, ou enunciados colados..."
              value={textoProva}
              onChange={(e) => setTextoProva(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={extraindo} onClick={() => extrairIA(false)}>
              {extraindo ? "Extraindo..." : "Pré-visualizar extração"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={extraindo || !preview}
              onClick={() => extrairIA(true)}
            >
              Aplicar direto no banco
            </Button>
            {preview && (
              <Button type="button" disabled={extraindo} onClick={() => extrairIA(true)}>
                Confirmar e aplicar prévia
              </Button>
            )}
          </div>
          {preview?.avisos && preview.avisos.length > 0 && (
            <ul className="text-xs text-amber-800">
              {preview.avisos.map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {preview && preview.questoes.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold">Prévia IA ({preview.questoes.length} questões)</h3>
          <div className="max-h-64 overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-1">#</th>
                  <th className="p-1">Matéria</th>
                  <th className="p-1">Assunto</th>
                  <th className="p-1">Conhec.</th>
                </tr>
              </thead>
              <tbody>
                {preview.questoes.slice(0, 20).map((q) => (
                  <tr key={q.numero} className="border-t">
                    <td className="p-1">{q.numero}</td>
                    <td className="p-1">{q.materia}</td>
                    <td className="p-1">{q.assunto}</td>
                    <td className="p-1 truncate max-w-[120px]">{q.conhecimentoExigido ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.questoes.length > 20 && (
              <p className="mt-2 text-slate-500">+ {preview.questoes.length - 20} questões...</p>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Importar planilha CSV (GPT)</h2>
        <p className="mb-3 text-sm text-slate-600">
          Colunas por questão (prova já cadastrada acima): Número, Área/Bloco, Matéria, Assunto,
          Conhecimento, Dificuldade, Observações, Gabarito. Colunas Prova/Caderno do GPT são
          ignoradas. Template:{" "}
          <code className="text-xs">docs/templates/prova-questoes.csv</code>
        </p>
        <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={csvIncluirGabarito}
            onChange={(e) => setCsvIncluirGabarito(e.target.checked)}
          />
          Importar coluna Gabarito do CSV (só se for gabarito oficial)
        </label>
        <Button className="mt-3" onClick={importCsv} disabled={!csvFile}>
          Importar CSV (substitui todas as questões)
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Gabarito oficial (somente admin)</h2>
        <p className="mb-2 text-sm text-slate-600">
          A extração por IA <strong>não</strong> deve preencher gabarito. Se o ENEM ainda tiver letras
          erradas da IA antiga, limpe tudo e cole o gabarito oficial abaixo.
        </p>
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

      <Card>
        <h2 className="mb-4 font-semibold">Tabela de questões</h2>
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
              </tr>
            </thead>
            <tbody>
              {prova.questoes.map((q) => (
                <tr key={q.id} className="border-b border-slate-100">
                  <td className="p-2 font-medium">{q.numero}</td>
                  <td className="p-2">{q.areaBloco ?? "—"}</td>
                  <td className="p-2">{q.materia}</td>
                  <td className="p-2">{q.assunto}</td>
                  <td className="p-2 max-w-xs truncate" title={q.conhecimentoExigido ?? ""}>
                    {q.conhecimentoExigido ?? "—"}
                  </td>
                  <td className="p-2">{q.nivelDificuldade ?? "—"}</td>
                  <td className="p-2 font-mono font-bold">{q.gabarito ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prova.questoes.length === 0 && (
          <p className="mt-4 text-slate-500">Importe um CSV ou extraia com IA para preencher o banco.</p>
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
