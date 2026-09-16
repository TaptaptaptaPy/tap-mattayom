import { describe, expect, it } from "vitest";
import game from "../../data/game.json";
import { newState, type GameState } from "./state";
import { whereIs, whoIsAt, signalAt, learnHabit, knownRegulars, noteEncounter,
         meetSpot, bumpInto, hasMet } from "./presence";
import { acceptInvite } from "./chat";
import { joinClub } from "./club";
import { mulberry32 } from "../core/rng";

const AFTER = game.chat.planPeriod;
const at = (s: GameState, p = 2) => { s.periodIndex = p; return s; };

/** สัญญาหลักของระบบนี้มีสองข้อ และมันขัดกันเอง ต้องคุมทั้งคู่ไว้พร้อมกัน:
 *  1. การเจอกันต้องเป็น *ความบังเอิญ* — ไม่งั้นก็ไม่ใช่การเจอ
 *  2. การ *นัดกันไว้* ต้องเจอแน่ๆ — ไม่งั้นการนัดก็ไม่มีความหมาย */
describe("ใครอยู่ตรงไหน", () => {
  it("คนเดิมไม่ได้อยู่ที่เดิมทุกวัน", () => {
    const s = at(newState(5));
    const spots = new Set<string | null>();
    for (let d = 0; d < 60; d++) { s.dayIndex = d; spots.add(whereIs(s, "ploy", AFTER)); }
    expect(spots.size).toBeGreaterThan(1);
  });

  it("ทอยแล้วต้องได้ค่าเดิมตลอดช่วงเวลานั้น ไม่ใช่สุ่มใหม่ทุกครั้งที่ถาม", () => {
    const s = at(newState(5));
    s.dayIndex = 9;
    const first = whereIs(s, "ploy", AFTER);
    for (let i = 0; i < 20; i++) expect(whereIs(s, "ploy", AFTER)).toBe(first);
  });

  it("เมล็ดคนละเมล็ดได้โลกคนละใบ", () => {
    const a = at(newState(3)), b = at(newState(4));
    a.dayIndex = b.dayIndex = 12;
    let same = 0;
    for (let d = 0; d < 40; d++) {
      a.dayIndex = b.dayIndex = d;
      if (whereIs(a, "ploy", AFTER) === whereIs(b, "ploy", AFTER)) same++;
    }
    expect(same).toBeLessThan(40);
  });

  it("บางวันเขาก็ไม่อยู่ที่ไหนที่เราเดินไปถึงเลย", () => {
    const s = at(newState(5));
    let away = 0;
    for (let d = 0; d < 80; d++) { s.dayIndex = d; if (!whereIs(s, "ploy", AFTER)) away++; }
    expect(away).toBeGreaterThan(0);
  });

  it("นัดไว้แล้วเขาไปรอจริง ทุกครั้ง ไม่ว่าทอยได้อะไร", () => {
    const s = at(newState(11));
    for (let d = 1; d < 30; d++) {
      s.dayIndex = d - 1;
      s.plans = [];
      acceptInvite(s, "minta");
      s.dayIndex = d;
      expect(whereIs(s, "minta", AFTER)).toBe(meetSpot("minta"));
    }
  });

  it("อยู่ชมรมเดียวกันแล้ววันซ้อม เพื่อนร่วมชมรมอยู่ที่ห้องชมรมแน่นอน", () => {
    const s = at(newState(2));
    joinClub(s, "music");
    // หาวันที่ชมรมดนตรีซ้อม (จันทร์/พุธ) แล้วดูว่ามินตราอยู่ห้องดนตรีไหม
    let checked = 0;
    for (let d = 0; d < 30 && checked < 3; d++) {
      s.dayIndex = d;
      const dow = new Date(game.term.startDate + "T00:00:00");
      dow.setDate(dow.getDate() + d);
      if (![1, 3].includes(dow.getDay())) continue;
      checked++;
      expect(whereIs(s, "minta", AFTER)).toBe("musicroom");
    }
    expect(checked).toBe(3);
  });

  it("คุยกับเขาไปแล้ววันนี้ ก็ไม่เจอเขาซ้ำอีกในวันเดียวกัน", () => {
    const s = at(newState(5));
    for (let d = 0; d < 40; d++) {
      s.dayIndex = d;
      const spot = whereIs(s, "ploy", AFTER);
      if (!spot) continue;
      expect(whoIsAt(s, spot, AFTER)).toContain("ploy");
      s.metToday["ploy"] = true;
      expect(whoIsAt(s, spot, AFTER)).not.toContain("ploy");
      return;
    }
    throw new Error("ไม่เจอพลอยเลยสักวันใน 40 วัน");
  });
});

describe("เท่าที่มองเห็นจากกระดาน", () => {
  it("ยังไม่สนิท เห็นแค่ว่ามีคนอยู่ ไม่รู้ว่าใคร", () => {
    const s = at(newState(5));
    for (let d = 0; d < 40; d++) {
      s.dayIndex = d;
      const spot = whereIs(s, "ploy", AFTER);
      if (!spot) continue;
      const sig = signalAt(s, spot, AFTER);
      expect(sig.kind).toBe("someone");
      expect(sig.ids).toHaveLength(0);
      return;
    }
    throw new Error("ไม่เจอพลอยเลยสักวัน");
  });

  it("สนิทพอแล้วจำหลังได้ตั้งแต่ไกล", () => {
    const s = at(newState(5));
    s.affinity["ploy"] = game.affinityRanks[game.presence.recogniseAtRank];
    for (let d = 0; d < 40; d++) {
      s.dayIndex = d;
      const spot = whereIs(s, "ploy", AFTER);
      if (!spot) continue;
      expect(signalAt(s, spot, AFTER).ids).toContain("ploy");
      return;
    }
    throw new Error("ไม่เจอพลอยเลยสักวัน");
  });

  it("เจอเขาที่เดิมซ้ำๆ ถึงจะรู้ว่าเขามักอยู่ตรงนั้น", () => {
    const s = at(newState(5));
    expect(knownRegulars(s, "library", AFTER)).toHaveLength(0);
    s.met["ploy"] = 0;
    for (let i = 0; i < game.presence.knowAt; i++) learnHabit(s, "ploy", AFTER, "library");
    expect(knownRegulars(s, "library", AFTER)).toContain("ploy");
  });
});

describe("รู้จักกันครั้งแรก", () => {
  it("ยังไม่เคยคุยกัน = ยังไม่รู้จัก", () => {
    const s = newState(5);
    expect(hasMet(s, "ploy")).toBe(false);
    expect(noteEncounter(s, "ploy", "library", AFTER)).toBe(true);
    expect(hasMet(s, "ploy")).toBe(true);
    expect(noteEncounter(s, "ploy", "library", AFTER)).toBe(false);
  });
});

describe("เดินสวนกันระหว่างทาง", () => {
  it("คนที่ยังไม่รู้จักไม่มีวันเดินสวนแล้วทักกัน", () => {
    const s = newState(5);
    s.affinity["ploy"] = 30;
    const rnd = mulberry32(3);
    for (let i = 0; i < 200; i++) expect(bumpInto(s, rnd)).toBeNull();
  });

  it("รู้จักกันแล้วถึงจะเดินสวนกันได้ และเกิดเป็นบางครั้ง", () => {
    const s = newState(5);
    s.met["ploy"] = 0;
    s.affinity["ploy"] = 30;
    const rnd = mulberry32(3);
    let n = 0;
    for (let i = 0; i < 200; i++) { s.doneToday = {}; if (bumpInto(s, rnd)) n++; }
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(200);
  });

  /** ของเดิมทอยทุกช่วงเวลา = วันละสี่ครั้ง × 120 วัน ได้ความสนิทฟรีราว 46 แต้มต่อเทอม
   *  ซึ่งพอๆ กับการไปนั่งคุยกับเขาจริงทั้งเทอม โดยไม่ต้องเสียเวลาสักช่วงเดียว */
  it("เดินสวนกันได้วันละครั้ง ไม่ใช่ทุกช่วงเวลา", () => {
    const s = newState(5);
    s.met["ploy"] = 0;
    s.affinity["ploy"] = 30;
    const rnd = () => 0;                       // ทอยได้เสมอ
    expect(bumpInto(s, rnd)).toBe("ploy");
    for (let i = 0; i < 10; i++) expect(bumpInto(s, rnd)).toBeNull();
    s.doneToday = {};                          // ขึ้นวันใหม่
    expect(bumpInto(s, rnd)).toBe("ploy");
  });

  it("ความสนิทที่ได้จากการเดินสวนทั้งเทอม ต้องน้อยกว่าการไปหาเขาจริงไม่กี่ครั้ง", () => {
    const s = newState(5);
    s.met["ploy"] = 0;
    s.affinity["ploy"] = 3;
    const rnd = mulberry32(9);
    for (let d = 0; d < 120; d++) { s.doneToday = {}; bumpInto(s, rnd); }
    // ไปตามนัดครั้งหนึ่งได้ 3 แต้ม — ทั้งเทอมที่เดินสวนกันต้องไม่เกินราวสิบครั้งนั้น
    expect(s.affinity["ploy"] - 3).toBeLessThan(game.chat.keptBonus * 10);
  });
});
