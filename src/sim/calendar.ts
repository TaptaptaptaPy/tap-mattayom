import game from "../../data/game.json";
import { maxEnergy, trait } from "./traits";
import events from "../../data/events.json";
import { settleMissedPlan } from "./chat";
import { stepLives } from "./offscreen";
import { checkClaims } from "./claims";
import { stepSickness } from "./push";
import { allowanceCut, homeDrag } from "./home";
import { maybeCallHome } from "./teacher";
import { stepRivals } from "./rival";
import type { Rnd } from "../core/rng";
import { settleHomework } from "./homework";
import { decayGrades } from "./grades";
import { chapterDef, chapterOf, inChapter, isUni, payRent } from "./chapter";
import { growHair } from "./grooming";
import { settleProject } from "./schoolwork";
import { remember, type GameState } from "./state";

const DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export interface TermEvent {
  id: string; day: number; period: string; name: string;
  ink?: string; exam?: string; holiday?: boolean; wholeDay?: boolean;
  pickClub?: boolean; ending?: boolean; skip?: boolean; assignProject?: boolean;
  /** ไม่ระบุ = ของมัธยม เพื่อให้ข้อมูลเดิมใช้ต่อได้โดยไม่ต้องแก้ทุกบรรทัด */
  chapter?: string;
}
const ALL_EVENTS = (events as TermEvent[]).filter((e) => !e.skip);

/** เหตุการณ์ของภาคที่กำลังเล่นอยู่ — ข้อมูลที่ไม่ระบุภาคถือเป็นของมัธยม */
export const eventsFor = (s: GameState) =>
  ALL_EVENTS.filter((e) => inChapter(e, chapterOf(s)));

/** เผื่อโค้ดเก่าที่ยังเรียกแบบไม่ส่ง state มา — คืนของมัธยม */
export const EVENTS = ALL_EVENTS.filter((e) => inChapter(e, "school"));

export function dateOf(s: GameState): Date {
  const d = new Date(chapterDef(s).startDate + "T00:00:00");
  d.setDate(d.getDate() + s.dayIndex);
  return d;
}
/** 0 = อาทิตย์ … 6 = เสาร์ */
export const weekdayOf = (s: GameState) => dateOf(s).getDay();
export const isWeekend = (s: GameState) => weekdayOf(s) === 0 || weekdayOf(s) === 6;

/** วันหยุดราชการที่ประกาศไว้ในปฏิทินเทอม */
export const isHoliday = (s: GameState) =>
  eventsFor(s).some((e) => e.day === s.dayIndex && e.holiday === true);

/** โรงเรียนเปิดไหม — เสาร์อาทิตย์และวันหยุดไม่เปิด เดิมเข้าห้องเรียนได้ทุกวัน */
export const isSchoolDay = (s: GameState) => !isWeekend(s) && !isHoliday(s);

export function dateLabel(s: GameState): string {
  const d = dateOf(s);
  const period = game.periods[s.periodIndex];
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} · ${period.name}`;
}
export const periodId = (s: GameState) => game.periods[s.periodIndex].id;

/** ช่วงเวลานี้ถูกล็อกด้วยคาบเรียนไหม (เสาร์อาทิตย์และวันหยุดไม่ล็อก) */
export function isLocked(s: GameState): boolean {
  return game.periods[s.periodIndex].schoolLocked && isSchoolDay(s);
}

/** เหตุการณ์ของช่วงเวลานี้ที่ยังไม่เคยเล่น */
export function eventNow(s: GameState): TermEvent | null {
  const pid = periodId(s);
  return eventsFor(s).find((e) => e.day === s.dayIndex && e.period === pid && !s.seenEvents[e.id]) ?? null;
}
/** เหตุการณ์ของวันนี้ทั้งหมด — ใช้โชว์บนปฏิทินล่วงหน้า */
export const eventsOnDay = (day: number, s?: GameState) =>
  (s ? eventsFor(s) : EVENTS).filter((e) => e.day === day);
export const nextEvent = (s: GameState) =>
  eventsFor(s).filter((e) => e.day > s.dayIndex).sort((a, b) => a.day - b.day)[0] ?? null;

export function advance(s: GameState, rnd: Rnd = Math.random): void {
  s.energy = Math.max(0, s.energy + game.energy.perPeriod);
  s.periodIndex++;
  if (s.periodIndex >= game.periods.length) {
    s.periodIndex = 0;
    s.dayIndex++;
    s.metToday = {};
    s.seenToday = {};
    s.doneToday = {};
    // นอนแล้วฟื้นแรง แต่หนี้การนอนจากคืนที่ฝืนจะตามมาหักในวันถัดไป
    // หนี้ถูกทยอยใช้คืน ไม่ใช่ล้างทิ้งทุกเช้า — ไม่งั้นฝืนติดกันสิบคืนก็เท่ากับฝืนคืนเดียว
    // และผลที่เกิด "ระหว่างวัน" (หลับในคาบ) จะไม่มีวันเห็นหนี้เลยสักครั้ง
    const restore = Math.max(20, game.energy.sleepRestore - s.sleepDebt);
    s.energy = Math.min(maxEnergy(s), s.energy + restore);
    // ฝืนมาหลายคืนแล้วร่างกายเก็บบิล — ต้องอยู่ *หลัง* ฟื้นแรง (ไม่งั้นแรงที่ฟื้นจะลบผลของการป่วย)
    // และ *ก่อน* ล้างหนี้ (ไม่งั้นมันจะไม่มีวันเกิดเลย)
    stepSickness(s, rnd);
    s.sleepDebt = Math.max(0, s.sleepDebt - game.energy.debtRecover);
    s.study *= game.examModel.studyDecayPerDay;
    decayGrades(s);
    growHair(s);
    settleProject(s);
    // นัดที่รับไว้เมื่อวานแล้วไม่ไป คิดบัญชีตรงนี้ — อยู่ในทางเดินหลักเพื่อให้เทสต์สมดุลเดินผ่านเอง
    s.stoodUp = settleMissedPlan(s).missed;
    // ตัวละครมีชีวิตของตัวเองตอนเราไม่อยู่ — เดินต่อไม่ว่าเราจะแวะไปหรือไม่
    stepLives(s);
    // คนอื่นก็ใช้เวลากับเขาเหมือนกัน — วันที่เราไม่ไป เขาไป
    stepRivals(s);
    // คนที่สนิทกันเอาเรื่องที่เราเล่ามาเทียบกันบ้าง — คำพูดที่ไม่ตรงกันมีวันโป๊ะ
    checkClaims(s, rnd);
    // ครูเก็บการบ้านเช้าวันเปิดเรียน แล้วสั่งของวันใหม่ — อยู่ในทางเดินหลักเพื่อให้เทสต์เดินผ่านเอง
    // ไม่เก็บข้อความไว้ใน state ฝั่ง UI ดูจาก s.homeworkMissed ที่ขยับแทน
    settleHomework(s, isSchoolDay(s));
    // ค่าขนมออกทุกวันจันทร์ ความประพฤติค่อยๆ ฟื้นถ้าไม่ก่อเรื่องซ้ำ
    // มัธยมได้ค่าขนมจากที่บ้าน ปีหนึ่งต้องจ่ายค่าหอเอง — คนละทิศทางกันเลย
    if (weekdayOf(s) === 1) { if (isUni(s)) payRent(s); else payAllowance(s); }
    // สัปดาห์ที่แย่พอ ครูประจำชั้นโทรหาที่บ้าน — จุดที่ฝ่ายปกครองกับเรื่องที่บ้านมาบรรจบกัน
    if (weekdayOf(s) === 1 && !isUni(s)) maybeCallHome(s);
    // บ้านที่ตึงกินแรงที่ควรได้คืนตอนนอน — ไปบวกกับหนี้การนอนที่มีอยู่แล้ว
    if (!isUni(s)) homeDrag(s);
  }
}

function payAllowance(s: GameState) {
  const M = game.money, B = game.behaviour;
  const best = Math.max(0, ...Object.values(s.exams).map((e) => 45 - e.rank));
  let amount = M.allowanceBase + Math.round(best * M.allowancePerRank / 10);
  if (s.behaviour < B.troubleAt) amount -= M.behaviourPenalty;
  // ที่บ้านตึงแล้วค่าขนมก็ลดลงจริงๆ ไม่ใช่การลงโทษ — เขาไม่มีจะให้
  amount -= allowanceCut(s);
  // บ้านแต่ละบ้านให้ไม่เท่ากันตั้งแต่ต้น — ของภูมิหลัง ไม่ใช่ของที่เล่นมา
  amount += trait(s, "allowance", 0);
  amount = Math.max(60, amount);
  s.money += amount;
  s.behaviour = Math.min(B.start, s.behaviour + B.recoverPerWeek);
  remember(s, `ได้ค่าขนมประจำสัปดาห์ ${amount} บาท`);
}

export const isTermOver = (s: GameState) => s.dayIndex >= chapterDef(s).days;
export const daysLeft = (s: GameState) => Math.max(0, chapterDef(s).days - s.dayIndex);
export const termDays = (s: GameState) => chapterDef(s).days;
