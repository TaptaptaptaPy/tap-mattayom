import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { affinityRank, remember, trustRank, type GameState } from "./state";
import { changeAffinity, changeTrust } from "./bonds";
import { chapterOf, inChapter } from "./chapter";

/** ตัวละครมีชีวิตตอนเราไม่อยู่
 *
 *  ปัญหาเดิม: ตัวละครมีชีวิตเฉพาะตอนเราเดินไปหา ไม่ไปก็เหมือนเวลาหยุดรอให้
 *  ซึ่งทำให้การเลือกว่าจะไปหาใครไม่มีราคาอะไรเลย — ไม่ไปวันนี้ พรุ่งนี้ก็เหมือนเดิม
 *
 *  ที่นี่แรงกดดันของแต่ละคนเดินขึ้นทุกวัน เร็วขึ้นถ้าเราไม่ไปหา
 *  ความสนิทและความเชื่อใจช่วยผ่อนแรง เพราะเขามีที่ให้พิง
 *  พอถึงจุดหนึ่ง เรื่องเกิดขึ้นโดยที่เราไม่อยู่ตรงนั้น แล้วเรามารู้ทีหลัง
 *
 *  กติกา: ผู้เล่นต้อง *รู้* ว่ามันเกิดขึ้น ไม่งั้นมันไม่ต่างจากไม่มีระบบนี้เลย
 *  ทุกเหตุการณ์จึงถูกเขียนลงสมุดบันทึกของเทอมเสมอ และตั้งธงให้บทหยิบไปพูดถึงได้
 */

const O = game.offscreen;
type Ev = [string, string, number];
const EVENTS = game.offscreenEvents as unknown as Record<string, Ev[]>;

export interface Life { pressure: number; lastSeen: number; fired: number; cooldown: number; }

export const lifeOf = (s: GameState, id: string): Life =>
  (s.lives[id] ??= { pressure: 0, lastSeen: -1, fired: 0, cooldown: 0 });

/** เราไปหาเขาแล้ววันนี้ — แรงกดดันลดลง เพราะมีคนฟัง */
export function visited(s: GameState, charId: string): void {
  const l = lifeOf(s, charId);
  l.lastSeen = s.dayIndex;
  l.pressure = Math.max(0, l.pressure - O.visitRelief);
}

/** เดินหนึ่งวันของทุกคน — เรียกจาก `advance()` ตอนขึ้นวันใหม่
 *  วางไว้ในทางเดินหลักเพื่อให้เทสต์สมดุลเดินผ่านเองโดยไม่ต้องจำไปเรียก */
export function stepLives(s: GameState): void {
  const ch = chapterOf(s);
  for (const c of chars) {
    if (!inChapter(c as { chapter?: string }, ch)) continue;
    const l = lifeOf(s, c.id);
    if (l.cooldown > 0) l.cooldown--;

    const away = l.lastSeen < 0 ? 3 : Math.min(9, s.dayIndex - l.lastSeen);
    const relief = affinityRank(s.affinity[c.id] ?? 0) * O.reliefPerCloseRank
                 + trustRank(s.trust[c.id] ?? 0) * O.reliefPerTrustRank;
    l.pressure = Math.max(0, l.pressure + O.risePerDay + away * O.risePerDayAway - relief);

    if (l.pressure < O.threshold || l.cooldown > 0) continue;
    const list = EVENTS[c.id];
    if (!list || l.fired >= list.length) continue;

    const [flag, line, hit] = list[l.fired];
    l.fired++;
    l.pressure = 0;
    l.cooldown = O.cooldownDays;
    s.flags[flag] = true;
    changeAffinity(s, c.id, hit);
    changeTrust(s, c.id, hit * 0.5);
    remember(s, line);
    s.offscreenNews.push(line);
    gossip(s, c.id);
    if (s.offscreenNews.length > 6) s.offscreenNews.shift();
  }
}

/** เขาเอาเรื่องของเราไปเล่าให้เพื่อนฟัง
 *
 *  Tokimeki Memorial เรียกระบบนี้ว่า "ระเบิด" — คนที่ถูกปล่อยไว้นานพอจะไม่ได้แค่เสียใจ
 *  เขาไปเล่าให้เพื่อนฟัง แล้วความสัมพันธ์กับทั้งวงลดลงพร้อมกัน ผู้เล่นที่จีบหลายคน
 *  จึงต้องวางแผนจริงๆ ไม่ใช่แค่เลือกคนที่ชอบที่สุดแล้วทุ่มให้คนเดียว
 *
 *  เกมนี้มีแผนที่ว่าใครคุยกับใครอยู่แล้ว (`bonds` ใน characters.json) และ
 *  `changeAffinity()` ก็กระจายระลอกให้อยู่แล้ว — แต่ระลอกนั้นเล็กเกินกว่าจะรู้สึก
 *  ระเบิดคือระลอกที่ *ตั้งใจให้รู้สึก* และเกิดเฉพาะตอนที่เราปล่อยเขาไว้จนมีเรื่อง
 *
 *  กติกาเดิมยังอยู่: ผู้เล่นต้องได้รู้ว่ามันเกิด
 */
function gossip(s: GameState, fromId: string): void {
  const src = chars.find((c) => c.id === fromId) as { bonds?: Record<string, number> } | undefined;
  const bonds = src?.bonds ?? {};
  const told: string[] = [];
  for (const [other, weight] of Object.entries(bonds)) {
    if (weight < O.gossipMinBond) continue;
    const c = chars.find((x) => x.id === other);
    if (!c || !inChapter(c as { chapter?: string }, chapterOf(s))) continue;
    changeAffinity(s, other, O.gossipHit * weight / O.gossipMinBond);
    told.push(c.name);
  }
  if (!told.length) return;
  const line = `เรื่องนี้ไปถึง${told.join("กับ")}แล้ว`;
  remember(s, line);
  s.offscreenNews.push(line);
  s.flags["gossip_spread"] = true;
}

/** เรื่องที่เพิ่งรู้ว่าเกิดขึ้นตอนเราไม่อยู่ — ฝั่ง UI เอาไปขึ้นให้เห็นแล้วล้างทิ้ง */
export function takeNews(s: GameState): string[] {
  const n = s.offscreenNews;
  s.offscreenNews = [];
  return n;
}
