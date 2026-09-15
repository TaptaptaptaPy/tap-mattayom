import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { applyStat } from "./economy";
import { shiftStanding, changeAffinity } from "./bonds";
import { SUBJECTS, subjectById } from "./grades";
import { remember, type GameState } from "./state";
import { noteBehaviour } from "./teacher";

/** สอบซ่อม และงานกลุ่ม
 *
 *  สองอย่างนี้เป็นภาระที่ *เกมยัดใส่มือ* ไม่ใช่สิ่งที่ผู้เล่นเลือกทำเอง
 *  เหมือนการบ้าน แต่หนักกว่าและมีเส้นตายจริง
 *
 *  สอบซ่อม: สอบเสร็จแล้ววิชาไหนต่ำกว่าเกณฑ์ต้องไปซ่อม ไม่ซ่อมก็ติด 0 ติดตัวไปถึงฉากจบ
 *  งานกลุ่ม: จับคู่กับคนที่ *ไม่ได้เลือก* แล้วต้องใช้เวลาหลังเลิกเรียนกับเขาให้ครบก่อนกำหนด
 *  ซึ่งบังคับให้ผู้เล่นรู้จักคนที่ไม่ได้ตั้งใจจะรู้จัก แทนที่จะเทให้คนเดียวทั้งเทอม
 */

const R = game.retake;
const PJ = game.project;

// ───────────────────────── สอบซ่อม ─────────────────────────

/** วิชาที่ตกหลังสอบ — เรียกทันทีหลังประกาศผลสอบ */
export function markRetakes(s: GameState): string[] {
  const failed = SUBJECTS.filter((x) => (s.grades[x.id] ?? 0) < R.failBelow).map((x) => x.id);
  s.retakes = failed;
  if (failed.length) remember(s, `ติดซ่อม ${failed.length} วิชา`);
  return failed;
}

export const hasRetake = (s: GameState) => s.retakes.length > 0;
export const retakeNames = (s: GameState) =>
  s.retakes.map((id) => subjectById(id)?.name ?? id);

/** ไปซ่อมหนึ่งวิชา — เสียเงิน เสียแรง และเสียหนึ่งช่วงเวลา */
export function doRetake(s: GameState, subjectId: string): string {
  const i = s.retakes.indexOf(subjectId);
  if (i < 0) return "วิชานี้ไม่ได้ติดซ่อม";
  if (s.money < R.cost) return "เงินไม่พอค่าสอบซ่อม";
  if (s.energy + R.energy < 0) return "แรงเหลือน้อยเกินกว่าจะไปนั่งสอบ";

  s.retakes.splice(i, 1);
  s.money -= R.cost;
  s.energy = Math.max(0, s.energy + R.energy);
  s.grades[subjectId] = Math.max(s.grades[subjectId] ?? 0, R.fixTo);
  const name = subjectById(subjectId)?.name ?? subjectId;
  remember(s, `ไปสอบซ่อม${name}`);
  noteBehaviour(s, game.teacher.perRetake, "ไปสอบซ่อม");
  return `สอบซ่อม${name}ผ่านแล้ว · -${R.cost} บาท`;
}

/** วิชาที่ยังติดซ่อมอยู่ตอนจบเทอม ดึงเกรดเฉลี่ยลงจริง */
export const retakePenalty = (s: GameState) => s.retakes.length * R.gpaPenaltyPerFail;

export const retakeCost = R.cost;

// ───────────────────────── งานกลุ่ม ─────────────────────────

/** จับคู่งานกลุ่ม — คนที่จับได้ไม่ใช่คนที่สนิทที่สุด แต่เป็นคนที่สนิทน้อยที่สุด
 *  เพราะประเด็นของระบบนี้คือบังคับให้รู้จักคนที่ไม่ได้ตั้งใจจะรู้จัก */
export function assignProject(s: GameState, chapter: string): string | null {
  const pool = chars.filter((c) => (c.chapter ?? "school") === chapter);
  if (!pool.length) return null;
  let pick = pool[0];
  for (const c of pool)
    if ((s.affinity[c.id] ?? 0) < (s.affinity[pick.id] ?? 0)) pick = c;
  s.project = { charId: pick.id, done: 0, due: s.dayIndex + PJ.dueInDays, settled: false };
  remember(s, `จับคู่งานกลุ่มกับ${pick.name}`);
  return pick.id;
}

export const projectPartner = (s: GameState) =>
  s.project && !s.project.settled ? s.project : null;

export const projectName = (s: GameState) =>
  chars.find((c) => c.id === s.project?.charId)?.name ?? "";

/** ทำงานกลุ่มหนึ่งครั้ง — กินหนึ่งช่วงเวลา ได้เกรดทุกวิชานิดหน่อยและได้ใจคู่ด้วย */
export function workProject(s: GameState): string {
  const p = projectPartner(s);
  if (!p) return "ไม่มีงานกลุ่มค้างอยู่";
  p.done++;
  for (const sub of SUBJECTS)
    s.grades[sub.id] = Math.min(100, (s.grades[sub.id] ?? 0) + PJ.gradePerSession);
  changeAffinity(s, p.charId, PJ.affinityPerSession);
  applyStat(s, "kind", 2, p.done - 1);
  const left = Math.max(0, PJ.sessionsNeeded - p.done);
  if (left === 0) {
    p.settled = true;
    shiftStanding(s, 4, `ส่งงานกลุ่มกับ${projectName(s)}ทันกำหนด`);
    return `งานกลุ่มเสร็จแล้ว · ส่งทันกำหนด`;
  }
  return `ทำงานกลุ่มกับ${projectName(s)} · เหลืออีก ${left} ครั้ง`;
}

/** เลยกำหนดแล้วยังไม่เสร็จ — เรียกตอนขึ้นวันใหม่ */
export function settleProject(s: GameState): number {
  const p = s.project;
  if (!p || p.settled || s.dayIndex <= p.due) return 0;
  p.settled = true;
  const short = Math.max(0, PJ.sessionsNeeded - p.done);
  s.behaviour = Math.max(0, s.behaviour - PJ.missPenalty * short);
  shiftStanding(s, -PJ.missStanding, `ส่งงานกลุ่มไม่ทัน`);
  changeAffinity(s, p.charId, -4);
  remember(s, `ส่งงานกลุ่มไม่ทัน ขาดอีก ${short} ครั้ง`);
  return short;
}

export const projectNeeded = PJ.sessionsNeeded;
