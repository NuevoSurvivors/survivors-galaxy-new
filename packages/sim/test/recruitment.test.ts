import { describe, expect, it } from "vitest";
import { loadCoreContent } from "@wc/data";
import { Game, recruitSurvivor } from "../src/index.ts";

const content = loadCoreContent();

describe("test astronaut recruitment", () => {
  it("adds a playable explorer with the matching skills and gear", () => {
    const game = Game.create(content, { seed: "explorer-recruit", mapSize: 96, storyteller: "none", scenario: "lone" });
    const before = [...game.pawns.values()].filter((p) => p.faction === "colony" && !p.robot).length;
    const pawn = recruitSurvivor(game, "explorer");

    expect(pawn).not.toBeNull();
    expect([...game.pawns.values()].filter((p) => p.faction === "colony" && !p.robot)).toHaveLength(before + 1);
    expect(pawn!.skills[game.reg.skills.idx("scavenging")].level).toBe(10);
    expect(pawn!.skills[game.reg.skills.idx("shooting")].level).toBe(7);
    expect(game.reg.items.list[pawn!.weapon!].id).toBe("machete");
    expect(pawn!.faction).toBe("colony");
  });

  it("adds a playable engineer near the base with the matching skills and gear", () => {
    const game = Game.create(content, { seed: "recruit", mapSize: 96, storyteller: "none", scenario: "lone" });
    const before = game.pawns.size;
    const pawn = recruitSurvivor(game, "robotic_engineer");

    expect(pawn).not.toBeNull();
    expect(game.pawns.size).toBe(before + 1);
    expect(game.walkable(pawn!.layer, pawn!.x, pawn!.y)).toBe(true);
    expect(Math.max(Math.abs(pawn!.x - game.home.x), Math.abs(pawn!.y - game.home.y))).toBeLessThanOrEqual(12);
    expect(pawn!.skills[game.reg.skills.idx("technology")].level).toBe(12);
    expect(pawn!.skills[game.reg.skills.idx("construction")].level).toBe(8);
    expect(game.reg.items.list[pawn!.weapon!].id).toBe("pipe");
    expect(pawn!.faction).toBe("colony");
    expect(pawn!.robot).toBeFalsy();
  });
});
