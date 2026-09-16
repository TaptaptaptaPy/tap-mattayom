import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { affinityRank, type GameState } from "./state";
import { chapterOf, inChapter } from "./chapter";
import { clubOf, clubToday } from "./club";
import { isPlanPeriod, plansToday } from "./chat";

/** ใครอยู่ตรงไหน — และทำไมมันถึงต้องเป็นเรื่องบังเอิญ
 *
 *  ปัญหาเดิม: `where` ใน characters.json บอกว่าพลอยอยู่ห้องสมุดทุกเย็นตลอด 120 วัน
 *  ผู้เล่นจึงไม่ได้ *เจอ* ใครเลยสักครั้ง เขาแค่ไปเบิกคนจากตู้ที่รู้อยู่แล้วว่าอยู่ช่องไหน
 *  และกระดานเลือกที่ไปก็เขียนชื่อทุกคนไว้ล่วงหน้าตั้งแต่ก่อนเดินออกจากห้อง
 *
 *  ที่นี่แต่ละคนมี *ตารางชีวิต* ไม่ใช่ตำแหน่งตายตัว — เป็นน้ำหนักว่าช่วงเวลานี้
 *  เขามีแนวโน้มจะอยู่ที่ไหนบ้าง และมีโอกาสที่วันนั้นเขาจะไม่อยู่ที่ไหนที่เราเดินไปถึงเลย
 *  ผลของการทอยคงที่ตลอดช่วงเวลานั้น (ทอยจากวัน+ช่วง+เมล็ดของเซฟ) ไม่ใช่สุ่มใหม่ทุกครั้งที่วาดจอ
 *
 *  สามทางที่ทำให้ "เจอแน่ๆ" ซึ่งทั้งสามทางคือการ *นัดแนะ* ไม่ใช่ความบังเอิญ:
 *  1. รับนัดทางไลน์ไว้ — เขาไปรอที่นั่นจริง
 *  2. อยู่ชมรมเดียวกันและวันนี้เป็นวันซ้อม — เพื่อนร่วมชมรมอยู่ที่ห้องชมรมแน่นอน
 *  3. รู้จักเขามาก่อนหน้าเทอม (ภูมิหลัง) หรือเจอเขาที่เดิมมาหลายครั้งจนรู้ตาราง
 *     ข้อสามไม่ได้การันตีว่าเจอ แต่บอกล่วงหน้าว่า "เขามักอยู่แถวนี้" ซึ่งคือสิ่งที่
 *     การรู้จักใครสักคนจริงๆ ให้ — ไม่ใช่พิกัดที่แน่นอน แต่เป็นความน่าจะเป็นที่ดีขึ้น
 */

const P = game.presence;
type Routine = Record<string, Record<string, number>>;

const routineOf = (charId: string): Routine =>
  ((chars.find((c) => c.id === charId) as { routine?: Routine } | undefined)?.routine) ?? {};

/** ที่ที่เขาไปรอเวลามีนัด — ที่ที่เขาอยู่บ่อยที่สุดในช่วงหลังเลิกเรียน */
export function meetSpot(charId: string): string | null {
  const c = chars.find((x) => x.id === charId) as { meetAt?: string } | undefined;
  if (c?.meetAt) return c.meetAt;
  const after = routineOf(charId)[game.chat.planPeriod] ?? {};
  let best: string | null = null, bw = 0;
  for (const [loc, w] of Object.entries(after)) if (w > bw) { bw = w; best = loc; }
  return best;
}

/** ทอยที่คงที่สำหรับ (เมล็ด, คน, วัน, ช่วงเวลา) — ค่าเดิมเสมอตราบใดที่ยังอยู่ช่วงเดียวกัน
 *  ถ้าใช้ Math.random() ตรงนี้ คนจะกระพริบเข้าออกทุกครั้งที่หน้าจอวาดใหม่ */
function roll(seed: number, charId: string, day: number, period: string): number {
  let h = 2166136261 ^ seed;
  const key = `${charId}|${day}|${period}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** เขาอยู่ที่ไหนในช่วงเวลานี้ — null คือวันนี้ช่วงนี้ไม่อยู่ที่ไหนที่เราเดินไปถึง
 *  `bonus` คือของภูมิหลัง (เช่นเด็กย้ายมาใหม่เจอคนง่ายกว่า) ส่งเข้ามาจาก whoIsAt() */
export function whereIs(s: GameState, charId: string, period: string, bonus = 0): string | null {
  const c = chars.find((x) => x.id === charId);
  if (!c || !inChapter(c as { chapter?: string }, chapterOf(s))) return null;

  // นัดไว้แล้วคือการนัดแนะ ไม่ใช่ความบังเอิญ — เขาไปรอที่นั่นจริง
  if (period === game.chat.planPeriod && plansToday(s).some((p) => p.charId === charId))
    return meetSpot(charId);

  // อยู่ชมรมเดียวกันและวันนี้ซ้อม — ตารางของชมรมคือการนัดแนะที่ตกลงกันไว้แล้วทั้งเทอม
  const club = clubToday(s);
  // ชมรมบำเพ็ญประโยชน์ไม่มีสมาชิกที่เป็นตัวละคร รายชื่อจึงถูกอ่านเป็น never[] ต้องกางชนิดเอง
  const members = (clubOf(s)?.members ?? []) as string[];
  if (club && period === game.chat.planPeriod && members.includes(charId))
    return club.location;

  const table = routineOf(charId)[period];
  if (!table) return null;

  const r = roll(s.seed, charId, s.dayIndex, period);
  // โบนัสจากภูมิหลังบีบช่องว่างของ "ไม่อยู่ที่ไหนเลย" ให้แคบลง ไม่ได้ย้ายที่ของเขา
  const scale = 1 - Math.max(-0.4, Math.min(0.4, bonus));
  let acc = 0;
  for (const [loc, w] of Object.entries(table)) {
    acc += w / 100;
    if (r * scale < acc) return loc;
  }
  return null;
}

/** ใครอยู่ที่นี่ตอนนี้บ้าง — คนที่เราคุยไปแล้ววันนี้ไม่นับ (เขาเดินไปทำอย่างอื่นแล้ว) */
export function whoIsAt(s: GameState, locId: string, period: string, bonus = 0): string[] {
  const out: string[] = [];
  for (const c of chars) {
    if (s.metToday[c.id]) continue;
    if (whereIs(s, c.id, period, bonus) === locId) out.push(c.id);
    if (out.length >= P.maxPerPlace) break;
  }
  return out;
}

// ───────────────────── การรู้ตารางชีวิตของคนอื่น ─────────────────────

const habitKey = (charId: string, period: string, loc: string) => `${charId}|${period}|${loc}`;

/** เจอเขาที่นี่อีกครั้ง — ความรู้เรื่องตารางของเขาขยับขึ้นหนึ่ง */
export function learnHabit(s: GameState, charId: string, period: string, loc: string, n = 1): void {
  const k = habitKey(charId, period, loc);
  s.habits[k] = Math.min(P.knowAt * 2, (s.habits[k] ?? 0) + n);
}

export const habitCount = (s: GameState, charId: string, period: string, loc: string) =>
  s.habits[habitKey(charId, period, loc)] ?? 0;

/** เรารู้ไหมว่าใครมักอยู่ที่นี่ตอนนี้ — คืนรายชื่อคนที่เจอที่นี่บ่อยพอจะเรียกว่ารู้
 *  นี่คือของที่ *การรู้จักใครสักคน* ให้ ไม่ใช่พิกัดที่แน่นอน แต่คือความน่าจะเป็นที่ดีขึ้น */
export function knownRegulars(s: GameState, locId: string, period: string): string[] {
  return chars
    .filter((c) => inChapter(c as { chapter?: string }, chapterOf(s)))
    .filter((c) => affinityRank(s.affinity[c.id] ?? 0) >= P.hintAtRank || s.met[c.id] !== undefined)
    .filter((c) => habitCount(s, c.id, period, locId) >= P.knowAt)
    .map((c) => c.id);
}

/** สิ่งที่กระดานเห็นได้จากระยะไกล ก่อนจะเดินเข้าไปจริง
 *
 *  ระดับความรู้สามขั้น ซึ่งตรงกับสิ่งที่ตาคนมองเห็นจริงๆ:
 *  - `none`  ไม่มีใครอยู่
 *  - `someone` มีคนอยู่ แต่ยังไม่รู้ว่าใคร (ยังไม่สนิทพอจะจำหลังได้)
 *  - `known` จำได้ตั้งแต่ไกลว่าเป็นใคร — ต้องสนิทถึงระดับ recogniseAtRank
 */
export interface PlaceSignal {
  kind: "none" | "someone" | "known";
  /** คนที่จำได้ตั้งแต่ไกล (เฉพาะ kind = known) */
  ids: string[];
  count: number;
  /** คนที่เรารู้ว่ามักอยู่ที่นี่ตอนนี้ ถึงวันนี้เขาจะไม่อยู่ก็ตาม */
  regulars: string[];
}

export function signalAt(s: GameState, locId: string, period: string, bonus = 0): PlaceSignal {
  const here = whoIsAt(s, locId, period, bonus);
  const known = here.filter((id) => affinityRank(s.affinity[id] ?? 0) >= P.recogniseAtRank);
  return {
    kind: here.length === 0 ? "none" : known.length ? "known" : "someone",
    ids: known,
    count: here.length,
    regulars: knownRegulars(s, locId, period),
  };
}

/** เจอเขาแล้วจริงๆ — จดไว้ว่าเจอที่ไหนตอนไหน และถ้าเป็นครั้งแรกให้บันทึกวันที่รู้จัก
 *  คืน true ถ้านี่คือครั้งแรกที่ได้รู้จักกันจริงๆ (ฝั่ง UI เอาไปเล่นฉากแนะนำตัว) */
export function noteEncounter(s: GameState, charId: string, locId: string, period: string): boolean {
  learnHabit(s, charId, period, locId);
  const first = s.met[charId] === undefined;
  if (first) s.met[charId] = s.dayIndex;
  return first;
}

export const hasMet = (s: GameState, charId: string) => s.met[charId] !== undefined;
/** รู้จักกันมากี่วันแล้ว — บทใช้บอกน้ำเสียงว่าเพิ่งเจอกันหรือรู้จักกันมานาน */
export const daysKnown = (s: GameState, charId: string) =>
  s.met[charId] === undefined ? -1 : s.dayIndex - s.met[charId];

/** เดินสวนกับใครสักคนระหว่างทาง
 *
 *  ของเล็กๆ ที่ทำให้โลกรู้สึกว่ามีคนอยู่จริง — ไม่กินช่วงเวลา ไม่มีบทสนทนา
 *  แค่ผ่านกันแล้วทัก ซึ่งเป็นสิ่งที่เกิดขึ้นทั้งวันในโรงเรียนจริง
 *  เกิดได้เฉพาะกับคนที่ *รู้จักกันแล้ว* เพราะการเดินสวนกับคนแปลกหน้าไม่ใช่เหตุการณ์
 *  และเฉพาะคนที่วันนี้ยังไม่ได้คุยกัน ไม่งั้นมันจะกลายเป็นช่องทางเก็บแต้มฟรี */
export function bumpInto(s: GameState, rnd: () => number): string | null {
  if (rnd() > P.bumpChance) return null;
  const pool = chars.filter((c) =>
    inChapter(c as { chapter?: string }, chapterOf(s)) &&
    s.met[c.id] !== undefined && !s.metToday[c.id] &&
    affinityRank(s.affinity[c.id] ?? 0) >= 1);
  if (!pool.length) return null;
  const pick = pool[Math.floor(rnd() * pool.length)];
  s.affinity[pick.id] = (s.affinity[pick.id] ?? 0) + P.bumpAffinity;
  s.encounters++;
  return pick.id;
}

/** วันนี้มีนัดกับใคร แล้วเขาไปรอที่ไหน — กระดานเอาไปชี้ให้เห็นว่าต้องไปที่ไหน */
export function apptSpot(s: GameState): { charId: string; loc: string } | null {
  if (!isPlanPeriod(s)) return null;
  const p = plansToday(s)[0];
  if (!p) return null;
  const loc = meetSpot(p.charId);
  return loc ? { charId: p.charId, loc } : null;
}
