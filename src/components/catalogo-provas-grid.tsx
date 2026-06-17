"use client";

import { useMemo, useState } from "react";
import type { ProvaTipo } from "@/generated/prisma/client";
import { abreviarNomeProva } from "@/lib/prova-label";
import { tipoAtividadeFromProvaTipo } from "@/lib/prova-tipo";
import { AtividadeCard, AtividadeCardRegistrar } from "@/components/atividade-card";
import { touchChipClass } from "@/components/ui";

export type ProvaCatalogoItem = {
  id: string;
  nome: string;
  tipo: ProvaTipo;
  banca: string;
  ano: number | null;
  minhasTentativas: number;
  temCaderno: boolean;
  ultimaTentativa: {
    id: string;
    dataLabel: string;
    pctAcerto: number;
  } | null;
};

type FiltroAtividades = "todas" | "pendentes" | "realizadas";

function subtituloProva(p: ProvaCatalogoItem): string {
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

function CardRealizada({ p }: { p: ProvaCatalogoItem }) {
  const titulo = abreviarNomeProva(p.nome, 42);
  const tipo = tipoAtividadeFromProvaTipo(p.tipo);
  const subtitulo = subtituloProva(p);
  const lenteHref = `/provas/${p.id}/lente`;
  const cadernoHref = p.temCaderno ? `/api/provas/${p.id}/caderno` : null;
  const examId = p.ultimaTentativa!.id;

  return (
    <AtividadeCard
      titulo={titulo}
      subtitulo={subtitulo}
      tipoAtividade={tipo}
      pct={p.ultimaTentativa!.pctAcerto}
      analiseHref={lenteHref}
      dadosHref={`/simulados/${examId}`}
      terceiroHref={`/quests?provaId=${p.id}`}
      terceiroLabel="Quests"
      cadernoHref={cadernoHref}
    />
  );
}

function CardPendente({ p }: { p: ProvaCatalogoItem }) {
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

export function CatalogoProvasGrid({ provas }: { provas: ProvaCatalogoItem[] }) {
  const [filtro, setFiltro] = useState<FiltroAtividades>("todas");

  const { pendentes, realizadas } = useMemo(() => {
    const pend: ProvaCatalogoItem[] = [];
    const real: ProvaCatalogoItem[] = [];
    for (const p of provas) {
      if (p.ultimaTentativa) real.push(p);
      else pend.push(p);
    }
    return { pendentes: pend, realizadas: real };
  }, [provas]);

  if (provas.length === 0) {
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
          Todas ({provas.length})
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
