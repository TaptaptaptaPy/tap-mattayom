import game from "../../data/game.json";
import { newGrades } from "./grades";
import { remember, type Ending, type GameState, type StatId } from "./state";

/** ภาคของเกม
 *
 *  เดิมเกมจบที่ปัจฉิมนิเทศแล้วหยุด ทั้งที่คำถามที่ค้างอยู่คือ "แล้วยังไงต่อ"
 *  ภาคสองคือปีหนึ่งในมหาวิทยาลัย ใช้เอนจินเดียวกันทุกอย่าง — ปฏิทิน ช่วงเวลา
 *  ค่าสถานะ ไลน์ การบ้าน สอบ — ต่างกันแค่ *ข้อมูล* ซึ่งเป็นเหตุผลที่สถาปัตยกรรมนี้ถูกวางไว้แบบนี้
 *
 *  ขึ้นมหาลัยแล้วไม่ได้เริ่มจากศูนย์ แต่ก็ไม่ได้เอามาทั้งหมด:
 *  ค่าสถานะเหลือครึ่ง เพราะทักษะยังอยู่แต่บริบทเปลี่ยน · ความสัมพันธ์เหลือไม่ถึงครึ่ง
 *  เพราะคนละมหาลัยคนละคณะ · ชื่อเสียงรีเซ็ตเกือบหมด เพราะที่นี่ไม่มีใครรู้ว่าเราเคยเป็นใคร
 */

export type ChapterId = "school" | "uni";
type ChapterDef = { name: string; startDate: string; days: number; sub: string };

const CH = game.chapters as unknown as Record<ChapterId, ChapterDef>;
const C = game.carryOver;

export const chapterOf = (s: GameState): ChapterId => s.chapter ?? "school";
export const chapterDef = (s: GameState) => CH[chapterOf(s)];
export const chapterName = (s: GameState) => chapterDef(s).name;
export const isUni = (s: GameState) => chapterOf(s) === "uni";

/** ข้อมูลชิ้นนี้อยู่ในภาคไหน — ไม่ระบุถือว่าเป็นของมัธยม เพื่อให้ข้อมูลเดิมใช้ต่อได้ */
export const inChapter = (item: { chapter?: string }, ch: ChapterId) =>
  (item.chapter ?? "school") === ch;

/** ขึ้นปีหนึ่ง — เรียกหลังฉากจบของมัธยมเท่านั้น */
export function startUni(s: GameState, schoolEnding: Ending): void {
  s.schoolEnding = schoolEnding;
  s.chapter = "uni";

  for (const k of Object.keys(s.stats) as StatId[]) s.stats[k] *= C.statKeep;
  for (const k of Object.keys(s.affinity)) s.affinity[k] *= C.affinityKeep;
  // ความเชื่อใจจางช้ากว่าความสนิท — คนที่เคยไว้ใจเรา ไม่ได้เลิกไว้ใจเพราะแค่ไม่ได้เจอกัน
  for (const k of Object.keys(s.trust ?? {})) s.trust[k] *= game.trust.decayPerTerm;

  s.dayIndex = 0;
  s.periodIndex = 0;
  s.energy = game.energy.max;
  s.standing = C.standingReset;
  s.money = C.startMoney;
  s.grades = newGrades();
  s.study = 0;
  s.exams = {};
  s.seenEvents = {};
  s.metToday = {};
  s.doneToday = {};
  s.homework = 0;
  s.homeworkMissed = 0;
  s.grooming = game.grooming.start;
  s.inspected = 0;
  s.behaviour = game.behaviour.start;
  s.club = null;
  s.sided = null;
  s.plans = [];
  s.pendingChat = null;
  s.chatDay = -1;
  s.ending = null;
  s.rentDue = C.rentPerWeek;

  remember(s, `เข้าเรียนปีหนึ่ง · ${schoolEnding.tier}`);
}

/** ค่าหอค่ากินรายสัปดาห์ — แรงกดดันหลักของภาคนี้ แทนที่ค่าขนมที่เคยได้ฟรี
 *  จ่ายไม่ไหวแล้วต้องไปทำงานพิเศษ ซึ่งกินเวลาที่ควรเอาไปเรียน */
export function payRent(s: GameState): string | null {
  if (!isUni(s)) return null;
  const due = C.rentPerWeek;
  if (s.money >= due) {
    s.money -= due;
    return `จ่ายค่าหอค่ากิน ${due} บาท`;
  }
  const short = due - s.money;
  s.money = 0;
  s.energy = Math.max(0, s.energy - 20);
  s.debt += short;
  remember(s, `ค่าหอขาด ${short} บาท ต้องยืมเขาไปก่อน`);
  return `ค่าหอขาด ${short} บาท · ต้องยืมเขามา แรงหายไปด้วย`;
}

export const rentPerWeek = C.rentPerWeek;
