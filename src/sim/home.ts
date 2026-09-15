import game from "../../data/game.json";
import { remember, type GameState } from "./state";

/** ทางบ้าน
 *
 *  ปัญหาเดิม: เงินไม่มีที่ไป เทสต์สมดุลจบเทอมด้วยเงินเหลือ 32,000 บาทในกลยุทธ์หนึ่ง
 *  และ 17,000 ในอีกกลยุทธ์ เงินที่ไม่มีอะไรให้ใช้แปลว่าการทำงานหาเงินไม่มีความหมาย
 *  ภาคมหาลัยแก้ข้อนี้ไปแล้วด้วยค่าหอ แต่ภาคมัธยมยังไม่มีอะไรดูดเงินออกเลย
 *
 *  ที่นี่เงินที่เก็บไว้คือเงินที่ทางบ้านต้องใช้ ให้ไปแล้วหายจริง ไม่ให้ก็มีราคาอีกแบบ
 *  และราคานั้นไม่ใช่การลงโทษ — มันคือบ้านที่ค่อยๆ ตึงขึ้นจนนอนไม่เต็มอิ่ม
 *
 *  กติกา: ต้องเป็น *ทางเลือก* เสมอ ถ้าเงินไม่พอจริงๆ ก็ไม่นับว่าปฏิเสธ
 */

const H = game.home;

export interface Home { strain: number; gave: number; refused: number; given: number; }

export const homeOf = (s: GameState): Home =>
  (s.home ??= { strain: 0, gave: 0, refused: 0, given: 0 });

/** ทางบ้านขอเท่าไหร่รอบนี้ — ยิ่งปลายเทอมยิ่งมากขึ้น เพราะเรื่องที่บ้านไม่ได้ดีขึ้นเอง */
export function askAmount(s: GameState): number {
  const stage = Math.min(1, s.dayIndex / game.term.days);
  return Math.round(H.askBase + H.askPerStage * stage + homeOf(s).refused * H.askPerRefusal);
}

/** ให้ไป — เงินหายจริง และบ้านคลายลง */
export function giveHome(s: GameState, amount: number): boolean {
  const h = homeOf(s);
  if (s.money < amount) return false;
  s.money -= amount;
  h.gave++;
  h.given += amount;
  h.strain = Math.max(0, h.strain - H.reliefPerGive);
  s.flags["helped_home"] = true;
  remember(s, `ส่งเงินให้ที่บ้าน ${amount} บาท`);
  return true;
}

/** ไม่ให้ — เงินยังอยู่ แต่บ้านตึงขึ้น
 *  เงินไม่พอจริงๆ ไม่นับว่าปฏิเสธ เพราะนั่นไม่ใช่การเลือก */
export function refuseHome(s: GameState, couldAfford: boolean): void {
  const h = homeOf(s);
  h.strain += couldAfford ? H.strainPerRefusal : H.strainPerCannot;
  if (couldAfford) { h.refused++; s.flags["refused_home"] = true; }
  else s.flags["broke_at_home"] = true;
  remember(s, couldAfford ? "บอกที่บ้านว่าไม่มี ทั้งที่มี" : "ที่บ้านขอมา แต่เราไม่มีจริงๆ");
}

/** บ้านตึงแค่ไหน 0=ปกติ 1=เริ่มรู้สึก 2=นอนไม่เต็มอิ่ม */
export const homeLevel = (s: GameState): number =>
  homeOf(s).strain >= H.hardAt ? 2 : homeOf(s).strain >= H.softAt ? 1 : 0;

export const homeName = (s: GameState) => H.levelNames[homeLevel(s)];

/** บ้านที่ตึงกินแรงที่ควรได้คืนตอนนอน และกดค่าขนมลง
 *  เรียกจาก `advance()` ตอนขึ้นวันใหม่ — คืนจำนวนแรงที่หายไป */
export function homeDrag(s: GameState): number {
  const lvl = homeLevel(s);
  if (lvl === 0) return 0;
  // บ้านที่มีเรื่องไม่ได้ทำให้เราขี้เกียจ มันทำให้เรานอนไม่หลับ ซึ่งคนละเรื่องกัน
  s.sleepDebt += H.debtPerNight[lvl];
  return H.debtPerNight[lvl];
}

/** ค่าขนมที่หายไปเพราะที่บ้านไม่มีจะให้ */
export const allowanceCut = (s: GameState) => H.allowanceCut[homeLevel(s)];
