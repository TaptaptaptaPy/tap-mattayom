import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { seenWith, whoElseIsHere } from "./seen";
import { acceptInvite } from "./chat";
import { stepLives } from "./offscreen";
import game from "../../data/game.json";

/** `where` ใน characters.json บอกอยู่แล้วว่าใครอยู่ที่ไหนตอนไหน
 *  แต่เดิมข้อมูลนั้นถูกใช้แค่ตอนวาดการ์ดสถานที่ ไม่ได้ทำให้การเลือกมีพยาน */
const afterSchool = () => { const s = newState(); s.periodIndex = 2; return s; };

describe("โดนเห็นตอนอยู่กับอีกคน", () => {
  it("ห้องสมุดหลังเลิกเรียนมีทั้งพลอยและปาล์ม", () => {
    const s = afterSchool();
    expect(whoElseIsHere(s, "ploy")).toContain("palm");
  });

  it("ไม่ได้อยู่ที่เดียวกันก็ไม่มีใครเห็น", () => {
    const s = afterSchool();
    expect(whoElseIsHere(s, "minta")).not.toContain("ploy");
  });

  it("คนที่นัดเราไว้แล้วนั่งอยู่ตรงนั้น เจ็บกว่าการผิดนัดเฉยๆ", () => {
    const s = afterSchool();
    s.affinity["palm"] = 40; s.trust["palm"] = 40;
    acceptInvite(s, "palm");
    s.dayIndex++;                       // ถึงวันนัดแล้ว
    const a = s.affinity["palm"], t = s.trust["palm"];
    const r = seenWith(s, "ploy");
    expect(r.find((x) => x.id === "palm")?.hadPlan).toBe(true);
    expect(s.affinity["palm"]).toBeLessThan(a);
    expect(s.trust["palm"]).toBeLessThan(t);
    expect(s.flags["caught_with_other"]).toBe(true);
  });

  it("คนที่ไม่ได้นัดและไม่ได้สนิท ก็แค่อยู่ห้องเดียวกันเฉยๆ", () => {
    const s = afterSchool();
    s.affinity["palm"] = 0;
    expect(seenWith(s, "ploy")).toHaveLength(0);
  });

  it("สนิทพอจะรู้สึก ระยะห่างขยับทีละนิด ไม่ใช่การลงโทษ", () => {
    const s = afterSchool();
    s.affinity["palm"] = game.seen.noticeAffinity + 10;
    const before = s.affinity["palm"];
    seenWith(s, "ploy");
    expect(s.affinity["palm"]).toBeLessThan(before);
    expect(before - s.affinity["palm"]).toBeLessThan(Math.abs(game.seen.caughtAffinity));
    expect(s.flags["noticed_together"]).toBe(true);
  });

  it("เห็นได้วันละครั้งต่อคน ไม่ใช่ทุกครั้งที่เดินผ่าน", () => {
    const s = afterSchool();
    s.affinity["palm"] = 40;
    expect(seenWith(s, "ploy")).toHaveLength(1);
    expect(seenWith(s, "ploy")).toHaveLength(0);
  });

  it("ผู้เล่นต้องได้รู้ว่าโดนเห็น", () => {
    const s = afterSchool();
    s.affinity["palm"] = 40;
    acceptInvite(s, "palm");
    s.dayIndex++;
    seenWith(s, "ploy");
    expect(s.history.some((h) => h.includes("เห็นเราอยู่กับ"))).toBe(true);
    expect(s.offscreenNews.length).toBeGreaterThan(0);
  });
});

/** ระบบ "ระเบิด" ของ Tokimeki Memorial — คนที่ถูกปล่อยไว้จนมีเรื่อง
 *  ไม่ได้แค่เสียใจ เขาเล่าให้เพื่อนฟัง แล้วทั้งวงเย็นชาลงพร้อมกัน */
describe("เรื่องแพร่ไปทั้งวง", () => {
  it("ปล่อยไว้จนมีเรื่อง แล้วคนที่เขาสนิทด้วยก็เย็นชาลงไปด้วย", () => {
    const s = newState();
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
    const s = newState();
    for (let d = 0; d < 40; d++) { s.dayIndex++; stepLives(s); }
    expect(s.history.some((h) => h.includes("เรื่องนี้ไปถึง"))).toBe(true);
  });
});
