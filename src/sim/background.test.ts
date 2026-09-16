import { describe, expect, it } from "vitest";
import game from "../../data/game.json";
import { newState } from "./state";
import { BACKGROUNDS, applyBackground, maxEnergy, trait, backgroundOf } from "./background";
import { knownRegulars, hasMet } from "./presence";
import { rollCatch } from "./discipline";
import { mulberry32 } from "../core/rng";

/** ภูมิหลังคือเหตุผลเดียวที่รอบสองไม่ใช่รอบแรกซ้ำ
 *  ถ้าสองภูมิหลังให้เกมเดียวกัน ก็เท่ากับไม่มีระบบนี้ */
describe("ภูมิหลัง", () => {
  it("ทุกอันมีของครบตามที่หน้าจอสัญญาไว้", () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(4);
    for (const b of BACKGROUNDS) {
      expect(b.name).toBeTruthy();
      expect(b.perk).toBeTruthy();
      expect(b.flaw).toBeTruthy();
      // ทุกอันต้องเปลี่ยนอย่างน้อยหนึ่งอย่างจริงๆ ไม่งั้นมันคือตัวเลือกหลอก
      const changes = Object.keys(b.stats).length + Object.keys(b.traits).length + b.knows.length;
      expect(changes).toBeGreaterThan(0);
    }
  });

  it("ไม่มีสองอันที่ให้ของเหมือนกัน", () => {
    const seen = new Set<string>();
    for (const b of BACKGROUNDS) {
      const key = JSON.stringify([b.stats, b.traits, b.knows.map((k) => k.id)]);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("คนที่รู้จักกันมาก่อน ไม่ต้องไปบังเอิญเจอ และเรารู้ตารางเขาอยู่แล้ว", () => {
    const s = newState(5);
    applyBackground(s, "childhood");
    expect(hasMet(s, "ploy")).toBe(true);
    expect(s.affinity["ploy"]).toBeGreaterThan(0);
    expect(s.memories["ploy"]?.length).toBeGreaterThan(0);
    expect(knownRegulars(s, "library", "after")).toContain("ploy");
    // ส่วนคนอื่นยังต้องไปเจอเอง
    expect(hasMet(s, "kanin")).toBe(false);
  });

  it("เริ่มเปล่าๆ ก็ยังไม่รู้จักใครเลย", () => {
    const s = newState(5);
    applyBackground(s, "transfer");
    for (const c of ["ploy", "kanin", "minta", "palm"]) expect(hasMet(s, c)).toBe(false);
  });

  it("เพดานแรงไม่เท่ากัน และแรงตั้งต้นต้องอยู่ในเพดานของตัวเอง", () => {
    const a = newState(5); applyBackground(a, "kingroom");
    const b = newState(5); applyBackground(b, "transfer");
    expect(maxEnergy(a)).toBeLessThan(maxEnergy(b));
    expect(a.energy).toBe(maxEnergy(a));
  });

  it("ลูกครูโดนจับยากกว่าเด็กซิ่วจริงๆ ไม่ใช่แค่เขียนไว้ในคำโฆษณา", () => {
    const count = (id: string) => {
      const s = newState(5);
      applyBackground(s, id);
      const rnd = mulberry32(99);
      let n = 0;
      for (let i = 0; i < 400; i++) { if (rollCatch(s, 0.34, rnd).caught) n++; s.behaviour = 100; }
      return n;
    };
    expect(count("teacherkid")).toBeLessThan(count("transfer"));
  });

  it("ตัวคูณที่ไม่ได้ระบุคืนค่ากลาง", () => {
    const s = newState(5);
    expect(trait(s, "pay", 1)).toBe(1);
    applyBackground(s, "repeat");
    expect(trait(s, "pay", 1)).toBeGreaterThan(1);
    expect(trait(s, "allowance", 0)).toBe(0);
  });

  it("บทถามได้ว่าเราเป็นใครมาก่อน", () => {
    for (const b of BACKGROUNDS) {
      const s = newState(5);
      applyBackground(s, b.id);
      expect(backgroundOf(s)?.id).toBe(b.id);
    }
  });

  it("เงินตั้งต้นต่างกันมากพอจะรู้สึก", () => {
    const money = BACKGROUNDS.map((b) => {
      const s = newState(5); applyBackground(s, b.id); return s.money;
    });
    expect(Math.max(...money) - Math.min(...money)).toBeGreaterThan(game.money.start);
  });
});
