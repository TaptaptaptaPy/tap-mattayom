import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { gift, giftedTimes, wantsOf } from "./shop";
import game from "../../data/game.json";

const withItem = (id: string, n = 9) => {
  const s = newState();
  s.inventory[id] = n;
  return s;
};

/** เดิมจับคู่ของฝากด้วย `likes` ซึ่งเป็นค่าสถานะ แปลว่าคนที่ค่าสถานะคล้ายกัน
 *  ชอบของเหมือนกันหมด ทั้งที่สิ่งที่ทำให้ของฝากมีความหมายคือมันเจาะจงกับ *คนคนนั้น* */
describe("ของฝากที่เจาะจงเป็นรายคน", () => {
  it("ทุกคนมีของที่อยากได้และของที่ไม่ใช่", () => {
    for (const id of ["ploy", "kanin", "minta", "palm", "tar", "nun"]) {
      const w = wantsOf(id);
      expect(w?.item?.id).toBeTruthy();
      expect(w?.why.length).toBeGreaterThan(0);
    }
  });

  it("ของที่เขาอยากได้จริงๆ ได้ใจมากกว่าของที่แค่เข้ากับค่าสถานะ", () => {
    const want = withItem("pen");
    gift(want, "pen", "ploy");           // pen คือของที่พลอยอยากได้
    const other = withItem("bracelet");
    gift(other, "bracelet", "ploy");
    expect(want.affinity["ploy"]).toBeGreaterThan(other.affinity["ploy"]);
  });

  it("ของที่เขาอยากได้ยังได้ความเชื่อใจด้วย เพราะมันแปลว่าเราดูเขาอยู่", () => {
    const s = withItem("pen");
    gift(s, "pen", "ploy");
    expect(s.trust["ploy"]).toBeGreaterThan(0);
    expect(s.flags["perfect_gift"]).toBe(true);
  });

  it("ของผิดฝาผิดตัวเสียความเชื่อใจ ไม่ใช่แค่ได้น้อย", () => {
    const s = withItem("cassette");      // cassette คือของที่พลอยไม่ได้อยากได้
    s.trust["ploy"] = 20;
    const before = s.trust["ploy"];
    gift(s, "cassette", "ploy");
    expect(s.trust["ploy"]).toBeLessThan(before);
    expect(s.flags["wrong_gift"]).toBe(true);
  });

  it("ของเดิมซ้ำๆ ได้ใจน้อยลงทุกครั้ง", () => {
    const s = withItem("pen");
    gift(s, "pen", "ploy");
    const first = s.affinity["ploy"];
    gift(s, "pen", "ploy");
    const second = s.affinity["ploy"] - first;
    gift(s, "pen", "ploy");
    const third = s.affinity["ploy"] - first - second;
    expect(second).toBeLessThan(first);
    expect(third).toBeLessThan(second);
  });

  it("ให้ซ้ำมากแค่ไหนก็ยังได้อะไรบ้าง ไม่ติดลบ", () => {
    const s = withItem("pen", 20);
    for (let i = 0; i < 15; i++) gift(s, "pen", "ploy");
    expect(s.affinity["ploy"]).toBeGreaterThan(0);
    expect(giftedTimes(s, "ploy", "pen")).toBe(15);
  });

  it("นับแยกตามคนและตามของ", () => {
    const s = withItem("pen");
    gift(s, "pen", "ploy");
    expect(giftedTimes(s, "ploy", "pen")).toBe(1);
    expect(giftedTimes(s, "minta", "pen")).toBe(0);
    expect(giftedTimes(s, "ploy", "cassette")).toBe(0);
  });

  it("ไม่มีของก็ให้ไม่ได้ และของที่ไม่ใช่ของฝากก็เอาไปให้ไม่ได้", () => {
    const s = newState();
    expect(gift(s, "pen", "ploy")).toContain("ไม่มีของ");
    s.inventory["sheet"] = 1;
    expect(gift(s, "sheet", "ploy")).toContain("ไม่เหมาะ");
  });

  it("ต้องสนิทระดับหนึ่งก่อนถึงจะรู้ว่าเขาอยากได้อะไร", () => {
    // ถ้ารู้ตั้งแต่แรก การรู้จักเขาก็ไม่มีความหมาย
    expect(game.gift.knowAtRank).toBeGreaterThan(0);
  });
});
