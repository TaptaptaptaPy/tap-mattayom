import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { changeAffinity, changeTrust } from "./bonds";
import { chapterOf, inChapter } from "./chapter";
import { plansToday } from "./chat";
import { periodId } from "./calendar";
import { lifeOf } from "./offscreen";
import { recall } from "./bonds";
import { remember, type GameState } from "./state";

/** โดนเห็นตอนอยู่กับอีกคน
 *
 *  ในภาค 3 ของ Persona ต้นฉบับ การถูกจับได้ว่าไปเดตกับอีกคน ทำให้ความสัมพันธ์
 *  "กลับด้าน" ซึ่งเป็นระบบที่ผู้เล่นเรียกร้องให้กลับมามากที่สุดหลังภาคหลังๆ ตัดมันทิ้ง
 *  เหตุผลที่มันดีคือ: มันทำให้การเลือกมีพยาน ไม่ใช่เรื่องที่รู้กันแค่เรากับตัวเลข
 *
 *  เกมนี้มีของที่ต้องใช้อยู่แล้วทั้งหมด — `where` ใน characters.json บอกว่าใครอยู่ที่ไหน
 *  ตอนไหน ไปหาพลอยที่ห้องสมุดหลังเลิกเรียน ปาล์มก็นั่งอยู่โต๊ะนั้นเหมือนกัน
 *
 *  ราคาไม่เท่ากันสองแบบ:
 *  - คนที่ *นัดเราไว้วันนี้* แล้วเห็นเราอยู่กับอีกคน — เขาไม่ได้แค่ถูกลืม เขาเห็นกับตา
 *  - คนที่ไม่ได้นัด แต่สนิทพอจะรู้สึก — เป็นระยะห่างที่ขยับทีละนิด ไม่ใช่การลงโทษ
 */

const S = game.seen;

const whereOf = (id: string, period: string): string | undefined =>
  (chars.find((c) => c.id === id) as { where?: Record<string, string> } | undefined)?.where?.[period];

const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id;

/** ใครอีกบ้างที่อยู่ตรงนั้นในช่วงเวลานี้ */
export function whoElseIsHere(s: GameState, metId: string): string[] {
  const period = periodId(s);
  const here = whereOf(metId, period);
  if (!here) return [];
  return chars
    .filter((c) => c.id !== metId && inChapter(c as { chapter?: string }, chapterOf(s)))
    .filter((c) => whereOf(c.id, period) === here)
    .map((c) => c.id);
}

export interface SeenReport { id: string; name: string; hadPlan: boolean; }

/** ไปอยู่กับคนนี้แล้วมีใครเห็นบ้าง — เรียกตอนที่เราไปหาใครสักคนจริงๆ
 *  ผลข้างเคียงทั้งหมดเกิดที่นี่ที่เดียว และวันละครั้งต่อคน */
export function seenWith(s: GameState, metId: string): SeenReport[] {
  const out: SeenReport[] = [];
  const booked = new Set(plansToday(s).filter((p) => !p.kept).map((p) => p.charId));

  for (const other of whoElseIsHere(s, metId)) {
    if (s.seenToday[other]) continue;
    const hadPlan = booked.has(other);
    // ไม่ได้นัดไว้และไม่ได้สนิทพอจะรู้สึกอะไร ก็แค่อยู่ห้องเดียวกันเฉยๆ
    if (!hadPlan && (s.affinity[other] ?? 0) < S.noticeAffinity) continue;
    s.seenToday[other] = true;

    if (hadPlan) {
      // ผิดนัดเฉยๆ ถูกคิดบัญชีที่ settleMissedPlan อยู่แล้ว ตรงนี้คือส่วนเพิ่มของการ *เห็นกับตา*
      changeAffinity(s, other, S.caughtAffinity);
      changeTrust(s, other, S.caughtTrust);
      lifeOf(s, other).pressure += S.caughtPressure;
      recall(s, other, `วันที่ฉันนั่งรออยู่ตรงนั้นแล้วเห็นนายเดินมากับ${nameOf(metId)}`);
      s.flags["caught_with_other"] = true;
      const line = `${nameOf(other)}เห็นเราอยู่กับ${nameOf(metId)} ทั้งที่วันนี้นัดกันไว้`;
      remember(s, line);
      s.offscreenNews.push(line);
    } else {
      changeAffinity(s, other, S.noticeAffinity2);
      s.flags["noticed_together"] = true;
      remember(s, `${nameOf(other)}อยู่ตรงนั้นด้วยตอนเราคุยกับ${nameOf(metId)}`);
    }
    out.push({ id: other, name: nameOf(other), hadPlan });
  }
  return out;
}
