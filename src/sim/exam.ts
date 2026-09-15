import game from "../../data/game.json";
import { SUBJECTS } from "./grades";
import { markRetakes } from "./schoolwork";
import { remember, type GameState } from "./state";

const E = game.examModel;

export interface ExamReport {
  id: string; name: string; score: number; rank: number;
  classSize: number; note: string;
}

export function examById(id: string) {
  return game.exams.find((e) => e.id === id)!;
}

/** คะแนนสอบ = ปัญญาที่สะสมมาทั้งเทอม + การทบทวนช่วงใกล้สอบ
 *  ฝืนเข้าห้องสอบทั้งที่หมดแรง คะแนนตก — เป็นเหตุผลให้ระบบแรงมีความหมาย */
/** quizScore 0..1 = ผลจากมินิเกมห้องสอบ · 0.5 คือทำได้กลางๆ
 *  ความรู้ที่สะสมมาทั้งเทอมยังเป็นฐานหลัก มินิเกมเป็นตัวคูณ ไม่ใช่ตัวตัดสินทั้งหมด */
export function takeExam(s: GameState, id: string, quizScore = 0.5): ExamReport {
  const def = examById(id);
  // เกรดรายวิชาเฉลี่ยคือ "ความรู้ที่สะสมมาจริง" ต่างจาก study ที่เป็นการอ่านช่วงใกล้สอบ
  const known = SUBJECTS.reduce((a, x) => a + (s.grades[x.id] ?? 0), 0) / Math.max(1, SUBJECTS.length);
  let raw = (s.stats.mind * E.mindWeight + s.study * E.studyWeight + known * E.gradeWeight) *
            (0.72 + quizScore * 0.56);
  const tired = s.energy < game.energy.lowThreshold;
  if (tired) raw *= 1 - E.energyPenalty;

  // เส้นโค้งอิ่มตัว: เตรียมตัวเพิ่มได้คะแนนเพิ่มเสมอ แต่เพิ่มช้าลงเรื่อยๆ
  // เดิมใช้อัตราส่วนตรงๆ ทำให้แม้แต่คนที่ไม่ทำอะไรเลยก็ได้ 100 เต็ม
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-raw / E.scale)))));
  const rank = Math.max(1, Math.min(E.classSize,
    1 + Math.round((E.classSize - 1) * Math.pow(1 - score / 100, E.rankCurve))));

  s.exams[id] = { score, rank };
  // ประกาศผลแล้วรู้เลยว่าติดซ่อมวิชาไหนบ้าง
  markRetakes(s);
  s.study *= 0.35;   // สอบเสร็จแล้วความพร้อมรีเซ็ตเกือบหมด ต้องทบทวนใหม่รอบหน้า
  const note = tired ? "เข้าห้องสอบทั้งที่หลับไม่พอ คะแนนหายไปส่วนหนึ่ง" : "";
  s.lastQuiz = quizScore;
  remember(s, `${def.name} ได้ ${score} คะแนน อันดับที่ ${rank} ของห้อง`);
  return { id, name: def.name, score, rank, classSize: E.classSize, note };
}

export const examDone = (s: GameState, id: string) => s.exams[id] !== undefined;

/** คะแนนรวมทั้งเทอม ถ่วงน้ำหนักตามที่ประกาศไว้ใน game.json */
export function termScore(s: GameState): number {
  let total = 0, weight = 0;
  for (const e of game.exams) {
    const r = s.exams[e.id];
    if (!r) continue;
    total += r.score * e.weight;
    weight += e.weight;
  }
  return weight > 0 ? total / weight : 0;
}
