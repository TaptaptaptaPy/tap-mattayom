import game from "../../data/game.json";
import chars from "../../data/characters.json";

export type StatId = "heart" | "mind" | "charm" | "kind" | "nerve";

export interface GameState {
  dayIndex: number;          // 0 = วันเปิดเทอม
  periodIndex: number;       // อ้างอิง data/game.json > periods
  energy: number;
  stats: Record<StatId, number>;
  affinity: Record<string, number>;
  flags: Record<string, true>;
  metToday: Record<string, true>;
  history: string[];
}

export function newState(): GameState {
  const stats = {} as Record<StatId, number>;
  for (const s of game.stats) stats[s.id as StatId] = 0;
  const affinity: Record<string, number> = {};
  for (const c of chars) affinity[c.id] = 0;
  return { dayIndex: 0, periodIndex: 0, energy: game.energy.max,
           stats, affinity, flags: {}, metToday: {}, history: [] };
}

export const rankOf = (value: number, ladder: number[]) => {
  let r = 0;
  for (let i = 0; i < ladder.length; i++) if (value >= ladder[i]) r = i;
  return r;
};
export const statRank = (v: number) => rankOf(v, game.statRanks);
export const affinityRank = (v: number) => rankOf(v, game.affinityRanks);
