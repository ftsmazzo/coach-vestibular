import type {
  MateriaCatalogo,
  ResultadoValidacao,
  ValidacaoNivel,
} from "./types";
import { indexarEscopos, prefixoCatalogoMateria } from "./load";

function resultado(nivel: ValidacaoNivel, ok: boolean, mensagem: string): ResultadoValidacao {
  return { nivel, ok, mensagem };
}

/** E0: IDs únicos, ativos, dentro do teto de N2. */
export function validarE0(catalog: MateriaCatalogo): ResultadoValidacao[] {
  const results: ResultadoValidacao[] = [];
  const escopos = indexarEscopos(catalog);
  const ids = new Set<string>();
  let duplicatas = 0;

  for (const assunto of catalog.assuntos) {
    for (const dominio of assunto.dominios) {
      if (ids.has(dominio.id)) duplicatas++;
      ids.add(dominio.id);

      for (const escopo of dominio.escopos) {
        if (ids.has(escopo.id)) duplicatas++;
        ids.add(escopo.id);
      }
    }
  }

  const max = catalog.regras?.maxN2PorMateria ?? 80;
  const totalN2 = escopos.size;

  results.push(
    resultado("E0", duplicatas === 0, duplicatas === 0 ? "IDs únicos" : `${duplicatas} IDs duplicados`)
  );
  results.push(
    resultado(
      "E0",
      totalN2 <= max,
      totalN2 <= max ? `${totalN2} N2 (≤ ${max})` : `${totalN2} N2 excede teto ${max}`
    )
  );

  const prefixo = prefixoCatalogoMateria(catalog.materiaId);
  for (const escopo of escopos.values()) {
    if (!escopo.escopoId.startsWith(`${prefixo}.`)) {
      results.push(
        resultado("E0", false, `Prefixo inválido: ${escopo.escopoId} (esperado ${prefixo}.)`)
      );
    }
  }

  return results;
}

/** E1: escopo pertence ao domínio; domínio pertence ao assunto (prefixo hierárquico). */
export function validarE1(catalog: MateriaCatalogo): ResultadoValidacao[] {
  const results: ResultadoValidacao[] = [];

  for (const assunto of catalog.assuntos) {
    for (const dominio of assunto.dominios) {
      if (!dominio.id.includes(`.${assunto.assuntoId}.`) && !dominio.id.endsWith(`.${assunto.assuntoId}`)) {
        const ok = dominio.id.includes(assunto.assuntoId.replace(/_/g, ""));
        if (!ok && !dominio.id.includes(assunto.assuntoId.split("_")[0]!)) {
          results.push(
            resultado("E1", false, `Domínio ${dominio.id} não reflete assunto ${assunto.assuntoId}`)
          );
        }
      }

      for (const escopo of dominio.escopos) {
        if (!escopo.id.startsWith(`${dominio.id}.`)) {
          results.push(
            resultado("E1", false, `Escopo ${escopo.id} não é filho de ${dominio.id}`)
          );
        }
        if (escopo.supersededBy && !escopo.deprecated) {
          results.push(
            resultado("E1", false, `Escopo ${escopo.id} tem supersededBy mas não está deprecated`)
          );
        }
      }
    }
  }

  if (results.length === 0) {
    results.push(resultado("E1", true, "Hierarquia assunto→domínio→escopo consistente"));
  }

  return results;
}

/** E2: escopo classificado pertence ao assunto esperado da questão. */
export function validarE2(
  escopoId: string,
  assuntoEsperado: string,
  catalog: MateriaCatalogo
): ResultadoValidacao {
  const entry = indexarEscopos(catalog).get(escopoId);
  if (!entry) {
    return resultado("E2", false, `Escopo ${escopoId} não existe no catálogo`);
  }
  const ok = entry.assuntoId === assuntoEsperado;
  return resultado(
    "E2",
    ok,
    ok
      ? `${escopoId} ∈ assunto ${assuntoEsperado}`
      : `${escopoId} pertence a ${entry.assuntoId}, esperado ${assuntoEsperado}`
  );
}

export function validarCatalogo(catalog: MateriaCatalogo): ResultadoValidacao[] {
  return [...validarE0(catalog), ...validarE1(catalog)];
}
