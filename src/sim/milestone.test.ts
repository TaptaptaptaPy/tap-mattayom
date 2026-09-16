import { describe, expect, it } from "vitest";
import { newState } from "./state";
import { joinClub } from "./club";
import { milestoneToday, runMilestone } from "./milestone";
import game from "../../data/game.json";

const onTheDay = (clubId: string, attended: number) => {
  const s = newState();
  joinClub(s, clubId);
  s.clubDays = attended;
  s.dayIndex = 94;   // เลยวันงานของทุกชมรมแล้ว
  return s;
};

/** clubs.json มี milestoneDay กับ milestoneName มาตั้งแต่ต้น และหน้าชมรมเอาไปแสดง
 *  ให้ผู้เล่นอ่านด้วย แต่ไม่มีโค้ดบรรทัดไหนอ่าน milestoneDay เลยสักครั้ง */
describe("งานใหญ่ของชมรม", () => {
  it("ไม่ได้อยู่ชมรมไหน ก็ไม่มีงานใหญ่", () => {
    const s = newState();
    s.dayIndex = 94;
    expect(milestoneToday(s)).toBeNull();
  });

  it("ยังไม่ถึงวัน ก็ยังไม่มีงาน", () => {
    const s = onTheDay("academic", 20);
    s.dayIndex = 10;
    expect(milestoneToday(s)).toBeNull();
  });

  it("ซ้อมมาทั้งเทอมแล้วทำได้ดี ได้ระดับสูงสุด", () => {
    const s = onTheDay("academic", game.milestone.fullAttendance);
    const r = runMilestone(s, 1)!;
    expect(r.tier).toBe(3);
    expect(s.flags["milestone_won"]).toBe(true);
  });

  it("สมัครไว้แต่ไม่เคยไป วันงานคือวันที่ทั้งโรงเรียนได้เห็น", () => {
    const s = onTheDay("academic", 0);
    const before = s.standing;
    const r = runMilestone(s, 0.5)!;
    expect(r.tier).toBe(0);
    expect(s.standing).toBeLessThan(before);
    expect(s.flags["milestone_flopped"]).toBe(true);
  });

  it("มินิเกมอย่างเดียวชดเชยการไม่ซ้อมทั้งเทอมไม่ได้", () => {
    const lazy = onTheDay("academic", 0);
    const keen = onTheDay("academic", game.milestone.fullAttendance);
    expect(runMilestone(lazy, 1)!.tier).toBeLessThan(runMilestone(keen, 0)!.tier);
  });

  it("ซ้อมอย่างเดียวโดยไม่ทำอะไรในวันงานก็ยังไม่ใช่ที่สุด", () => {
    const a = onTheDay("academic", game.milestone.fullAttendance);
    const b = onTheDay("academic", game.milestone.fullAttendance);
    expect(runMilestone(a, 0)!.tier).toBeLessThan(runMilestone(b, 1)!.tier);
  });

  it("คนในชมรมเป็นคนที่ยืนอยู่ตรงนั้นด้วย ผลจึงไปถึงเขา", () => {
    const s = onTheDay("academic", game.milestone.fullAttendance);
    const before = s.affinity["ploy"];
    runMilestone(s, 1);
    expect(s.affinity["ploy"]).toBeGreaterThan(before);
  });

  it("ทำพังก็ไปถึงเขาเหมือนกัน", () => {
    const s = onTheDay("academic", 0);
    s.affinity["ploy"] = 30;
    const before = s.affinity["ploy"];
    runMilestone(s, 0);
    expect(s.affinity["ploy"]).toBeLessThan(before);
  });

  it("งานใหญ่มีได้ครั้งเดียวต่อเทอม", () => {
    const s = onTheDay("academic", 10);
    expect(runMilestone(s, 0.5)).not.toBeNull();
    expect(runMilestone(s, 0.5)).toBeNull();
    expect(milestoneToday(s)).toBeNull();
  });

  it("ผู้เล่นต้องได้รู้ว่ามันเกิด ไม่ใช่ตัวเลขที่ขยับเงียบๆ", () => {
    const s = onTheDay("music", 15);
    runMilestone(s, 0.8);
    expect(s.history.some((h) => h.includes("กีฬาสี"))).toBe(true);
    expect(s.offscreenNews.length).toBeGreaterThan(0);
  });

  it("ไปซ้อมแล้วถูกนับจริง — ฐานของทั้งระบบนี้", async () => {
    const { doClubActivity } = await import("./club");
    const s = newState();
    joinClub(s, "academic");
    s.dayIndex = 0;
    // หาวันที่ชมรมมีกิจกรรมจริง แล้วเข้าร่วม
    for (let d = 0; d < 14 && s.clubDays === 0; d++) { s.dayIndex = d; doClubActivity(s, 0); }
    expect(s.clubDays).toBe(1);
  });
});

/** ปมที่เจอตอนตรวจความขัดแย้งข้ามระบบ:
 *  ชมรมทั้งสี่ของมัธยมอยู่ที่สถานที่ของมัธยม ซึ่งภาคมหาลัยเข้าไม่ได้เลย
 *  ของเดิมจึงเปิดให้สมัครชมรมที่ไปซ้อมไม่ได้ แล้ววันงานใหญ่ก็ตกระดับล่างสุดแน่นอน
 *  = โทษ 8 คะแนนชื่อเสียงสำหรับสิ่งที่ผู้เล่นทำอะไรไม่ได้เลย */
describe("ชมรมต้องไปซ้อมได้จริงในภาคที่สมัคร", () => {
  it("ชมรมที่สมัครได้ในแต่ละภาคอยู่ที่สถานที่ของภาคนั้น", async () => {
    const { clubsFor } = await import("./club");
    const locs = (await import("../../data/locations.json")).default as
      { id: string; chapter?: string }[];
    for (const ch of ["school", "uni"] as const) {
      const s = newState(); s.chapter = ch;
      const list = clubsFor(s);
      expect(list.length).toBeGreaterThan(0);
      for (const c of list) {
        const loc = locs.find((l) => l.id === c.location);
        expect((loc?.chapter ?? "school")).toBe(ch);
      }
    }
  });

  it("วันงานใหญ่ของชมรมมหาลัยอยู่ในช่วงเทอมของมหาลัย", async () => {
    const { clubsFor } = await import("./club");
    const s = newState(); s.chapter = "uni";
    for (const c of clubsFor(s)) {
      const day = (c as { milestoneDay?: number }).milestoneDay ?? 0;
      expect(day).toBeLessThan(game.chapters.uni.days);
    }
  });
});
