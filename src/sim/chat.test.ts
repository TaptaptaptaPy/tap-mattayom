import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { acceptInvite, plansToday, planClash, keepPlan, settleMissedPlan } from "./chat";
import game from "../../data/game.json";

/** วันหนึ่งมีช่วงหลังเลิกเรียนช่วงเดียว รับนัดสองคนแปลว่าต้องผิดนัดอย่างน้อยหนึ่งคนแน่ๆ
 *  เกมไม่ห้ามให้รับซ้อน เพราะการรับปากทั้งที่รู้ว่าไปไม่ได้ ก็เป็นการตัดสินใจอย่างหนึ่ง */
describe("นัดซ้อน", () => {
  const dayAfter = (s: ReturnType<typeof newState>) => { s.dayIndex += 1; };

  it("รับนัดสองคนในวันเดียวกันได้ และนับได้ว่าซ้อน", () => {
    const s = newState();
    acceptInvite(s, "ploy");
    acceptInvite(s, "kanin");
    dayAfter(s);
    expect(plansToday(s).length).toBe(2);
    expect(planClash(s)).toBe(2);
  });

  it("ไปได้คนเดียว อีกคนถือว่าผิดนัด", () => {
    const s = newState();
    s.affinity.ploy = 40; s.affinity.kanin = 40;
    s.trust.ploy = 20; s.trust.kanin = 20;
    acceptInvite(s, "ploy");
    acceptInvite(s, "kanin");
    dayAfter(s);
    s.periodIndex = game.periods.findIndex((p) => p.id === game.chat.planPeriod);
    expect(keepPlan(s, "ploy")).toBeGreaterThan(0);
    expect(keepPlan(s, "kanin"), "ไปได้คนเดียวต่อวัน").toBe(0);

    const trustBefore = s.trust.kanin;
    s.dayIndex += 1;
    settleMissedPlan(s);
    expect(s.trust.kanin, "คนที่ถูกทิ้งต้องเสียความเชื่อใจ").toBeLessThan(trustBefore);
    expect(s.trust.ploy, "คนที่เราไปหาไม่ควรเสียอะไร").toBeGreaterThan(0);
  });

  it("ผิดนัดเพราะไปหาคนอื่น เจ็บกว่าผิดนัดเฉยๆ", () => {
    const mk = () => { const s = newState(); s.affinity.kanin = 40; s.trust.kanin = 30; return s; };
    const period = game.periods.findIndex((p) => p.id === game.chat.planPeriod);

    const alone = mk();
    acceptInvite(alone, "kanin");
    alone.dayIndex += 2;
    settleMissedPlan(alone);

    const chose = mk();
    chose.affinity.ploy = 40;
    acceptInvite(chose, "kanin");
    acceptInvite(chose, "ploy");
    chose.dayIndex += 1;
    chose.periodIndex = period;
    keepPlan(chose, "ploy");
    chose.dayIndex += 1;
    settleMissedPlan(chose);

    expect(chose.trust.kanin,
      "เขารู้ว่าเราไปหาใคร ซึ่งเจ็บกว่าการถูกลืมเฉยๆ").toBeLessThan(alone.trust.kanin);
  });

  it("นัดที่เลยวันไปแล้วต้องถูกเก็บกวาด ไม่ค้างสะสม", () => {
    const s = newState();
    acceptInvite(s, "ploy");
    s.dayIndex += 5;
    settleMissedPlan(s);
    expect(s.plans.length).toBe(0);
  });
});
