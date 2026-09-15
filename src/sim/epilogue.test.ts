import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { epilogues, selfEpilogue, epilogueMinRank } from "./epilogue";
import game from "../../data/game.json";
import chars from "../../data/characters.json";

describe("ใครมีฉากจบให้ดู", () => {
  it("ไม่สนิทกับใครเลย ต้องได้แต่ฉากจบของตัวเอง", () => {
    const s = newState();
    expect(epilogues(s)).toEqual([]);
    expect(selfEpilogue(s)).toBe("epi_self");
  });

  it("สนิทไม่ถึงเกณฑ์ ต้องยังไม่มีปลายทางให้ดู", () => {
    const s = newState();
    s.affinity.ploy = game.affinityRanks[epilogueMinRank] - 1;
    expect(epilogues(s)).toEqual([]);
  });

  it("สนิทพอดีเกณฑ์ ต้องเห็น", () => {
    const s = newState();
    s.affinity.ploy = game.affinityRanks[epilogueMinRank];
    expect(epilogues(s).map((e) => e.charId)).toEqual(["ploy"]);
  });

  it("เรียงจากคนที่สนิทที่สุดลงมา", () => {
    const s = newState();
    s.affinity.ploy = game.affinityRanks[10];
    s.affinity.kanin = game.affinityRanks[5];
    s.affinity.minta = game.affinityRanks[7];
    expect(epilogues(s).map((e) => e.charId)).toEqual(["ploy", "minta", "kanin"]);
  });

  it("ภาคมัธยมต้องไม่โผล่คนของมหาลัย และกลับกัน", () => {
    const s = newState();
    for (const c of chars) s.affinity[c.id] = game.affinityRanks[10];
    expect(epilogues(s).map((e) => e.charId).sort()).toEqual(["kanin", "minta", "palm", "ploy"]);

    s.chapter = "uni";
    expect(epilogues(s).map((e) => e.charId).sort()).toEqual(["nun", "tar"]);
    expect(selfEpilogue(s)).toBe("epi_self_uni");
  });

  it("ทุกคนต้องมีไฟล์บทของตัวเอง ไม่ใช่ชื่อที่เดาเอา", () => {
    for (const c of chars as { id: string; epilogue?: string }[])
      expect(c.epilogue, `${c.id} ยังไม่มี epilogue ใน characters.json`).toBeTruthy();
  });
});
