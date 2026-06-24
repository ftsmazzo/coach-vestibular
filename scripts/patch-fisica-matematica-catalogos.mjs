#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HINTS = [
  "velocidade média",
  "km/h",
  "força resultante",
  "satélite",
  "órbita",
  "força gravitacional",
  "empuxo",
  "volume submerso",
  "dilatação térmica",
  "gás ideal",
  "pV=nRT",
  "espelho plano",
  "potência elétrica",
  "kWh",
  "campo magnético",
  "próton",
  "fóton",
  "Planck",
  "efeito fotoelétrico",
];

const SCOPE_IDS = new Set([
  "mat.aritmetica.numeros.operacoes",
  "mat.aritmetica.numeros.razao_proporcao",
  "mat.aritmetica.numeros.porcentagem",
  "mat.aritmetica.potencias.potenciacao",
  "mat.funcoes.geral.conceito_grafico",
  "mat.funcoes.geral.afim",
  "mat.algebra.equacoes.primeiro_grau",
  "mat.algebra.equacoes.segundo_grau",
  "mat.estatistica.medidas.graficos",
  "mat.estatistica.medidas.leitura_tabelas",
]);

const root = path.join(__dirname, "..", "data", "conhecimento-catalog");
const matPath = path.join(root, "catalogo-matematica-v1.2.0.json");
const mat = JSON.parse(fs.readFileSync(matPath, "utf8"));

mat.catalogVersion = "1.2.2";
mat.changelog = mat.changelog || [];
mat.changelog.unshift(
  "1.2.2: Desempate Física×Matemática (fisica_prevalece_quando_ha_grandezas_e_fenomeno) — negativeHints em escopos aritmética/funções/gráficos que roubavam Física matematizada."
);

mat.regras.fisicaPrevalece = {
  regraId: "fisica_prevalece_quando_ha_grandezas_e_fenomeno",
  nota:
    "Se números, equações, gráficos ou proporções modelam grandezas físicas, unidades físicas, leis ou fenômenos físicos, NÃO classifique como Matemática. Só Matemática quando o objeto central for estrutura matemática abstrata sem fenômeno físico como núcleo.",
};

const regraExtra =
  " Não classifique aqui se houver grandezas/unidades/leis físicas (fisica_prevalece_quando_ha_grandezas_e_fenomeno) — cálculo, gráfico ou proporção sozinhos não bastam.";

if (!mat.regras.regraDesempate.includes("fisica_prevalece")) {
  mat.regras.regraDesempate += regraExtra;
}

function patchEscopos(assuntos) {
  for (const ass of assuntos) {
    for (const dom of ass.dominios || []) {
      for (const esc of dom.escopos || []) {
        if (!SCOPE_IDS.has(esc.id)) continue;
        const prev = esc.negativeHints || [];
        esc.negativeHints = [...new Set([...prev, ...HINTS])];
        if (!esc.naoConfundirCom?.includes("fis.__nao_classificado")) {
          esc.naoConfundirCom = [
            ...(esc.naoConfundirCom || []),
            "fis.mecanica.cinematica.mru",
            "fis.mecanica.cinematica.graficos",
          ];
        }
      }
    }
  }
}

patchEscopos(mat.assuntos);
fs.writeFileSync(matPath, JSON.stringify(mat, null, 2) + "\n");

const fisPath = path.join(root, "catalogo-fisica-v1.2.0.json");
const fis = JSON.parse(fs.readFileSync(fisPath, "utf8"));
fis.catalogVersion = "1.2.1";
fis.changelog = fis.changelog || [];
fis.changelog.unshift(
  "1.2.1: Regra global fisica_prevalece_quando_ha_grandezas_e_fenomeno — Física matematizada (FAMERP) não deve ir para Matemática no N1/N2."
);
fis.regras.fisicaPrevalece = {
  regraId: "fisica_prevalece_quando_ha_grandezas_e_fenomeno",
  nota:
    "Muitas questões usam cálculo, gráficos, proporções, porcentagens, fórmulas e álgebra. Isso NÃO transforma a questão em Matemática. Classifique como Física quando o conhecimento exigido envolver grandezas físicas, unidades físicas, leis físicas ou interpretação de fenômenos físicos.",
};
fs.writeFileSync(fisPath, JSON.stringify(fis, null, 2) + "\n");

console.log("Catálogos mat/fis atualizados.");
