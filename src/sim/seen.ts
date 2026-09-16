import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { changeAffinity, changeTrust } from "./bonds";
import { plansToday } from "./chat";
import { periodId } from "./calendar";
import { lifeOf } from "./offscreen";
import { recall } from "./bonds";
import { whereIs } from "./presence";
import { trait } from "./traits";
import { remember, type GameState } from "./state";

/** โดนเห็นตอนอยู่กับอีกคน
 *
 *  ในภาค 3 ของ Persona ต้นฉบับ การถูกจับได้ว่าไปเดตกับอีกคน ทำให้ความสัมพันธ์
 *  "กลับด้าน" ซึ่งเป็นระบบที่ผู้เล่นเรียกร้องให้กลับมามากที่สุดหลังภาคหลังๆ ตัดมันทิ้ง
 *  เหตุผลที่มันดีคือ: มันทำให้การเลือกมีพยาน ไม่ใช่เรื่องที่รู้กันแค่เรากับตัวเลข
 *
 *  ตั้งแต่ตารางชีวิตกลายเป็นการทอย (ดู src/sim/presence.ts) พยานก็กลายเป็นเรื่องบังเอิญจริงๆ
 *  วันนี้ไปหาพลอยที่ห้องสมุดแล้วปาล์มบังเอิญนั่งอยู่โต๊ะนั้น พรุ่งนี้อาจไม่มีใครเห็นเลย
 *  ซึ่งดีกว่าของเดิมที่คู่เดิมเห็นกันทุกครั้งจนผู้เล่นจำได้ว่าห้องไหน "ห้ามไป"
 *
 *  ราคาไม่เท่ากันสองแบบ:
 *  - คนที่ *นัดเราไว้วันนี้* แล้วเห็นเราอยู่กับอีกคน — เขาไม่ได้แค่ถูกลืม เขาเห็นกับตา
 *  - คนที่ไม่ได้นัด แต่สนิทพอจะรู้สึก — เป็นระยะห่างที่ขยับทีละนิด ไม่ใช่การลงโทษ
 */

const S = game.seen;

const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id;

/** ใครอีกบ้างที่อยู่ตรงนั้นในช่วงเวลานี้
 *  `at` คือที่ที่เราไปเจอเขาจริงๆ — ส่งเข้ามาเพราะคนหนึ่งคนอยู่ได้หลายที่แล้ว */
export function whoElseIsHere(s: GameState, metId: string, at?: string): string[] {
  const period = periodId(s);
  const bonus = trait(s, "encounter", 0);
  const here = at ?? whereIs(s, metId, period, bonus);
  if (!here) return [];
  return chars
    .filter((c) => c.id !== metId)
    .filter((c) => whereIs(s, c.id, period, bonus) === here)
    .map((c) => c.id);
}

export interface SeenReport { id: string; name: string; hadPlan: boolean; }

/** ไปอยู่กับคนนี้แล้วมีใครเห็นบ้าง — เรียกตอนที่เราไปหาใครสักคนจริงๆ
 *  ผลข้างเคียงทั้งหมดเกิดที่นี่ที่เดียว และวันละครั้งต่อคน */
export function seenWith(s: GameState, metId: string, at?: string): SeenReport[] {
  const out: SeenReport[] = [];
  const booked = new Set(plansToday(s).filter((p) => !p.kept).map((p) => p.charId));

  for (const other of whoElseIsHere(s, metId, at)) {
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
