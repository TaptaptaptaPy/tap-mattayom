import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { affinityRank, trustRank, type GameState } from "./state";
import { chapterOf, inChapter } from "./chapter";

/** ฉากจบรายตัวละคร
 *
 *  ฉากจบของเทอมบอกว่า "เราไปถึงไหน" แต่ไม่ได้บอกว่า "แล้วเขาล่ะ"
 *  ซึ่งเป็นคำถามที่ค้างอยู่ทุกครั้งที่เล่นจบ
 *
 *  ที่สำคัญกว่านั้น: ตอนตรวจพบว่าธงในบท 79 อันถูกตั้งแต่มีแค่ 34 อันที่ถูกอ่าน
 *  แปลว่าทางเลือก 45 อันไม่ส่งผลอะไรเลยสักอย่าง ฉากจบรายคนคือที่ที่ธงพวกนั้นได้ทำงาน
 *  ทางเลือกที่จำได้ตอนเล่น จะได้ถูกเล่าคืนตอนจบ
 */

const E = game.epilogue;

export interface EpilogueEntry {
  charId: string;
  name: string;
  color: string;
  ink: string;
  rank: number;
  /** เขาไว้ใจเราถึงระดับไหนตอนจบ — บทฉากจบอ่านค่านี้เพื่อเลือกว่าจะเล่าอะไรให้ฟัง */
  trust: number;
}

/** ใครมีปลายทางให้ดูบ้าง เรียงจากสนิทที่สุดไปน้อยที่สุด
 *  คนที่เราแทบไม่รู้จักไม่มีปลายทาง เพราะเราไม่ได้อยู่ในเรื่องของเขา */
export function epilogues(s: GameState): EpilogueEntry[] {
  const ch = chapterOf(s);
  return chars
    .filter((c) => inChapter(c as { chapter?: string }, ch))
    .map((c) => ({
      charId: c.id,
      name: c.name,
      color: c.color,
      ink: (c as { epilogue?: string }).epilogue ?? `epi_${c.id}`,
      rank: affinityRank(s.affinity[c.id] ?? 0),
      trust: trustRank(s.trust[c.id] ?? 0),
    }))
    .filter((e) => e.rank >= E.minRank)
    .sort((a, b) => (s.affinity[b.charId] ?? 0) - (s.affinity[a.charId] ?? 0));
}

/** ฉากจบของตัวเราเอง — เล่นเสมอ ไม่ต้องสนิทกับใคร
 *  อ่านธงของเหตุการณ์ตามปฏิทินที่เดิมตั้งแล้วไม่มีใครอ่านเลย */
export const selfEpilogue = (s: GameState) =>
  E.selfAlways ? (chapterOf(s) === "uni" ? "epi_self_uni" : "epi_self") : null;

export const epilogueMinRank = E.minRank;
