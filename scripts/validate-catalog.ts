/**
 * Valida catálogos N1/N2 (E0 + E1).
 * Uso: npx tsx scripts/validate-catalog.ts [materiaId]
 */
import {
  carregarCatalogoMateria,
  validarCatalogo,
} from "../src/lib/conhecimento-catalog";

const materiaId = process.argv[2] ?? "biologia";

const catalog = carregarCatalogoMateria(materiaId);
const results = validarCatalogo(catalog);

console.log(`Catálogo ${catalog.materiaLabel} (${catalog.catalogVersion ?? catalog.schemaVersion})`);
for (const r of results) {
  console.log(`  [${r.nivel}] ${r.ok ? "OK" : "FALHA"} — ${r.mensagem}`);
}

const falhas = results.filter((r) => !r.ok);
process.exit(falhas.length > 0 ? 1 : 0);
