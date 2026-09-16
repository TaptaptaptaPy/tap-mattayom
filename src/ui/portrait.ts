import chars from "../../data/characters.json";
import { asset } from "../core/asset";

/** ภาพตัวละคร
 *
 *  เคยวาดด้วย SVG จากโค้ดทั้งหมด ซึ่งได้เพดานอยู่แค่ "หกคนหน้าเดียวกัน ต่างแค่สีผม"
 *  ตอนนี้เป็นภาพที่ประกอบไว้ล่วงหน้าจากชิ้นส่วน CC0 ของ Tainara-P
 *  หนึ่งคนสิบภาพ ตามอารมณ์สิบแบบ ประกอบด้วย `node tools/sprites.mjs build`
 *
 *  สามอย่างที่เคยทำให้หน้าทุกคนดูเหมือน "คนโรคจิต" และแก้ไปแล้ว (ดู data/looks.json):
 *  หน้ากับคอคนละสีผิว · ม่านตาสีบานเย็น/ฟ้านีออน/เขียวนีออน · ไม่มีชั้นเงาเปลือกตา
 *
 *  ทำไมประกอบล่วงหน้าแทนที่จะซ้อนชั้นตอนรัน: ชิ้นส่วนหนึ่งตัวมีสิบเอ็ดชั้น
 *  ถ้าซ้อนตอนรันต้องโหลดสิบเอ็ดไฟล์ต่อหนึ่งภาพ และลำดับชั้นผิดได้ทุกที่ที่เรียก
 *  ประกอบไว้ก่อนแล้วเหลือไฟล์เดียวต่อหนึ่งอารมณ์ ทั้งเบากว่าและพังยากกว่า
 */
/** สิบอารมณ์ ตรงกับ `moods` ใน data/looks.json — เพิ่มอันไหนต้องเพิ่มทั้งสองที่แล้ว build ใหม่ */
export type Mood = "calm" | "happy" | "laugh" | "shy" | "sad"
                 | "away" | "think" | "firm" | "angry" | "shock";
export const MOODS: Mood[] =
  ["calm", "happy", "laugh", "shy", "sad", "away", "think", "firm", "angry", "shock"];

const HAS = new Set(chars.map((c) => c.id));

/** ผู้บรรยาย — ไม่มีตัวตน จึงเป็นธงโรงเรียนแทนหน้าคน
 *  ยังวาดด้วย SVG เพราะไม่ได้เป็นใครที่ต้องมีสีหน้า */
const NARRATOR = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="pnar">
  <rect width="120" height="120" fill="#241f36"/>
  <g stroke="#8d80a6" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M44 96h40M56 96V28"/></g>
  <path d="M56 32h34l-9 11 9 11H56z" fill="#cfc8e8" opacity=".85"/>
  <circle cx="56" cy="26" r="3.5" fill="#e8c96a"/>
</svg>`;

/** ภาพของตัวละครหนึ่งคนตามอารมณ์ — คืนเป็น HTML พร้อมใส่ลงใน innerHTML ได้เลย
 *  `charId` เป็น null เมื่อไม่มีใครพูด (ผู้บรรยาย) */
export function portraitHTML(charId: string | null, mood: Mood = "calm"): string {
  if (!charId || !HAS.has(charId)) return NARRATOR;
  const c = chars.find((x) => x.id === charId)!;
  // decoding="sync" เพื่อไม่ให้ภาพกะพริบตอนเปลี่ยนสีหน้ากลางประโยค
  return `<img class="pface" src="${asset(`assets/portraits/${charId}-${mood}.webp`)}"
    alt="${c.name}" width="420" height="420" decoding="sync">`;
}

/** ไอคอนเล็กไว้ใช้ในปุ่มและรายการ */
export function avatarChip(charId: string, size = 34): string {
  return `<span class="avatar" style="width:${size}px;height:${size}px">${portraitHTML(charId)}</span>`;
}
