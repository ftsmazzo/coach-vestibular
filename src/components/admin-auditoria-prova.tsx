"use client";

import { useState } from "react";
import { Button, Card, Label } from "@/components/ui";

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
  totalQuestoes: number;
  suspeitas: number;
  temTextoFonte: boolean;
  textoFonteSalvo: boolean;
  alertas: AlertaAuditoria[];
  exportacaoTexto: string;
  exportacaoCsv: string;
  numerosSuspeitos: number[];
}

interface Props {
  provaId: string;
  provaNome: string;
  temTextoFonte?: boolean;
  tamanhoTextoFonte?: number;
  totalQuestoes: number;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function AdminAuditoriaProva({
  provaId,
  provaNome,
  temTextoFonte,
  tamanhoTextoFonte = 0,
  totalQuestoes,
}: Props) {
  const [textoExtra, setTextoExtra] = useState("");
  const [salvarTexto, setSalvarTexto] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAuditoria | null>(null);
  const [msg, setMsg] = useState("");

  async function auditar() {
    setAuditing(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/provas/${provaId}/auditar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoFonte: textoExtra.trim() || undefined,
          salvarTextoFonte: salvarTexto && Boolean(textoExtra.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Falha na auditoria");
        setResultado(null);
        return;
      }
      setResultado(data as ResultadoAuditoria);
      setMsg(
        data.suspeitas === 0
          ? "Nenhuma inconsistência detectada pelas regras automáticas."
          : `${data.suspeitas} questão(ões) suspeita(s) — use Copiar relatório ou CSV.`
      );
    } catch {
      setMsg("Erro de rede ao auditar.");
    } finally {
      setAuditing(false);
    }
  }

  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <h2 className="mb-2 font-semibold text-violet-900">Auditoria de classificação (IA)</h2>
      <p className="mb-3 text-sm text-violet-900">
        Detecta questões com matéria/assunto incoerentes em relação aos vizinhos — típico quando a
        IA “herda” a classificação da questão anterior após quebra de página (ex.: q.29 igual à
        q.21, mas diferente de 28 e 30). Gera texto e CSV para colar no GPT, corrigir e reimportar.
      </p>
      {temTextoFonte && (
        <p className="mb-2 text-xs text-violet-800">
          Texto da prova já salvo no servidor ({tamanhoTextoFonte.toLocaleString("pt-BR")}{" "}
          caracteres) da última extração. A auditoria usa esse texto automaticamente se o campo
          abaixo estiver vazio.
        </p>
      )}
      {!temTextoFonte && totalQuestoes > 0 && (
        <p className="mb-2 text-xs text-amber-800">
          Sem texto salvo: cole abaixo o texto completo da prova (ou reextraia com IA) para incluir
          enunciados no relatório.
        </p>
      )}
      <div>
        <Label>Texto da prova (opcional — complementa ou substitui o salvo)</Label>
        <textarea
          className="mt-1 w-full rounded-xl border border-violet-200 bg-white p-3 font-mono text-xs"
          rows={4}
          placeholder="Cole o PDF em texto, ou deixe vazio para usar o texto já salvo na extração..."
          value={textoExtra}
          onChange={(e) => setTextoExtra(e.target.value)}
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-violet-900">
          <input
            type="checkbox"
            checked={salvarTexto}
            onChange={(e) => setSalvarTexto(e.target.checked)}
          />
          Salvar texto colado no servidor (para próximas auditorias)
        </label>
      </div>
      <Button type="button" className="mt-3" disabled={auditing} onClick={auditar}>
        {auditing ? "Analisando..." : "Auditar classificações"}
      </Button>
      {msg && <p className="mt-2 text-sm text-violet-900">{msg}</p>}

      {resultado && resultado.suspeitas > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const ok = await copiar(resultado.exportacaoTexto);
                setMsg(ok ? "Relatório copiado." : "Não foi possível copiar — selecione o texto abaixo.");
              }}
            >
              Copiar relatório (texto)
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const ok = await copiar(resultado.exportacaoCsv);
                setMsg(ok ? "CSV copiado." : "Não foi possível copiar o CSV.");
              }}
            >
              Copiar CSV
            </Button>
          </div>
          <p className="text-xs text-violet-800">
            Questões: {resultado.numerosSuspeitos.join(", ")} · {provaNome}
          </p>
          <ul className="max-h-48 space-y-2 overflow-auto text-sm">
            {resultado.alertas.map((a) => (
              <li
                key={a.numero}
                className={`rounded-lg border px-3 py-2 ${
                  a.severidade === "alta"
                    ? "border-rose-200 bg-rose-50/80"
                    : "border-amber-200 bg-amber-50/80"
                }`}
              >
                <span className="font-semibold">
                  Q.{a.numero}
                  {a.severidade === "alta" ? " — prioridade alta" : ""}
                </span>
                <span className="block text-slate-700">
                  {a.atual.materia} — {a.atual.assunto}
                </span>
                {a.parRemoto && (
                  <span className="block text-xs text-teal-800">
                    Mesmo padrão da q.{a.parRemoto.numero}: {a.parRemoto.classificacao.materia} —{" "}
                    {a.parRemoto.classificacao.assunto}
                  </span>
                )}
                <span className="block text-xs text-slate-600">{a.motivos[0]}</span>
              </li>
            ))}
          </ul>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-violet-900">
              Ver relatório completo
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-3 font-mono text-[11px]">
              {resultado.exportacaoTexto}
            </pre>
          </details>
        </div>
      )}
    </Card>
  );
}
