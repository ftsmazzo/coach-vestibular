/**
 * Contrato: salvar prova via /api/exams/from-prova não dispara motor da Jornada.
 * Executar: node --import tsx --test src/lib/prova-attempt-from-prova.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "..");

function corpoRegistrarTentativaProva(src: string): string {
  const inicio = src.indexOf("export async function registrarTentativaProva");
  assert.ok(inicio >= 0);
  const fim = src.indexOf("\nasync function aplicarPlanoEQuests", inicio);
  assert.ok(fim >= 0);
  return src.slice(inicio, fim);
}

describe("POST /api/exams/from-prova — sem motor da Jornada", () => {
  it("rota delega apenas a registrarTentativaProva", () => {
    const route = readFileSync(join(ROOT, "app/api/exams/from-prova/route.ts"), "utf8");
    assert.ok(route.includes("registrarTentativaProva"));
    assert.equal(route.includes("aplicarPlanoEQuests"), false);
    assert.equal(route.includes("gerarOuObterPlanoSemanalJornada"), false);
    assert.equal(route.includes("criarOuObterPrimeiroCicloJornada"), false);
    assert.equal(route.includes("iniciarJornadaComDiagnosticoInicial"), false);
    assert.equal(route.includes("regenerarPlanoGlobalUsuario"), false);
  });

  it("registrarTentativaProva não chama aplicarPlanoEQuests", () => {
    const src = readFileSync(join(ROOT, "lib/prova-attempt.ts"), "utf8");
    const corpo = corpoRegistrarTentativaProva(src);
    assert.equal(corpo.includes("aplicarPlanoEQuests"), false);
    assert.equal(corpo.includes("gerarOuObterPlanoSemanalJornada"), false);
    assert.equal(corpo.includes("criarOuObterPrimeiroCicloJornada"), false);
    assert.equal(corpo.includes("iniciarJornadaComDiagnosticoInicial"), false);
    assert.equal(corpo.includes("sincronizarCicloDaSemana"), false);
    assert.equal(corpo.includes("persistirQuestsIA"), false);
    assert.ok(corpo.includes("diagnosticSnapshot"));
    assert.ok(corpo.includes("questionAttempts"));
  });

  it("registrarTentativaProva não cria StudyPlan JORNADA_SEMANAL nem Quest com cicloId", () => {
    const src = corpoRegistrarTentativaProva(
      readFileSync(join(ROOT, "lib/prova-attempt.ts"), "utf8")
    );
    assert.equal(src.includes("JORNADA_SEMANAL"), false);
    assert.equal(src.includes("motor-jornada-v1"), false);
    assert.equal(src.includes("studyPlan.create"), false);
    assert.equal(src.includes("quest.create"), false);
    assert.equal(src.includes("cicloId"), false);
  });
});

describe("UI registrar resultado — textos sem promessa de plano", () => {
  it("não exibe Gerar diagnóstico e plano", () => {
    const page = readFileSync(join(ROOT, "app/(app)/simulados/novo/page.tsx"), "utf8");
    assert.equal(page.includes("Gerar diagnóstico e plano"), false);
    assert.equal(page.includes("Substituir e gerar diagnóstico"), false);
    assert.equal(page.includes("diagnóstico e plano serão"), false);
    assert.equal(page.includes("gerar o diagnóstico"), false);
    assert.ok(page.includes("Salvar resultado da prova"));
    assert.ok(page.includes("Substituir resultado"));
  });
});
