import game from "../../data/game.json";
import { remember, type GameState } from "./state";
import { addStrain } from "./home";

/** ครูประจำชั้น
 *
 *  ปัญหาเดิม: ฝ่ายปกครองเป็นกลไกล้วน — ทอยลูกเต๋า โดนจับ หักคะแนน จบ
 *  ไม่มีใครอยู่ตรงนั้นเลยสักคน ทั้งที่ในโรงเรียนไทยจริง ครูประจำชั้นที่จำชื่อเราได้
 *  คือความต่างระหว่าง "โดนหักคะแนน" กับ "โดนเรียกไปคุยแล้วให้โอกาสอีกครั้ง"
 *
 *  ครูไม่ใช่เพื่อน ความสัมพันธ์กับครูไม่ได้มาจากการไปหา — มันมาจาก *ความรับผิดชอบ*
 *  ส่งการบ้าน ตัดผม ไปสอบซ่อม = ครูเห็น · โดนจับ ไม่ส่งงาน = ครูเห็นเหมือนกัน
 *
 *  แล้วมันไปบรรจบกับสองระบบที่มีอยู่แล้ว:
 *  - ครูที่ไว้ใจเราจะกันเราไว้ตอนโดนจับ (ลดโทษ)
 *  - ครูที่ไม่ไว้ใจเราแล้วจะโทรหาที่บ้าน ซึ่งไปเพิ่มความตึงของบ้านโดยตรง
 */

const T = game.teacher;

export const teacherEye = (s: GameState) => s.teacher;

/** ครูเห็นสิ่งที่เราทำ — ทางเดียวที่ค่านี้ขยับ */
export function noteBehaviour(s: GameState, delta: number, why: string): void {
  const before = s.teacher;
  s.teacher = Math.max(0, Math.min(100, s.teacher + delta));
  if (before < T.trustedAt && s.teacher >= T.trustedAt) {
    s.flags["kru_trusts"] = true;
    remember(s, "ครูประจำชั้นเริ่มเรียกชื่อเราตอนสั่งงาน แทนที่จะชี้");
  }
  if (before > T.watchedAt && s.teacher <= T.watchedAt) {
    s.flags["kru_watches"] = true;
    remember(s, `ครูประจำชั้นเริ่มจับตาดูเรา (${why})`);
  }
}

export const teacherLevel = (s: GameState): number =>
  s.teacher >= T.trustedAt ? 2 : s.teacher > T.watchedAt ? 1 : 0;

export const teacherName = (s: GameState) => T.levelNames[teacherLevel(s)];

/** โดนจับแล้วครูกันไว้ให้ไหม — คืนโทษที่เหลือจริง
 *  ครูที่ไว้ใจเราไม่ได้ทำให้เราไม่ผิด เขาแค่เป็นคนที่พูดแทนเราได้ */
export function teacherShields(s: GameState, penalty: number): { penalty: number; saved: boolean } {
  if (teacherLevel(s) < 2) return { penalty, saved: false };
  const cut = Math.round(penalty * T.shieldFraction);
  if (cut <= 0) return { penalty, saved: false };
  s.flags["kru_spoke_for_us"] = true;
  remember(s, "ครูประจำชั้นเข้าไปคุยกับฝ่ายปกครองแทนเรา");
  return { penalty: penalty - cut, saved: true };
}

/** สัปดาห์ที่แย่พอ ครูโทรหาที่บ้าน — เรียกจาก `advance()` ตอนต้นสัปดาห์
 *  นี่คือจุดที่ฝ่ายปกครองกับเรื่องที่บ้านมาบรรจบกัน */
export function maybeCallHome(s: GameState): boolean {
  if (teacherLevel(s) > 0) return false;
  if (s.behaviour > game.behaviour.troubleAt) return false;
  // ครูไม่ได้โทรทุกสัปดาห์ — เรื่องเดิมโทรซ้ำทุกจันทร์ไม่ใช่การเล่าเรื่อง มันคือการกดตัวเลข
  if (s.dayIndex - s.teacherCalled < T.callCooldownDays) return false;
  s.teacherCalled = s.dayIndex;
  addStrain(s, T.callHomeStrain);
  s.flags["kru_called_home"] = true;
  const line = "ครูประจำชั้นโทรหาที่บ้าน แม่ไม่ได้เล่าให้ฟังว่าคุยอะไรกัน";
  remember(s, line);
  s.offscreenNews.push(line);
  return true;
}
