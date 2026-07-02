"use client";

import {
  LABEL_TEXTO_INCOMPLETO,
  type PendenciasProvaAdmin,
} from "@/lib/prova-pendencias-admin";

interface Props {
  pendencias: PendenciasProvaAdmin;
  publicada: boolean;
  extracaoValidada: boolean;
  comN1: number;
  totalLinhasBanco: number;
}

function Pill({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function AdminProvaResumoStatus({
  pendencias,
  publicada,
  extracaoValidada,
  comN1,
  totalLinhasBanco,
}: Props) {
  const { cadastradas, totalQuestoes, coberturaPct, bancoIncompleto, textoIncompleto } =
    pendencias;

  const coberturaOk =
    !bancoIncompleto && textoIncompleto.length === 0 && cadastradas >= totalQuestoes;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        className={
          coberturaOk
            ? "bg-emerald-100 text-emerald-900"
            : bancoIncompleto
              ? "bg-amber-100 text-amber-950"
              : "bg-slate-100 text-slate-700"
        }
        title="Questões lógicas no banco vs total cadastrado na prova"
      >
        {cadastradas}/{totalQuestoes} no banco ({coberturaPct}%)
      </Pill>

      {textoIncompleto.length > 0 && (
        <Pill
          className="bg-violet-100 text-violet-900"
          title="Alternativas ou trechos não transcritos — comum em provas com figuras ou fórmulas"
        >
          {textoIncompleto.length} {LABEL_TEXTO_INCOMPLETO.toLowerCase()}
        </Pill>
      )}

      {bancoIncompleto && (
        <Pill className="bg-amber-100 text-amber-950" title="Números ausentes no banco">
          {pendencias.faltando.length} faltando
        </Pill>
      )}

      {pendencias.validacaoExtracaoPendente && (
        <Pill className="bg-sky-100 text-sky-900" title="Revise amostras após extrair o PDF">
          Validar extração
        </Pill>
      )}

      <Pill
        className={
          pendencias.gabaritoPendente
            ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            : "bg-emerald-50 text-emerald-800"
        }
      >
        Gabarito {pendencias.gabaritoPendente ? "pendente" : "ok"}
      </Pill>

      {totalLinhasBanco > 0 && (
        <Pill className="bg-slate-100 text-slate-700">
          N1 {comN1}/{totalLinhasBanco}
        </Pill>
      )}

      <Pill
        className={
          publicada ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-600"
        }
      >
        {publicada ? "Publicada" : "Rascunho"}
      </Pill>

      {extracaoValidada && totalLinhasBanco > 0 && (
        <Pill className="bg-slate-100 text-slate-600">Extração validada</Pill>
      )}
    </div>
  );
}
