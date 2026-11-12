import type { Game } from "./game.ts";
import { countItems, dropItems } from "./items.ts";

type Requirement =
  | { kind: "items"; id: string; count: number }
  | { kind: "built"; id: string; count: number }
  | { kind: "research"; id: string }
  | { kind: "robot"; id: string; count: number }
  | { kind: "signal"; id: string; count: number; codeId: string; codeCount: number };

export interface SpaceMission {
  id: string;
  requirement: Requirement;
  reward: Record<string, number>;
}

export const SPACE_MISSIONS: readonly SpaceMission[] = [
  { id: "titanium", requirement: { kind: "items", id: "wood", count: 100 }, reward: { scrap: 20 } },
  { id: "lunar_rock", requirement: { kind: "items", id: "stone", count: 15 }, reward: { steel: 15 } },
  { id: "solar_array", requirement: { kind: "built", id: "solar_panel", count: 1 }, reward: { electronics: 5 } },
  { id: "alloy", requirement: { kind: "items", id: "scrap", count: 180 }, reward: { components: 6 } },
  { id: "robotics", requirement: { kind: "research", id: "robotics" }, reward: { steel: 20, electronics: 2 } },
  { id: "robot_bay", requirement: { kind: "built", id: "robot_bay", count: 1 }, reward: { steel: 15, components: 4 } },
  { id: "miner_drone", requirement: { kind: "robot", id: "miner_bot", count: 1 }, reward: { relay_code: 3, electronics: 5 } },
  { id: "orbital_signal", requirement: { kind: "signal", id: "signal_log", count: 1, codeId: "relay_code", codeCount: 3 }, reward: { scrap: 50, electronics: 10 } },
];

export interface SpaceMissionProgress {
  id: string;
  current: number;
  target: number;
  completed: boolean;
  unlocked: boolean;
  reward: { item: string; count: number }[];
}

function progress(game: Game, requirement: Requirement): number {
  switch (requirement.kind) {
    case "items":
      return countItems(game, requirement.id);
    case "signal":
      return [...game.things.values()].some((t) => game.reg.things.list[t.def].id === "satellite_dish") &&
        countItems(game, requirement.id) >= requirement.count &&
        countItems(game, requirement.codeId) >= requirement.codeCount
        ? requirement.count
        : 0;
    case "built":
      return [...game.things.values()].filter((t) => game.reg.things.list[t.def].id === requirement.id).length;
    case "research":
      return Number(game.research.done.has(requirement.id));
    case "robot": {
      const creature = game.reg.content.creatures.findIndex((c) => c.id === requirement.id);
      return [...game.pawns.values()].filter((p) => p.robot && p.creature === creature).length;
    }
  }
}

/** Ordered progress for the UI; later missions stay locked until earlier ones are complete. */
export function spaceMissionProgress(game: Game): SpaceMissionProgress[] {
  let unlocked = true;
  return SPACE_MISSIONS.map((mission) => {
    const completed = game.spaceMissions.includes(mission.id);
    const target = mission.requirement.kind === "research" ? 1 : mission.requirement.count;
    const row = {
      id: mission.id,
      current: Math.min(target, progress(game, mission.requirement)),
      target,
      completed,
      unlocked,
      reward: Object.entries(mission.reward).map(([item, count]) => ({ item, count })),
    };
    if (!completed) unlocked = false;
    return row;
  });
}

/** Complete only the next unlocked mission and deliver its resources beside the base. */
export function tickSpaceMissions(game: Game): void {
  if (game.tick % Math.round(game.ticksPerHour) !== 0 || game.spaceMissions.length >= SPACE_MISSIONS.length) return;
  const mission = SPACE_MISSIONS[game.spaceMissions.length];
  if (progress(game, mission.requirement) < (mission.requirement.kind === "research" ? 1 : mission.requirement.count)) return;
  game.spaceMissions.push(mission.id);
  for (const [item, count] of Object.entries(mission.reward)) dropItems(game, item, count, game.home.layer, game.home.x + 2, game.home.y + 2);
  game.message("msg.space_mission_done", { mission: `mission.space.${mission.id}.title` }, "info");
}
