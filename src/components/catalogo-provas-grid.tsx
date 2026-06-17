"use client";

import { useMemo, useState } from "react";
import type { ItemCatalogoAtividades } from "@/lib/catalogo-atividades";
import { abreviarNomeProva } from "@/lib/prova-label";
import { tipoAtividadeFromProvaTipo } from "@/lib/prova-tipo";
import { AtividadeCard, AtividadeCardRegistrar } from "@/components/atividade-card";
import { touchChipClass } from "@/components/ui";

type FiltroAtividades = "todas" | "pendentes" | "realizadas";

function subtituloSingle(p: Extract<ItemCatalogoAtividades, { kind: "single" }>): string {
  const ano = p.ano != null ? String(p.ano) : "";
  const partes = [p.banca, ano].filter(Boolean);
  if (p.ultimaTentativa) {
    return `${partes.join(" · ")} · ${p.ultimaTentativa.dataLabel} · ${p.ultimaTentativa.pctAcerto}% acertos`;
  }
  if (p.minhasTentativas > 0) {
    return `${partes.join(" · ")} · ${p.minhasTentativas} registro(s)`;
  }
  return partes.join(" · ") || "Disponível no catálogo";
}

function subtituloConjunto(p: Extract<ItemCatalogoAtividades, { kind: "conjunto" }>): string {
  const ano = p.ano != null ? String(p.ano) : "";
  const partes = [p.banca, ano].filter(Boolean);
  const u = p.ultimaTentativa;
  return `${partes.join(" · ")} · ${u.dataLabel} · ${u.pctAcerto}% · ${u.totalQuestoes} questões (2 dias)`;
}

function CardRealizadaSingle({ p }: { p: Extract<ItemCatalogoAtividades, { kind: "single" }> }) {
  const titulo = abreviarNomeProva(p.nome, 42);
  const tipo = tipoAtividadeFromProvaTipo(p.tipo);
  const examId = p.ultimaTentativa!.id;

  return (
    <AtividadeCard
      titulo={titulo}
      subtitulo={subtituloSingle(p)}
      tipoAtividade={tipo}
      pct={p.ultimaTentativa!.pctAcerto}
      analiseHref={`/provas/${p.id}/lente`}
      dadosHref={`/simulados/${examId}`}
      terceiroHref={`/quests?provaId=${p.id}`}
      terceiroLabel="Quests"
      cadernoHref={p.temCaderno ? `/api/provas/${p.id}/caderno` : null}
    />
  );
}

function CardRealizadaConjunto({ p }: { p: Extract<ItemCatalogoAtividades, { kind: "conjunto" }> }) {
  const titulo = abreviarNomeProva(p.nome, 48);
  const tipo = tipoAtividadeFromProvaTipo(p.tipo);
  const conjuntoHref = `/simulados/${p.ultimaTentativa.id}`;

  return (
    <AtividadeCard
      titulo={titulo}
      subtitulo={subtituloConjunto(p)}
      tipoAtividade={tipo}
      pct={p.ultimaTentativa.pctAcerto}
      analiseHref={conjuntoHref}
      dadosHref={conjuntoHref}
      terceiroHref={`/quests?provaId=${p.provaIds[0]}`}
      terceiroLabel="Quests"
      cadernoHref={p.temCaderno ? `/api/provas/${p.provaIds[0]}/caderno` : null}
    />
  );
}

function CardRealizada({ p }: { p: ItemCatalogoAtividades }) {
  if (p.kind === "conjunto") return <CardRealizadaConjunto p={p} />;
  if (!p.ultimaTentativa) return null;
  return <CardRealizadaSingle p={p} />;
}

function CardPendente({ p }: { p: Extract<ItemCatalogoAtividades, { kind: "single" }> }) {
  const titulo = abreviarNomeProva(p.nome, 42);
  const tipo = tipoAtividadeFromProvaTipo(p.tipo);
  const ano = p.ano != null ? String(p.ano) : "";
  const partes = [p.banca, ano].filter(Boolean);
  const subtitulo = partes.length ? `${partes.join(" · ")} · Ainda sem resultado` : "Ainda sem resultado";

  return (
    <div className="relative rounded-xl ring-2 ring-amber-300/90 ring-offset-2 ring-offset-slate-50">
      <span className="absolute -top-2.5 left-3 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm">
        A fazer
      </span>
      <AtividadeCardRegistrar
        titulo={titulo}
        subtitulo={subtitulo}
        tipoAtividade={tipo}
        registrarHref={`/simulados/novo?provaId=${p.id}`}
      />
    </div>
  );
}

function SecaoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

export function CatalogoProvasGrid({ itens }: { itens: ItemCatalogoAtividades[] }) {
  const [filtro, setFiltro] = useState<FiltroAtividades>("todas");

  const { pendentes, realizadas } = useMemo(() => {
    const pend: Extract<ItemCatalogoAtividades, { kind: "single" }>[] = [];
    const real: ItemCatalogoAtividades[] = [];
    for (const p of itens) {
      if (p.kind === "conjunto" || p.ultimaTentativa) real.push(p);
      else if (p.kind === "single") pend.push(p);
    }
    return { pendentes: pend, realizadas: real };
  }, [itens]);

  if (itens.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        Nenhuma prova disponível no catálogo por enquanto.
      </p>
    );
  }

  const mostrarPendentes = filtro === "todas" || filtro === "pendentes";
  const mostrarRealizadas = filtro === "todas" || filtro === "realizadas";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={touchChipClass(filtro === "todas")} onClick={() => setFiltro("todas")}>
          Todas ({itens.length})
        </button>
        <button
          type="button"
          className={touchChipClass(filtro === "pendentes")}
          onClick={() => setFiltro("pendentes")}
        >
          A fazer ({pendentes.length})
        </button>
        <button
          type="button"
          className={touchChipClass(filtro === "realizadas")}
          onClick={() => setFiltro("realizadas")}
        >
          Realizadas ({realizadas.length})
        </button>
      </div>

      {mostrarPendentes && pendentes.length > 0 && (
        <section>
          {filtro === "todas" && (
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Para fazer
              <span className="ml-2 font-normal text-slate-500">— registre seu gabarito quando terminar</span>
            </h2>
          )}
          <SecaoGrid>
            {pendentes.map((p) => (
              <CardPendente key={p.id} p={p} />
            ))}
          </SecaoGrid>
        </section>
      )}

      {mostrarRealizadas && realizadas.length > 0 && (
        <section>
          {filtro === "todas" && pendentes.length > 0 && (
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Já registradas
              <span className="ml-2 font-normal text-slate-500">— com resultado e diagnóstico</span>
            </h2>
          )}
          <SecaoGrid>
            {realizadas.map((p) => (
              <CardRealizada key={p.id} p={p} />
            ))}
          </SecaoGrid>
        </section>
      )}

      {filtro === "pendentes" && pendentes.length === 0 && (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-6 text-center text-sm text-emerald-900">
          Você já registrou resultado em todas as atividades do catálogo.
        </p>
      )}

      {filtro === "realizadas" && realizadas.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          Nenhuma atividade com resultado ainda. Escolha uma prova em «A fazer» e registre seu gabarito.
        </p>
      )}
    </div>
  );
}
