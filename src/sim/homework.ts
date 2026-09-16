import game from "../../data/game.json";
import { applyStat } from "./economy";
import { studyAll, gradePerHomework } from "./grades";
import { remember, type GameState } from "./state";
import { noteBehaviour } from "./teacher";

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

/** ทำการบ้านให้จบ — กินแรงและกินช่วงเวลาไปหนึ่งช่วง
 *
 *  `focus` คือผลของมินิเกมนั่งท่อง (0.7–1.3) — ส่งครบเหมือนกันแต่ได้ความรู้ไม่เท่ากัน
 *  ซึ่งตรงกับของจริง: ลอกมาส่งกับนั่งทำเองได้คะแนนส่งเท่ากัน แต่เข้าหัวคนละเรื่อง
 *  ความประพฤติกับครูไม่ขึ้นกับฝีมือ เพราะครูเห็นแค่ว่าส่งหรือไม่ส่ง */
export function doHomework(s: GameState, focus = 1): string {
  if (s.homework <= 0) return "ไม่มีการบ้านค้างอยู่";
  if (s.energy + H.energy < 0) return "แรงเหลือน้อยเกินกว่าจะนั่งทำได้";
  const pieces = s.homework;
  s.homework = 0;
  s.energy = Math.max(0, s.energy + H.energy);
  s.study += H.study * pieces * focus;
  const got = applyStat(s, "mind", H.mind * pieces * focus, s.doneToday["_homework"] ?? 0);
  studyAll(s, gradePerHomework * pieces * focus);
  s.doneToday["_homework"] = (s.doneToday["_homework"] ?? 0) + 1;
  remember(s, `ส่งการบ้าน ${pieces} ชิ้น`);
  noteBehaviour(s, game.teacher.perHomework * pieces, "ส่งการบ้าน");
  return `ทำการบ้าน ${pieces} ชิ้น · ความพร้อมสอบ +${Math.round(H.study * pieces * focus)} · ปัญญา +${got.toFixed(1)}`;
}

/** เรียกตอนขึ้นวันเรียนใหม่ — เก็บงานที่ค้าง แล้วสั่งของวันใหม่
 *  อยู่ในทางเดินของ `advance()` เพื่อให้ `npm run balance` เดินผ่านเองโดยไม่ต้องจำไปเรียก */
/** ครูเห็นทุกอย่างที่เราทำและไม่ทำ — ดู src/sim/teacher.ts */
export function settleHomework(s: GameState, schoolDay: boolean): number {
  let missed = 0;
  if (s.homework > 0) {
    const pieces = s.homework;
    s.behaviour = Math.max(0, s.behaviour - H.behaviourPenalty * pieces);
    s.study = Math.max(0, s.study - H.studyPenalty * pieces);
    s.homeworkMissed += pieces;
    remember(s, `ไม่ได้ส่งการบ้าน ${pieces} ชิ้น ครูจดชื่อไว้`);
    noteBehaviour(s, game.teacher.perMissedHomework * pieces, "ไม่ส่งการบ้าน");
    missed = pieces;
    s.homework = 0;
  }
  // วันหยุดครูไม่สั่งเพิ่ม แต่ของเดิมที่ค้างก็ถูกเก็บไปแล้วข้างบน
  if (schoolDay) s.homework = Math.min(H.maxPending, s.homework + H.perSchoolDay);
  return missed;
}
