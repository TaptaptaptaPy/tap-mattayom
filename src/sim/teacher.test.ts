import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { doHomework, settleHomework } from "./homework";
import { rollCatch } from "./discipline";
import { maybeCallHome, noteBehaviour, teacherLevel, teacherShields } from "./teacher";
import { homeOf } from "./home";
import game from "../../data/game.json";

const T = game.teacher;

/** ฝ่ายปกครองเดิมเป็นกลไกล้วน — ทอยลูกเต๋า หักคะแนน จบ ไม่มีใครอยู่ตรงนั้นเลยสักคน */
describe("ครูประจำชั้น", () => {
  it("ส่งการบ้านแล้วครูเห็น", () => {
    const s = newState();
    s.homework = 3;
    const before = s.teacher;
    doHomework(s);
    expect(s.teacher).toBeGreaterThan(before);
  });

  it("ไม่ส่งการบ้านแล้วครูเห็นเหมือนกัน", () => {
    const s = newState();
    s.homework = 3;
    const before = s.teacher;
    settleHomework(s, true);
    expect(s.teacher).toBeLessThan(before);
  });

  it("ครูที่ไว้ใจเราพูดแทนเราได้ตอนโดนจับ", () => {
    const s = newState();
    s.teacher = 100;
    expect(teacherLevel(s)).toBe(2);
    const r = teacherShields(s, 10);
    expect(r.penalty).toBeLessThan(10);
    expect(r.saved).toBe(true);
    expect(s.flags["kru_spoke_for_us"]).toBe(true);
  });

  it("ครูที่ยังไม่ไว้ใจเราไม่พูดแทน", () => {
    const s = newState();
    s.teacher = 50;
    expect(teacherShields(s, 10)).toEqual({ penalty: 10, saved: false });
  });

  it("โดนจับแล้วครูเห็น และโทษถูกหักจริง", () => {
    const s = newState();
    const before = s.teacher;
    const r = rollCatch(s, 1, () => 0);
    expect(r.caught).toBe(true);
    expect(s.teacher).toBeLessThan(before);
    expect(s.behaviour).toBeLessThan(game.behaviour.start);
  });

  it("เด็กมีปัญหาแล้วครูโทรหาที่บ้าน ซึ่งไปเพิ่มความตึงของบ้านจริง", () => {
    const s = newState();
    s.teacher = 0;
    s.behaviour = 10;
    const before = homeOf(s).strain;
    expect(maybeCallHome(s)).toBe(true);
    expect(homeOf(s).strain).toBeGreaterThan(before);
    expect(s.flags["kru_called_home"]).toBe(true);
  });

  it("ครูไม่ได้โทรทุกสัปดาห์ — เรื่องเดิมโทรซ้ำคือการกดตัวเลข ไม่ใช่การเล่าเรื่อง", () => {
    const s = newState();
    s.teacher = 0; s.behaviour = 10;
    expect(maybeCallHome(s)).toBe(true);
    expect(maybeCallHome(s)).toBe(false);
    s.dayIndex += T.callCooldownDays;
    expect(maybeCallHome(s)).toBe(true);
  });

  it("ความประพฤติดีอยู่ ครูก็ไม่โทรแม้จะยังไม่ไว้ใจ", () => {
    const s = newState();
    s.teacher = 0;
    expect(maybeCallHome(s)).toBe(false);
  });

  it("ข้ามเส้นแล้วผู้เล่นได้รู้ ไม่ใช่ตัวเลขที่ขยับเงียบๆ", () => {
    const s = newState();
    noteBehaviour(s, 100, "ทดสอบ");
    expect(s.flags["kru_trusts"]).toBe(true);
    const b = newState();
    noteBehaviour(b, -100, "ทดสอบ");
    expect(b.flags["kru_watches"]).toBe(true);
    expect(b.history.length).toBeGreaterThan(0);
  });

  it("ค่านี้ไม่หลุดออกนอกช่วง 0-100", () => {
    const s = newState();
    noteBehaviour(s, 9999, "x");
    expect(s.teacher).toBe(100);
    noteBehaviour(s, -9999, "x");
    expect(s.teacher).toBe(0);
  });
});
