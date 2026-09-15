import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { advance } from "./calendar";
import { askAmount, giveHome, homeLevel, homeOf, refuseHome, allowanceCut } from "./home";
import game from "../../data/game.json";

/** เงินไม่มีที่ไปในภาคมัธยม — เทสต์สมดุลจบเทอมด้วยเงินเหลือ 32,000 บาท
 *  เงินที่ไม่มีอะไรให้ใช้แปลว่าการทำงานหาเงินไม่มีความหมาย */
describe("ทางบ้าน", () => {
  it("ยิ่งปลายเทอมยิ่งขอมากขึ้น", () => {
    const early = newState(); early.dayIndex = 10;
    const late = newState(); late.dayIndex = 100;
    expect(askAmount(late)).toBeGreaterThan(askAmount(early));
  });

  it("ปฏิเสธไปแล้วรอบหน้าขอมากขึ้น", () => {
    const s = newState();
    const first = askAmount(s);
    refuseHome(s, true);
    expect(askAmount(s)).toBeGreaterThan(first);
  });

  it("ให้ไปแล้วเงินหายจริง และบ้านคลายลง", () => {
    const s = newState();
    s.money = 5000;
    homeOf(s).strain = 4;
    const want = askAmount(s);
    expect(giveHome(s, want)).toBe(true);
    expect(s.money).toBe(5000 - want);
    expect(homeOf(s).strain).toBeLessThan(4);
    expect(s.flags["helped_home"]).toBe(true);
  });

  it("เงินไม่พอก็ให้ไม่ได้", () => {
    const s = newState();
    s.money = 10;
    expect(giveHome(s, 900)).toBe(false);
    expect(s.money).toBe(10);
  });

  it("ไม่มีจริงๆ ไม่นับว่าปฏิเสธ — นั่นไม่ใช่การเลือก", () => {
    const s = newState();
    refuseHome(s, false);
    expect(homeOf(s).refused).toBe(0);
    expect(s.flags["refused_home"]).toBeUndefined();
    expect(s.flags["broke_at_home"]).toBe(true);
    // แต่บ้านก็ยังตึงขึ้นอยู่ดี
    expect(homeOf(s).strain).toBeGreaterThan(0);
  });

  it("ไม่ให้ทั้งที่มี เจ็บกว่าไม่มีจริงๆ", () => {
    const a = newState(); refuseHome(a, true);
    const b = newState(); refuseHome(b, false);
    expect(homeOf(a).strain).toBeGreaterThan(homeOf(b).strain);
  });

  it("บ้านที่ตึงกดค่าขนมลงจริง — เขาไม่มีจะให้ ไม่ใช่การลงโทษ", () => {
    const s = newState();
    expect(allowanceCut(s)).toBe(0);
    homeOf(s).strain = game.home.hardAt;
    expect(homeLevel(s)).toBe(2);
    expect(allowanceCut(s)).toBeGreaterThan(0);
  });

  it("บ้านที่ตึงทำให้นอนไม่หลับ ไปบวกกับหนี้การนอนที่มีอยู่แล้ว", () => {
    const s = newState();
    homeOf(s).strain = game.home.hardAt;
    const before = s.sleepDebt;
    // เดินจนขึ้นวันใหม่
    for (let i = 0; i < game.periods.length; i++) advance(s, () => 1);
    expect(s.sleepDebt).toBeGreaterThan(before);
  });

  it("บ้านปกติไม่กินแรงอะไรเลย", () => {
    const s = newState();
    for (let i = 0; i < game.periods.length; i++) advance(s, () => 1);
    expect(s.sleepDebt).toBe(0);
  });
});
