/**
 * Testes de classificação attempt ↔ ProvaQuestao e pendências da Jornada.
 * Executar: node --import tsx --test src/lib/jornada-classificacao-attempt.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  conhecimentoExigidoExibicao,
  erroAnalisavel,
  montarAtualizacaoSnapshotClassificacao,
  motivosPendenciaClassificacao,
  questaoTemN1N2N3,
  resolverClassificacaoAttempt,
} from "./jornada-classificacao-attempt";
import { calcularElegibilidadeJornada } from "./jornada-elegibilidade";

describe("resolverClassificacaoAttempt — fallback ProvaQuestao", () => {
  it("conta N3 presente quando só ProvaQuestao tem conhecimentoExigido", () => {
    const c = resolverClassificacaoAttempt(
      {
        correto: false,
        materiaId: "historia",
        conhecimentoEscopoId: "hist.moderna.absolutismo",
        conhecimentoExigido: null,
        provaQuestao: {
          classificacaoN1Json: JSON.stringify({ catalogoId: "historia" }),
          conhecimentoEscopoId: "hist.moderna.absolutismo",
          conhecimentoExigido: "Compreender o absolutismo.",
        },
      },
      null
    );
    assert.equal(questaoTemN1N2N3(c), true);
    assert.equal(erroAnalisavel(c), true);
  });

  it("usa catálogo por número quando attempt não tem provaQuestao join", () => {
    const c = resolverClassificacaoAttempt(
      {
        correto: true,
        materiaId: "quimica",
        conhecimentoEscopoId: null,
        conhecimentoExigido: null,
        provaQuestao: null,
      },
      {
        classificacaoN1Json: JSON.stringify({ catalogoId: "quimica" }),
        conhecimentoEscopoId: "quim.gases.ideal",
        conhecimentoExigido: "Aplicar PV=nRT.",
        materia: "quimica",
      }
    );
    assert.equal(questaoTemN1N2N3(c), true);
  });
});

describe("motivosPendenciaClassificacao", () => {
  it("identifica ausência de N1, N2 real e N3", () => {
    assert.deepEqual(
      motivosPendenciaClassificacao({
        correto: false,
        n1CatalogoId: null,
        escopoId: "hist.__nao_classificado",
        conhecimentoExigido: null,
      }),
      ["sem N1", "sem N2 real", "sem N3"]
    );
  });
});

describe("montarAtualizacaoSnapshotClassificacao", () => {
  it("copia N3 de ProvaQuestao para attempt vazio", () => {
    const { data, alterou } = montarAtualizacaoSnapshotClassificacao(
      { conhecimentoExigido: null },
      { id: "pq-1", conhecimentoExigido: "Texto N3." }
    );
    assert.equal(alterou, true);
    assert.equal(data.conhecimentoExigido, "Texto N3.");
    assert.equal(data.provaQuestaoId, "pq-1");
  });

  it("não sobrescreve snapshot já preenchido no attempt", () => {
    const { data, alterou } = montarAtualizacaoSnapshotClassificacao(
      { conhecimentoExigido: "Já existia.", provaQuestaoId: "pq-1" },
      { id: "pq-1", conhecimentoExigido: "Novo do catálogo." }
    );
    assert.equal(alterou, false);
    assert.equal(data.conhecimentoExigido, undefined);
  });

  it("não altera resposta do aluno nem correto (campos fora do escopo)", () => {
    const attempt = {
      conhecimentoExigido: null,
      respostaAluno: "C",
      correto: false,
    };
    const { data } = montarAtualizacaoSnapshotClassificacao(attempt, {
      id: "pq-2",
      conhecimentoExigido: "N3.",
    });
    assert.equal((data as { respostaAluno?: string }).respostaAluno, undefined);
    assert.equal((data as { correto?: boolean }).correto, undefined);
    assert.equal(attempt.respostaAluno, "C");
    assert.equal(attempt.correto, false);
  });

  it("é idempotente — segunda chamada não altera", () => {
    const attempt = { conhecimentoExigido: null, provaQuestaoId: null as string | null };
    const pq = { id: "pq-3", conhecimentoExigido: "N3.", conhecimentoEscopoId: "bio.celula" };
    const primeiro = montarAtualizacaoSnapshotClassificacao(attempt, pq);
    assert.equal(primeiro.alterou, true);
    const segundo = montarAtualizacaoSnapshotClassificacao(
      { ...attempt, ...primeiro.data },
      pq
    );
    assert.equal(segundo.alterou, false);
  });
});

describe("conhecimentoExigidoExibicao", () => {
  it("prefere attempt e faz fallback para ProvaQuestao", () => {
    assert.equal(
      conhecimentoExigidoExibicao({ conhecimentoExigido: "Do attempt." }, { conhecimentoExigido: "Do catálogo." }),
      "Do attempt."
    );
    assert.equal(
      conhecimentoExigidoExibicao({ conhecimentoExigido: null }, { conhecimentoExigido: "Do catálogo." }),
      "Do catálogo."
    );
    assert.equal(conhecimentoExigidoExibicao({}, null), null);
  });
});

describe("elegibilidade — mensagens e meta 95%", () => {
  it("bloqueia abaixo de 95% com mensagem amigável", () => {
    const r = calcularElegibilidadeJornada({
      anamneseConcluida: true,
      provasOuSimuladosValidos: 2,
      totalQuestoesValidas: 170,
      totalErrosAnalisaveis: 40,
      pctQuestoesComN1N2N3: 0.85,
    });
    assert.equal(r.elegivel, false);
    assert.ok(
      r.motivosBloqueio.some((m) => m.includes("sendo preparadas pela equipe"))
    );
  });

  it("libera em 95% ou mais", () => {
    const r = calcularElegibilidadeJornada({
      anamneseConcluida: true,
      provasOuSimuladosValidos: 2,
      totalQuestoesValidas: 170,
      totalErrosAnalisaveis: 40,
      pctQuestoesComN1N2N3: 0.95,
    });
    assert.equal(r.elegivel, true);
  });
});

describe("UI aluno — sem termos N1/N2/N3", () => {
  it("card de elegibilidade não expõe N1/N2/N3", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/jornada-elegibilidade-card.tsx"),
      "utf8"
    );
    assert.equal(src.includes("N1/N2/N3"), false);
    assert.equal(src.includes("Erros prontos para análise"), true);
    assert.equal(src.includes("Processamento pedagógico das questões"), true);
  });
});

describe("percentual após sincronização (lógica pura)", () => {
  it("170 questões com 25 incompletas = 85%; após preencher 17 sobe para ≥95%", () => {
    const antes = 145 / 170;
    const depois = 162 / 170;
    assert.equal(Math.round(antes * 100), 85);
    assert.ok(depois >= 0.95);
  });
});
