import type { Game } from "./game.ts";
import { addMemory, makeSurvivor, type Pawn } from "./pawn.ts";

export type RecruitRole = "explorer" | "robotic_engineer";

const ROLES: Record<RecruitRole, { skills: [string, number][]; weapon: string }> = {
  explorer: { skills: [["scavenging", 10], ["shooting", 7]], weapon: "machete" },
  robotic_engineer: { skills: [["technology", 12], ["construction", 8]], weapon: "pipe" },
};

function freeTile(game: Game): { x: number; y: number } | null {
  const { layer, x: hx, y: hy } = game.home;
  for (let r = 1; r <= 12; r++)
    for (let y = hy - r; y <= hy + r; y++)
      for (let x = hx - r; x <= hx + r; x++) {
        if (Math.max(Math.abs(x - hx), Math.abs(y - hy)) !== r || !game.walkable(layer, x, y)) continue;
        if ([...game.pawns.values()].some((p) => p.layer === layer && p.x === x && p.y === y)) continue;
        const L = game.map.layers[layer];
        if (L.blueprint[L.i(x, y)] !== -1) continue;
        return { x, y };
      }
  return null;
}

/** Create a playable colony survivor beside the starting base. */
export function recruitSurvivor(game: Game, role: RecruitRole): Pawn | null {
  const profile = ROLES[role];
  if (!profile) throw new Error(`Unknown recruit role: ${role}`);
  const tile = freeTile(game);
  if (!tile) return null;

  const usedNames = new Set([...game.pawns.values()].filter((p) => p.faction === "colony" && !p.robot).flatMap((p) => [p.first, p.nick]));
  const pawn = makeSurvivor(game, game.home.layer, tile.x, tile.y, usedNames);
  for (const [skill, level] of profile.skills) pawn.skills[game.reg.skills.idx(skill)].level = level;
  pawn.weapon = game.reg.items.idx(profile.weapon);
  pawn.clothes = game.reg.items.idx("patched_clothes");
  addMemory(game, pawn, "survived_the_end");
  game.pawns.set(pawn.id, pawn);
  return pawn;
}
