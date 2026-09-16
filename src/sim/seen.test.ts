import { describe, expect, it } from "vitest";
import { newState, type GameState } from "./state";
import { seenWith, whoElseIsHere } from "./seen";
import { acceptInvite } from "./chat";
import { stepLives } from "./offscreen";
import { whereIs } from "./presence";
import game from "../../data/game.json";

/** ตั้งแต่ตารางชีวิตกลายเป็นการทอย (src/sim/presence.ts) การที่สองคนอยู่ที่เดียวกัน
 *  ไม่ใช่ของตายอีกแล้ว เทสต์จึงต้อง *หาวัน* ที่มันเกิดขึ้นจริง แทนที่จะสมมติว่าเกิดทุกวัน
 *  ซึ่งก็คือสิ่งที่เราอยากยืนยัน: มันยังเกิดได้อยู่ และเกิดเป็นบางวันเท่านั้น */
function dayTogether(a: string, b: string, period = 2): { s: GameState; at: string } {
  for (let seed = 1; seed < 40; seed++) {
    const s = newState(seed);
    s.periodIndex = period;
    for (let d = 0; d < 60; d++) {
      s.dayIndex = d;
      const at = whereIs(s, a, game.periods[period].id);
      if (at && whereIs(s, b, game.periods[period].id) === at) return { s, at };
    }
  }
  throw new Error(`ไม่มีวันไหนที่ ${a} กับ ${b} อยู่ที่เดียวกันเลย — ตารางชีวิตอาจไม่ทับกันแล้ว`);
}

describe("โดนเห็นตอนอยู่กับอีกคน", () => {
  it("มีวันที่พลอยกับปาล์มบังเอิญอยู่ที่เดียวกัน", () => {
    const { s } = dayTogether("ploy", "palm");
    expect(whoElseIsHere(s, "ploy")).toContain("palm");
  });

  it("แต่ไม่ใช่ทุกวัน — ถ้าเจอกันทุกวันก็ไม่ใช่ความบังเอิญ", () => {
    const s = newState(7);
    s.periodIndex = 2;
    let together = 0;
    for (let d = 0; d < 60; d++) {
      s.dayIndex = d;
      if (whoElseIsHere(s, "ploy").includes("palm")) together++;
    }
    expect(together).toBeGreaterThan(0);
    expect(together).toBeLessThan(60);
  });

  it("คนที่นัดเราไว้แล้วนั่งอยู่ตรงนั้น เจ็บกว่าการผิดนัดเฉยๆ", () => {
    const { s, at } = dayTogether("ploy", "palm");
    s.affinity["palm"] = 40; s.trust["palm"] = 40;
    s.dayIndex--;                       // ย้อนไปหนึ่งวันเพื่อนัดของ "พรุ่งนี้"
    acceptInvite(s, "palm");
    s.dayIndex++;                       // ถึงวันนัดแล้ว
    const a = s.affinity["palm"], t = s.trust["palm"];
    const r = seenWith(s, "ploy", at);
    expect(r.find((x) => x.id === "palm")?.hadPlan).toBe(true);
    expect(s.affinity["palm"]).toBeLessThan(a);
    expect(s.trust["palm"]).toBeLessThan(t);
    expect(s.flags["caught_with_other"]).toBe(true);
  });

  it("คนที่ไม่ได้นัดและไม่ได้สนิท ก็แค่อยู่ห้องเดียวกันเฉยๆ", () => {
    const { s, at } = dayTogether("ploy", "palm");
    s.affinity["palm"] = 0;
    expect(seenWith(s, "ploy", at)).toHaveLength(0);
  });

  it("สนิทพอจะรู้สึก ระยะห่างขยับทีละนิด ไม่ใช่การลงโทษ", () => {
    const { s, at } = dayTogether("ploy", "palm");
    s.affinity["palm"] = game.seen.noticeAffinity + 10;
    const before = s.affinity["palm"];
    seenWith(s, "ploy", at);
    expect(s.affinity["palm"]).toBeLessThan(before);
    expect(before - s.affinity["palm"]).toBeLessThan(Math.abs(game.seen.caughtAffinity));
    expect(s.flags["noticed_together"]).toBe(true);
  });

  it("เห็นได้วันละครั้งต่อคน ไม่ใช่ทุกครั้งที่เดินผ่าน", () => {
    const { s, at } = dayTogether("ploy", "palm");
    s.affinity["palm"] = 40;
    expect(seenWith(s, "ploy", at)).toHaveLength(1);
    expect(seenWith(s, "ploy", at)).toHaveLength(0);
  });

  it("ผู้เล่นต้องได้รู้ว่าโดนเห็น", () => {
    const { s, at } = dayTogether("ploy", "palm");
    s.affinity["palm"] = 40;
    s.dayIndex--;
    acceptInvite(s, "palm");
    s.dayIndex++;
    seenWith(s, "ploy", at);
    expect(s.history.some((h) => h.includes("เห็นเราอยู่กับ"))).toBe(true);
    expect(s.offscreenNews.length).toBeGreaterThan(0);
  });
});

/** ระบบ "ระเบิด" ของ Tokimeki Memorial — คนที่ถูกปล่อยไว้จนมีเรื่อง
 *  ไม่ได้แค่เสียใจ เขาเล่าให้เพื่อนฟัง แล้วทั้งวงเย็นชาลงพร้อมกัน */
describe("เรื่องแพร่ไปทั้งวง", () => {
  it("ปล่อยไว้จนมีเรื่อง แล้วคนที่เขาสนิทด้วยก็เย็นชาลงไปด้วย", () => {
    const s = newState(1);
    for (const id of ["ploy", "kanin", "minta", "palm"]) s.affinity[id] = 40;
    const before = { ...s.affinity };
    for (let d = 0; d < 40; d++) { s.dayIndex++; stepLives(s); }
    expect(s.flags["gossip_spread"]).toBe(true);
    // คนที่เราไม่ได้ทำอะไรด้วยเลยก็โดนไปด้วย เพราะเขาคุยกัน
    const cooled = ["ploy", "kanin", "minta", "palm"].filter((id) => s.affinity[id] < before[id]);
    expect(cooled.length).toBeGreaterThan(1);
  });

  it("คนที่ไม่ถูกกันไม่เอาเรื่องไปเล่าให้ฟัง", () => {
    // ปลอยกับกนินมี bond ติดลบ ระเบิดของฝ่ายหนึ่งจึงไม่ควรวิ่งไปอีกฝ่ายผ่านเส้นนั้น
    expect(game.offscreen.gossipMinBond).toBeGreaterThan(0);
  });

  it("ผู้เล่นต้องได้รู้ว่าเรื่องแพร่", () => {
    const s = newState(1);
    for (let d = 0; d < 40; d++) { s.dayIndex++; stepLives(s); }
    expect(s.history.some((h) => h.includes("เรื่องนี้ไปถึง"))).toBe(true);
  });
});
