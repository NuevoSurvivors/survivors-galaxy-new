import { describe, expect, it } from "vitest";
import { loadCoreContent } from "@wc/data";
import { countItems, dropItems, Game, loadGame, saveGame, SPACE_MISSIONS, tickSpaceMissions } from "../src/index.ts";

const content = loadCoreContent();
const make = () => Game.create(content, { seed: "space-missions", mapSize: 96, storyteller: "none", scenario: "lone" });

describe("space mission progression", () => {
  it("completes missions in order, grants resources, and keeps rewards after loading", () => {
    const game = make();
    const hour = Math.round(game.ticksPerHour);
    const startingScrap = countItems(game, "scrap");
    game.tick = hour;
    tickSpaceMissions(game);
    expect(game.spaceMissions).toEqual([]);

    dropItems(game, "wood", 60, game.home.layer, game.home.x, game.home.y);
    game.tick += hour;
    tickSpaceMissions(game);
    expect(game.spaceMissions).toEqual(["titanium"]);
    expect(countItems(game, "scrap")).toBe(startingScrap + 20);

    const startingSteel = countItems(game, "steel");
    dropItems(game, "stone", 15, game.home.layer, game.home.x, game.home.y);
    game.tick += hour;
    tickSpaceMissions(game);
    expect(game.spaceMissions).toEqual(["titanium", "lunar_rock"]);
    expect(countItems(game, "steel")).toBe(startingSteel + 15);

    const loaded = loadGame(content, JSON.parse(JSON.stringify(saveGame(game))));
    tickSpaceMissions(loaded);
    expect(loaded.spaceMissions).toEqual(["titanium", "lunar_rock"]);
    expect(countItems(loaded, "steel")).toBe(startingSteel + 15);
  });

  it("requires an antenna, an orbital signal, and all relay codes for the final mission", () => {
    const game = make();
    game.spaceMissions = SPACE_MISSIONS.slice(0, -1).map((mission) => mission.id);
    const startingElectronics = countItems(game, "electronics");
    let dish: { x: number; y: number } | null = null;
    for (let y = 8; y < game.map.h - 4 && !dish; y++)
      for (let x = 8; x < game.map.w - 4 && !dish; x++)
        if (game.fits(game.reg.things.idx("satellite_dish"), 0, x, y)) dish = { x, y };
    expect(dish).not.toBeNull();
    game.spawnThing("satellite_dish", 0, dish!.x, dish!.y);
    dropItems(game, "signal_log", 1, 0, game.home.x, game.home.y);
    game.tick = Math.round(game.ticksPerHour);

    tickSpaceMissions(game);
    expect(game.spaceMissions).toHaveLength(SPACE_MISSIONS.length - 1);
    dropItems(game, "relay_code", 3, 0, game.home.x, game.home.y);
    game.tick += Math.round(game.ticksPerHour);
    tickSpaceMissions(game);

    expect(game.spaceMissions).toHaveLength(SPACE_MISSIONS.length);
    expect(countItems(game, "electronics")).toBe(startingElectronics + 10);
  });
});
