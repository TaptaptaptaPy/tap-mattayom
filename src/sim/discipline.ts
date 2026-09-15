import game from "../../data/game.json";
import { remember, type GameState } from "./state";

const B = game.behaviour;

export type Rnd = () => number;

export interface CaughtResult { caught: boolean; message: string | null; }

/** ฝ่ายปกครอง: ที่ที่ครูไม่ควรเห็นเรา มีโอกาสโดนจับได้จริง
 *  ความซ่าสูงช่วยให้รอด นี่คือส่วนของ Bully ที่โครงเดิมยังไม่มีเลย */
export function rollCatch(s: GameState, catchBase: number, rnd: Rnd = Math.random): CaughtResult {
  const dodge = Math.min(0.75, s.stats.nerve / 60);
  const chance = Math.max(0.02, catchBase * (1 - dodge));
  if (rnd() > chance) return { caught: false, message: null };

  const penalty = 6 + Math.round(rnd() * 6);
  s.behaviour = Math.max(0, s.behaviour - penalty);
  s.caught++;
  const line = s.behaviour < B.troubleAt
    ? `ครูปกครองจับได้ · ตัดคะแนนความประพฤติ ${penalty} · เรียกผู้ปกครองแล้ว`
    : `ครูปกครองจับได้ · ตัดคะแนนความประพฤติ ${penalty}`;
  remember(s, line);
  return { caught: true, message: line };
}

export const behaviourLabel = (v: number) =>
  v >= B.start - 4 ? "ไม่มีประวัติ"
  : v >= B.warnAt ? "มีชื่อในสมุดบ้าง"
  : v >= B.troubleAt ? "ครูปกครองจำหน้าได้"
  : "อยู่ในสายตาฝ่ายปกครอง";

/** ความประพฤติต่ำกว่าเกณฑ์ ทำให้ที่เสี่ยงๆ เข้าไม่ได้อีก */
export const inTrouble = (s: GameState) => s.behaviour < B.troubleAt;
