import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, t } from "../src/i18n.ts";

describe("Spanish localization", () => {
  afterEach(() => setLanguage("en"));

  it("uses space-themed resource names and fills parameters", () => {
    setLanguage("es");
    expect(t("item.wood")).toBe("Titanio");
    expect(t("item.stone")).toBe("Roca lunar");
    expect(t("item.scrap")).toBe("Aleación espacial");
    expect(t("item.canned_food")).toBe("Raciones sintéticas");
    expect(t("pawn.miner_bot")).toBe("Dron minero");
    expect(t("speed.n", { n: 2 })).toBe("Velocidad 2 (2)");
  });

  it("falls back to English for keys not yet translated", () => {
    setLanguage("es");
    expect(t("item.reactor_manual")).toBe("Reactor manual");
  });
});
