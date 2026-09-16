import game from "../../data/game.json";
import { trait } from "./traits";
import { remember, type GameState } from "./state";
import { noteBehaviour, teacherShields } from "./teacher";

const B = game.behaviour;

export type Rnd = () => number;

export interface CaughtResult { caught: boolean; message: string | null; penalty: number; }

/** ฝ่ายปกครอง: ที่ที่ครูไม่ควรเห็นเรา มีโอกาสโดนจับได้จริง
 *  ความซ่าสูงช่วยให้รอด นี่คือส่วนของ Bully ที่โครงเดิมยังไม่มีเลย */
export function rollCatch(s: GameState, catchBase: number, rnd: Rnd = Math.random): CaughtResult {
  // ความซ่าคือของที่เล่นมาแล้วได้ · `escape` คือของที่ติดตัวมาตั้งแต่ก่อนเปิดเทอม
  const dodge = Math.min(0.75, s.stats.nerve / 60 + trait(s, "escape", 0));
  const chance = Math.max(0.02, catchBase * trait(s, "catch", 1) * (1 - dodge));
  if (rnd() > chance) return { caught: false, message: null, penalty: 0 };

  const raw = 6 + Math.round(rnd() * 6);
  // ครูประจำชั้นที่ไว้ใจเราเข้าไปพูดแทน — เขาไม่ได้ทำให้เราไม่ผิด แค่เป็นคนที่พูดแทนเราได้
  const { penalty, saved } = teacherShields(s, raw);
  s.behaviour = Math.max(0, s.behaviour - penalty);
  s.caught++;
  noteBehaviour(s, game.teacher.perCaught, "โดนฝ่ายปกครองจับ");
  const line = saved
    ? `ครูปกครองจับได้ · ครูประจำชั้นเข้าไปคุยให้ · ตัดคะแนน ${penalty} แทนที่จะเป็น ${raw}`
    : s.behaviour < B.troubleAt
    ? `ครูปกครองจับได้ · ตัดคะแนนความประพฤติ ${penalty} · เรียกผู้ปกครองแล้ว`
    : `ครูปกครองจับได้ · ตัดคะแนนความประพฤติ ${penalty}`;
  remember(s, line);
  return { caught: true, message: line, penalty };
}

export const behaviourLabel = (v: number) =>
  v >= B.start - 4 ? "ไม่มีประวัติ"
  : v >= B.warnAt ? "มีชื่อในสมุดบ้าง"
  : v >= B.troubleAt ? "ครูปกครองจำหน้าได้"
  : "อยู่ในสายตาฝ่ายปกครอง";

/** ความประพฤติต่ำกว่าเกณฑ์ ทำให้ที่เสี่ยงๆ เข้าไม่ได้อีก */
export const inTrouble = (s: GameState) => s.behaviour < B.troubleAt;

/** หลบพ้นในมินิเกมแล้ว คืนคะแนนความประพฤติที่เพิ่งหักไป */
export function escapeCatch(s: GameState, penalty: number) {
  s.behaviour = Math.min(B.start, s.behaviour + penalty);
  s.caught = Math.max(0, s.caught - 1);
  remember(s, "โดนครูปกครองเรียก แต่เอาตัวรอดมาได้");
}
