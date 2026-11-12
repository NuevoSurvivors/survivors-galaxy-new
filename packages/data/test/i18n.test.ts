import { afterEach, describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
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

  it("translates every story, objective and next-step hint used by the right panel", () => {
    const panelKeys = Object.keys(en).filter((key) => /^(goal\.|hint\.|story\.|line\.(reactor|bus|orbit)(\.|$)|msg\.intro$)/.test(key));
    expect(panelKeys.filter((key) => !es[key as keyof typeof es])).toEqual([]);
  });
});
