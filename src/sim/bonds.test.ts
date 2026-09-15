import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { changeAffinity, changeTrust, trustFromFlag, takeSide, sideOpen,
         shiftStanding, standingRank } from "./bonds";
import game from "../../data/game.json";
import chars from "../../data/characters.json";

// characters.json ให้ชนิดของ `bonds` ต่างกันไปตามคีย์ที่แต่ละคนมีจริง
// TypeScript เลยมองว่าเป็นคนละชนิดกันทั้งหมด ต้องผ่าน unknown ก่อนถึงจะมองเป็นตารางเดียวกันได้
type Char = { id: string; bonds?: Record<string, number> };
const CHARS = chars as unknown as Char[];
const bondsOf = (id: string) => CHARS.find((c) => c.id === id)?.bonds ?? {};

/** ระบบนี้คือเหตุผลที่ทางเลือก "ส่งผลกับหลายอย่าง" ไม่ใช่กับคนเดียว
 *  ถ้ามันเงียบไปจะไม่มีอะไรฟ้อง เพราะตัวเลขของคนที่เราคุยด้วยก็ยังขึ้นปกติ */
describe("ความสัมพันธ์กระเพื่อมไปถึงคนรอบตัว", () => {
  it("ทุกตัวละครต้องมีวงของตัวเอง ไม่งั้นระบบนี้ไม่มีทางทำงานกับเขา", () => {
    for (const c of CHARS)
      expect(Object.keys(bondsOf(c.id)).length, `${c.id} ไม่มี bonds`).toBeGreaterThan(0);
  });

  it("ทำดีกับคนหนึ่ง เพื่อนของเขา (bond บวก) ต้องขยับตาม", () => {
    const s = newState();
    const friend = Object.entries(bondsOf("ploy")).find(([, w]) => w > 0)![0];
    changeAffinity(s, "ploy", 20);
    expect(s.affinity.ploy).toBe(20);
    expect(s.affinity[friend]).toBeGreaterThan(0);
  });

  it("คนที่ไม่ถูกกัน (bond ลบ) ต้องถอยห่าง ไม่ใช่นิ่งเฉย", () => {
    const s = newState();
    const foe = Object.entries(bondsOf("ploy")).find(([, w]) => w < 0)![0];
    s.affinity[foe] = 50;                       // ต้องมีของให้เสียก่อน
    changeAffinity(s, "ploy", 20);
    expect(s.affinity[foe]).toBeLessThan(50);
  });

  it("ความสัมพันธ์ต้องไม่ติดลบ", () => {
    const s = newState();
    changeAffinity(s, "ploy", -50);
    expect(s.affinity.ploy).toBe(0);
  });
});

describe("เลือกข้าง", () => {
  it("เลือกได้ครั้งเดียวทั้งเทอม อีกฝั่งปิดถาวร", () => {
    const s = newState();
    expect(sideOpen(s, "ploy")).toBe(true);
    expect(sideOpen(s, "kanin")).toBe(true);
    takeSide(s, "ploy");
    expect(s.sided).toBe("ploy");
    expect(sideOpen(s, "ploy")).toBe(true);
    expect(sideOpen(s, "kanin")).toBe(false);
    takeSide(s, "kanin");
    expect(s.sided, "เลือกซ้ำต้องไม่เปลี่ยนใจให้").toBe("ploy");
  });

  it("เลือกข้างแล้วคนที่ไม่ถูกกับเขาต้องถอยห่างจริง", () => {
    const s = newState();
    const foe = Object.entries(bondsOf("ploy")).find(([, w]) => w < 0)![0];
    s.affinity[foe] = 60;
    takeSide(s, "ploy");
    expect(s.affinity[foe]).toBeLessThan(60);
  });
});

describe("ชื่อเสียงในโรงเรียน", () => {
  it("อยู่ในช่วง 0-100 เสมอ", () => {
    const s = newState();
    shiftStanding(s, 999);
    expect(s.standing).toBe(100);
    shiftStanding(s, -999);
    expect(s.standing).toBe(0);
  });

  it("ระดับต้องไล่ขึ้นตามตัวเลข ไม่ข้ามขั้นและไม่ย้อนกลับ", () => {
    let last = -1;
    for (let v = 0; v <= 100; v++) {
      const r = standingRank(v);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
    expect(standingRank(100)).toBe(4);
    expect(standingRank(0)).toBe(0);
  });
});

/** ความเชื่อใจเป็นคนละแกนกับความสนิท ถ้าสองอันนี้ขยับพร้อมกันเสมอ
 *  การแยกออกมาก็ไม่ได้อะไร เทสต์ชุดนี้พิสูจน์ว่ามันแยกกันได้จริง */
describe("ความเชื่อใจ", () => {
  it("ขยับได้โดยที่ความสนิทไม่ขยับ และกลับกัน", () => {
    const s = newState();
    changeAffinity(s, "ploy", 30);
    expect(s.trust.ploy).toBe(0);            // สนิทขึ้นโดยไม่ได้ไว้ใจขึ้น
    changeTrust(s, "kanin", 10);
    expect(s.affinity.kanin).toBe(0);        // ไว้ใจขึ้นโดยไม่ได้สนิทขึ้น
  });

  it("ไม่กระจายตอนได้ แต่กระจายตอนเสีย", () => {
    const friend = Object.entries(bondsOf("ploy")).find(([, w]) => w > 0)![0];
    const up = newState();
    changeTrust(up, "ploy", 20);
    expect(up.trust[friend], "ความเชื่อใจเป็นเรื่องส่วนตัว ไม่ควรกระจายตอนได้").toBe(0);

    const down = newState();
    down.trust.ploy = 30; down.trust[friend] = 30;
    changeTrust(down, "ploy", -20);
    expect(down.trust[friend], "เรื่องที่ทำให้คนหนึ่งเลิกไว้ใจ ไปถึงหูคนที่เขาสนิทเสมอ")
      .toBeLessThan(30);
  });

  it("ไม่ติดลบ", () => {
    const s = newState();
    changeTrust(s, "ploy", -50);
    expect(s.trust.ploy).toBe(0);
  });

  it("ธงจากบทแปลงเป็นความเชื่อใจให้เอง", () => {
    const s = newState();
    trustFromFlag(s, "ploy_refused");        // ไม่ยอมแก้คะแนนให้ครู = ทำสิ่งที่ยาก
    expect(s.trust.ploy).toBeGreaterThan(0);
    const before = s.trust.ploy;
    trustFromFlag(s, "ploy_complied");       // ยอมแก้ = เลือกทางที่สบายกว่า
    expect(s.trust.ploy).toBeLessThan(before);
  });

  it("ธงที่ไม่อยู่ในตารางต้องไม่ทำอะไรเลย", () => {
    const s = newState();
    trustFromFlag(s, "ธงที่ไม่มีจริง");
    expect(Object.values(s.trust).every((v) => v === 0)).toBe(true);
  });

  it("เลือกข้างแล้วคนที่ถูกเลือกไว้ใจขึ้น คนที่ไม่ถูกเลือกไว้ใจลง", () => {
    const s = newState();
    const foe = Object.entries(bondsOf("ploy")).find(([, w]) => w < 0)![0];
    s.trust[foe] = 20;
    takeSide(s, "ploy");
    expect(s.trust.ploy).toBeGreaterThan(0);
    expect(s.trust[foe]).toBeLessThan(20);
  });

  it("ทุกธงในตารางต้องชี้ไปที่ตัวละครที่มีอยู่จริง", () => {
    const ids = new Set(CHARS.map((c) => c.id));
    for (const [flag, rule] of Object.entries(game.trustFlags as unknown as Record<string, [string, number]>))
      expect(ids.has(rule[0]), `${flag} ชี้ไปที่ ${rule[0]} ซึ่งไม่มีตัวนี้`).toBe(true);
  });
});
