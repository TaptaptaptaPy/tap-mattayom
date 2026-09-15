import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { remember, trustRank, type GameState } from "./state";

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

// ───────────────────────── ความเชื่อใจ ─────────────────────────

const T = game.trust;
// TypeScript อ่าน JSON แล้วมองคู่ [ชื่อ, เลข] เป็น (string|number)[] ต้องผ่าน unknown ก่อน
const TRUST_FLAGS = game.trustFlags as unknown as Record<string, [string, number]>;

/** ความเชื่อใจ — คนละเรื่องกับความสนิท
 *
 *  ความสนิทวัดว่า "อยู่ด้วยกันมาเท่าไร" ความเชื่อใจวัดว่า "ฝากเรื่องไว้ได้ไหม"
 *  แกนเดียวทำให้ *ทำให้เขาสบายใจ* กับ *ทำในสิ่งที่ถูก* ให้ผลเหมือนกันหมด ซึ่งไม่จริงเลย
 *  พลอยชอบเราได้โดยไม่ให้เราแตะสมุดของเธอ และกนินไว้ใจเราได้ทั้งที่ไม่ได้อยากคุยด้วย
 *
 *  ความเชื่อใจไต่ช้ากว่าและเสียเร็วกว่าเสมอ นั่นคือเหตุผลที่มันแยกออกมา
 */
export function changeTrust(s: GameState, charId: string, amount: number): void {
  s.trust[charId] = Math.max(0, (s.trust[charId] ?? 0) + amount);
  // ความเชื่อใจเป็นเรื่องส่วนตัว ไม่กระจายเหมือนความสนิท — ยกเว้นตอนเสีย
  // เรื่องที่ทำให้คนหนึ่งเลิกไว้ใจเรา มักไปถึงหูคนที่เขาสนิทด้วยเสมอ
  if (amount >= 0) return;
  for (const [other, weight] of Object.entries(bondsOf(charId))) {
    if (other === charId || weight <= 0) continue;
    const shift = amount * weight * T.rippleLossScale;
    if (Math.abs(shift) < 0.05) continue;
    s.trust[other] = Math.max(0, (s.trust[other] ?? 0) + shift);
  }
}

/** ธงจากบทบางอันแปลว่าเราทำสิ่งที่ยากหรือซื่อสัตย์ บางอันแปลว่าเราเลือกทางที่สบายกว่า
 *  ตารางใน game.json แปลงธงพวกนั้นเป็นความเชื่อใจให้อัตโนมัติ
 *  ทางเลือก 79 อันที่เขียนไว้แล้วจึงมีน้ำหนักเพิ่มทันทีโดยไม่ต้องเขียนบทใหม่สักบรรทัด */
export function trustFromFlag(s: GameState, flag: string): void {
  const rule = TRUST_FLAGS[flag];
  if (!rule) return;
  changeTrust(s, rule[0], rule[1]);
}

export const trustOf = (s: GameState, charId: string) => s.trust[charId] ?? 0;
export const trustRankOf = (s: GameState, charId: string) => trustRank(trustOf(s, charId));

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
  // ยืนข้างใครคือการบอกว่าเราเป็นคนแบบไหน คนที่ถูกเลือกไว้ใจขึ้น คนที่ไม่ถูกเลือกไว้ใจน้อยลง
  changeTrust(s, charId, T.sideChosen);
  // คนที่ไม่ถูกกับคนที่เราเลือก (bond ติดลบ) จะถอยห่างออกไปอีก
  for (const c of chars) {
    if (c.id === charId) continue;
    const w = bondsOf(charId)[c.id] ?? 0;
    if (w < 0) { changeAffinity(s, c.id, B.sideCost * w); changeTrust(s, c.id, T.sideRefused); }
  }
}

/** อีกฝั่งยังเปิดอยู่ไหม — บทใช้เช็กก่อนจะยื่นทางเลือกที่ขัดกับที่เลือกไว้แล้ว */
export const sideOpen = (s: GameState, charId: string) => !s.sided || s.sided === charId;
