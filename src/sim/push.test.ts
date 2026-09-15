import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { canPush, debtLevel, dozeOff, isSick, push, stepSickness, whyNoPush } from "./push";
import { availableLocations, doAction } from "./actions";
import game from "../../data/game.json";

const always = () => 0;
const never = () => 1;

/** แรงเคยเป็น *กำแพง* — ต่ำกว่าเกณฑ์แล้วปุ่มทุกปุ่มดับ ผู้เล่นไม่ได้เลือกอะไรเลย
 *  ตอนนี้มันเป็น *ทางเลือก* ที่มีราคาตกอยู่ที่วันพรุ่งนี้ */
describe("ฝืนต่อทั้งที่หมดแรง", () => {
  /** เช้าไม่มีกิจกรรมให้เลือกเลย ต้องเลื่อนไปช่วงหลังเลิกเรียนก่อนเสมอ */
  const afterSchool = () => { const s = newState(); s.periodIndex = 2; return s; };

  const tiredAction = (s: ReturnType<typeof newState>) => {
    const loc = availableLocations(s).find((l) => l.action && l.action.energy < 0 && !l.blocked && !l.action.cost);
    expect(loc, "ต้องมีกิจกรรมที่เปลืองแรงให้ทดสอบ").toBeTruthy();
    return loc!;
  };

  it("แรงต่ำแล้วทำไม่ได้ถ้าไม่ฝืน — กำแพงยังอยู่สำหรับคนที่ไม่เลือก", () => {
    const s = afterSchool();
    s.energy = 5;
    const r = doAction(s, tiredAction(s), never, false);
    expect(r!.ok).toBe(false);
  });

  it("เลือกฝืนแล้วทำได้จริง", () => {
    const s = afterSchool();
    s.energy = 5;
    const r = doAction(s, tiredAction(s), never, true);
    expect(r!.ok).toBe(true);
    expect(r!.forced).toBe(true);
  });

  it("ฝืนแล้วได้ของน้อยกว่าทำตอนแรงเต็ม", () => {
    const full = afterSchool();
    const a = doAction(full, tiredAction(full), never, false);
    const tired = afterSchool();
    tired.energy = 5;
    const b = doAction(tired, tiredAction(tired), never, true);
    const num = (m: string) => Number(m.match(/\+([\d.]+)/)![1]);
    expect(num(b!.message)).toBeLessThan(num(a!.message));
  });

  it("ฝืนแล้วเป็นหนี้การนอน และหนี้ไปหักแรงที่ควรได้คืนพรุ่งนี้", () => {
    const s = newState();
    expect(s.sleepDebt).toBe(0);
    push(s);
    expect(s.sleepDebt).toBe(game.push.debtPerPush);
    expect(s.flags["pushed_through"]).toBe(true);
  });

  it("เงินไม่พอยังเป็นกำแพงอยู่ — ฝืนไม่ได้ซื้อของให้", () => {
    const s = afterSchool();
    s.money = 0;
    const paid = availableLocations(s).find((l) => l.action?.cost && !l.blocked);
    if (!paid) return;
    const r = doAction(s, paid, never, true);
    expect(r!.ok).toBe(false);
    expect(r!.message).toBe("เงินไม่พอ");
  });

  it("ฝืนมากจนถึงเพดานแล้วร่างกายไม่ยอมอีก", () => {
    const s = newState();
    s.sleepDebt = game.push.maxDebt;
    expect(canPush(s)).toBe(false);
    expect(whyNoPush(s)).toBeTruthy();
  });

  it("หนี้ถึงระดับหนึ่งแล้วหลับในคาบ คาบนั้นเสียเปล่าและครูเห็น", () => {
    const s = newState();
    s.sleepDebt = game.push.dozeAt;
    const before = s.behaviour;
    expect(dozeOff(s, always)).toBeTruthy();
    expect(s.behaviour).toBeLessThan(before);
    expect(s.flags["dozed_in_class"]).toBe(true);
  });

  it("หนี้น้อยไม่หลับในคาบ ไม่ว่าจะซวยแค่ไหน", () => {
    const s = newState();
    s.sleepDebt = game.push.dozeAt - 1;
    expect(dozeOff(s, always)).toBeNull();
    expect(debtLevel(s)).toBe(0);
  });

  it("ฝืนสะสมจนล้มป่วย เสียทั้งวัน ไม่ใช่แค่แรง และผู้เล่นได้รู้", () => {
    const s = newState();
    s.sleepDebt = game.push.sickAt;
    expect(stepSickness(s, always)).toBeTruthy();
    expect(isSick(s)).toBe(true);
    expect(s.energy).toBeLessThanOrEqual(game.push.sickEnergy);
    expect(s.history.some((h) => h.includes("ลุกไม่ไหว"))).toBe(true);
    expect(s.offscreenNews.length).toBeGreaterThan(0);
  });

  it("ล้มป่วยเป็นความเสี่ยง ไม่ใช่โทษที่ตกแน่ๆ", () => {
    const s = newState();
    s.sleepDebt = game.push.sickAt;
    expect(stepSickness(s, never)).toBeNull();
    expect(isSick(s)).toBe(false);
  });

  it("วันที่ป่วยฝืนไม่ได้เลย ต่อให้ยังไม่ถึงเพดานหนี้", () => {
    const s = newState();
    s.sleepDebt = 0;
    s.flags["sick_today"] = true;
    expect(canPush(s)).toBe(false);
  });
});
