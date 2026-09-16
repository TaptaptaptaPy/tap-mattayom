import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { remember, type BoardRow, type GameState } from "./state";
import { changeAffinity, changeTrust, shiftStanding } from "./bonds";
import { lifeOf } from "./offscreen";
import { examById } from "./exam";
import { chapterOf, inChapter } from "./chapter";

/** กระดานประกาศผลสอบหน้าห้อง
 *
 *  เดิมผลสอบเป็นเลขของเราคนเดียว — "ได้ 78 อันดับที่ 12 ของห้อง" อันดับนั้นไม่มีหน้าใครอยู่ในนั้นเลย
 *  การเรียนเลยเป็นเรื่องส่วนตัวล้วน ทั้งที่โรงเรียนไทยติดผลสอบให้ทั้งโรงเรียนอ่าน
 *
 *  ที่นี่เพื่อนทุกคนมีคะแนนของตัวเอง และคะแนนนั้นมาจากสามอย่างที่เรามีส่วนทั้งหมด:
 *  ความสามารถพื้นฐานของเขา · จำนวนครั้งที่เราติวให้ · และ**แรงกดดันในชีวิตที่เราปล่อยไว้**
 *  ไม่ไปหาเขาทั้งเดือน เรื่องมันไม่ได้จบแค่เขาเหงา — มันมาโผล่บนกระดานที่ทุกคนยืนอ่าน
 *
 *  กติกา: กระดานต้องเปลี่ยนอะไรสักอย่างเสมอ ไม่งั้นมันเป็นแค่ตารางสวยๆ
 *  ติดอันดับต้น/ท้ายขยับชื่อเสียง · แซงคนที่ถือศักดิ์ศรีเรื่องเกรดแล้วระยะห่างเปลี่ยน ·
 *  คนที่ร่วงลงจากรอบก่อนแรงกดดันขึ้น · คนที่เราติวให้แล้วขึ้นจริงจะไว้ใจเรามากขึ้น
 */

const B = game.board;
const E = game.examModel;

export type { BoardRow };

/** อันดับในห้องจากคะแนน — ใช้สูตรเดียวกับ `takeExam` เพื่อไม่ให้กระดานกับสมุดพกขัดกันเอง */
export const rankFromScore = (score: number): number =>
  Math.max(1, Math.min(E.classSize,
    1 + Math.round((E.classSize - 1) * Math.pow(1 - score / 100, E.rankCurve))));

/** สุ่มที่ซ้ำผลได้จากชื่อ + รอบสอบ — เปิดกระดานซ้ำต้องได้เลขเดิมเสมอ */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/** เราติวให้เขาไปกี่ครั้ง */
export const tutoredCount = (s: GameState, id: string) => s.tutored[id] ?? 0;

/** ติวให้เพื่อนหนึ่งคืน — เรียกจากบทผ่าน `tutor()`
 *  ราคาคือเวลาทบทวนของเราเอง (`s.study`) ซึ่งเป็นคะแนนสอบของเราตรงๆ */
export function tutor(s: GameState, charId: string): void {
  s.tutored[charId] = (s.tutored[charId] ?? 0) + 1;
  s.study = Math.max(0, s.study - game.board.tutorCost);
  changeTrust(s, charId, B.tutorTrust);
}

/** ชีวิตของเขาหนักแค่ไหน 0..1 — แรงกดดันที่ค้างอยู่ บวกเรื่องที่เกิดไปแล้ว
 *  `fired` คือสิ่งที่ไม่หายไป ต่างจาก `pressure` ที่ถูกล้างทุกครั้งที่เรื่องเกิด */
function strainOf(s: GameState, id: string): number {
  const l = lifeOf(s, id);
  const now = Math.min(1, l.pressure / game.offscreen.threshold);
  return Math.min(1, now * B.strainFromNow + l.fired * B.strainPerEvent);
}

function scoreOf(s: GameState, id: string, examId: string): number {
  const c = chars.find((x) => x.id === id) as { smart?: number } | undefined;
  const raw = (c?.smart ?? 0.55) * B.smartWeight
            + tutoredCount(s, id) * B.tutorBonus
            // ชีวิตที่เราปล่อยไว้ = แรงกดดันที่ค้างอยู่ *บวก* เรื่องที่เกิดไปแล้ว
            //
            // ของเดิมอ่านแค่ `pressure` ซึ่งถูกรีเซ็ตเป็น 0 ทันทีที่เรื่องเกิดขึ้น
            // ผลคือชีวิตเขาพังแล้วคะแนนเขา *ดีขึ้น* (วัดได้ 21 → 57) ซึ่งกลับหัวกลับหาง
            // เรื่องที่เกิดไปแล้วไม่ได้หายไปกับแรงกดดัน มันทิ้งรอยไว้
            - strainOf(s, id) * B.pressurePenalty
            + jitter(id + examId) * B.jitter;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / B.scale)))));
}

/** กระดานถูกเก็บแยกตามภาค — ชื่อรอบสอบของมัธยมกับปีหนึ่งซ้ำกัน ("midterm"/"final")
 *  ถ้าไม่แยก กระดานของปีหนึ่งจะไม่เคยถูกติดเลย เพราะช่องเดิมมีของอยู่แล้ว */
const boardKey = (s: GameState, examId: string) => `${s.chapter}:${examId}`;

/** รหัสกระดานของภาคนี้ เรียงตามลำดับรอบสอบ */
const keysThisChapter = (s: GameState) =>
  game.exams.map((e) => boardKey(s, e.id)).filter((k) => s.board[k]);

/** ติดประกาศ — เรียกทันทีหลังรู้ผลสอบ คืนตารางที่ UI เอาไปวาด
 *  ผลข้างเคียงทั้งหมดเกิดที่นี่ที่เดียว และเกิดครั้งเดียวต่อรอบสอบ */
export function postBoard(s: GameState, examId: string): BoardRow[] {
  const mine = s.exams[examId];
  const key = boardKey(s, examId);
  if (!mine) return [];
  if (s.board[key]) return s.board[key];

  // อันดับของเราคำนวณจากคะแนนด้วยสูตรเดียวกับของทุกคน ไม่ได้หยิบ `mine.rank` มาใช้ตรงๆ
  // ทั้งสองทางให้เลขเดียวกันอยู่แล้ว แต่ถ้าวันหนึ่งไม่ตรง กระดานจะขัดกันเองต่อหน้าผู้เล่น
  // (เลข 14 ของเราอยู่เหนือเลข 11 ของคนอื่น) ซึ่งเป็นความผิดที่อ่านออกทันทีและอธิบายไม่ได้
  const rows: BoardRow[] = [{
    id: "me", name: "เรา", score: mine.score, rank: rankFromScore(mine.score),
    me: true, move: 0, tutored: false,
  }];
  for (const c of chars) {
    if (!inChapter(c, chapterOf(s))) continue;
    const score = scoreOf(s, c.id, examId);
    rows.push({ id: c.id, name: c.name, score, rank: rankFromScore(score), me: false, move: 0,
                tutored: tutoredCount(s, c.id) > 0 });
  }
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // เทียบกับรอบก่อน — "ร่วงห้าอันดับ" เจ็บกว่า "ได้ 61 คะแนน"
  const prevKey = lastBoardBefore(s, examId);
  const prev = prevKey ? s.board[prevKey] : null;
  for (const r of rows) {
    const p = prev?.find((x) => x.id === r.id);
    r.move = p ? p.rank - r.rank : 0;   // บวก = ขึ้น
  }

  s.board[key] = rows;
  applyEffects(s, examId, rows);
  return rows;
}

/** รอบสอบก่อนหน้าที่ติดประกาศไปแล้ว — ในภาคเดียวกันเท่านั้น
 *  ขึ้นปีหนึ่งแล้วเทียบอันดับกับตอน ม.6 ไม่ได้ คนละห้อง คนละคนที่อยู่ในนั้น */
function lastBoardBefore(s: GameState, examId: string): string | null {
  const order = game.exams.map((e) => e.id);
  for (let i = order.indexOf(examId) - 1; i >= 0; i--) {
    const k = boardKey(s, order[i]);
    if (s.board[k]) return k;
  }
  return null;
}

function applyEffects(s: GameState, examId: string, rows: BoardRow[]): void {
  const name = examById(examId).name;
  const me = rows.find((r) => r.me)!;

  // 1) ทั้งห้องเห็นชื่อเราอยู่ตรงไหน
  if (me.rank <= B.topRank) {
    shiftStanding(s, B.topStanding);
    s.flags["board_top"] = true;
    remember(s, `ชื่อเราอยู่อันดับ ${me.rank} บนกระดานหน้าห้อง มีคนมายืนอ่านทั้งเช้า`);
  } else if (me.rank >= B.bottomFrom) {
    shiftStanding(s, B.bottomStanding);
    s.flags["board_bottom"] = true;
    remember(s, `ชื่อเราอยู่อันดับ ${me.rank} บนกระดานหน้าห้อง เราเดินผ่านมันสี่รอบในวันเดียว`);
  }

  for (const r of rows) {
    if (r.me) continue;
    const c = chars.find((x) => x.id === r.id) as { proudOfGrades?: boolean } | undefined;

    // 2) ชื่อเราอยู่เหนือชื่อเขาบนกระดานที่ทุกคนอ่าน — เป็นเรื่องจริงสำหรับทั้งสองฝ่ายเสมอ
    //    แต่ *ราคา* ของมันมีเฉพาะกับคนที่ถือศักดิ์ศรีเรื่องเกรด คนอื่นแค่รับรู้
    if (me.rank < r.rank) {
      s.flags[`beat_${r.id}`] = true;
      if (c?.proudOfGrades) {
        changeAffinity(s, r.id, B.beatProudAffinity);
        changeTrust(s, r.id, B.beatProudTrust);
        remember(s, `${r.name}ยืนอ่านกระดานอยู่นานกว่าคนอื่น แล้วเดินกลับไปที่โต๊ะโดยไม่พูดอะไร`);
      }
    }

    // 3) ร่วงจากรอบก่อน — ชีวิตที่เราปล่อยไว้โผล่บนกระดานที่ทุกคนอ่าน
    if (r.move <= -B.slipMoves) {
      lifeOf(s, r.id).pressure += B.slipPressure;
      s.flags[`${r.id}_slipped`] = true;
      remember(s, `${r.name}ร่วงไป ${-r.move} อันดับใน${name} เขาไม่ได้พูดถึงมันเลยสักครั้ง`);
      s.offscreenNews.push(`${r.name}ร่วง ${-r.move} อันดับบนกระดาน`);
    }

    // 4) เราติวให้แล้วเขาขึ้นจริง
    if (r.tutored && r.move >= B.slipMoves) {
      s.flags[`lifted_${r.id}`] = true;
      remember(s, `${r.name}ขึ้นมา ${r.move} อันดับ คืนที่เราติวให้ก่อนสอบมีผลจริง`);
    }
  }
}

/** ใครอยู่เหนือเรา / ใต้เรา บนกระดานล่าสุด — บทใช้พูดถึงได้ */
export function boardNeighbours(s: GameState): { above: string; below: string } {
  const ks = keysThisChapter(s);
  const rows = ks.length ? s.board[ks[ks.length - 1]] : null;
  if (!rows) return { above: "", below: "" };
  const i = rows.findIndex((r) => r.me);
  return { above: rows[i - 1]?.id ?? "", below: rows[i + 1]?.id ?? "" };
}

/** อันดับล่าสุดของเรา — 0 ถ้ายังไม่เคยประกาศ */
export function myBoardRank(s: GameState): number {
  const ks = keysThisChapter(s);
  if (!ks.length) return 0;
  return s.board[ks[ks.length - 1]].find((r) => r.me)?.rank ?? 0;
}
