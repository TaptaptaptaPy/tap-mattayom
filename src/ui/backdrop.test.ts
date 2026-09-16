import { describe, expect, it } from "vitest";
import { eventBackdrop, hasBackdrop } from "./backdrop";
import events from "../../data/events.json";

/** ทุกเหตุการณ์ตามปฏิทินต้องมีฉากหลัง
 *
 *  เหตุการณ์ที่ไม่มีฉากไม่ได้พังและไม่มี error — มันแค่เล่นบนพื้นที่ว่างครึ่งจอ
 *  ซึ่งเป็นสิ่งที่เห็นแล้วรู้ทันทีว่า "แห้ง" แต่หาสาเหตุไม่เจอถ้าไม่ไล่ทีละบท
 *  ตอนเจอครั้งแรกมีสิบจากสิบแปดบทที่ไม่มีฉาก รวมถึงบทแรกสุดที่ผู้เล่นเห็นตอนเปิดเกม */
type Ev = { id?: string; ink?: string; chapter?: string };
const listed = (events as Ev[]).filter((e) => typeof e.ink === "string");

describe("ฉากหลังของเหตุการณ์", () => {
  it("มีเหตุการณ์ที่มีบทให้ตรวจจริง — ถ้าเป็นศูนย์แปลว่าอ่านไฟล์ผิด", () => {
    expect(listed.length).toBeGreaterThan(10);
  });

  for (const e of listed) {
    const chapter = (e.chapter === "uni" ? "uni" : "school") as "school" | "uni";
    it(`${e.id} (${e.ink}) มีฉากหลัง`, () => {
      const bg = eventBackdrop(e.ink!, chapter);
      expect(bg, `เหตุการณ์ ${e.id} ไม่มีฉากหลังเลย — จะเล่นบนจอดำเปล่า`).toBeTruthy();
      expect(hasBackdrop(bg!), `${e.id} ชี้ไปที่ฉาก "${bg}" ซึ่งไม่มีอยู่จริง`).toBe(true);
    });
  }

  it("เข้าแถวหน้าเสาธงมีฉากของตัวเอง — เป็นบทที่เล่นบ่อยที่สุดในเกม", () => {
    expect(eventBackdrop("assembly", "school")).toBe("assembly");
  });

  it("บทที่ใช้ทั้งสองภาคได้ฉากคนละที่", () => {
    expect(eventBackdrop("ev_group", "school")).not.toBe(eventBackdrop("ev_group", "uni"));
  });

  it("บทที่ไม่รู้จักคืน undefined ไม่ใช่ฉากมั่ว", () => {
    expect(eventBackdrop("ไม่มีบทนี้", "school")).toBeUndefined();
  });
});
