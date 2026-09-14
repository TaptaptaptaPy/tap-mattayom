import game from "../../data/game.json";
import type { GameState } from "./state";

const DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export function dateOf(s: GameState): Date {
  const d = new Date(game.term.startDate + "T00:00:00");
  d.setDate(d.getDate() + s.dayIndex);
  return d;
}
export function isWeekend(s: GameState): boolean {
  const w = dateOf(s).getDay();
  return w === 0 || w === 6;
}
export function dateLabel(s: GameState): string {
  const d = dateOf(s);
  const period = game.periods[s.periodIndex];
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} · ${period.name}`;
}
/** ช่วงเวลานี้ถูกล็อกด้วยคาบเรียนไหม (เสาร์อาทิตย์ไม่ล็อก) */
export function isLocked(s: GameState): boolean {
  return game.periods[s.periodIndex].schoolLocked && !isWeekend(s);
}

export function advance(s: GameState): void {
  s.energy = Math.max(0, s.energy + game.energy.perPeriod);
  s.periodIndex++;
  if (s.periodIndex >= game.periods.length) {
    s.periodIndex = 0;
    s.dayIndex++;
    s.energy = game.energy.sleepRestore;
    s.metToday = {};
  }
}
export const isTermOver = (s: GameState) => s.dayIndex >= game.term.days;
