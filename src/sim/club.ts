import clubs from "../../data/clubs.json";
import game from "../../data/game.json";
import { applyStat } from "./economy";
import { changeAffinity } from "./bonds";
import { remember, type GameState, type StatId } from "./state";
import { weekdayOf } from "./calendar";

export type Club = (typeof clubs)[number];
export const CLUBS = clubs as Club[];
export const clubOf = (s: GameState): Club | null =>
  s.club ? CLUBS.find((c) => c.id === s.club) ?? null : null;

/** ชมรมที่สมัครได้ในภาคนี้
 *  ชมรมของมัธยมทั้งสี่อยู่ที่สถานที่ของมัธยมทั้งหมด ซึ่งภาคมหาลัยเข้าไม่ได้
 *  ของเดิมจึงเปิดให้สมัครชมรมที่ *ไปซ้อมไม่ได้เลย* แล้ววันงานใหญ่ก็ตกระดับล่างสุดแน่นอน
 *  = โทษ 8 คะแนนชื่อเสียงสำหรับสิ่งที่ผู้เล่นทำอะไรไม่ได้เลย */
export const clubsFor = (s: GameState): Club[] =>
  CLUBS.filter((c) => ((c as { chapter?: string }).chapter ?? "school") === s.chapter);

/** วันนี้มีกิจกรรมชมรมไหม — ชมรมคือสิ่งที่ทำให้ตารางชีวิตมีจังหวะประจำ */
export function clubToday(s: GameState): Club | null {
  const c = clubOf(s);
  if (!c) return null;
  return c.days.includes(weekdayOf(s)) ? c : null;
}

export function joinClub(s: GameState, id: string) {
  s.club = id;
  const c = clubOf(s);
  if (c) remember(s, `สมัครเข้า${c.name}`);
}

export interface ClubOutcome { message: string; members: string[]; }

export function doClubActivity(s: GameState, times: number, mult = 1): ClubOutcome | null {
  const c = clubToday(s);
  if (!c) return null;
  // นับการซ้อมที่นี่ที่เดียว — ฐานของผลงานในวันงานใหญ่ (ดู src/sim/milestone.ts)
  s.clubDays++;
  const got = applyStat(s, c.stat as StatId, c.gain * mult, times);
  s.energy = Math.max(0, s.energy + c.energy);
  if ("study" in c && typeof c.study === "number") s.study += c.study;
  if ("behaviourPerWeek" in c && typeof c.behaviourPerWeek === "number")
    s.behaviour = Math.min(game.behaviour.start, s.behaviour + c.behaviourPerWeek / 2);
  for (const m of c.members) changeAffinity(s, m, 1);
  const nm = game.stats.find((x) => x.id === c.stat)!.name;
  return { message: `${c.name} · ${nm} +${got.toFixed(1)}`, members: c.members };
}
