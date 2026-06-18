import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadConjuntoExamView } from "@/lib/conjunto-exam-view";
import { getLeituraCoachConjunto, getMicroPlanoConjunto } from "@/lib/micro-plano-conjunto";
import { abreviarNomeProva } from "@/lib/prova-label";
import { parseConjuntoExamId } from "@/lib/prova-multidia";
import { GerarMicroPlanoConjuntoButton } from "@/components/gerar-micro-plano-conjunto-button";
import { ProvaDiagnosticoIA } from "@/components/prova-diagnostico-ia";
import { LeituraCoachCard } from "@/components/leitura-coach-card";
import { PageBackLink } from "@/components/page-back-link";
import { Card, Badge, LinkButton } from "@/components/ui";

export default async function ConjuntoLentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: conjuntoExamId } = await params;
  const parsed = parseConjuntoExamId(conjuntoExamId);
  if (!parsed) notFound();

  const [examIdDia1, examIdDia2] = parsed;
  const [conjunto, leitura, microPlano] = await Promise.all([
    loadConjuntoExamView(session.userId, examIdDia1, examIdDia2),
    getLeituraCoachConjunto(session.userId, conjuntoExamId),
    getMicroPlanoConjunto(session.userId, conjuntoExamId),
  ]);
  if (!conjunto) notFound();

  const narrativaIA = microPlano.narrative;
  const blocosMicroPlano = microPlano.items.filter(
    (i) => i.bloco !== "contexto" && i.titulo
  );
  const tituloProva = abreviarNomeProva(conjunto.nome, 56);
  const total = conjunto.questionAttempts.length;
  const pct = total > 0 ? Math.round((conjunto.acertos / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <PageBackLink href="/provas">Atividades</PageBackLink>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Sua lente</h1>
          <Badge tone="success">Prova completa · {total} questões</Badge>
        </div>
        <p className="text-sm font-medium text-slate-700">{tituloProva}</p>
        <p className="text-xs text-slate-500">
          {conjunto.dataLabel} · {pct}% de acerto · dia 1 + dia 2 unificados
        </p>
      </header>

      {narrativaIA ? (
        <ProvaDiagnosticoIA narrativa={narrativaIA} provaNome={tituloProva} />
      ) : (
        leitura && (
          <LeituraCoachCard
            titulo={leitura.tituloProva}
            mensagem={leitura.mensagem}
            focos={leitura.focos}
            pctReferencia={leitura.pctReferencia}
          />
        )
      )}

      {blocosMicroPlano.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold text-slate-900">Micro-plano desta prova (180 questões)</h2>
          <p className="mb-4 text-xs text-slate-500">
            Blocos de estudo da prova completa. O passo a passo está em{" "}
            <Link href={`/quests?provaId=${conjunto.provaIds[0]}`} className="font-medium text-teal-700 underline">
              Quests
            </Link>
            .
          </p>
          <ul className="space-y-3">
            {blocosMicroPlano.map((item) => (
              <li
                key={`${item.ordem}-${item.titulo}`}
                className={`rounded-xl border p-3 ${
                  item.bloco === "foco_profundo"
                    ? "border-teal-200 bg-teal-50/30"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{item.titulo}</h3>
                  {item.bloco === "foco_profundo" && <Badge tone="danger">Prioridade</Badge>}
                  {item.duracaoMin > 0 && (
                    <span className="text-xs text-slate-500">~{item.duracaoMin} min</span>
                  )}
                </div>
                {item.descricao && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {item.descricao}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="border-teal-200 bg-teal-50/40">
        <h2 className="font-semibold text-teal-950">
          {narrativaIA ? "Atualizar análise da prova completa" : "Análise e micro-plano (180 questões)"}
        </h2>
        <p className="mt-2 text-sm text-teal-900">
          {narrativaIA
            ? "Regerar diagnóstico, micro-plano e quests com dia 1 + dia 2 juntos."
            : "Gera diagnóstico com IA, micro-plano e quests considerando as 180 questões — não só um dia."}
        </p>
        <div className="mt-4">
          <GerarMicroPlanoConjuntoButton
            conjuntoExamId={conjuntoExamId}
            provaIdQuests={conjunto.provaIds[0]}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Números e questões</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/simulados/${conjuntoExamId}`}>Ver gráficos (180q)</LinkButton>
          <LinkButton href={`/simulados/${examIdDia1}`} variant="secondary">
            Só dia 1
          </LinkButton>
          <LinkButton href={`/simulados/${examIdDia2}`} variant="secondary">
            Só dia 2
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
