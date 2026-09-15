import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { affinityRank, remember, type ChatMsg, type ChatThread, type GameState } from "./state";
import type { Rnd } from "../core/rng";
import { changeAffinity } from "./bonds";

/** ไลน์ตอนกลางคืน
 *
 *  ปัญหาที่แก้: เดิมผู้เล่นเป็นฝ่ายเดินไปหาคนอื่นเสมอ ไม่มีใครเคยติดต่อมาหาเลย
 *  และช่วง "กลางคืน" แทบไม่มีอะไรให้ทำนอกจากทบทวนบทเรียนที่บ้าน
 *  พอมีคนทักมาเอง คืนนั้นเลยมีเรื่องให้รอ และการรับนัดทำให้พรุ่งนี้ถูกจองไว้ล่วงหน้าแล้วส่วนหนึ่ง
 *
 *  แบ่งหน้าที่ตามกติกาของโปรเจกต์: ไฟล์นี้เป็นเจ้าของ "ใครทักเมื่อไหร่ นัดแล้วได้เสียอะไร"
 *  ส่วน *คำพูด* ทั้งหมดอยู่ใน `story/chat_<ชื่อ>.ink` ไม่มีข้อความบทสนทนาสักบรรทัดในไฟล์นี้
 */

const C = game.chat;

/** อ่าน id ช่วงเวลาตรงนี้เอง ไม่ import `calendar.ts`
 *  เพราะ `calendar.ts` เป็นฝ่ายเรียก `settleMissedPlan()` ของไฟล์นี้ ถ้า import กลับจะเป็นวงกลม */
const periodOf = (s: GameState) => game.periods[s.periodIndex].id;

export const nameOf = (charId: string) => chars.find((c) => c.id === charId)?.name ?? charId;

/** ตอนนี้เป็นช่วงที่ไลน์เข้าได้ไหม */
export const isChatTime = (s: GameState) => periodOf(s) === C.period;

const lastThreadDay = (s: GameState, charId: string) => {
  let d = -1;
  for (const t of s.chats) if (t.charId === charId && t.day > d) d = t.day;
  return d;
};

/** คืนนี้มีใครทักมาไหม — ตัดสินจาก state ล้วนบวก rnd ที่ส่งเข้ามา
 *  ตั้ง `s.pendingChat` ไว้ให้ฝั่ง UI ไปเปิดอ่าน ตัวข้อความยังไม่ถูกสร้างตรงนี้
 *  เพราะคำพูดเป็นของ ink ซึ่งจะรันตอนผู้เล่นกดเปิดแชทจริงๆ */
export function offerChat(s: GameState, rnd: Rnd): string | null {
  if (!isChatTime(s) || s.chatDay === s.dayIndex || s.pendingChat) return null;
  s.chatDay = s.dayIndex;
  if (rnd() > C.chancePerNight) return null;

  const pool = chars.filter((c) => {
    if (affinityRank(s.affinity[c.id] ?? 0) < C.minRank) return false;
    const last = lastThreadDay(s, c.id);
    return last < 0 || s.dayIndex - last >= C.cooldownDays;
  });
  if (!pool.length) return null;

  // คนที่สนิทกว่าทักบ่อยกว่า แต่ไม่ผูกขาดคนเดียวทั้งเทอม
  pool.sort((a, b) => (s.affinity[b.id] ?? 0) - (s.affinity[a.id] ?? 0));
  const pick = pool[Math.floor(rnd() * Math.min(pool.length, 2))];
  s.pendingChat = pick.id;
  return pick.id;
}

/** เก็บบทสนทนาที่เพิ่งอ่านจบลงประวัติ เพื่อให้ย้อนกลับมาอ่านได้เหมือนแชทจริง */
export function recordThread(s: GameState, charId: string, msgs: ChatMsg[], invited: boolean): ChatThread {
  const t: ChatThread = {
    id: `${charId}-${s.dayIndex}-${s.chats.length}`,
    charId, day: s.dayIndex, invited, msgs,
  };
  s.chats.push(t);
  while (s.chats.length > C.maxThreads) s.chats.shift();
  if (s.pendingChat === charId) s.pendingChat = null;
  return t;
}

/** รับนัด — จองช่วงหลังเลิกเรียนของพรุ่งนี้ไว้ */
export function acceptInvite(s: GameState, charId: string) {
  s.plan = { charId, day: s.dayIndex + 1, kept: false };
  remember(s, `รับนัด${nameOf(charId)}ไว้พรุ่งนี้หลังเลิกเรียน`);
}

/** วันนี้มีนัดค้างอยู่กับใครไหม */
export const planToday = (s: GameState) =>
  s.plan && !s.plan.kept && s.plan.day === s.dayIndex ? s.plan : null;

/** ที่นัดกันไว้คือช่วงหลังเลิกเรียน และต้องเจอตัวเขาที่นั่นจริง */
export const isPlanPeriod = (s: GameState) => periodOf(s) === C.planPeriod;

/** ไปตามนัดแล้ว — คืนแต้มความสัมพันธ์ที่ได้เพิ่ม (0 ถ้าไม่มีนัด) */
export function keepPlan(s: GameState, charId: string): number {
  const p = planToday(s);
  if (!p || p.charId !== charId || !isPlanPeriod(s)) return 0;
  p.kept = true;
  changeAffinity(s, charId, C.keptBonus);
  remember(s, `ไปตามนัด${nameOf(charId)}`);
  return C.keptBonus;
}

/** เรียกตอนขึ้นวันใหม่ — นัดที่รับไว้แล้วไม่ไป มีราคาต้องจ่าย
 *  วางไว้ในทางเดินของ `advance()` เพื่อให้ `npm run balance` เดินผ่านเองโดยไม่ต้องจำไปเรียก */
export function settleMissedPlan(s: GameState) {
  const p = s.plan;
  if (!p || p.day >= s.dayIndex) return;
  if (!p.kept) {
    changeAffinity(s, p.charId, -C.missedPenalty);
    remember(s, `ผิดนัด${nameOf(p.charId)}`);
  }
  s.plan = null;
}
