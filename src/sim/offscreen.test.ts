import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { stepLives, visited, takeNews, lifeOf } from "./offscreen";
import { lastMemory, memoryCount, trustFromFlag } from "./bonds";
import game from "../../data/game.json";

const days = (s: ReturnType<typeof newState>, n: number) => {
  for (let i = 0; i < n; i++) { s.dayIndex++; stepLives(s); }
};

/** เดิมตัวละครมีชีวิตเฉพาะตอนเราเดินไปหา ไม่ไปก็เหมือนเวลาหยุดรอให้
 *  ซึ่งทำให้การเลือกว่าจะไปหาใครไม่มีราคาอะไรเลย */
describe("โลกเดินตอนเราไม่อยู่", () => {
  it("ไม่ไปหาใครเลย แรงกดดันของทุกคนขึ้น", () => {
    const s = newState();
    days(s, 3);
    expect(lifeOf(s, "ploy").pressure).toBeGreaterThan(0);
  });

  it("ไปหาแล้วแรงกดดันลดลง", () => {
    const s = newState();
    days(s, 5);
    const before = lifeOf(s, "ploy").pressure;
    visited(s, "ploy");
    expect(lifeOf(s, "ploy").pressure).toBeLessThan(before);
  });

  it("ปล่อยไว้นานพอ เรื่องเกิดขึ้นเองโดยที่เราไม่อยู่", () => {
    const s = newState();
    days(s, 30);
    const l = lifeOf(s, "ploy");
    expect(l.fired, "ควรมีอย่างน้อยหนึ่งเรื่องเกิดขึ้น").toBeGreaterThan(0);
    expect(s.flags.ploy_alone_load, "เรื่องที่เกิดต้องตั้งธงไว้ให้บทหยิบไปใช้ได้").toBe(true);
  });

  it("ผู้เล่นต้องได้รู้ ไม่งั้นเหมือนไม่มีระบบนี้เลย", () => {
    const s = newState();
    days(s, 30);
    const news = takeNews(s);
    expect(news.length).toBeGreaterThan(0);
    expect(s.history.some((h) => h.includes(news[0])), "ต้องถูกจดลงสมุดบันทึกด้วย").toBe(true);
    expect(takeNews(s), "อ่านแล้วต้องถูกล้าง ไม่ขึ้นซ้ำ").toEqual([]);
  });

  it("คนที่เราสนิทและไว้ใจพอ ไม่มีเรื่องเกิดเลย — ระบบนี้ต้องเป็นผลของการเลือก", () => {
    const lonely = newState();
    const held = newState();
    held.affinity.ploy = game.affinityRanks[10];
    held.trust.ploy = game.trust.ranks[5];
    days(lonely, 40); days(held, 40);
    expect(lifeOf(lonely, "ploy").fired).toBeGreaterThan(0);
    expect(lifeOf(held, "ploy").fired,
      "ดูแลเขาดีแล้วยังมีเรื่องอยู่ดี = การเลือกไม่มีความหมาย").toBe(0);
  });

  it("ตัวละครของอีกบทต้องไม่มีเรื่องเกิดตอนเรายังอยู่บทนี้", () => {
    const s = newState();
    days(s, 30);
    expect(lifeOf(s, "tar").fired, "ต้าร์เป็นคนของมหาลัย ยังไม่ควรมีเรื่อง").toBe(0);
  });
});

describe("ความทรงจำรายคน", () => {
  it("ธงที่มีข้อความจำ กลายเป็นเรื่องที่เขาจำได้", () => {
    const s = newState();
    trustFromFlag(s, "ploy_refused");
    expect(memoryCount(s, "ploy")).toBe(1);
    expect(lastMemory(s, "ploy")).not.toBe("");
  });

  it("ธงที่ไม่มีข้อความจำ ขยับแต่ความเชื่อใจ", () => {
    const s = newState();
    trustFromFlag(s, "ploy_knows_pressure");
    expect(s.trust.ploy).toBeGreaterThan(0);
    expect(memoryCount(s, "ploy")).toBe(0);
  });

  it("จำเรื่องเดิมซ้ำไม่ได้", () => {
    const s = newState();
    trustFromFlag(s, "ploy_refused");
    trustFromFlag(s, "ploy_refused");
    expect(memoryCount(s, "ploy")).toBe(1);
  });

  it("ความทรงจำเป็นของใครของมัน ไม่ปนกัน", () => {
    const s = newState();
    trustFromFlag(s, "ploy_refused");
    expect(memoryCount(s, "kanin")).toBe(0);
  });
});
