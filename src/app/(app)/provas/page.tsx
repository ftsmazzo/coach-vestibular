import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statsQuestoesProva } from "@/lib/prova-stats";
import {
  abaFromSearchParam,
  filtrarProvasPorAba,
  labelTipoProva,
} from "@/lib/prova-tipo";
import { formatDataAplicacao } from "@/lib/data-prova";
import { Card, Badge, LinkButton } from "@/components/ui";

interface PageProps {
  searchParams: Promise<{ aba?: string }>;
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition sm:min-h-0 ${
        active
          ? "bg-teal-600 text-white shadow-sm"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}

function agruparPorAno<T extends { ano: number | null }>(provas: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of provas) {
    const chave = p.ano != null ? String(p.ano) : "Sem ano";
    const lista = map.get(chave) ?? [];
    lista.push(p);
    map.set(chave, lista);
  }
  const anos = [...map.keys()].sort((a, b) => {
    if (a === "Sem ano") return 1;
    if (b === "Sem ano") return -1;
    return parseInt(b, 10) - parseInt(a, 10);
  });
  return new Map(anos.map((y) => [y, map.get(y)!]));
}

export default async function ProvasPublicasPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { aba: abaParam } = await searchParams;
  const aba = abaFromSearchParam(abaParam);

  const [user, provasRaw, meusExams] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { vestibularAlvo: true, metaProva: true },
    }),
    prisma.prova.findMany({
      where: { publicada: true },
      orderBy: [{ ano: "desc" }, { nome: "asc" }],
      include: { questoes: { select: { numero: true } } },
    }),
    prisma.exam.findMany({
      where: {
        userId: session.userId,
        provaId: { not: null },
      },
      include: { questionAttempts: true },
      orderBy: { data: "desc" },
    }),
  ]);

  const ultimaPorProvaId = new Map<
    string,
    { id: string; dataLabel: string; pctAcerto: number }
  >();
  const contagemPorProvaId = new Map<string, number>();

  for (const e of meusExams) {
    if (!e.provaId) continue;
    contagemPorProvaId.set(e.provaId, (contagemPorProvaId.get(e.provaId) ?? 0) + 1);
    if (!ultimaPorProvaId.has(e.provaId)) {
      const total = e.questionAttempts.length;
      const acertos = e.questionAttempts.filter((q) => q.correto).length;
      ultimaPorProvaId.set(e.provaId, {
        id: e.id,
        dataLabel: formatDataAplicacao(e.data),
        pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
      });
    }
  }

  const provas = provasRaw.map((p) => {
    const stats = statsQuestoesProva(p.questoes, p.totalQuestoes);
    return {
      id: p.id,
      nome: p.nome,
      banca: p.banca,
      tipo: p.tipo,
      ano: p.ano,
      dia: p.dia,
      caderno: p.caderno,
      totalQuestoes: p.totalQuestoes,
      gabaritoCompleto: p.gabaritoCompleto,
      questoesCount: stats.cadastradas,
      bancoIncompleto: stats.incompleto,
      minhasTentativas: contagemPorProvaId.get(p.id) ?? 0,
      ultimaTentativa: ultimaPorProvaId.get(p.id) ?? null,
    };
  });

  const filtradas = filtrarProvasPorAba(provas, aba);
  const porAno = agruparPorAno(filtradas);

  const totalOficiais = filtrarProvasPorAba(provas, "oficiais").length;
  const totalSimulados = filtrarProvasPorAba(provas, "simulados").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Provas públicas</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Escolha a prova que você fez (oficial ou simulado), de qualquer ano cadastrado pelo
          admin. Depois informe suas respostas ou só os erros — o conteúdo de cada questão já está
          no banco.
        </p>
      </div>

      {(user?.vestibularAlvo || user?.metaProva) && (
        <Card className="border-teal-100 bg-teal-50/50">
          <p className="text-sm text-teal-900">
            <span className="font-medium">Sua meta:</span>{" "}
            {[user.vestibularAlvo, user.metaProva].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-teal-800">
            Erros em provas da banca da sua meta pesam mais na jornada e no plano.{" "}
            <Link href="/perfil" className="font-medium underline">
              Editar meta
            </Link>
          </p>
        </Card>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <TabLink href="/provas?aba=oficiais" active={aba === "oficiais"}>
            Provas oficiais ({totalOficiais})
          </TabLink>
          <TabLink href="/provas?aba=simulados" active={aba === "simulados"}>
            Simulados ({totalSimulados})
          </TabLink>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {aba === "oficiais" ? (
            <>
              <strong>Oficiais</strong> (ENEM, vestibulares): definem os focos principais a partir
              das falhas reais.
            </>
          ) : (
            <>
              <strong>Simulados</strong>: acompanham se você está melhorando nos temas que as
              provas oficiais mostraram — um termômetro na caminhada.
            </>
          )}
        </p>
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            Nenhuma prova publicada nesta categoria ainda. O admin cadastra em{" "}
            <strong>Admin → Banco de provas</strong> e publica (pode incluir anos anteriores).
          </p>
          {aba === "oficiais" && totalSimulados > 0 && (
            <Link href="/provas?aba=simulados" className="mt-3 inline-block text-sm text-teal-700">
              Ver simulados ({totalSimulados}) →
            </Link>
          )}
          {aba === "simulados" && totalOficiais > 0 && (
            <Link href="/provas?aba=oficiais" className="mt-3 inline-block text-sm text-teal-700">
              Ver provas oficiais ({totalOficiais}) →
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          {[...porAno.entries()].map(([anoLabel, lista]) => (
            <section key={anoLabel}>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">
                {anoLabel === "Sem ano" ? "Sem ano definido" : `Ano ${anoLabel}`}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {lista.map((p) => (
                  <li key={p.id}>
                    <Card className="flex h-full flex-col justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-start gap-2">
                          <Badge tone="neutral">{labelTipoProva(p.tipo)}</Badge>
                          {p.minhasTentativas > 0 && (
                            <Badge tone="success">
                              {p.minhasTentativas} registro
                              {p.minhasTentativas > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <h3 className="mt-2 font-semibold text-slate-900">{p.nome}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {p.banca}
                          {p.caderno ? ` · ${p.caderno}` : ""}
                          {p.dia ? ` · Dia ${p.dia}` : ""}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {p.questoesCount}/{p.totalQuestoes} questões no banco
                          {p.bancoIncompleto ? " · cadastro parcial" : ""}
                          {!p.gabaritoCompleto ? " · gabarito incompleto" : ""}
                        </p>
                        {p.ultimaTentativa && (
                          <p className="mt-2 text-sm text-teal-800">
                            Seu último registro: aplicada em{" "}
                            <strong>{p.ultimaTentativa.dataLabel}</strong> ·{" "}
                            {p.ultimaTentativa.pctAcerto}% acertos
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {p.minhasTentativas >= 1 && (
                          <>
                            <LinkButton
                              href={`/provas/${p.id}/lente`}
                              variant="secondary"
                              className="w-full flex-1 text-center"
                            >
                              Sua lente
                            </LinkButton>
                            <LinkButton
                              href={`/provas/${p.id}/historico`}
                              variant="ghost"
                              className="w-full flex-1 text-center"
                            >
                              Histórico ({p.minhasTentativas})
                            </LinkButton>
                          </>
                        )}
                        {p.ultimaTentativa && (
                          <LinkButton
                            href={`/simulados/${p.ultimaTentativa.id}`}
                            variant="secondary"
                            className="w-full flex-1 text-center"
                          >
                            Ver último resultado
                          </LinkButton>
                        )}
                        <LinkButton
                          href={`/simulados/novo?provaId=${p.id}`}
                          className="w-full flex-1 text-center"
                        >
                          {p.minhasTentativas > 0
                            ? "Refazer / atualizar gabarito"
                            : "Registrar meu resultado"}
                        </LinkButton>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Card className="bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Em breve</h2>
        <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
          <li>Meta de faculdade com peso por banca/vestibular</li>
          <li>Incidência de temas em vestibulares (API externa)</li>
        </ul>
      </Card>
    </div>
  );
}
