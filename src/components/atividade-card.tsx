import type { TipoAtividadeVisual } from "@/lib/prova-tipo";
import { TEMA_ATIVIDADE } from "@/lib/prova-tipo";
import type { WidgetMode } from "@/lib/widget-context";
import { PctDonut } from "@/components/pct-donut";
import { LinkButton } from "@/components/ui";

const btnFino = "!rounded-md !px-2 !py-1 !text-[10px] !font-medium !leading-none";

export function AtividadeCard({
  titulo,
  subtitulo,
  tipoAtividade,
  pct,
  analiseHref,
  dadosHref,
  terceiroHref,
  terceiroLabel,
  cadernoHref,
  mode = "FULL",
}: {
  titulo: string;
  subtitulo: string;
  tipoAtividade: TipoAtividadeVisual;
  pct: number | null;
  analiseHref: string;
  dadosHref: string;
  terceiroHref: string;
  terceiroLabel: string;
  cadernoHref?: string | null;
  mode?: WidgetMode;
}) {
  const tema = TEMA_ATIVIDADE[tipoAtividade];
  const home = mode === "HOME";

  return (
    <article
      className={`flex h-full min-h-[148px] flex-col overflow-hidden rounded-xl text-white shadow-md ${tema.cardClass}`}
    >
      <div className="flex flex-1 items-start gap-2.5 p-3 pb-2">
        <PctDonut pct={pct} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${tema.badgeClass}`}
            >
              {tema.label}
            </span>
            {cadernoHref && (
              <a
                href={cadernoHref}
                download
                title="Baixar o caderno desta prova para fazer"
                className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold leading-none text-white hover:bg-white/30"
              >
                <span aria-hidden>⬇</span> Caderno
              </a>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">{titulo}</p>
          <p className={`mt-0.5 text-[10px] ${tema.pctMuted}`}>{subtitulo}</p>
        </div>
      </div>

      <div
        className={`grid gap-1 border-t border-white/10 p-2 ${home ? "grid-cols-2" : "grid-cols-3"}`}
      >
        <LinkButton href={analiseHref} className={`${btnFino} ${tema.btnPrimary}`}>
          {home ? "Ver resultado" : "Análise"}
        </LinkButton>
        {!home && (
          <LinkButton href={dadosHref} className={`${btnFino} ${tema.btnOutline}`}>
            Dados
          </LinkButton>
        )}
        <LinkButton href={terceiroHref} className={`${btnFino} ${home ? tema.btnOutline : tema.btnGhost}`}>
          {terceiroLabel}
        </LinkButton>
      </div>
    </article>
  );
}

export function AtividadeCardRegistrar({
  titulo,
  subtitulo,
  tipoAtividade,
  registrarHref,
}: {
  titulo: string;
  subtitulo: string;
  tipoAtividade: TipoAtividadeVisual;
  registrarHref: string;
}) {
  const tema = TEMA_ATIVIDADE[tipoAtividade];

  return (
    <article
      className={`flex min-h-[148px] flex-col overflow-hidden rounded-xl text-white shadow-md ${tema.cardClass}`}
    >
      <div className="flex flex-1 items-start gap-2.5 p-3 pb-2">
        <PctDonut pct={null} size="sm" />
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${tema.badgeClass}`}
          >
            {tema.label}
          </span>
          <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">{titulo}</p>
          <p className={`mt-0.5 text-[10px] ${tema.pctMuted}`}>{subtitulo}</p>
        </div>
      </div>

      <div className="border-t border-white/10 p-2">
        <LinkButton href={registrarHref} className={`${btnFino} w-full ${tema.btnPrimary}`}>
          Registrar resultado
        </LinkButton>
      </div>
    </article>
  );
}
