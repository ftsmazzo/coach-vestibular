import { describe, expect, it } from "vitest";
import { parseGabaritoLote } from "./gabarito";
import {
  GABARITO_ANULADA,
  gabaritoEhAnulada,
  gabaritoOficialPreenchido,
  normalizarGabaritoOficial,
} from "./gabarito-anulada";

describe("gabarito-anulada", () => {
  it("reconhece * e anulada", () => {
    expect(gabaritoEhAnulada("*")).toBe(true);
    expect(gabaritoEhAnulada("ANULADA")).toBe(true);
    expect(gabaritoEhAnulada("C")).toBe(false);
  });

  it("parseGabaritoLote aceita linha anulada", () => {
    const map = parseGabaritoLote("12,*\n13, anulada\n14,C");
    expect(map.get(12)).toBe("*");
    expect(map.get(13)).toBe("*");
    expect(map.get(14)).toBe("C");
  });

  it("gabaritoOficialPreenchido conta anulada como resolvida", () => {
    expect(gabaritoOficialPreenchido("*")).toBe(true);
    expect(gabaritoOficialPreenchido(null)).toBe(false);
  });

  it("normalizarGabaritoOficial", () => {
    expect(normalizarGabaritoOficial("anulada")).toBe(GABARITO_ANULADA);
    expect(normalizarGabaritoOficial("d")).toBe("D");
  });
});
