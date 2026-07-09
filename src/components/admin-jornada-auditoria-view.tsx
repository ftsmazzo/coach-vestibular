import Link from "next/link";
import type { AuditoriaDadosJornada } from "@/lib/jornada-auditoria-dados";
import type { EvidenciaCanonicaFoco } from "@/lib/jornada-evidencia-canonica";
import { Badge, Card } from "@/components/ui";

type Props = {
  aluno: { id: string; name: string };
  auditoria: AuditoriaDadosJornada;
  escopoId?: string;
  textoEvidenciaAgregada?: string | null;
};

function pct(n: number) {
  return `${Math.round(n * 10) / 10}%`;
}

function FocoEscopoCard({
  foco,
  textoAgregado,
  userId,
}: {
  foco: EvidenciaCanonicaFoco;
  textoAgregado?: string | null;
  userId: string;
}) {
  return (
    <Card className="border-teal-200 bg-teal-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
            Escopo selecionado — agregado da Jornada
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{foco.label}</h2>
          {textoAgregado && <p className="mt-2 text-sm text-slate-700">{textoAgregado}</p>}
        </div>
        <Link
          href={`/admin/jornada/auditoria?userId=${userId}`}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          Limpar filtro
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">Erros / total</p>
          <p className="font-semibold text-slate-900">
            {foco.erros} / {foco.total}
          </p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">% erro (agregado)</p>
          <p className="font-semibold text-slate-900">{pct(foco.pctErro)}</p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">Provas com erro</p>
          <p className="font-semibold text-slate-900">{foco.provasComErro}</p>
          <p className="text-xs text-slate-500">de {foco.provasComQuestao} com questões</p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">N3 recorrentes</p>
          <p className="text-sm text-slate-800">
            {foco.n3Recorrentes.length > 0 ? foco.n3Recorrentes.join(", ") : "—"}
          </p>
        </div>
      </div>
      {foco.ocorrenciasPorProva.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-800">Por prova (prova isolada)</p>
          <ul className="mt-2 space-y-2">
            {foco.ocorrenciasPorProva.map((o) => (
              <li
                key={o.examId}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <span className="font-medium text-slate-900">{o.nome}</span>
                {" — "}
                {o.erros} erro(s) em {o.total} questão(ões)
                {o.numerosErradas.length > 0 && (
                  <span className="text-slate-500">
                    {" "}
                    (questões erradas: {o.numerosErradas.join(", ")})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function AdminJornadaAuditoriaView({
  aluno,
  auditoria,
  escopoId,
  textoEvidenciaAgregada,
}: Props) {
  const temDivergencias = auditoria.divergencias.length > 0;
  const escoposOrdenados = [...auditoria.agregadoPorEscopo].sort((a, b) => b.erros - a.erros);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-teal-700 hover:underline">
          ← Alunos e acesso
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Auditoria da Jornada</h1>
        <p className="mt-1 text-slate-600">
          Coerência entre provas, diagnóstico inicial, ciclo e agregados canônicos —{" "}
          <span className="font-medium text-slate-900">{aluno.name}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {temDivergencias ? (
          <Badge tone="danger">{auditoria.divergencias.length} divergência(s)</Badge>
        ) : (
          <Badge tone="success">Sem divergências detectadas</Badge>
        )}
        {auditoria.questoesComDivergenciaEscopo > 0 && (
          <Badge tone="warning">
            {auditoria.questoesComDivergenciaEscopo} questão(ões) com escopo attempt ≠ prova
          </Badge>
        )}
        <Badge tone="neutral">
          {auditoria.totais.provasValidas} prova(s) · {auditoria.totais.questoesValidas} questões
          válidas
        </Badge>
      </div>

      {auditoria.evidenciaCanonicaFoco && (
        <FocoEscopoCard
          foco={auditoria.evidenciaCanonicaFoco}
          textoAgregado={textoEvidenciaAgregada}
          userId={aluno.id}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-slate-900">Diagnóstico inicial</h2>
          <dl className="mt-3 space-y-1 text-sm text-slate-700">
            <div className="flex justify-between gap-4">
              <dt>Snapshot</dt>
              <dd className="font-mono text-xs text-slate-600">
                {auditoria.diagnosticoInicial.snapshotId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Escopos no baseline</dt>
              <dd>{auditoria.diagnosticoInicial.escoposNoSnapshot}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Ciclo inicial (Semana 1)</h2>
          <dl className="mt-3 space-y-1 text-sm text-slate-700">
            <div className="flex justify-between gap-4">
              <dt>Ciclo</dt>
              <dd className="font-mono text-xs text-slate-600">
                {auditoria.cicloInicial.cicloId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Meta escopo</dt>
              <dd className="text-right">
                {auditoria.cicloInicial.metaEscopoId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Erros no escopo (ciclo)</dt>
              <dd>{auditoria.cicloInicial.errosNoEscopo ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Total questões no escopo</dt>
              <dd>{auditoria.cicloInicial.totalQuestoesNoEscopo ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {temDivergencias && (
        <Card className="border-rose-200">
          <h2 className="font-semibold text-rose-900">Divergências</h2>
          <p className="mt-1 text-sm text-slate-600">
            Valores canônicos (attempt + catálogo) comparados com diagnóstico, ciclo ou gráfico da
            prova.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-600">
                  <th className="p-2 font-medium">Origem</th>
                  <th className="p-2 font-medium">Escopo</th>
                  <th className="p-2 font-medium">Campo</th>
                  <th className="p-2 font-medium">Canônico</th>
                  <th className="p-2 font-medium">Encontrado</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.divergencias.map((d, i) => (
                  <tr key={`${d.origem}-${d.escopoId}-${d.campo}-${i}`} className="border-b border-slate-100">
                    <td className="p-2 text-slate-700">{d.origem}</td>
                    <td className="p-2">
                      <Link
                        href={`/admin/jornada/auditoria?userId=${aluno.id}&escopoId=${encodeURIComponent(d.escopoId)}`}
                        className="font-medium text-teal-700 hover:underline"
                      >
                        {d.label}
                      </Link>
                    </td>
                    <td className="p-2 text-slate-600">{d.campo}</td>
                    <td className="p-2 font-mono">{String(d.canonico)}</td>
                    <td className="p-2 font-mono text-rose-700">{String(d.encontrado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">Agregado por escopo (Jornada)</h2>
        <p className="mb-3 text-sm text-slate-600">
          Clique em um escopo para ver o breakdown por prova.{" "}
          <strong>provasComErro</strong> = quantas provas tiveram erro no tema (não é contagem de
          erros).
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
                <th className="p-3 font-medium">Escopo</th>
                <th className="p-3 font-medium text-center">Erros</th>
                <th className="p-3 font-medium text-center">Total</th>
                <th className="p-3 font-medium text-center">% erro</th>
                <th className="p-3 font-medium text-center">Provas c/ erro</th>
                <th className="p-3 font-medium text-center">Provas c/ questão</th>
              </tr>
            </thead>
            <tbody>
              {escoposOrdenados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-500">
                    Nenhum escopo com questões analisáveis na Jornada.
                  </td>
                </tr>
              ) : (
                escoposOrdenados.map((e) => {
                  const ativo = escopoId === e.escopoId;
                  return (
                    <tr
                      key={e.escopoId}
                      className={`border-b border-slate-100 ${ativo ? "bg-teal-50/60" : ""}`}
                    >
                      <td className="p-3">
                        <Link
                          href={`/admin/jornada/auditoria?userId=${aluno.id}&escopoId=${encodeURIComponent(e.escopoId)}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {e.label}
                        </Link>
                        {ativo && (
                          <span className="ml-2">
                            <Badge tone="success">filtro ativo</Badge>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-medium">{e.erros}</td>
                      <td className="p-3 text-center">{e.total}</td>
                      <td className="p-3 text-center">{pct(e.pctErro)}</td>
                      <td className="p-3 text-center">{e.provasComErro}</td>
                      <td className="p-3 text-center">{e.provasComQuestao}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Por prova (isolada)</h2>
        <div className="space-y-4">
          {auditoria.porProva.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600">Nenhuma prova elegível na Jornada.</p>
            </Card>
          ) : (
            auditoria.porProva.map((prova) => (
              <Card key={prova.examId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{prova.nome}</h3>
                  <Badge tone="neutral">{prova.modoUso}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {prova.acertos} acertos · {prova.erros} erros · {pct(prova.pctAcerto)} acerto
                </p>
                {prova.porEscopo.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {prova.porEscopo
                      .filter((s) => s.erros > 0 || s.total > 0)
                      .sort((a, b) => b.erros - a.erros)
                      .slice(0, 12)
                      .map((s) => (
                        <li key={s.escopoId} className="flex flex-wrap justify-between gap-2 text-slate-700">
                          <Link
                            href={`/admin/jornada/auditoria?userId=${aluno.id}&escopoId=${encodeURIComponent(s.escopoId)}`}
                            className="text-teal-700 hover:underline"
                          >
                            {s.label}
                          </Link>
                          <span>
                            {s.erros}/{s.total} erros
                            {s.numerosErradas.length > 0 && (
                              <span className="text-slate-500">
                                {" "}
                                (Q{s.numerosErradas.join(", Q")})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
