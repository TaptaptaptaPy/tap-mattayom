import game from "../../data/game.json";
import type { GameState, StatId } from "./state";

const C = game.statCurve;

/** ผลตอบแทนลดหลั่น: ยิ่งเก่งอยู่แล้ว ยิ่งได้เพิ่มยาก
 *  เดิมทุ่มอ่านหนังสืออย่างเดียวแตะ "ตำนาน" ตั้งแต่วันที่ 12 จาก 120 แล้วไม่เหลืออะไรให้ไต่ */
export function gainFactor(current: number): number {
  return Math.max(C.minFactor, 1 / (1 + current / C.softCap));
}

/** ทำกิจกรรมเดิมซ้ำในวันเดียวกันได้ผลน้อยลงเรื่อยๆ */
export function repeatFactor(times: number): number {
  return Math.pow(C.sameDayFactor, Math.max(0, times));
}

export function applyStat(s: GameState, id: StatId, raw: number, repeats = 0): number {
  const got = raw * gainFactor(s.stats[id]) * repeatFactor(repeats);
  s.stats[id] += got;
  return got;
}

export const energyLow = (s: GameState) => s.energy < game.energy.lowThreshold;

/** พอแรงเหลือน้อย กิจกรรมที่เปลืองแรงจะทำไม่ได้ ต้องเลือกว่าจะพักหรือฝืน */
export function canAfford(s: GameState, energyCost: number, money = 0): string | null {
  if (money > 0 && s.money < money) return "เงินไม่พอ";
  if (energyCost < 0 && s.energy + energyCost < 0) return "หมดแรงแล้ว กลับบ้านไปพักก่อน";
  if (energyCost < 0 && energyLow(s)) return "แรงเหลือน้อยเกินไป ต้องพักก่อน";
  return null;
}
