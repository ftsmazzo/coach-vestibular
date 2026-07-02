"use client";

import { Button, Card, Input, Label } from "@/components/ui";
import { GabaritoRevisaoGrid } from "@/components/gabarito-revisao-grid";
import type { LinhaRevisaoGabarito } from "@/lib/extrair-gabarito-aluno";
import { type FaixaIdiomaOpcional } from "@/lib/prova-idioma";
import { AdminZonaColarImagem } from "./admin-zona-colar-imagem";
import type { ProvaAdmin } from "./types";

interface Props {
  prova: ProvaAdmin;
  extracaoValidada: boolean;
  faixaIdiomaDual: FaixaIdiomaOpcional | null;
  gradeGabarito: LinhaRevisaoGabarito[] | null;
  numerosGrade: number[];
  gabaritoLote: string;
  csvIncluirGabarito: boolean;
  arquivosGabarito: File[];
  extraindoGabaritoFoto: boolean;
  avisosExtracaoGabarito: string[];
  lidasIaGabarito?: number;
  onGradeChange: (linhas: LinhaRevisaoGabarito[]) => void;
  onGabaritoLoteChange: (v: string) => void;
  onCsvIncluirGabaritoChange: (v: boolean) => void;
  onArquivosGabaritoChange: (files: File[]) => void;
  onLerGabaritoFoto: () => void;
  onAplicarTextoColado: () => void;
  onLimparGabaritos: () => void;
  onSalvarGabarito: () => void;
}

export function AdminProvaGabaritoSection({
  prova,
  extracaoValidada,
  faixaIdiomaDual,
  gradeGabarito,
  numerosGrade,
  gabaritoLote,
  csvIncluirGabarito,
  arquivosGabarito,
  extraindoGabaritoFoto,
  avisosExtracaoGabarito,
  lidasIaGabarito,
  onGradeChange,
  onGabaritoLoteChange,
  onCsvIncluirGabaritoChange,
  onArquivosGabaritoChange,
  onLerGabaritoFoto,
  onAplicarTextoColado,
  onLimparGabaritos,
  onSalvarGabarito,
}: Props) {
  if (!extracaoValidada) {
    return (
      <Card>
        <h2 className="mb-1 font-semibold text-slate-900">Gabarito oficial</h2>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          Valide a extração na aba <strong>Questões</strong> antes de montar o gabarito. O grid só
          aparece depois da confirmação — já com a faixa EN/ES detectada automaticamente quando
          houver numeração duplicada.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold text-slate-900">Gabarito oficial</h2>
      <p className="mb-3 text-sm text-slate-600">
        Leia da foto/PDF da banca, revise no grid e salve.{" "}
        {faixaIdiomaDual && (
          <span className="text-slate-700">
            Faixa dual EN/ES: Q{faixaIdiomaDual.inicio}–{faixaIdiomaDual.fim}.
          </span>
        )}
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={csvIncluirGabarito}
          onChange={(e) => onCsvIncluirGabaritoChange(e.target.checked)}
        />
        Aplicar gabarito ao gravar extração/CSV
      </label>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onLimparGabaritos}>
          Zerar gabaritos
        </Button>
        {prova.questoes.some((q) => q.gabarito) && (
          <span className="self-center text-xs text-amber-700">
            {prova.questoes.filter((q) => q.gabarito).length} com gabarito
          </span>
        )}
      </div>
      <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <div>
          <Label>PDF ou foto do gabarito</Label>
          <div className="mt-2">
            <AdminZonaColarImagem
              arquivo={arquivosGabarito[0] ?? null}
              onArquivo={(f) => onArquivosGabaritoChange(f ? [f] : [])}
              dica="Cole o print do gabarito (Ctrl+V) ou escolha arquivo"
            />
          </div>
          <Input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => onArquivosGabaritoChange(Array.from(e.target.files ?? []))}
          />
          {arquivosGabarito.length > 0 && (
            <p className="text-xs text-slate-600">
              {arquivosGabarito.length} arquivo(s): {arquivosGabarito.map((f) => f.name).join(", ")}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={extraindoGabaritoFoto || arquivosGabarito.length === 0}
          onClick={onLerGabaritoFoto}
        >
          {extraindoGabaritoFoto ? "Lendo…" : "Ler gabarito com IA"}
        </Button>
      </div>
      {gradeGabarito && gradeGabarito.length > 0 ? (
        <GabaritoRevisaoGrid
          linhas={gradeGabarito}
          onChange={onGradeChange}
          avisos={avisosExtracaoGabarito}
          lidas={lidasIaGabarito}
          faixaIdiomaDual={faixaIdiomaDual}
          permitirMarcarAnulada
        />
      ) : (
        <p className="text-sm text-slate-500">Carregando grade do gabarito…</p>
      )}
      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Colar texto em lote
        </summary>
        <textarea
          className="mt-2 w-full rounded-xl border p-3 font-mono text-sm"
          rows={4}
          placeholder={"1,C\n2,A\n16,C,en\n16,B,es"}
          value={gabaritoLote}
          onChange={(e) => onGabaritoLoteChange(e.target.value)}
        />
        <Button type="button" variant="secondary" className="mt-2" onClick={onAplicarTextoColado}>
          Aplicar no grid
        </Button>
      </details>
      <Button className="mt-4" onClick={onSalvarGabarito}>
        Salvar gabarito
      </Button>
    </Card>
  );
}
