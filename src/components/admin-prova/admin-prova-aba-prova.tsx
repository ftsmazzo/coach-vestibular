"use client";

import { Button, Card, Input, Label } from "@/components/ui";
import { buildProvaNome } from "@/lib/prova-nome";
import { temDuplicataEnEs } from "@/lib/prova-idioma";
import type { ProvaAdmin, ProvaMetaForm } from "./types";

interface Props {
  prova: ProvaAdmin;
  meta: ProvaMetaForm;
  setMeta: React.Dispatch<React.SetStateAction<ProvaMetaForm>>;
  cadernoFile: File | null;
  setCadernoFile: (f: File | null) => void;
  salvandoCaderno: boolean;
  detectandoFaixa: boolean;
  onSalvarMetadados: () => void;
  onEnviarCaderno: () => void;
  onRemoverCaderno: () => void;
  onDetectarFaixa: (aplicar: boolean) => void;
  onZerarQuestoes: () => void;
  onExcluirProva: () => void;
}

export function AdminProvaAbaProva({
  prova,
  meta,
  setMeta,
  cadernoFile,
  setCadernoFile,
  salvandoCaderno,
  detectandoFaixa,
  onSalvarMetadados,
  onEnviarCaderno,
  onRemoverCaderno,
  onDetectarFaixa,
  onZerarQuestoes,
  onExcluirProva,
}: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-semibold text-slate-900">Identificação</h2>
        <p className="mb-4 text-sm text-slate-600">
          Dados que o aluno vê ao escolher esta prova no simulado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome (gerado ao salvar)</Label>
            <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {buildProvaNome({
                banca: meta.banca,
                ano: meta.ano ? parseInt(meta.ano, 10) : null,
                dia: meta.dia ? parseInt(meta.dia, 10) : null,
                caderno: meta.caderno || null,
              })}
            </p>
          </div>
          <div>
            <Label>Banca / vestibular</Label>
            <Input value={meta.banca} onChange={(e) => setMeta({ ...meta, banca: e.target.value })} />
          </div>
          <div>
            <Label>Ano</Label>
            <Input
              type="number"
              value={meta.ano}
              onChange={(e) => setMeta({ ...meta, ano: e.target.value })}
            />
          </div>
          <div>
            <Label>Caderno / tipo</Label>
            <Input
              value={meta.caderno}
              onChange={(e) => setMeta({ ...meta, caderno: e.target.value })}
              placeholder="Azul, Tipo A, 1º dia…"
            />
          </div>
          <div>
            <Label>Dia (ENEM, opcional)</Label>
            <Input
              type="number"
              value={meta.dia}
              onChange={(e) => setMeta({ ...meta, dia: e.target.value })}
            />
          </div>
          <div>
            <Label>Total de questões</Label>
            <Input
              type="number"
              value={meta.totalQuestoes}
              onChange={(e) => setMeta({ ...meta, totalQuestoes: e.target.value })}
              placeholder="90, 60, 45…"
            />
            <p className="mt-1 text-xs text-slate-500">Meta da prova — usada na cobertura do banco.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={meta.descricao}
              onChange={(e) => setMeta({ ...meta, descricao: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Política de idiomas</Label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={meta.politicaIdiomas}
              onChange={(e) =>
                setMeta({
                  ...meta,
                  politicaIdiomas: e.target.value as "NENHUMA" | "DUPLICATA_EN_ES",
                  ...(e.target.value === "NENHUMA"
                    ? { idiomaQuestaoInicio: "", idiomaQuestaoFim: "" }
                    : {}),
                })
              }
            >
              <option value="NENHUMA">Sem duplicata EN/ES</option>
              <option value="DUPLICATA_EN_ES">Duplicata inglês + espanhol</option>
            </select>
          </div>
          {meta.politicaIdiomas === "DUPLICATA_EN_ES" && (
            <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-sm font-medium text-slate-800">Faixa EN/ES</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Questão inicial</Label>
                  <Input
                    type="number"
                    value={meta.idiomaQuestaoInicio}
                    onChange={(e) => setMeta({ ...meta, idiomaQuestaoInicio: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Questão final</Label>
                  <Input
                    type="number"
                    value={meta.idiomaQuestaoFim}
                    onChange={(e) => setMeta({ ...meta, idiomaQuestaoFim: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={detectandoFaixa}
                  onClick={() => onDetectarFaixa(false)}
                >
                  Detectar faixa
                </Button>
                <Button type="button" disabled={detectandoFaixa} onClick={() => onDetectarFaixa(true)}>
                  Aplicar faixa sugerida
                </Button>
              </div>
            </div>
          )}
          {temDuplicataEnEs(prova) && meta.politicaIdiomas === "NENHUMA" && (
            <p className="sm:col-span-2 text-xs text-amber-800">
              Extração detectou EN/ES — confirme a faixa acima antes do gabarito dual.
            </p>
          )}
        </div>
        <Button className="mt-4" type="button" onClick={onSalvarMetadados}>
          Salvar cadastro
        </Button>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-slate-900">Caderno para download</h2>
        <p className="mb-3 text-sm text-slate-600">
          PDF ou imagem que o aluno baixa na tela de atividades. A extração híbrida também pode
          salvar o PDF aqui automaticamente.
        </p>
        {prova.cadernoFileName ? (
          <p className="mb-2 text-sm font-medium text-emerald-700">Arquivo: {prova.cadernoFileName}</p>
        ) : (
          <p className="mb-2 text-sm text-slate-500">Nenhum caderno enviado.</p>
        )}
        <Input
          type="file"
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setCadernoFile(e.target.files?.[0] ?? null)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={salvandoCaderno || !cadernoFile} onClick={onEnviarCaderno}>
            {salvandoCaderno ? "Enviando…" : "Salvar caderno"}
          </Button>
          {prova.cadernoFileName && (
            <Button type="button" variant="secondary" onClick={onRemoverCaderno}>
              Remover
            </Button>
          )}
        </div>
      </Card>

      <Card className="border-red-200 bg-red-50/30">
        <h2 className="mb-2 font-semibold text-red-900">Zona de perigo</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onZerarQuestoes}>
            Zerar questões
          </Button>
          <Button type="button" variant="danger" onClick={onExcluirProva}>
            Excluir prova
          </Button>
        </div>
      </Card>
    </div>
  );
}
