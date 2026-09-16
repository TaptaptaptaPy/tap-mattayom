import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { affinityRank, remember, type ChatMsg, type ChatThread, type GameState } from "./state";
import type { Rnd } from "../core/rng";
import { changeAffinity, changeTrust } from "./bonds";

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
    // ยังไม่เคยเจอหน้ากันก็ไม่มีไลน์กัน — ตรวจตรงนี้เอง ไม่ import presence
    // เพราะ presence เป็นฝ่าย import ไฟล์นี้ (ดูหมายเหตุเรื่อง import วนกันข้างบน)
    if (s.met[c.id] === undefined) return false;
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

/** คืนนี้มีคนที่สองทักมาอีกไหม — เรียกหลังจากอ่านของคนแรกจบแล้ว
 *
 *  ถ้าคืนหนึ่งมีคนทักได้คนเดียวเสมอ การรับนัดซ้อนกันจะไม่มีทางเกิดขึ้นเลย
 *  เพราะนัดถูกจองเป็นของ "พรุ่งนี้" เสมอ (เทสต์สมดุลจับข้อนี้ได้ตอนเพิ่มระบบนัดซ้อน
 *  รายงานว่า "วันที่รับนัดซ้อนกัน 0" ทั้งที่โค้ดรองรับไว้หมดแล้ว)
 *
 *  เงื่อนไขคือต้องสนิทกับหลายคนพอสมควร ซึ่งสมเหตุสมผล — ยิ่งมีคนสนิทมาก
 *  ยิ่งมีโอกาสที่สองคนจะทักมาคืนเดียวกัน แล้วเราต้องเลือก
 */
export function offerSecondChat(s: GameState, rnd: Rnd, firstId: string): string | null {
  if (s.pendingChat) return null;
  const close = chars.filter((c) =>
    s.met[c.id] !== undefined && affinityRank(s.affinity[c.id] ?? 0) >= C.secondMinClose);
  if (close.length < 2 || rnd() > C.secondChance) return null;

  const pool = close.filter((c) => {
    if (c.id === firstId) return false;
    const last = lastThreadDay(s, c.id);
    return last < 0 || s.dayIndex - last >= C.cooldownDays;
  });
  if (!pool.length) return null;
  const pick = pool[Math.floor(rnd() * pool.length)];
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

/** รับนัด — จองช่วงหลังเลิกเรียนของพรุ่งนี้ไว้
 *
 *  รับได้มากกว่าหนึ่งคนในวันเดียวกัน และนั่นคือประเด็นทั้งหมด
 *  วันหนึ่งมีช่วงหลังเลิกเรียนช่วงเดียว รับสองคนแปลว่าต้องผิดนัดอย่างน้อยหนึ่งคนแน่ๆ
 *  เกมไม่ห้าม เพราะการรับปากทั้งที่รู้ว่าไปไม่ได้ ก็เป็นการตัดสินใจอย่างหนึ่ง */
export function acceptInvite(s: GameState, charId: string) {
  const clash = s.plans.filter((p) => p.day === s.dayIndex + 1 && !p.kept);
  s.plans.push({ charId, day: s.dayIndex + 1, kept: false });
  if (clash.length)
    remember(s, `รับนัด${nameOf(charId)}ทั้งที่รับ${nameOf(clash[0].charId)}ไว้แล้ว`);
  else remember(s, `รับนัด${nameOf(charId)}ไว้พรุ่งนี้หลังเลิกเรียน`);
}

/** นัดของวันนี้ที่ยังไม่ได้ไป — อาจมีมากกว่าหนึ่ง */
export const plansToday = (s: GameState) =>
  s.plans.filter((p) => !p.kept && p.day === s.dayIndex);

/** วันนี้มีนัดค้างอยู่กับใครไหม (เอาคนแรก) */
export const planToday = (s: GameState) => plansToday(s)[0] ?? null;

/** วันนี้รับนัดไว้ซ้อนกันกี่คน */
export const planClash = (s: GameState) => plansToday(s).length;

/** ที่นัดกันไว้คือช่วงหลังเลิกเรียน และต้องเจอตัวเขาที่นั่นจริง */
export const isPlanPeriod = (s: GameState) => periodOf(s) === C.planPeriod;

/** ไปตามนัดแล้ว — คืนแต้มความสัมพันธ์ที่ได้เพิ่ม (0 ถ้าไม่มีนัด) */
export function keepPlan(s: GameState, charId: string): number {
  // วันหนึ่งไปตามนัดได้คนเดียว — กฎนี้ต้องอยู่ตรงนี้ ไม่ใช่ปล่อยให้ชั้น UI บังคับเอง
  // ถ้าอยู่ที่ UI แล้ววันหนึ่ง UI เปลี่ยน กฎจะหายไปเงียบๆ พร้อมกับความหมายของการรับนัดซ้อน
  if (s.plans.some((x) => x.kept && x.day === s.dayIndex)) return 0;
  const p = plansToday(s).find((x) => x.charId === charId);
  if (!p || !isPlanPeriod(s)) return 0;
  p.kept = true;
  changeAffinity(s, charId, C.keptBonus);
  // ไปตามที่รับปากไว้คือหลักฐานชิ้นเดียวที่ไม่ต้องอธิบาย
  changeTrust(s, charId, game.trust.keptPlan);
  remember(s, `ไปตามนัด${nameOf(charId)}`);
  return C.keptBonus;
}

/** เรียกตอนขึ้นวันใหม่ — นัดที่รับไว้แล้วไม่ไป มีราคาต้องจ่าย
 *  วางไว้ในทางเดินของ `advance()` เพื่อให้ `npm run balance` เดินผ่านเองโดยไม่ต้องจำไปเรียก */
export function settleMissedPlan(s: GameState): { missed: number; chose: boolean } {
  const due = s.plans.filter((p) => p.day < s.dayIndex);
  if (!due.length) return { missed: 0, chose: false };
  // ถ้าวันนั้นรับไว้หลายคนแล้วไปหาคนหนึ่ง คนที่เหลือไม่ได้แค่ถูกลืม — เขารู้ว่าเราไปหาใคร
  const chosen = due.find((p) => p.kept);
  for (const p of due) {
    if (p.kept) continue;
    changeAffinity(s, p.charId, -C.missedPenalty);
    // ผิดนัดเสียความเชื่อใจหนักกว่าเสียความสนิท เพราะมันไม่ใช่เรื่องของเวลา แต่เป็นเรื่องของคำพูด
    changeTrust(s, p.charId, game.trust.missedPlan);
    if (chosen) {
      changeTrust(s, p.charId, game.trust.chosenOther);
      remember(s, `ผิดนัด${nameOf(p.charId)}เพราะไปหา${nameOf(chosen.charId)}`);
    } else remember(s, `ผิดนัด${nameOf(p.charId)}`);
  }
  s.plans = s.plans.filter((p) => p.day >= s.dayIndex);
  return { missed: due.filter((p) => !p.kept).length, chose: !!chosen };
}
