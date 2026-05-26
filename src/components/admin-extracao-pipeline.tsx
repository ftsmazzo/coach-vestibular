"use client";

import { useCallback, useState } from "react";
import { Button, Card } from "@/components/ui";

type Etapa = "enunciados" | "materia" | "assunto" | "conhecimento" | "completo";

interface QuestaoPreview {
  numero: number;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  trechoEnunciado?: string;
}

interface ExtracaoPreview {
  questoes: QuestaoPreview[];
  avisos: string[];
  resumo?: string;
  etapa?: Etapa;
}

const ETAPAS: { id: Etapa; titulo: string; desc: string }[] = [
  {
    id: "enunciados",
    titulo: "1. Enunciados",
    desc: "Extrai e grava o texto literal de cada questão (obrigatório primeiro).",
  },
  {
    id: "materia",
    titulo: "2. Matéria e assunto",
    desc: "Motor Passo 2 (taxonomia completa + pós-processamento de idioma/ciências).",
  },
  {
    id: "assunto",
    titulo: "3. Refinar assunto",
    desc: "Opcional: só se quiser ajustar assuntos após a etapa 2.",
  },
  {
    id: "conhecimento",
    titulo: "4. Conhecimento",
    desc: "Gera uma frase do conhecimento exigido com enunciado + matéria + assunto.",
  },
];

interface Props {
  provaId: string;
  textoProva: string;
  pdfFile: File | null;
  questoesNoBanco: number;
  temTextoFonte?: boolean;
  onMensagem: (msg: string) => void;
  onAtualizado: () => void;
}

export function AdminExtracaoPipeline({
  provaId,
  textoProva,
  pdfFile,
  questoesNoBanco,
  temTextoFonte = false,
  onMensagem,
  onAtualizado,
}: Props) {
  const [etapaAtiva, setEtapaAtiva] = useState<Etapa>("enunciados");
  const [preview, setPreview] = useState<ExtracaoPreview | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [excluirBlocoEspanhol, setExcluirBlocoEspanhol] = useState(true);

  const rodar = useCallback(
    async (etapa: Etapa, aplicar: boolean) => {
      const precisaTexto = etapa === "enunciados" || etapa === "completo";
      const etapaUsaBanco =
        etapa === "materia" || etapa === "assunto" || etapa === "conhecimento";

      if (precisaTexto && !textoProva.trim() && !pdfFile && !temTextoFonte) {
        onMensagem("Cole o texto da prova ou envie um PDF.");
        return;
      }
      if (etapaUsaBanco && questoesNoBanco === 0) {
        onMensagem("Grave os enunciados no banco antes desta etapa.");
        return;
      }

      setCarregando(true);
      onMensagem("");
      const fd = new FormData();
      fd.append("aplicar", String(aplicar));
      fd.append("modo", etapa === "enunciados" && aplicar ? "substituir" : "adicionar");
      fd.append("etapa", etapa);
      fd.append("continuarDeBanco", String(etapaUsaBanco));
      fd.append("excluirBlocoEspanhol", String(excluirBlocoEspanhol));
      // Etapas 2–4: não reenviar o texto gigante — o servidor usa textoFonte + enunciados do banco
      if (!etapaUsaBanco) {
        if (textoProva.trim()) {
          fd.append("texto", textoProva.trim());
        } else if (pdfFile && precisaTexto) {
          fd.append("file", pdfFile);
        } else if (precisaTexto && temTextoFonte) {
          fd.append("usarTextoFonte", "true");
          onMensagem("Usando texto da prova já salvo no servidor (sem reenviar PDF)…");
        }
      }

      const res = await fetch(`/api/admin/provas/${provaId}/extrair`, { method: "POST", body: fd });
      const data = await res.json();
      setCarregando(false);

      if (!res.ok) {
        onMensagem(data.error ?? "Erro na extração");
        return;
      }

      if (aplicar) {
        setPreview(null);
        onMensagem(
          `Etapa «${etapa}» gravada — ${data.adicionadas ?? data.questoes?.length ?? 0} questão(ões).`
        );
        onAtualizado();
      } else {
        setPreview({
          questoes: data.questoes,
          avisos: data.avisos ?? [],
          resumo: data.resumo,
          etapa: data.etapa ?? etapa,
        });
        setEtapaAtiva(etapa);
        onMensagem(
          data.resumo ??
            `Prévia da etapa «${etapa}»: ${data.questoes?.length ?? 0} questões. Revise e grave.`
        );
      }
    },
    [
      provaId,
      textoProva,
      pdfFile,
      questoesNoBanco,
      temTextoFonte,
      excluirBlocoEspanhol,
      onMensagem,
      onAtualizado,
    ]
  );

  const etapaInfo = ETAPAS.find((e) => e.id === etapaAtiva);

  return (
    <Card className="border-teal-200 bg-teal-50/40">
      <h2 className="mb-2 font-semibold text-teal-900">Extração em etapas (recomendado)</h2>
      <p className="mb-3 text-sm text-teal-800">
        Etapa 2 lê os <strong>cabeçalhos do caderno</strong> (MATEMÁTICA, SOCIOLOGIA, TIPO 1…)
        do PDF/texto salvo e usa <strong>gpt-4o</strong> só onde o bloco não define a matéria.
        Grave os enunciados antes; mantenha o texto completo da prova salvo no servidor.
      </p>

      <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm text-teal-900">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={excluirBlocoEspanhol}
          onChange={(e) => setExcluirBlocoEspanhol(e.target.checked)}
        />
        <span>
          <strong>Ignorar bloco de Espanhol</strong> (UFU e similares: inglês e espanhol com a
          mesma numeração). Remove o trecho «Língua Espanhola» do texto e prefere enunciado em
          inglês quando houver duplicata.
        </span>
      </label>

      <div className="mb-4 flex flex-wrap gap-2">
        {ETAPAS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEtapaAtiva(e.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              etapaAtiva === e.id
                ? "bg-teal-700 text-white"
                : "bg-white text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100"
            }`}
          >
            {e.titulo}
          </button>
        ))}
      </div>

      {etapaInfo && (
        <p className="mb-3 text-xs text-teal-700">
          <strong>{etapaInfo.titulo}:</strong> {etapaInfo.desc}
          {questoesNoBanco > 0 && etapaAtiva !== "enunciados" && (
            <span className="ml-1">
              ({questoesNoBanco} questão(ões) no banco — usa enunciados gravados
              {temTextoFonte ? " e texto da prova já salvo no servidor" : ""}.)
            </span>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={carregando} onClick={() => rodar(etapaAtiva, false)}>
          {carregando ? "Processando..." : `Pré-visualizar — ${etapaInfo?.titulo ?? etapaAtiva}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={carregando}
          onClick={() => rodar(etapaAtiva, true)}
        >
          Gravar esta etapa no banco
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={carregando}
          onClick={() => rodar("completo", false)}
        >
          Prévia pipeline completo
        </Button>
        <Button type="button" disabled={carregando} onClick={() => rodar("completo", true)}>
          Aplicar tudo (substitui prova)
        </Button>
      </div>

      {preview?.avisos && preview.avisos.length > 0 && (
        <ul className="mt-3 text-xs text-amber-800">
          {preview.avisos.map((a, i) => (
            <li key={i}>• {a}</li>
          ))}
        </ul>
      )}

      {preview && preview.questoes.length > 0 && (
        <div className="mt-4 rounded-xl border border-teal-100 bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            Prévia — {preview.etapa ?? etapaAtiva} ({preview.questoes.length} questões)
          </h3>
          {preview.resumo && (
            <p className="mb-2 text-xs text-slate-600">{preview.resumo}</p>
          )}
          <div className="max-h-80 overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-1 text-left">#</th>
                  <th className="p-1 text-left">Matéria</th>
                  <th className="p-1 text-left">Assunto</th>
                  <th className="p-1 text-left">Enunciado</th>
                  <th className="p-1 text-left">Conhec.</th>
                </tr>
              </thead>
              <tbody>
                {preview.questoes.slice(0, 30).map((q) => (
                  <tr key={q.numero} className="border-t align-top">
                    <td className="p-1">{q.numero}</td>
                    <td className="p-1">{q.materia}</td>
                    <td className="p-1">{q.assunto}</td>
                    <td className="p-1 max-w-[200px] text-slate-600" title={q.trechoEnunciado}>
                      {q.trechoEnunciado
                        ? `${q.trechoEnunciado.slice(0, 80)}${q.trechoEnunciado.length > 80 ? "…" : ""}`
                        : "—"}
                    </td>
                    <td className="p-1 max-w-[100px] truncate">
                      {q.conhecimentoExigido ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.questoes.length > 30 && (
              <p className="mt-2 text-slate-500">+ {preview.questoes.length - 30} questões…</p>
            )}
          </div>
          <p className="mt-2 text-xs text-teal-700">
            Revise a prévia e clique em <strong>Gravar esta etapa no banco</strong> para persistir só
            esta fase.
          </p>
        </div>
      )}
    </Card>
  );
}
