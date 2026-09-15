import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { computeEnding } from "./ending";
import { joinClub } from "./club";
import { homeOf } from "./home";
import game from "../../data/game.json";

/** โมดูลที่ทั้งเกมเดินไปหา แต่เดิมไม่มีเทสต์ตรงๆ เลยสักอัน
 *  มันเป็นตัวที่ถ้าพังแล้วพังเงียบที่สุด เพราะผู้เล่นเห็นแค่ตัวเลขที่ดู "พอได้" */
const term = () => { const s = newState(); s.dayIndex = game.term.days; return s; };

const scored = (tune: (s: ReturnType<typeof newState>) => void) => {
  const s = term(); tune(s); return computeEnding(s);
};

describe("ปลายทางของเทอม", () => {
  it("ไม่ทำอะไรเลยทั้งเทอม ได้ปลายทางที่แย่ที่สุด", () => {
    const e = scored(() => { /* ปล่อยว่างไว้ */ });
    expect(e.score).toBeLessThan(game.entrance.tiers[game.entrance.tiers.length - 2].min);
  });

  it("คะแนนไม่มีวันติดลบ", () => {
    const e = scored((s) => {
      s.behaviour = 0; s.standing = 0; s.teacher = 0;
      homeOf(s).strain = game.home.strainMax;
    });
    expect(e.score).toBeGreaterThanOrEqual(0);
  });

  it("ครูประจำชั้นมีน้ำหนักจริงในคะแนนปลายทาง", () => {
    const low = scored((s) => { s.teacher = 0; });
    const high = scored((s) => { s.teacher = 100; });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("ผลงานในงานใหญ่ของชมรมมีน้ำหนักจริง", () => {
    const flop = scored((s) => { joinClub(s, "academic"); s.milestoneDone = true; s.flags["milestone_flopped"] = true; });
    const won = scored((s) => { joinClub(s, "academic"); s.milestoneDone = true; s.flags["milestone_won"] = true; });
    expect(won.score).toBeGreaterThan(flop.score);
  });

  it("ไม่ได้ขึ้นเวทีเลย แย่กว่าขึ้นแล้วทำได้ไม่ดี", () => {
    const never = scored((s) => { joinClub(s, "academic"); });
    const flop = scored((s) => { joinClub(s, "academic"); s.milestoneDone = true; s.flags["milestone_flopped"] = true; });
    expect(flop.score).toBeGreaterThan(never.score);
  });

  it("บ้านที่ตึงเป็นตัวหัก ไม่ใช่ตัวบวก", () => {
    const calm = scored(() => { /* บ้านปกติ */ });
    const hard = scored((s) => { homeOf(s).strain = game.home.strainMax; });
    expect(hard.score).toBeLessThan(calm.score);
  });

  it("ผู้เล่นต้องเห็นว่าคะแนนมาจากไหน ไม่ใช่เลขลอยๆ", () => {
    const e = scored((s) => {
      joinClub(s, "academic");
      s.milestoneDone = true; s.flags["milestone_won"] = true;
      s.teacher = 90;
      homeOf(s).gave = 2; homeOf(s).given = 1800;
    });
    expect(e.lines.some((l) => l.includes("ครูประจำชั้น"))).toBe(true);
    expect(e.lines.some((l) => l.includes("งานใหญ่ของชมรม"))).toBe(true);
    expect(e.lines.some((l) => l.includes("ส่งเงินให้ที่บ้าน"))).toBe(true);
  });

  it("เล่นจริงจังต้องต่างจากไม่ทำอะไรเลยอย่างชัดเจน", () => {
    const idle = scored(() => { /* ไม่ทำอะไร */ });
    const keen = scored((s) => {
      for (const k of Object.keys(s.stats) as (keyof typeof s.stats)[]) s.stats[k] = 60;
      s.exams["midterm"] = { score: 88, rank: 3 };
      s.exams["final"] = { score: 92, rank: 2 };
      s.standing = 90; s.teacher = 95;
      joinClub(s, "academic");
      s.milestoneDone = true; s.flags["milestone_won"] = true;
      for (const g of Object.keys(s.grades)) s.grades[g] = 90;
    });
    expect(keen.score - idle.score).toBeGreaterThan(50);
  });

  it("ทุกระดับปลายทางมีชื่อและโทน ไม่มีช่องว่าง", () => {
    for (const t of game.entrance.tiers) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.tone.length).toBeGreaterThan(0);
    }
    // ระดับล่างสุดต้องรับคะแนน 0 ได้ ไม่งั้นจะมีคะแนนที่ไม่มีปลายทางรองรับ
    expect(game.entrance.tiers[game.entrance.tiers.length - 1].min).toBe(0);
  });

  it("น้ำหนักทั้งหมดรวมกันต้องไม่เกิน 1 ไม่งั้นคะแนนสอบจะกลายเป็นตัวลบ", () => {
    const E = game.entrance;
    const carried = E.behaviourWeight + E.clubWeight + E.statWeight +
                    E.standingWeight + E.gpaWeight + E.teacherWeight + E.folioWeight;
    expect(carried).toBeLessThan(1);
  });
});
