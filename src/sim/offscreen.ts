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
    if (s.offscreenNews.length > 6) s.offscreenNews.shift();
  }
}

/** เรื่องที่เพิ่งรู้ว่าเกิดขึ้นตอนเราไม่อยู่ — ฝั่ง UI เอาไปขึ้นให้เห็นแล้วล้างทิ้ง */
export function takeNews(s: GameState): string[] {
  const n = s.offscreenNews;
  s.offscreenNews = [];
  return n;
}
