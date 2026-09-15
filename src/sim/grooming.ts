import game from "../../data/game.json";
import { shiftStanding } from "./bonds";
import { isUni } from "./chapter";
import { remember, type GameState } from "./state";
import type { Rnd } from "../core/rng";

/** ตรวจหน้าเสาธง
 *
 *  ผมยาว ถุงเท้าสั้น เสื้อไม่เข้าใน — ของที่คนไทยทุกคนเคยโดนแต่แทบไม่มีเกมไหนทำ
 *  มันผูกเงิน เวลา ความประพฤติ และเสน่ห์เข้าด้วยกันด้วยกลไกเดียว:
 *  ปล่อยไว้ก็ประหยัดเงินและเวลา แต่เสี่ยงโดนหน้าแถวต่อหน้าทั้งโรงเรียน
 *
 *  ต่างจากฝ่ายปกครองตรงที่อันนั้นจับตอนเราไปที่ที่ไม่ควรไป ส่วนอันนี้จับตอนเรา *ไม่ทำอะไรเลย*
 */

const G = game.grooming;

export const groomingLabel = (v: number) =>
  v >= 80 ? "เรียบร้อย"
  : v >= G.checkBelow ? "เริ่มยาวแล้ว"
  : v >= 40 ? "ครูเริ่มมอง"
  : "โดนแน่ถ้าไม่ตัด";

export const needsHaircut = (s: GameState) => s.grooming < G.checkBelow;

/** ผมยาวขึ้นทุกวัน เรียกจาก `advance()` ตอนขึ้นวันใหม่ */
export function growHair(s: GameState): void {
  s.grooming = Math.max(0, s.grooming - G.perDay);
}

/** ตัดผม — เสียเงินและเสียหนึ่งช่วงเวลา แต่ไม่ต้องลุ้นหน้าเสาธงอีกสักพัก */
export function haircut(s: GameState): string {
  s.grooming = G.start;
  remember(s, "ไปตัดผมให้เรียบร้อย");
  return "ตัดผมเรียบร้อยแล้ว ครูไม่มีอะไรจะว่า";
}

export interface InspectResult { caught: boolean; message: string | null; }

/** ครูตรวจตอนเข้าแถว — เรียกจาก `attendClass()` ผ่านทางเดียวกับที่เกมจริงใช้ */
export function inspect(s: GameState, rnd: Rnd = Math.random): InspectResult {
  // ที่มหาวิทยาลัยไม่มีใครตรวจทรงผม และนั่นคือสิ่งที่ภาคสองอยากให้รู้สึก
  if (isUni(s) || !needsHaircut(s)) return { caught: false, message: null };
  // ยิ่งปล่อยยาว ยิ่งโดนง่าย
  const over = (G.checkBelow - s.grooming) / G.checkBelow;
  if (rnd() > G.catchChance * (0.5 + over)) return { caught: false, message: null };

  s.behaviour = Math.max(0, s.behaviour - G.behaviourPenalty);
  shiftStanding(s, -G.standingPenalty, "โดนเรียกออกมาหน้าแถวเพราะผมยาว");
  s.inspected++;
  return {
    caught: true,
    message: `โดนเรียกออกมาหน้าแถว · ความประพฤติ -${G.behaviourPenalty} · ชื่อเสียง -${G.standingPenalty}`,
  };
}

export const cutCost = G.cutCost;
