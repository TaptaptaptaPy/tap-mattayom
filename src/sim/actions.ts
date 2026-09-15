import locations from "../../data/locations.json";
import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { isLocked, isSchoolDay, periodId } from "./calendar";
import { applyStat, canAfford } from "./economy";
import { rollCatch, inTrouble, type Rnd } from "./discipline";
import { clubToday } from "./club";
import { remember, type GameState, type StatId } from "./state";

type RawLocation = (typeof locations)[number];

export interface LocationOption {
  id: string; name: string; icon: string;
  school?: boolean; risky?: boolean; catchBase?: number;
  action?: { label: string; stat: StatId; gain: number; energy: number; study?: number; cost?: number };
  rest?: { label: string; energy: number };
  club?: { label: string; name: string };
  present: { id: string; name: string; color: string }[];
  blocked?: string;
}

const LOCS = locations as RawLocation[];
const get = <T,>(o: object, k: string): T | undefined => (o as Record<string, T>)[k];

/** ที่ไหนไปได้บ้างในช่วงเวลานี้ และใครอยู่ที่นั่น */
export function availableLocations(s: GameState): LocationOption[] {
  const period = periodId(s);
  if (isLocked(s)) {
    const cls = LOCS.find((l) => l.id === "classroom")!;
    return [{ ...cls, action: undefined, present: whoIsAt(s, "classroom", period) } as LocationOption];
  }
  const club = clubToday(s);
  return LOCS
    .filter((l) => l.periods.includes(period))
    // เสาร์อาทิตย์และวันหยุด โรงเรียนปิด — เดิมเข้าห้องสมุดได้ทุกวันไม่เว้น
    .filter((l) => !get<boolean>(l, "school") || isSchoolDay(s))
    .map((l) => {
      const o = { ...l, present: whoIsAt(s, l.id, period) } as LocationOption;
      if (get<boolean>(l, "risky") && inTrouble(s))
        o.blocked = "ครูปกครองสั่งห้ามเข้าแล้ว";
      if (club && club.location === l.id && period === "after")
        o.club = { label: `กิจกรรม${club.name}`, name: club.name };
      return o;
    });
}

function whoIsAt(s: GameState, locId: string, period: string) {
  return chars
    .filter((c) => get<string>(c.where, period) === locId && !s.metToday[c.id])
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));
}

export interface ActionResult { message: string; caught: string | null; }

export function doAction(s: GameState, loc: LocationOption, rnd: Rnd = Math.random): ActionResult | null {
  const a = loc.action;
  if (!a) return null;
  if (loc.blocked) return { message: loc.blocked, caught: null };
  const why = canAfford(s, a.energy, a.cost ?? 0);
  if (why) return { message: why, caught: null };

  const times = s.doneToday[loc.id] ?? 0;
  const got = applyStat(s, a.stat, a.gain, times);
  s.energy = Math.max(0, Math.min(game.energy.max, s.energy + a.energy));
  if (a.cost) s.money -= a.cost;
  if (a.study) s.study += a.study;
  s.doneToday[loc.id] = times + 1;

  const nm = game.stats.find((x) => x.id === a.stat)!.name;
  let message = `${a.label} · ${nm} +${got.toFixed(1)}`;
  if (times > 0) message += " (ทำซ้ำวันนี้ ได้น้อยลง)";
  if (a.cost) message += ` · -${a.cost} บาท`;

  let caught: string | null = null;
  if (loc.risky && loc.catchBase) {
    const r = rollCatch(s, loc.catchBase, rnd);
    if (r.caught) caught = r.message;
  }
  return { message, caught };
}

export function doRest(s: GameState, loc: LocationOption): string | null {
  if (!loc.rest) return null;
  s.energy = Math.min(game.energy.max, s.energy + loc.rest.energy);
  return `${loc.rest.label} · แรง +${loc.rest.energy}`;
}

/** คาบเรียนเช้า: เข้าแถวหน้าเสาธงแล้วเรียน — เดิมมีแค่ปุ่ม "ผ่านคาบไป" เฉยๆ */
export function attendClass(s: GameState): string {
  const got = applyStat(s, "mind", 2, s.doneToday["_class"] ?? 0);
  s.doneToday["_class"] = (s.doneToday["_class"] ?? 0) + 1;
  s.study += 2;
  return `ตั้งใจเรียน · ปัญญา +${got.toFixed(1)}`;
}

export function skipClass(s: GameState, rnd: Rnd = Math.random): ActionResult {
  const got = applyStat(s, "nerve", 4, 0);
  const r = rollCatch(s, 0.34, rnd);
  if (!r.caught) remember(s, "โดดคาบเรียนแล้วรอด");
  return { message: `โดดคาบ · ความซ่า +${got.toFixed(1)}`, caught: r.message };
}
