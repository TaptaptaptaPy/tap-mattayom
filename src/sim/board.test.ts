import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { postBoard, tutor, tutoredCount, myBoardRank, rankFromScore } from "./board";
import { lifeOf } from "./offscreen";
import game from "../../data/game.json";

const sat = (s: ReturnType<typeof newState>, id: string, examId: string, rank: number) => {
  s.exams[examId] = { score: 100 - rank * 2, rank };
  return postBoard(s, examId);
};

/** เดิมผลสอบเป็นเลขของเราคนเดียว — "อันดับที่ 12 ของห้อง" ไม่มีหน้าใครอยู่ในนั้นเลย */
describe("กระดานประกาศผลหน้าห้อง", () => {
  it("เพื่อนทุกคนมีคะแนนของตัวเอง ไม่ใช่มีแต่เรา", () => {
    const s = newState();
    const rows = sat(s, "me", "midterm", 20);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.filter((r) => r.me).length).toBe(1);
  });

  it("เรียงจากคะแนนมากไปน้อยเสมอ และเลขอันดับต้องไม่ขัดกับลำดับที่เห็น", () => {
    const s = newState();
    const rows = sat(s, "me", "midterm", 20);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
      // คนที่อยู่สูงกว่าบนกระดานต้องมีเลขอันดับน้อยกว่าหรือเท่ากันเสมอ
      // ไม่งั้นผู้เล่นจะเห็น "ที่ 14" อยู่เหนือ "ที่ 11" ซึ่งอธิบายไม่ได้
      expect(rows[i - 1].rank).toBeLessThanOrEqual(rows[i].rank);
    }
  });

  it("ติดอันดับต้นแล้วทั้งห้องเห็น ชื่อเสียงขึ้น", () => {
    const s = newState();
    const before = s.standing;
    sat(s, "me", "midterm", 1);
    expect(s.standing).toBeGreaterThan(before);
    expect(s.flags["board_top"]).toBe(true);
  });

  it("ติดอันดับท้ายแล้วทั้งห้องเห็นเหมือนกัน ชื่อเสียงลง", () => {
    const s = newState();
    const before = s.standing;
    sat(s, "me", "midterm", 44);
    expect(s.standing).toBeLessThan(before);
    expect(s.flags["board_bottom"]).toBe(true);
  });

  it("แซงคนที่ถือศักดิ์ศรีเรื่องเกรด ระยะห่างเปลี่ยน แต่เขาไม่ได้เลิกไว้ใจเรา", () => {
    const s = newState();
    s.affinity["ploy"] = 40; s.trust["ploy"] = 40;
    const a = s.affinity["ploy"], t = s.trust["ploy"];
    sat(s, "me", "midterm", 1);
    expect(s.flags["beat_ploy"]).toBe(true);
    expect(s.affinity["ploy"]).toBeLessThan(a);
    expect(s.trust["ploy"]).toBeGreaterThan(t);
  });

  it("แพ้เขา ไม่มีอะไรเกิดขึ้นกับเขา", () => {
    const s = newState();
    sat(s, "me", "midterm", 44);
    expect(s.flags["beat_ploy"]).toBeUndefined();
  });

  it("ติวให้เพื่อนแล้วคะแนนเขาขึ้นจริงบนกระดาน", () => {
    const plain = newState();
    const rowsA = sat(plain, "me", "midterm", 20);
    const helped = newState();
    tutor(helped, "palm");
    const rowsB = sat(helped, "me", "midterm", 20);
    const a = rowsA.find((r) => r.id === "palm")!.score;
    const b = rowsB.find((r) => r.id === "palm")!.score;
    expect(b).toBeGreaterThan(a);
    expect(tutoredCount(helped, "palm")).toBe(1);
  });

  it("ติวให้เพื่อนมีราคา — เวลาทบทวนของเราเองหายไป", () => {
    const s = newState();
    s.study = 30;
    tutor(s, "palm");
    expect(s.study).toBe(30 - game.board.tutorCost);
  });

  it("ชีวิตที่เราปล่อยไว้โผล่บนกระดาน — ยิ่งกดดัน คะแนนยิ่งตก", () => {
    const calm = newState();
    const rowsA = sat(calm, "me", "midterm", 20);
    const heavy = newState();
    lifeOf(heavy, "minta").pressure = game.offscreen.threshold;
    const rowsB = sat(heavy, "me", "midterm", 20);
    expect(rowsB.find((r) => r.id === "minta")!.score)
      .toBeLessThan(rowsA.find((r) => r.id === "minta")!.score);
  });

  it("ร่วงจากรอบก่อนแล้วแรงกดดันของเขาขึ้นอีก และเราได้รู้", () => {
    const s = newState();
    sat(s, "me", "midterm", 20);
    lifeOf(s, "minta").pressure = game.offscreen.threshold;
    const before = lifeOf(s, "minta").pressure;
    sat(s, "me", "final", 20);
    expect(s.flags["minta_slipped"]).toBe(true);
    expect(lifeOf(s, "minta").pressure).toBeGreaterThan(before);
    expect(s.history.some((h) => h.includes("ร่วง"))).toBe(true);
  });

  it("ติดกระดานซ้ำรอบเดิมไม่ทำให้ผลข้างเคียงเกิดสองรอบ", () => {
    const s = newState();
    sat(s, "me", "midterm", 1);
    const once = s.standing;
    postBoard(s, "midterm");
    expect(s.standing).toBe(once);
  });

  it("กระดานของปีหนึ่งแยกจากของมัธยม แม้ชื่อรอบสอบจะซ้ำกัน", () => {
    const s = newState();
    s.exams["final"] = { score: 95, rank: rankFromScore(95) };
    postBoard(s, "final");
    const schoolRank = myBoardRank(s);
    s.chapter = "uni";
    s.exams["final"] = { score: 20, rank: rankFromScore(20) };
    const uni = postBoard(s, "final");
    expect(uni.find((r) => r.me)!.rank).toBe(rankFromScore(20));
    expect(myBoardRank(s)).toBe(rankFromScore(20));
    expect(schoolRank).toBe(rankFromScore(95));
    expect(schoolRank).toBeLessThan(myBoardRank(s));   // มัธยมได้ดีกว่าปีหนึ่งจริง
  });

  it("อันดับบนกระดานใช้สูตรเดียวกับสมุดพก ไม่ขัดกันเอง", () => {
    expect(rankFromScore(100)).toBe(1);
    expect(rankFromScore(0)).toBe(game.examModel.classSize);
    expect(rankFromScore(80)).toBeLessThan(rankFromScore(40));
  });
});
