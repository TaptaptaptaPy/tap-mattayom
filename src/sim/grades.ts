import game from "../../data/game.json";
import subjects from "../../data/subjects.json";
import type { GameState, StatId } from "./state";

/** เกรดรายวิชา
 *
 *  เดิมการสอบเป็นเลขตัวเดียว และ "ปัญญา" ก็เป็นค่าเดียว ทั้งที่ `data/questions.json`
 *  แบ่งข้อสอบเป็นห้าวิชาไว้ตั้งแต่แรกแล้ว โรงเรียนไทยจริงคือ ปพ. ที่มีเกรดรายวิชา
 *
 *  ผลที่ตามมาสามอย่าง: โรงเรียนกวดวิชา 320 บาทมีความหมายขึ้นมาทันที (ไปติววิชาไหน) ·
 *  มินิเกมห้องสอบมีที่ไป · และฉากจบมีเนื้อขึ้นเยอะ ("เกรดเฉลี่ย 3.42 อ่อนเลขแต่ภาษาดี")
 */

const G = game.grades;

export interface Subject { id: string; name: string; short: string; likes: string; hard: number; }
export const SUBJECTS = (subjects as unknown[]).filter(
  (x): x is Subject => typeof (x as Subject).id === "string");

export const subjectById = (id: string) => SUBJECTS.find((x) => x.id === id) ?? null;

export const newGrades = (): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const s of SUBJECTS) out[s.id] = 0;
  return out;
};

/** เข้าเรียนหนึ่งคาบ = ได้ทุกวิชานิดหน่อย วิชาที่ตรงกับค่าสถานะที่เราแข็งจะได้มากกว่า */
export function studyAll(s: GameState, amount: number): void {
  for (const sub of SUBJECTS) {
    const affinity = 1 + Math.min(0.6, (s.stats[sub.likes as StatId] ?? 0) / 90);
    s.grades[sub.id] = Math.min(100, (s.grades[sub.id] ?? 0) + amount * affinity / sub.hard);
  }
}

/** ติววิชาเดียวแบบเจาะจง — นี่คือสิ่งที่ทำให้โรงเรียนกวดวิชามีความหมาย */
export function studyOne(s: GameState, subjectId: string, amount = G.tutorFocus): number {
  const sub = subjectById(subjectId);
  if (!sub) return 0;
  const before = s.grades[subjectId] ?? 0;
  s.grades[subjectId] = Math.min(100, before + amount / sub.hard);
  return s.grades[subjectId] - before;
}

/** เกรดของวิชาหนึ่งตามเกณฑ์ 4 ขั้น */
export function gradeOf(score: number): { grade: number; name: string } {
  const step = G.gpaSteps.find((x) => score >= x.min) ?? G.gpaSteps[G.gpaSteps.length - 1];
  return { grade: step.grade, name: step.name };
}

/** เกรดเฉลี่ยรวม — ตัวเลขที่คนไทยทุกคนรู้ว่าแปลว่าอะไร */
export function gpa(s: GameState): number {
  if (!SUBJECTS.length) return 0;
  const sum = SUBJECTS.reduce((a, sub) => a + gradeOf(s.grades[sub.id] ?? 0).grade, 0);
  return sum / SUBJECTS.length;
}

/** วิชาที่ดีที่สุดและแย่ที่สุด — ใช้เล่าในฉากจบ */
export function bestWorst(s: GameState): { best: Subject; worst: Subject } | null {
  if (SUBJECTS.length < 2) return null;
  const sorted = [...SUBJECTS].sort((a, b) => (s.grades[b.id] ?? 0) - (s.grades[a.id] ?? 0));
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

/** ความรู้จางลงถ้าไม่ได้ทบทวน เหมือน `study` แต่ช้ากว่ามาก */
export function decayGrades(s: GameState): void {
  for (const sub of SUBJECTS)
    s.grades[sub.id] = (s.grades[sub.id] ?? 0) * G.decayPerDay;
}

export const gradePerClass = G.perClass;
export const gradePerHomework = G.perHomework;
