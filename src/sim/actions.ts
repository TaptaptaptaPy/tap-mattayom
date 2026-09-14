import locations from "../../data/locations.json";
import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { isLocked } from "./calendar";
import type { GameState, StatId } from "./state";

export interface LocationOption {
  id: string; name: string; icon: string;
  action?: { label: string; stat: StatId; gain: number; energy: number };
  present: { id: string; name: string; color: string }[];
}

/** ที่ไหนไปได้บ้างในช่วงเวลานี้ และใครอยู่ที่นั่น */
export function availableLocations(s: GameState): LocationOption[] {
  const period = game.periods[s.periodIndex].id;
  if (isLocked(s)) {
    const cls = locations.find((l) => l.id === "classroom")!;
    return [{ ...cls, action: undefined, present: whoIsAt(s, "classroom", period) } as LocationOption];
  }
  return locations
    .filter((l) => l.periods.includes(period))
    .map((l) => ({ ...l, present: whoIsAt(s, l.id, period) }) as LocationOption);
}

function whoIsAt(s: GameState, locId: string, period: string) {
  return chars
    .filter((c) => (c.where as Record<string, string | undefined>)[period] === locId && !s.metToday[c.id])
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));
}

export function doAction(s: GameState, loc: LocationOption): string | null {
  if (!loc.action) return null;
  const a = loc.action;
  if (s.energy + a.energy < 0) return "หมดแรงแล้ว กลับบ้านไปนอนเถอะ";
  s.stats[a.stat] += a.gain;
  s.energy = Math.min(game.energy.max, s.energy + a.energy);
  const nm = game.stats.find((x) => x.id === a.stat)!.name;
  return `${a.label} · ${nm} +${a.gain}`;
}
