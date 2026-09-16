import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { remember, trustRank, type GameState } from "./state";

/** เรื่องหลักของเทอม — "สมุดปกแดง"
 *
 *  ปัญหาเดิม: เกมมีระบบครบสิบกว่าอย่าง มีตัวละครที่มีปมของตัวเองครบทุกคน
 *  แต่ไม่มี *เรื่อง* — ไม่มีคำถามที่ทั้งเทอมกำลังเดินไปหาคำตอบ
 *  ผู้เล่นจึงไม่รู้ว่าตัวเองกำลังทำอะไรอยู่ นอกจากไต่ตัวเลขไปเรื่อยๆ จนหมดวัน
 *  และปมของตัวละครทั้งหกกองอยู่แยกกันโดยไม่มีอะไรร้อยเข้าหากัน
 *
 *  แกนที่เลือก ใช้ของที่เกมมีอยู่แล้วทั้งหมด ไม่ได้สร้างระบบใหม่ซ้อนเข้าไป:
 *  ความประพฤติ (ตัวเลขที่ตัดสินคน) · ครูประจำชั้น (คนที่ถือสมุด) ·
 *  ความเชื่อใจ (สิ่งที่ทำให้คนยอมเล่าให้ฟัง) · หัวหน้าห้องที่ถูกสั่งให้แก้คะแนนย้อนหลัง
 *  (ธง `ploy_refused` / `ploy_complied` มีอยู่ในบทของพลอยตั้งแต่ก่อนหน้านี้แล้ว —
 *  ที่นี่แค่เลื่อนมันจาก *ปมส่วนตัวของเธอ* ขึ้นมาเป็น *แกนของทั้งเทอม*)
 *
 *  สามองก์:
 *  1. รู้ว่ามีสมุดเล่มหนึ่งที่ตัดสินว่าใครได้ไปต่อ และไม่มีใครได้อ่าน
 *  2. สมุดหาย ทั้งห้องถูกสอบสวน และ **เราคือคนที่ถูกเรียกถามเป็นคนแรก**
 *     ด้วยเหตุผลที่ต่างกันตามภูมิหลัง — จุดที่ภูมิหลังกลายเป็นเนื้อเรื่อง ไม่ใช่แค่ค่าตั้งต้น
 *  3. ที่ประชุมกรรมการ เราพูดหรือไม่พูด พูดอะไร — และใครจะยืนขึ้นด้วย
 *
 *  **ความเชื่อใจคือกลไกของเรื่องหลัก ไม่ใช่ตัวเลขข้างเคียง** แต่ละคนรู้คนละชิ้น
 *  และจะเล่าก็ต่อเมื่อไว้ใจเราถึงระดับหนึ่ง · ไม่สนิทกับใครเลย = ไม่มีวันรู้ความจริง
 */

const P = game.plot;

/** เบาะแสห้าชิ้น — ใครรู้อะไร และต้องไว้ใจถึงระดับไหนถึงจะเล่า */
export interface Clue { id: string; from: string; trust: number; short: string; line: string; }
export const CLUES: Clue[] = (P.clues as unknown as Clue[]);

export const plotOf = (s: GameState) => s.plot;

/** องก์ที่เดินอยู่ตอนนี้ — 0 ยังไม่เริ่ม · 1 รู้ว่ามีสมุด · 2 สมุดหายและเราถูกสงสัย
 *  · 3 ปะติดปะต่อได้แล้ว · 4 จบแล้ว */
export const plotStage = (s: GameState) => s.plot.stage;

export function advancePlot(s: GameState, stage: number, why: string) {
  if (s.plot.stage >= stage) return;
  s.plot.stage = stage;
  remember(s, why);
}

/** เบาะแสที่เก็บได้แล้ว */
export const hasClue = (s: GameState, id: string) => s.plot.clues.includes(id);
export const clueCount = (s: GameState) => s.plot.clues.length;

/** เก็บเบาะแสหนึ่งชิ้น — เรียกจากบทเมื่อคนคนนั้นยอมเล่า
 *  พอครบเกณฑ์ เรื่องเดินเองไปองก์สาม เพราะปะติดปะต่อได้แล้ว */
export function takeClue(s: GameState, id: string): boolean {
  const c = CLUES.find((x) => x.id === id);
  if (!c || hasClue(s, id)) return false;
  s.plot.clues.push(id);
  remember(s, `รู้เพิ่มอีกเรื่อง: ${c.short}`);
  if (s.plot.clues.length >= P.cluesToSolve && s.plot.stage === 2)
    advancePlot(s, 3, "ปะติดปะต่อเรื่องสมุดปกแดงได้แล้ว");
  return true;
}

/** คนนี้พร้อมจะเล่าให้เราฟังหรือยัง — ต้องถึงองก์ที่ถาม และไว้ใจถึงระดับที่กำหนด */
export function clueReady(s: GameState, charId: string): Clue | null {
  if (s.plot.stage < 2) return null;
  const c = CLUES.find((x) => x.from === charId);
  if (!c || hasClue(s, c.id)) return null;
  return trustRank(s.trust[charId] ?? 0) >= c.trust ? c : null;
}

/** ครูสงสัยเราแค่ไหน 0-100 — ขึ้นจากการโดนจับ ไม่ส่งงาน และการถูกเห็นในที่ที่ไม่ควรอยู่
 *  ลงจากความรับผิดชอบ · สูงเกินเกณฑ์แล้วที่ประชุมจะไม่ฟังเราเลยไม่ว่าเรามีอะไร */
export function suspect(s: GameState, amount: number, why?: string) {
  s.plot.suspect = Math.max(0, Math.min(100, s.plot.suspect + amount));
  if (why && amount >= 4) remember(s, why);
}
export const suspectLevel = (s: GameState) =>
  s.plot.suspect >= P.suspectHigh ? 2 : s.plot.suspect >= P.suspectLow ? 1 : 0;
export const suspectName = (s: GameState) => P.suspectNames[suspectLevel(s)];

/** ใครจะยืนขึ้นพูดด้วยในที่ประชุม — คนที่ไว้ใจเราถึงระดับที่ยอมเอาตัวเองเข้าไปเสี่ยง */
export function backers(s: GameState): string[] {
  return chars
    .filter((c) => (c.chapter ?? "school") === "school")
    .filter((c) => s.met[c.id] !== undefined)
    .filter((c) => trustRank(s.trust[c.id] ?? 0) >= P.backerTrust)
    .map((c) => c.id);
}

/** คำให้การสี่แบบ — เปิดได้ไม่เท่ากันตามสิ่งที่เรารู้และคนที่ยืนอยู่ข้างเรา */
export type Verdict = "silent" | "blame" | "teacher" | "self";

export interface VerdictOption { id: Verdict; label: string; need: string | null; }
export function verdictOptions(s: GameState): VerdictOption[] {
  const out: VerdictOption[] = [
    { id: "silent", label: "ไม่พูดอะไร", need: null },
    { id: "self", label: "รับไปเอง", need: null },
  ];
  if (s.plot.stage >= 3)
    out.push({ id: "blame", label: "บอกว่าใครฉีก", need: null });
  // ชี้ไปที่ครูได้ต่อเมื่อรู้ความจริงครบ *และ* มีคนยืนขึ้นด้วย
  // คำพูดของเด็กคนเดียวในห้องที่มีแต่ผู้ใหญ่ ไม่เคยพอ
  if (s.plot.stage >= 3 && backers(s).length >= P.backersToAccuse)
    out.push({ id: "teacher", label: "พูดถึงคนที่สั่ง", need: null });
  else if (s.plot.stage >= 3)
    out.push({ id: "teacher", label: "พูดถึงคนที่สั่ง",
      need: `ต้องมีคนไว้ใจเราพอจะยืนขึ้นด้วยอย่างน้อย ${P.backersToAccuse} คน` });
  return out;
}

/** ปิดเรื่อง — ผลไปโผล่ที่ฉากจบของทุกคน */
export function settleVerdict(s: GameState, v: Verdict) {
  s.plot.verdict = v;
  s.plot.stage = 4;
  // ชื่อธงต้องเขียนตรงๆ ห้ามประกอบจากตัวแปร — `npm run story` มองไม่เห็นชื่อที่ประกอบขึ้น
  // แล้วธงที่ตั้งไว้จะไม่มีใครตรวจว่ามีคนอ่านหรือเปล่า (กติกาข้อนี้อยู่ใน CLAUDE.md)
  if (v === "silent") s.flags["plot_silent"] = true;
  if (v === "blame") s.flags["plot_blame"] = true;
  if (v === "teacher") s.flags["plot_teacher"] = true;
  if (v === "self") s.flags["plot_self"] = true;
  if (backers(s).length) s.flags["plot_backed"] = true;
  remember(s, P.verdictLog[v] ?? "ให้การในที่ประชุมไปแล้ว");
}

export const plotVerdict = (s: GameState) => s.plot.verdict;

/** เรื่องเดินไปตามปฏิทิน — วางไว้ที่เดียวเพื่อให้ทั้งเกมจริง เทสต์เล่นจบ และเทสต์สมดุล
 *  เดินทางเดียวกัน ไม่ใช่ต่างคนต่างเลื่อนองก์เอง */
export function plotOnEvent(s: GameState, eventId: string) {
  if (eventId === "mp_book") advancePlot(s, 1, "รู้ว่ามีสมุดปกแดงที่ตัดสินว่าใครได้ไปต่อ");
  if (eventId === "mp_gone") advancePlot(s, 2, "สมุดปกแดงหายไปหนึ่งหน้า และเราถูกเรียกถามเป็นคนแรก");
}

/** ที่ค้นแฟ้มเก่าได้ — ทางเดียวที่ไม่ต้องพึ่งความเชื่อใจของใครเลย แลกกับเวลาทั้งช่วง */
export const canSearchArchive = (s: GameState, locId: string) =>
  s.plot.stage >= 2 && s.plot.stage < 4 && locId === "library" && !hasClue(s, "clue_page");

/** สิ่งที่เรื่องหลักกำลังรออยู่ตอนนี้ — กระดานเอาไปขึ้นเป็นการ์ดจุดมุ่งหมาย
 *  ของเดิมเกมไม่เคยบอกเลยว่าเล่นไปเพื่ออะไร ผู้เล่นจึงไต่ตัวเลขไปจนหมดวันโดยไม่รู้ว่าทำไม */
export interface PlotAim { title: string; aim: string; note: string; }
export function plotAim(s: GameState): PlotAim | null {
  const st = s.plot.stage;
  if (st < 1) return null;
  const names = P.stageNames as string[];
  const aims = P.stageAim as string[];
  let note = "";
  if (st === 2) {
    const left = P.cluesToSolve - s.plot.clues.length;
    note = left > 0
      ? `รู้แล้ว ${s.plot.clues.length} เรื่อง · อีก ${left} เรื่องถึงจะปะติดปะต่อได้`
      : "รู้พอจะปะติดปะต่อได้แล้ว";
  } else if (st === 3) {
    const b = backers(s).length;
    note = b >= P.backersToAccuse
      ? `มีคนพร้อมยืนขึ้นด้วย ${b} คน — พูดถึงคนที่สั่งได้`
      : `มีคนพร้อมยืนขึ้นด้วย ${b} จาก ${P.backersToAccuse} คน`;
  } else if (st === 4) {
    note = P.verdictLog[(s.plot.verdict ?? "silent") as keyof typeof P.verdictLog] ?? "";
  } else {
    note = `ครู${suspectName(s)}`;
  }
  return { title: names[st] ?? "", aim: aims[st] ?? "", note };
}
