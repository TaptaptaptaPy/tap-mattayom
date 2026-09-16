import game from "../../data/game.json";
import { recall } from "./bonds";
import { learnHabit } from "./presence";
import { maxEnergy, trait, backgroundById, type Background } from "./traits";
import { remember, type GameState, type StatId } from "./state";

/** ภูมิหลังของตัวเรา — ของที่เกิดขึ้นก่อนวันแรกของเทอม
 *
 *  ปัญหาเดิม: ทุกรอบเริ่มเหมือนกันหมด ค่าสถานะศูนย์ ไม่มีใครรู้จักเรา เงินเท่ากัน
 *  รอบสองจึงเป็นแค่ "ตัดสินใจใหม่ด้วยของเดิม" ไม่ใช่ชีวิตอีกแบบ
 *
 *  ภูมิหลังเปลี่ยนสามอย่างพร้อมกัน ซึ่งเป็นสามอย่างที่ทำให้เล่นซ้ำแล้วไม่เหมือนเดิม:
 *  1. ค่าสถานะและเงินตั้งต้น — จุดที่เราออกตัวไม่เท่ากัน
 *  2. คนที่รู้จักเราอยู่แล้ว — บางคนไม่ต้องไปบังเอิญเจอ เพราะรู้จักกันมาก่อนหน้านี้
 *     และเรารู้ด้วยว่าเขามักไปนั่งตรงไหน ซึ่งเป็นของที่คนอื่นต้องใช้เวลาเรียนรู้เอง
 *  3. กฎบางข้อของโลก (`traits` ใน `traits.ts`) — ค่าขนม โอกาสโดนจับ ค่าแรง เพดานแรง
 *
 *  กติกา: ตัวเลขทุกตัวอยู่ใน `data/backgrounds.json` ไฟล์นี้แค่เอาไปใช้
 */

export * from "./traits";

/** เริ่มเทอมด้วยภูมิหลังนี้ — เรียกครั้งเดียวตอนสร้างเกมใหม่เท่านั้น */
export function applyBackground(s: GameState, id: string): Background | null {
  const bg = backgroundById(id);
  if (!bg) return null;
  s.background = bg.id;

  for (const [k, v] of Object.entries(bg.stats)) s.stats[k as StatId] += v as number;
  const st = bg.start;
  if (st.money !== undefined) s.money = st.money;
  if (st.standing !== undefined) s.standing = st.standing;
  if (st.teacher !== undefined) s.teacher = st.teacher;
  if (st.behaviour !== undefined) s.behaviour = st.behaviour;
  if (st.study !== undefined) s.study = st.study;
  if (st.homeStrain !== undefined) s.home.strain = st.homeStrain;
  // เกรดตั้งต้นของเด็กที่เคยอยู่ห้องคิง — ความรู้เก่ายังอยู่ ไม่ได้หายไปพร้อมห้อง
  const gradeHead = trait(s, "grade", 0);
  if (gradeHead) for (const k of Object.keys(s.grades)) s.grades[k] += gradeHead;
  // แรงตั้งต้นต้องอยู่ในเพดานของภูมิหลังนี้ ไม่ใช่เพดานกลาง
  s.energy = maxEnergy(s);

  // คนที่รู้จักเราอยู่ก่อนวันแรก — ไม่ต้องบังเอิญเจอ และเขาจำเรื่องเก่าได้ด้วย
  for (const k of bg.knows) {
    s.affinity[k.id] = (s.affinity[k.id] ?? 0) + k.affinity;
    s.trust[k.id] = (s.trust[k.id] ?? 0) + k.trust;
    s.met[k.id] = 0;
    recall(s, k.id, k.memory);
    // รู้จักกันมาก่อนแปลว่ารู้ด้วยว่าเขามักไปนั่งตรงไหน — ของที่คนอื่นต้องใช้เวลาเรียนรู้เอง
    for (const h of k.habits ?? []) {
      const [period, loc] = h.split(":");
      learnHabit(s, k.id, period, loc, game.presence.knowAt);
    }
  }
  remember(s, `เปิดเทอมในฐานะ${bg.name}`);
  return bg;
}
