import game from "../../data/game.json";
import events from "../../data/events.json";
import { remember, type GameState } from "./state";

const DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export interface TermEvent {
  id: string; day: number; period: string; name: string;
  ink?: string; exam?: string; holiday?: boolean; wholeDay?: boolean;
  pickClub?: boolean; ending?: boolean; skip?: boolean;
}
export const EVENTS = (events as TermEvent[]).filter((e) => !e.skip);

export function dateOf(s: GameState): Date {
  const d = new Date(game.term.startDate + "T00:00:00");
  d.setDate(d.getDate() + s.dayIndex);
  return d;
}
/** 0 = อาทิตย์ … 6 = เสาร์ */
export const weekdayOf = (s: GameState) => dateOf(s).getDay();
export const isWeekend = (s: GameState) => weekdayOf(s) === 0 || weekdayOf(s) === 6;

/** วันหยุดราชการที่ประกาศไว้ในปฏิทินเทอม */
export const isHoliday = (s: GameState) =>
  EVENTS.some((e) => e.day === s.dayIndex && e.holiday === true);

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
  return EVENTS.find((e) => e.day === s.dayIndex && e.period === pid && !s.seenEvents[e.id]) ?? null;
}
/** เหตุการณ์ของวันนี้ทั้งหมด — ใช้โชว์บนปฏิทินล่วงหน้า */
export const eventsOnDay = (day: number) => EVENTS.filter((e) => e.day === day);
export const nextEvent = (s: GameState) =>
  EVENTS.filter((e) => e.day > s.dayIndex).sort((a, b) => a.day - b.day)[0] ?? null;

export function advance(s: GameState): void {
  s.energy = Math.max(0, s.energy + game.energy.perPeriod);
  s.periodIndex++;
  if (s.periodIndex >= game.periods.length) {
    s.periodIndex = 0;
    s.dayIndex++;
    s.metToday = {};
    s.doneToday = {};
    // นอนแล้วฟื้นแรง แต่หนี้การนอนจากคืนที่ฝืนจะตามมาหักในวันถัดไป
    const restore = Math.max(20, game.energy.sleepRestore - s.sleepDebt);
    s.energy = Math.min(game.energy.max, s.energy + restore);
    s.sleepDebt = 0;
    s.study *= game.examModel.studyDecayPerDay;
    // ค่าขนมออกทุกวันจันทร์ ความประพฤติค่อยๆ ฟื้นถ้าไม่ก่อเรื่องซ้ำ
    if (weekdayOf(s) === 1) payAllowance(s);
  }
}

function payAllowance(s: GameState) {
  const M = game.money, B = game.behaviour;
  const best = Math.max(0, ...Object.values(s.exams).map((e) => 45 - e.rank));
  let amount = M.allowanceBase + Math.round(best * M.allowancePerRank / 10);
  if (s.behaviour < B.troubleAt) amount -= M.behaviourPenalty;
  amount = Math.max(60, amount);
  s.money += amount;
  s.behaviour = Math.min(B.start, s.behaviour + B.recoverPerWeek);
  remember(s, `ได้ค่าขนมประจำสัปดาห์ ${amount} บาท`);
}

export const isTermOver = (s: GameState) => s.dayIndex >= game.term.days;
export const daysLeft = (s: GameState) => Math.max(0, game.term.days - s.dayIndex);
