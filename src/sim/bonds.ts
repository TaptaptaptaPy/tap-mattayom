import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { remember, type GameState } from "./state";

/** ผลกระทบข้ามตัวละคร และชื่อเสียงในโรงเรียน
 *
 *  ปัญหาเดิม: ทางเลือกทุกอันส่งผลกับคนที่อยู่ตรงหน้าคนเดียว
 *  เข้าข้างกนินต่อหน้าพลอยแล้วพลอยไม่รู้สึกอะไรเลย ทั้งที่ทั้งคู่อยู่ห้องเดียวกัน
 *  โรงเรียนจริงไม่ได้ทำงานแบบนั้น — เรื่องมันไปถึงหูกันเสมอ
 *
 *  ที่นี่ทุกครั้งที่ความสัมพันธ์กับใครขยับ วงของคนนั้นขยับตามตาม `bonds` ใน characters.json
 *  หัวหน้าห้องกับเด็กหลังห้องไม่ถูกกัน สนิทกับฝั่งหนึ่งมากขึ้น อีกฝั่งก็ห่างออกไป
 *  ไม่ใช่การลงโทษ แต่คือการบังคับให้ *เลือก* ว่าจะเป็นใครในสายตาใคร
 */

const B = game.bonds;

type BondMap = Record<string, number>;
const bondsOf = (charId: string): BondMap =>
  ((chars.find((c) => c.id === charId) as { bonds?: BondMap } | undefined)?.bonds) ?? {};

/** เปลี่ยนความสัมพันธ์กับคนหนึ่ง แล้วให้วงของเขาขยับตาม
 *  ทุกที่ในเกมต้องเรียกผ่านฟังก์ชันนี้ ไม่ใช่เขียน `s.affinity[id] += n` ตรงๆ
 *  ไม่งั้นระลอกจะหายไปเงียบๆ เฉพาะทางนั้น */
export function changeAffinity(s: GameState, charId: string, amount: number): void {
  s.affinity[charId] = Math.max(0, (s.affinity[charId] ?? 0) + amount);
  if (Math.abs(amount) < B.rippleFloor) return;
  for (const [other, weight] of Object.entries(bondsOf(charId))) {
    if (other === charId) continue;
    const shift = amount * weight * B.rippleScale;
    if (Math.abs(shift) < 0.05) continue;
    s.affinity[other] = Math.max(0, (s.affinity[other] ?? 0) + shift);
  }
}

// ───────────────────────── ชื่อเสียงในโรงเรียน ─────────────────────────

/** ชื่อเสียงคือสิ่งที่คนที่ยังไม่รู้จักเราใช้ตัดสินเรา
 *  ต่างจากความประพฤติตรงที่ความประพฤติเป็นของฝ่ายปกครอง ส่วนชื่อเสียงเป็นของทั้งโรงเรียน */
export function shiftStanding(s: GameState, amount: number, why?: string): void {
  const before = s.standing;
  s.standing = Math.max(0, Math.min(100, s.standing + amount));
  if (why && Math.abs(s.standing - before) >= 1) remember(s, why);
}

export const standingLabel = (v: number) =>
  v >= B.famous ? "ทั้งโรงเรียนรู้จัก"
  : v >= B.known ? "มีคนรู้จักพอสมควร"
  : v >= B.plain ? "เป็นคนธรรมดาในสายตาคนอื่น"
  : v >= B.talked ? "มีคนนินทาอยู่บ้าง"
  : "ชื่อเสียงเสียหายไปแล้ว";

/** บางบทเปิดได้ต่อเมื่อคนอื่นในโรงเรียนมองเราแบบหนึ่งแล้วเท่านั้น */
export const standingRank = (v: number) =>
  v >= B.famous ? 4 : v >= B.known ? 3 : v >= B.plain ? 2 : v >= B.talked ? 1 : 0;

// ───────────────────────── การเลือกข้าง ─────────────────────────

/** ปลายเทอมมีจุดที่ต้องเลือกว่าจะยืนข้างใคร เลือกแล้วอีกฝั่งปิดถาวร
 *  นี่คือจุดที่ทำให้เล่นรอบเดียวไม่มีทางเห็นครบ ซึ่งเป็นเรื่องตั้งใจ */
export function takeSide(s: GameState, charId: string): void {
  if (s.sided) return;
  s.sided = charId;
  const name = chars.find((c) => c.id === charId)?.name ?? charId;
  remember(s, `เลือกยืนข้าง${name}`);
  // คนที่ไม่ถูกกับคนที่เราเลือก (bond ติดลบ) จะถอยห่างออกไปอีก
  for (const c of chars) {
    if (c.id === charId) continue;
    const w = bondsOf(charId)[c.id] ?? 0;
    if (w < 0) changeAffinity(s, c.id, B.sideCost * w);
  }
}

/** อีกฝั่งยังเปิดอยู่ไหม — บทใช้เช็กก่อนจะยื่นทางเลือกที่ขัดกับที่เลือกไว้แล้ว */
export const sideOpen = (s: GameState, charId: string) => !s.sided || s.sided === charId;
