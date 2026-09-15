import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { affinityRank, remember, trustRank, type GameState } from "./state";
import { changeTrust } from "./bonds";
import { chapterOf, inChapter } from "./chapter";
import { lifeOf } from "./offscreen";

/** คนอื่นก็ชอบเขาเหมือนกัน
 *
 *  เกมแนวนี้เกือบทุกเกมมีคู่แข่ง — Tokimeki มี Yandere Simulator ทั้งเกมสร้างรอบเรื่องนี้
 *  เหตุผลที่มันดีไม่ใช่เพราะ "มีศัตรู" แต่เพราะมันทำให้ *เวลา* มีราคาขึ้นมาทันที
 *  ไม่ไปหาเขาวันนี้ไม่ได้แปลว่าพรุ่งนี้ค่อยไปก็ได้ มันแปลว่ามีคนอื่นไปแทนเรา
 *
 *  คู่แข่งที่นี่ไม่มีภาพ ไม่มีบท และไม่เคยปรากฏตัว — เหมือนครูประจำชั้น
 *  เขาเป็นชื่อที่ตัวละครเอ่ยถึงเอง ซึ่งเป็นวิธีที่คนจริงๆ รู้เรื่องพวกนี้อยู่แล้ว
 *
 *  และทางออกไม่ใช่การกำจัดเขา — เกมนี้ไม่มีปุ่มนั้น
 *  มีแค่สองทาง: ลงเวลาให้มากกว่า หรือยินดีกับเขาแล้วได้ความเชื่อใจแทน
 */

const R = game.rival;

export interface RivalInfo { name: string; blurb: string }

export const rivalOf = (id: string): RivalInfo | null =>
  ((chars.find((c) => c.id === id) as { rival?: RivalInfo } | undefined)?.rival) ?? null;

const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id;

export const rivalScore = (s: GameState, id: string) => s.rivals[id] ?? 0;

/** เรานำอยู่เท่าไหร่ — ติดลบแปลว่าเขานำ */
export const rivalLead = (s: GameState, id: string) =>
  Math.round((s.affinity[id] ?? 0) - rivalScore(s, id));

export const rivalAhead = (s: GameState, id: string) => rivalLead(s, id) <= -R.aheadBy;

/** เดินหนึ่งวันของคู่แข่งทุกคน — เรียกจาก `advance()` ตอนขึ้นวันใหม่
 *  วางไว้ในทางเดินหลักเพื่อให้เทสต์สมดุลเดินผ่านเองโดยไม่ต้องจำไปเรียก */
export function stepRivals(s: GameState): void {
  const ch = chapterOf(s);
  for (const c of chars) {
    if (!inChapter(c as { chapter?: string }, ch)) continue;
    if (!rivalOf(c.id)) continue;
    if (s.conceded[c.id]) continue;   // ยกให้เขาไปแล้ว เรื่องนี้จบไปแล้ว
    // คนที่เราไม่เคยเริ่มอะไรด้วยเลยไม่มี "คู่แข่ง" — เขาแค่มีชีวิตของเขา
    // ถ้าไม่กันตรงนี้ ธง rival_*_ahead จะขึ้นครบทุกคนทุกรอบจนกลายเป็นเสียงรบกวน
    //
    // แต่เกณฑ์นี้ใช้ครั้งเดียวตอน *เริ่ม* เท่านั้น ห้ามเช็กซ้ำทุกวัน
    // เพราะเรื่องที่เกิดลับหลังกับข่าวที่แพร่ไปทั้งวงกดความสนิทลงได้เอง
    // ถ้าเช็กซ้ำ ความสนิทที่ตกต่ำกว่าเกณฑ์จะไป *หยุด* คู่แข่งไว้ ซึ่งกลับหัวกลับหาง:
    // ยิ่งเราทิ้งเขา คู่แข่งยิ่งควรได้ที่ ไม่ใช่ยิ่งหยุดเดิน
    if (s.rivals[c.id] === undefined) {
      if (affinityRank(s.affinity[c.id] ?? 0) < R.minRank) continue;
      s.rivals[c.id] = 0;
    }

    const l = lifeOf(s, c.id);
    const away = l.lastSeen < 0 ? R.awayCap : Math.min(R.awayCap, s.dayIndex - l.lastSeen);
    // ยิ่งเราไม่ไป เขายิ่งได้ที่ · ความเชื่อใจที่เราสร้างไว้ถ่วงเขาไว้ได้ แต่ความสนิทเฉยๆ ถ่วงไม่ได้
    // เพราะสิ่งที่คู่แข่งแข่งด้วยคือ *เวลา* ไม่ใช่ความรู้สึก
    const hold = trustRank(s.trust[c.id] ?? 0) * R.holdPerTrustRank;
    const gain = R.risePerDay + away * R.risePerDayAway - hold;
    const before = rivalScore(s, c.id);
    s.rivals[c.id] = Math.max(0, Math.min(R.max, before + gain));

    if (!rivalAhead(s, c.id)) continue;
    if (s.flags[`rival_${c.id}_ahead`]) continue;
    // ผู้เล่นต้องได้รู้ ไม่งั้นมันเป็นแค่ตัวเลขที่แพ้ไปแล้วโดยไม่รู้ตัว
    s.flags[`rival_${c.id}_ahead`] = true;
    s.flags["rival_ahead"] = true;
    const r = rivalOf(c.id)!;
    const line = `${nameOf(c.id)}เริ่มพูดถึง${r.name}บ่อยกว่าพูดถึงเรา`;
    remember(s, line);
    s.offscreenNews.push(line);
  }
}

/** ยินดีกับเขา — ไม่ใช่การยอมแพ้ มันคือการเลือกอีกอย่างหนึ่ง
 *  ความสนิทหยุดโตตรงนั้น แต่ความเชื่อใจขึ้น เพราะคนที่พูดแบบนั้นได้มีไม่เยอะ */
export function concede(s: GameState, id: string): void {
  if (s.conceded[id]) return;
  s.conceded[id] = true;
  changeTrust(s, id, R.concedeTrust);
  s.flags["let_them_go"] = true;
  const r = rivalOf(id);
  remember(s, `บอก${nameOf(id)}ไปตรงๆ ว่าดีใจด้วยเรื่อง${r?.name ?? "เขา"}`);
}

/** ปิดทางลึกไว้ถ้าเขาไปไกลแล้ว — บทใช้กั้นทางเลือกที่ควรปิด */
export const stillOurs = (s: GameState, id: string) =>
  !s.conceded[id] && (!rivalAhead(s, id) || affinityRank(s.affinity[id] ?? 0) >= R.keepAtRank);
