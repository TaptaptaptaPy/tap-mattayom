import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { changeAffinity, changeTrust } from "./bonds";
import { visited } from "./offscreen";
import { concede, rivalAhead, rivalLead, rivalOf, stepRivals, stillOurs } from "./rival";
import game from "../../data/game.json";

const R = game.rival;
const start = (aff = 12) => { const s = newState(); changeAffinity(s, "ploy", aff); return s; };
const days = (s: ReturnType<typeof newState>, n: number, visit = 0) => {
  for (let d = 0; d < n; d++) {
    s.dayIndex++;
    if (visit && d % visit === 0) visited(s, "ploy");
    stepRivals(s);
  }
};

/** สิ่งที่คู่แข่งทำให้เกมคือทำให้ *เวลา* มีราคาขึ้นมาทันที
 *  ไม่ไปหาเขาวันนี้ไม่ได้แปลว่าพรุ่งนี้ค่อยไปก็ได้ มันแปลว่ามีคนอื่นไปแทนเรา */
describe("คนอื่นก็ชอบเขาเหมือนกัน", () => {
  it("ทุกคนมีคู่แข่งที่มีชื่อ", () => {
    for (const id of ["ploy", "kanin", "minta", "palm", "tar", "nun"])
      expect(rivalOf(id)?.name).toBeTruthy();
  });

  it("คนที่เราไม่เคยเริ่มอะไรด้วยเลย ไม่มีเรื่องคู่แข่ง", () => {
    const s = newState();
    days(s, 60);
    expect(s.rivals["ploy"]).toBeUndefined();
    expect(s.flags["rival_ploy_ahead"]).toBeUndefined();
  });

  it("เริ่มแล้วทิ้งไว้ทั้งเทอม เขาแซงเราไป", () => {
    const s = start();
    days(s, game.term.days);
    expect(rivalAhead(s, "ploy")).toBe(true);
    expect(s.flags["rival_ploy_ahead"]).toBe(true);
  });

  it("ไปหาเขาเรื่อยๆ แล้วยังนำอยู่", () => {
    const s = start();
    days(s, game.term.days, 4);
    expect(rivalLead(s, "ploy")).toBeGreaterThan(-R.aheadBy);
  });

  it("ความเชื่อใจถ่วงเขาไว้ได้ ความสนิทเฉยๆ ถ่วงไม่ได้", () => {
    const plain = start();
    days(plain, 60);
    const trusted = start();
    changeTrust(trusted, "ploy", 40);
    days(trusted, 60);
    expect(trusted.rivals["ploy"]).toBeLessThan(plain.rivals["ploy"]!);
  });

  it("เกณฑ์เริ่มใช้ครั้งเดียว — ความสนิทที่ตกทีหลังต้องไม่หยุดคู่แข่ง", () => {
    const s = start();
    days(s, 20);
    const mid = s.rivals["ploy"]!;
    // เรื่องลับหลังกดความสนิทลงได้เอง ถ้าเช็กเกณฑ์ซ้ำ คู่แข่งจะหยุดเดินตรงนี้
    s.affinity["ploy"] = 0;
    days(s, 40);
    expect(s.rivals["ploy"]).toBeGreaterThan(mid);
  });

  it("ผู้เล่นต้องได้รู้ตอนเขาแซง ไม่ใช่แพ้ไปแล้วโดยไม่รู้ตัว", () => {
    const s = start();
    days(s, game.term.days);
    expect(s.history.some((h) => h.includes("บ่อยกว่าพูดถึงเรา"))).toBe(true);
    expect(s.offscreenNews.length).toBeGreaterThan(0);
  });

  it("ยินดีกับเขาแล้วได้ความเชื่อใจ และเรื่องนั้นจบลง", () => {
    const s = start();
    days(s, 40);
    const before = s.trust["ploy"] ?? 0;
    concede(s, "ploy");
    expect(s.trust["ploy"]).toBeGreaterThan(before);
    expect(s.conceded["ploy"]).toBe(true);
    const at = s.rivals["ploy"];
    days(s, 40);
    expect(s.rivals["ploy"]).toBe(at);   // หยุดเดินแล้วจริง
  });

  it("ยินดีซ้ำไม่ได้ประโยชน์ซ้ำ", () => {
    const s = start();
    concede(s, "ploy");
    const t = s.trust["ploy"];
    concede(s, "ploy");
    expect(s.trust["ploy"]).toBe(t);
  });

  it("สนิทมากพอ ทางลึกยังไม่ปิดแม้เขาจะนำ", () => {
    // ต้องอยู่ในช่วงที่ทั้งสองอย่างเป็นจริงได้พร้อมกัน — สนิทเกิน keepAtRank
    // แต่ยังต่ำพอให้คู่แข่ง (เพดาน 32) แซงได้จริง
    const s = start(16);
    days(s, game.term.days);
    expect(rivalAhead(s, "ploy")).toBe(true);
    expect(stillOurs(s, "ploy")).toBe(true);
  });

  it("สนิทมากจนคู่แข่งไล่ไม่ทัน — เพดานของเขาต่ำกว่าเพดานของเรา", () => {
    const s = start(50);
    days(s, game.term.days);
    expect(rivalAhead(s, "ploy")).toBe(false);
  });

  it("คะแนนคู่แข่งอยู่สเกลเดียวกับความสนิท ไม่ใช่ 0-100", () => {
    // ตอนแรกตั้งเป็น 0-100 แล้วคู่แข่งแซงทุกคนทุกรอบ เพราะความสนิทที่ทำได้จริงอยู่แถว 23
    expect(R.max).toBeLessThanOrEqual(game.affinityRanks[game.affinityRanks.length - 1]);
  });
});
