import { describe, expect, it } from "vitest";
import game from "../../data/game.json";
import { newState } from "./state";
import { CLUES, takeClue, clueCount, plotStage, advancePlot, plotOnEvent, backers,
         verdictOptions, settleVerdict, suspect, suspectLevel, plotAim,
         canSearchArchive, clueReady, hasClue } from "./plot";
import { noteBehaviour } from "./teacher";

/** แกนของทั้งเทอม — ถ้าเส้นนี้ขาด เกมกลับไปเป็นการไต่ตัวเลขไปจนหมดวันเหมือนเดิม */
describe("เรื่องหลัก: สมุดปกแดง", () => {
  it("เดินไปตามปฏิทิน ไม่ใช่เดินเอง", () => {
    const s = newState(1);
    expect(plotStage(s)).toBe(0);
    plotOnEvent(s, "mp_book");
    expect(plotStage(s)).toBe(1);
    plotOnEvent(s, "mp_gone");
    expect(plotStage(s)).toBe(2);
    // เหตุการณ์อื่นไม่เลื่อนองก์
    plotOnEvent(s, "sports_day");
    expect(plotStage(s)).toBe(2);
  });

  it("องก์ถอยหลังไม่ได้", () => {
    const s = newState(1);
    advancePlot(s, 3, "ข้ามมา");
    advancePlot(s, 1, "ถอย");
    expect(plotStage(s)).toBe(3);
  });

  it("เบาะแสครบเกณฑ์แล้วปะติดปะต่อได้เอง", () => {
    const s = newState(1);
    plotOnEvent(s, "mp_gone");
    for (const c of CLUES.slice(0, game.plot.cluesToSolve)) takeClue(s, c.id);
    expect(clueCount(s)).toBe(game.plot.cluesToSolve);
    expect(plotStage(s)).toBe(3);
  });

  it("เก็บเบาะแสซ้ำไม่ได้", () => {
    const s = newState(1);
    expect(takeClue(s, CLUES[0].id)).toBe(true);
    expect(takeClue(s, CLUES[0].id)).toBe(false);
    expect(takeClue(s, "ไม่มีชิ้นนี้")).toBe(false);
    expect(hasClue(s, CLUES[0].id)).toBe(true);
  });

  /** ความเชื่อใจต้องเป็น *กลไกของเรื่อง* ไม่ใช่ตัวเลขข้างเคียง
   *  ไม่สนิทกับใครเลย = ไม่มีวันรู้ความจริง นั่นคือทั้งหมดของการออกแบบนี้ */
  it("คนจะเล่าให้ฟังก็ต่อเมื่อไว้ใจเราถึงระดับที่กำหนด", () => {
    const s = newState(1);
    plotOnEvent(s, "mp_gone");
    const c = CLUES.find((x) => x.from === "ploy")!;
    expect(clueReady(s, "ploy")).toBeNull();
    s.trust["ploy"] = game.trust.ranks[c.trust];
    expect(clueReady(s, "ploy")?.id).toBe(c.id);
  });

  it("ยังไม่ถึงองก์ที่ถาม ก็ยังไม่มีใครเล่าอะไร", () => {
    const s = newState(1);
    s.trust["ploy"] = 99;
    expect(clueReady(s, "ploy")).toBeNull();
  });

  it("ค้นแฟ้มเก่าได้เฉพาะที่ห้องสมุด ในองก์ที่ถูก และครั้งเดียว", () => {
    const s = newState(1);
    expect(canSearchArchive(s, "library")).toBe(false);
    plotOnEvent(s, "mp_gone");
    expect(canSearchArchive(s, "library")).toBe(true);
    expect(canSearchArchive(s, "canteen")).toBe(false);
    takeClue(s, "clue_page");
    expect(canSearchArchive(s, "library")).toBe(false);
  });

  /** ทางที่หนักที่สุดต้องเปิดได้จริง ไม่ใช่เขียนไว้แล้วไม่มีใครไปถึง */
  it("พูดถึงคนที่สั่งได้ต่อเมื่อรู้ความจริง *และ* มีคนยืนขึ้นด้วย", () => {
    const s = newState(1);
    plotOnEvent(s, "mp_gone");
    for (const c of CLUES.slice(0, game.plot.cluesToSolve)) takeClue(s, c.id);
    const locked = verdictOptions(s).find((v) => v.id === "teacher");
    expect(locked?.need, "ยังไม่มีใครยืนด้วย แต่ทางกลับเปิดแล้ว").toBeTruthy();

    for (const id of ["ploy", "kanin"]) {
      s.met[id] = 0;
      s.trust[id] = game.trust.ranks[game.plot.backerTrust];
    }
    expect(backers(s).length).toBeGreaterThanOrEqual(game.plot.backersToAccuse);
    expect(verdictOptions(s).find((v) => v.id === "teacher")?.need).toBeNull();
  });

  it("คนที่ยังไม่เคยเจอกันไม่มีวันมายืนข้างเรา", () => {
    const s = newState(1);
    s.trust["ploy"] = 99;                       // ไว้ใจสุดๆ แต่ไม่เคยเจอกัน
    expect(backers(s)).toHaveLength(0);
  });

  it("เงียบกับรับไปเองเปิดได้เสมอ — เรื่องต้องจบได้แม้ไม่ได้สืบอะไรเลย", () => {
    const s = newState(1);
    const ids = verdictOptions(s).map((v) => v.id);
    expect(ids).toContain("silent");
    expect(ids).toContain("self");
    expect(ids).not.toContain("blame");
  });

  it("ให้การแล้วเรื่องปิด และธงถูกตั้งให้ฉากจบอ่าน", () => {
    const s = newState(1);
    settleVerdict(s, "teacher");
    expect(plotStage(s)).toBe(4);
    expect(s.flags["plot_teacher"]).toBe(true);
    expect(s.plot.verdict).toBe("teacher");
  });

  /** สิ่งที่ครูเห็นเราทำมาทั้งเทอม คือสิ่งที่พูดแทนเราในห้องประชุมก่อนที่เราจะได้พูดเอง */
  it("ความสงสัยขึ้นจากสิ่งที่ครูเห็น และลงจากความรับผิดชอบ", () => {
    const s = newState(1);
    expect(suspectLevel(s)).toBe(0);
    for (let i = 0; i < 12; i++) noteBehaviour(s, game.teacher.perCaught, "โดนจับ");
    expect(suspectLevel(s)).toBeGreaterThan(0);
    const high = s.plot.suspect;
    for (let i = 0; i < 40; i++) noteBehaviour(s, game.teacher.perHomework, "ส่งงาน");
    expect(s.plot.suspect).toBeLessThan(high);
  });

  it("ความสงสัยไม่หลุดออกนอกช่วง 0-100", () => {
    const s = newState(1);
    suspect(s, -999);
    expect(s.plot.suspect).toBe(0);
    suspect(s, 999);
    expect(s.plot.suspect).toBe(100);
    expect(suspectLevel(s)).toBe(2);
  });

  /** ผู้เล่นต้องรู้เสมอว่าตอนนี้เรื่องอยู่ตรงไหนและกำลังรออะไร
   *  ไม่งั้นก็กลับไปเป็นเกมที่ไม่มีอะไรบอกว่าเล่นไปเพื่ออะไรเหมือนเดิม */
  it("การ์ดจุดมุ่งหมายบอกได้ทุกองก์ และไม่โผล่ก่อนเรื่องเริ่ม", () => {
    const s = newState(1);
    expect(plotAim(s)).toBeNull();
    for (const st of [1, 2, 3, 4]) {
      advancePlot(s, st, "ทดสอบ");
      const aim = plotAim(s)!;
      expect(aim.title, `องก์ ${st} ไม่มีชื่อ`).toBeTruthy();
      expect(aim.aim, `องก์ ${st} ไม่บอกว่ารออะไร`).toBeTruthy();
      expect(aim.note, `องก์ ${st} ไม่บอกว่าคืบไปถึงไหน`).toBeTruthy();
    }
  });

  it("ทุกเบาะแสมีเจ้าของที่มีตัวตน และมีชิ้นที่ไม่ต้องพึ่งใครอยู่หนึ่งชิ้น", () => {
    const owners = CLUES.filter((c) => c.from);
    expect(owners.length).toBeGreaterThanOrEqual(game.plot.cluesToSolve);
    expect(CLUES.filter((c) => !c.from)).toHaveLength(1);
    for (const c of CLUES) { expect(c.short).toBeTruthy(); expect(c.id).toMatch(/^clue_/); }
  });
});
