import type { ProvaTipo } from "@/generated/prisma/client";
import { abreviarNomeProva } from "@/lib/prova-label";
import { tipoAtividadeFromProvaTipo } from "@/lib/prova-tipo";
import { AtividadeCard, AtividadeCardRegistrar } from "@/components/atividade-card";

export type ProvaCatalogoItem = {
  id: string;
  nome: string;
  tipo: ProvaTipo;
  banca: string;
  ano: number | null;
  minhasTentativas: number;
  ultimaTentativa: {
    id: string;
    dataLabel: string;
    pctAcerto: number;
  } | null;
};

function subtituloProva(p: ProvaCatalogoItem): string {
  const ano = p.ano != null ? String(p.ano) : "";
  const partes = [p.banca, ano].filter(Boolean);
  if (p.ultimaTentativa) {
    return `${partes.join(" · ")} · ${p.ultimaTentativa.dataLabel}`;
  }
  if (p.minhasTentativas > 0) {
    return `${partes.join(" · ")} · ${p.minhasTentativas} registro(s)`;
  }
  return partes.join(" · ") || "Disponível no catálogo";
}

export function CatalogoProvasGrid({ provas }: { provas: ProvaCatalogoItem[] }) {
  if (provas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        Nenhuma prova disponível no catálogo por enquanto.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {provas.map((p) => {
        const titulo = abreviarNomeProva(p.nome, 42);
        const tipo = tipoAtividadeFromProvaTipo(p.tipo);
        const subtitulo = subtituloProva(p);
        const registrarHref = `/simulados/novo?provaId=${p.id}`;

        if (!p.ultimaTentativa) {
          return (
            <AtividadeCardRegistrar
              key={p.id}
              titulo={titulo}
              subtitulo={subtitulo}
              tipoAtividade={tipo}
              registrarHref={registrarHref}
            />
          );
        }

        const examId = p.ultimaTentativa.id;
        return (
          <AtividadeCard
            key={p.id}
            titulo={titulo}
            subtitulo={subtitulo}
            tipoAtividade={tipo}
            pct={p.ultimaTentativa.pctAcerto}
            analiseHref={`/simulados/${examId}`}
            dadosHref={`/provas/${p.id}/lente`}
            terceiroHref={`/quests?provaId=${p.id}`}
            terceiroLabel="Quests"
          />
        );
      })}
    </div>
  );
}
