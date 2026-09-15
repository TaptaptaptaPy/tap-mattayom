import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { claim, checkClaims, toldThem, toldCount } from "./claims";
import game from "../../data/game.json";

const always = () => 0;   // สุ่มแล้วต่ำกว่า checkChance เสมอ = เขาเอามาคุยกันแน่
const never = () => 1;    // ไม่มีวันคุยกัน

/** เดิม `bonds` ใน characters.json ถูกใช้แค่กระเพื่อมตัวเลขความสัมพันธ์
 *  ทั้งที่มันคือแผนที่ว่าใครคุยกับใคร ซึ่งเป็นสิ่งเดียวที่ทำให้การโกหกมีราคา */
describe("คำพูดที่ไม่ตรงกัน", () => {
  it("บอกสองคนที่สนิทกันไม่ตรงกัน แล้วโป๊ะ", () => {
    const s = newState();
    claim(s, "yesterday", "busy", "minta");
    claim(s, "yesterday", "other", "palm");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.flags["caught_lying"]).toBe(true);
  });

  it("โป๊ะแล้วเสียความเชื่อใจทั้งสองคน ไม่ใช่คนเดียว", () => {
    const s = newState();
    // ต้องมีความเชื่อใจให้เสียก่อน — `changeTrust` มีพื้นที่ 0 คนที่ยังไม่ไว้ใจเราอยู่แล้ว
    // เสียอะไรไม่ได้ (ตั้งใจ: โกหกคนแปลกหน้าไม่มีราคา โกหกคนที่ไว้ใจเราถึงมี)
    s.trust["minta"] = 30; s.trust["palm"] = 30;
    const before = { m: s.trust["minta"], p: s.trust["palm"] };
    claim(s, "yesterday", "busy", "minta");
    claim(s, "yesterday", "other", "palm");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.trust["minta"]).toBeLessThan(before.m);
    expect(s.trust["palm"]).toBeLessThan(before.p);
  });

  it("โกหกคนที่ยังไม่ไว้ใจเราอยู่แล้ว ไม่มีอะไรให้เสีย — ราคาจึงอยู่ที่ชื่อเสียงแทน", () => {
    const s = newState();
    const before = s.standing;
    claim(s, "yesterday", "busy", "minta");
    claim(s, "yesterday", "other", "palm");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.trust["minta"]).toBe(0);
    expect(s.standing).toBeLessThan(before);
  });

  it("ผู้เล่นต้องได้รู้ว่าโป๊ะ ไม่ใช่ตัวเลขที่หายไปเงียบๆ", () => {
    const s = newState();
    claim(s, "yesterday", "busy", "minta");
    claim(s, "yesterday", "other", "palm");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.history.some((h) => h.includes("พูดไม่ตรงกัน"))).toBe(true);
    expect(s.offscreenNews.length).toBeGreaterThan(0);
  });

  it("บอกตรงกันทุกคน ไม่มีอะไรเกิดขึ้นแม้เขาจะคุยกัน", () => {
    const s = newState();
    claim(s, "yesterday", "busy", "minta");
    claim(s, "yesterday", "busy", "palm");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.flags["caught_lying"]).toBeUndefined();
  });

  it("สองคนที่ไม่ถูกกันไม่เอาเรื่องมาเทียบกัน — โกหกคนที่เกลียดกันจึงรอด", () => {
    const s = newState();
    expect(game.claims.minBond).toBeGreaterThan(-0.3);   // ผลอิงจาก bonds ploy↔kanin
    claim(s, "yesterday", "busy", "ploy");
    claim(s, "yesterday", "other", "kanin");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.flags["caught_lying"]).toBeUndefined();
  });

  it("โกหกเป็นการพนัน ไม่ใช่โทษที่ตกแน่ๆ", () => {
    const s = newState();
    claim(s, "yesterday", "busy", "minta");
    claim(s, "yesterday", "other", "palm");
    s.dayIndex++;
    checkClaims(s, never);
    expect(s.flags["caught_lying"]).toBeUndefined();
  });

  it("บอกคนละอย่างคนละวันไม่ใช่การโกหก — คนละเมื่อวานกัน", () => {
    const s = newState();
    claim(s, "yesterday", "busy", "minta");
    s.dayIndex++;
    claim(s, "yesterday", "other", "palm");
    s.dayIndex++;
    checkClaims(s, always);
    expect(s.flags["caught_lying"]).toBeUndefined();
  });

  it("เรื่องเก่าถูกทิ้ง state ไม่บวมขึ้นทุกวัน", () => {
    const s = newState();
    claim(s, "yesterday", "busy", "minta");
    s.dayIndex += game.claims.keepDays + 1;
    checkClaims(s, always);
    expect(Object.keys(s.claims).length).toBe(0);
  });

  it("บทถามได้ว่าคืนนี้บอกใครไปแล้วว่าอะไร", () => {
    const s = newState();
    claim(s, "yesterday", "tired", "minta");
    expect(toldThem(s, "yesterday", "minta")).toBe("tired");
    expect(toldCount(s, "yesterday")).toBe(1);
    s.dayIndex++;
    expect(toldCount(s, "yesterday")).toBe(0);   // พรุ่งนี้เป็นเมื่อวานคนละอัน
  });
});
