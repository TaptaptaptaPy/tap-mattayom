import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { changeAffinity, takeSide, sideOpen, shiftStanding, standingRank } from "./bonds";
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
