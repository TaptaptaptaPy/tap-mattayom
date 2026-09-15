import game from "../../data/game.json";
import { applyStat } from "./economy";
import { studyAll, gradePerHomework } from "./grades";
import { remember, type GameState } from "./state";

/** การบ้าน
 *
 *  ช่วง "กลางคืน" เคยเกือบฟรี — ทบทวนบทเรียนที่บ้านหรือไม่ทำอะไรก็ได้ ไม่มีใครว่า
 *  การบ้านทำให้คืนนั้นมีของที่ *ต้อง* ทำ แลกกับช่วงเวลาที่อยากเอาไปทำอย่างอื่น
 *  นี่คือแรงกดดันแบบที่โรงเรียนจริงมี และเป็นการตัดสินใจที่เกิดขึ้นทุกวัน
 *
 *  ครูสั่งทุกวันเปิดเรียน และเก็บเช้าวันเปิดเรียนถัดไป ไม่ส่งแล้วโดนหักความประพฤติ
 */

const H = game.homework;

export const hasHomework = (s: GameState) => s.homework > 0;

/** ทำการบ้านให้จบ — กินแรงและกินช่วงเวลาไปหนึ่งช่วง */
export function doHomework(s: GameState): string {
  if (s.homework <= 0) return "ไม่มีการบ้านค้างอยู่";
  if (s.energy + H.energy < 0) return "แรงเหลือน้อยเกินกว่าจะนั่งทำได้";
  const pieces = s.homework;
  s.homework = 0;
  s.energy = Math.max(0, s.energy + H.energy);
  s.study += H.study * pieces;
  const got = applyStat(s, "mind", H.mind * pieces, s.doneToday["_homework"] ?? 0);
  studyAll(s, gradePerHomework * pieces);
  s.doneToday["_homework"] = (s.doneToday["_homework"] ?? 0) + 1;
  remember(s, `ส่งการบ้าน ${pieces} ชิ้น`);
  return `ทำการบ้าน ${pieces} ชิ้น · ความพร้อมสอบ +${H.study * pieces} · ปัญญา +${got.toFixed(1)}`;
}

/** เรียกตอนขึ้นวันเรียนใหม่ — เก็บงานที่ค้าง แล้วสั่งของวันใหม่
 *  อยู่ในทางเดินของ `advance()` เพื่อให้ `npm run balance` เดินผ่านเองโดยไม่ต้องจำไปเรียก */
export function settleHomework(s: GameState, schoolDay: boolean): number {
  let missed = 0;
  if (s.homework > 0) {
    const pieces = s.homework;
    s.behaviour = Math.max(0, s.behaviour - H.behaviourPenalty * pieces);
    s.study = Math.max(0, s.study - H.studyPenalty * pieces);
    s.homeworkMissed += pieces;
    remember(s, `ไม่ได้ส่งการบ้าน ${pieces} ชิ้น ครูจดชื่อไว้`);
    missed = pieces;
    s.homework = 0;
  }
  // วันหยุดครูไม่สั่งเพิ่ม แต่ของเดิมที่ค้างก็ถูกเก็บไปแล้วข้างบน
  if (schoolDay) s.homework = Math.min(H.maxPending, s.homework + H.perSchoolDay);
  return missed;
}
