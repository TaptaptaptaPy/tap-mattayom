import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// หน้าวิธีเล่นเปิดเองครั้งแรกที่เล่น ซึ่งจะบังทุกภาพในไฟล์นี้
// เทสต์ที่อยากดูหน้านั้นจริงๆ เรียก __mattayom.showHow() เอง
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem("mattayom:seenHow", "1"); } catch { /* โหมดส่วนตัว */ }
  });
});

/** หน้าจอจริงของเกม — คนละเรื่องกับ art.spec.ts ที่ดูของทีละชิ้น
 *  ไฟล์นี้ดูว่า "ของทุกชิ้นวางรวมกันแล้วยังอ่านออกไหม" ซึ่งเป็นคนละคำถาม
 *  (แถบภาพฉากเคยลอยอยู่บนสุดแล้วเหลือพื้นดำเปล่าสูง 300px คั่นกลาง — ชิ้นส่วนไม่ผิดสักชิ้น) */

/** รอจนตัวพิมพ์ดีดพิมพ์จบ ไม่งั้นภาพจะจับข้อความครึ่งประโยค */
async function typed(page: Page) {
  await page.waitForSelector("#scene:not(.hidden)");
  await expect.poll(async () => page.locator("#line").textContent(), { timeout: 10_000 })
    .not.toBe("");
  let prev = "";
  await expect.poll(async () => {
    const now = (await page.locator("#line").textContent()) ?? "";
    const same = now === prev; prev = now; return same;
  }, { timeout: 10_000 }).toBe(true);
}

test("เปิดเกมมาเจอฉากวันเปิดเทอม", async ({ page }) => {
  await page.goto("/");
  await typed(page);
  await expect(page).toHaveScreenshot("opening.png");
});

test("กระดานเลือกที่ไป", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  // ข้ามฉากเปิดเทอมไปตรงๆ แทนที่จะไล่คลิก — การไล่คลิกพังทุกครั้งที่บทถูกแก้
  // สิ่งที่อยากดูคือหน้ากระดาน ไม่ใช่ทางเดินไปหากระดาน (บทมี storywalk ดูให้แล้ว)
  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    M.render();
  });
  await page.waitForSelector("#board .loc");
  await expect(page).toHaveScreenshot("board.png");
});

test("ฉากจบรายคน — ภาพฉาก ภาพตัวละคร และข้อความต้องอยู่ด้วยกัน", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  await page.evaluate(() => {
    const M = (window as any).__mattayom, s = M.s;
    s.affinity = { ploy: 120, kanin: 90, minta: 70, palm: 40 };
    for (const f of ["ploy_book", "ploy_stayed", "ploy_refused", "ploy_sister_known",
                     "kanin_cleared", "minta_signed", "palm_spoke"]) s.flags[f] = true;
    M.playEpilogues(() => { /* จบแล้ว */ });
  });
  await typed(page);
  await expect(page).toHaveScreenshot("epilogue.png");
});

test("เปิดเกมแล้วต้องไม่มี error ใน console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await typed(page);
  expect(errors).toEqual([]);
});

test("กระดานประกาศผลหน้าห้อง — ชื่อเราต้องหาเจอในหนึ่งวินาที", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    // ผลสอบของเราถูกยัดเข้าไปตรงๆ เพราะสิ่งที่อยากดูคือกระดาน ไม่ใช่ทางเดินไปหาวันสอบ
    M.s.exams["midterm"] = { score: 61, rank: 11 };
    M.render();
    M.showBoard("midterm");
  });
  await page.waitForSelector(".board .brow.is-me");
  await expect(page).toHaveScreenshot("board-exam.png");
});

test("ปุ่มที่ต้องฝืนต้องดูออกว่ากดได้ ไม่ใช่ปุ่มที่ดับ", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    M.s.periodIndex = 2;          // หลังเลิกเรียน — ช่วงที่มีที่ให้ไปมากที่สุด
    M.s.energy = 8;               // ต่ำกว่าเกณฑ์ ทุกกิจกรรมต้องฝืนถึงจะทำได้
    M.s.sleepDebt = 12;
    M.render();
  });
  await page.waitForSelector(".act.tired");
  // ปุ่มที่ต้องฝืนต้องยังกดได้จริง ไม่งั้นแรงกลับไปเป็นกำแพงเหมือนเดิม
  expect(await page.locator(".act.tired").first().isDisabled()).toBe(false);
  await expect(page).toHaveScreenshot("board-tired.png");
});

test("หน้าวิธีเล่นต้องอ่านออกและไม่ล้นจอ", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    M.render();
    M.showHow();
  });
  await page.waitForSelector(".howto .hrow");
  // ทุกหัวข้อต้องมีเนื้อหาจริง ไม่ใช่หัวข้อเปล่า
  const rows = await page.locator(".howto .hrow").count();
  expect(rows).toBeGreaterThan(5);
  await expect(page).toHaveScreenshot("howto.png");
});

test("สมุดบันทึกต้องอ่านได้ทั้งเทอม ไม่ใช่แค่สิบสองบรรทัดสุดท้าย", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    // ยัดเรื่องเข้าไปให้ครบทุกหมวด เพื่อดูว่าตัวกรองทำงานจริง
    M.s.history = [
      "วันที่ 3: คุยกับพลอย", "วันที่ 5: ส่งการบ้าน 2 ชิ้น",
      "วันที่ 8: ไปตามนัดกนิน", "วันที่ 12: ครูประจำชั้นโทรหาที่บ้าน",
      "วันที่ 20: ส่งเงินให้ที่บ้าน 550 บาท", "วันที่ 30: สอบกลางภาค ได้ 74 คะแนน",
      "วันที่ 33: ปาล์มเห็นเราอยู่กับพลอย ทั้งที่วันนี้นัดกันไว้",
      "วันที่ 40: หลับในคาบจนครูเรียกชื่อ",
    ];
    M.render();
    M.showDiary();
  });
  await page.waitForSelector(".diary .dline");
  const all = await page.locator(".diary .dline").count();
  await page.locator('[data-tab="home"]').click();
  const home = await page.locator(".diary .dline").count();
  expect(home).toBeGreaterThan(0);
  expect(home).toBeLessThan(all);
  await page.locator('[data-tab="all"]').click();
  await expect(page).toHaveScreenshot("diary.png");
});

/** แถบบนต้องบอกได้สองอย่าง: ตอนนี้เท่าไหร่ และเมื่อกี้เปลี่ยนไปเท่าไหร่
 *
 *  ทั้งสองอย่างเคยตายเงียบพร้อมกัน — หลอดใต้ชิปไม่มีกฎ CSS ของตัวเอง (เห็นเฉพาะชิป "แรง")
 *  และตัวจับความเปลี่ยนแปลงแกะตัวเลขจากข้อความ ซึ่งชิปค่าสถานะโชว์เป็นชื่อระดับ
 *  `Number("")` คืน 0 ค่าสถานะห้าตัวจึงอ่านได้ 0 เท่ากันตลอด แล้วไม่เคยถูกนับว่าเปลี่ยนเลย
 *  ภาพนิ่งจับข้อนี้ไม่ได้ เพราะทั้งคู่เป็นของที่ "ควรโผล่มา" ไม่ใช่ของที่ "หายไป" */
test("แถบบน: หลอดค่าสถานะต้องมองเห็น และค่าที่เพิ่งเปลี่ยนต้องลอยตัวเลขขึ้นมา", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__mattayom);
  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    M.s.stats.heart = 30; M.s.stats.mind = 70; M.s.stats.charm = 5;
    M.render();
  });

  const widths = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#stats .chip.stat i")]
      .map((i) => i.getBoundingClientRect().width));
  console.log("ความกว้างหลอดค่าสถานะ: " + widths.map((w) => w.toFixed(1)).join(" · "));
  expect(widths.length, "ไม่มีหลอดค่าสถานะเลย").toBe(5);
  expect(Math.max(...widths), "หลอดกว้างศูนย์ทุกใบ — แปลว่าไม่มีกฎ CSS ให้มัน").toBeGreaterThan(4);
  // ค่าไม่เท่ากันต้องได้หลอดไม่เท่ากัน ไม่งั้นหลอดก็ไม่ได้บอกอะไร
  expect(new Set(widths.map((w) => Math.round(w))).size).toBeGreaterThan(2);

  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.stats.heart += 40;
    M.s.money -= 60;
    M.render();
  });
  const deltas = await page.evaluate(() =>
    [...document.querySelectorAll("#stats .delta")].map((d) => d.textContent ?? ""));
  console.log("ตัวเลขที่ลอยขึ้นมา: " + (deltas.join(" · ") || "ไม่มีเลย"));
  expect(deltas.length, "ค่าเปลี่ยนแล้วแต่ไม่มีอะไรลอยขึ้นมาบอก").toBeGreaterThan(1);
  expect(deltas.some((d) => d.startsWith("+")), "ไม่มีค่าที่เพิ่มขึ้นถูกรายงาน").toBe(true);
  expect(deltas.some((d) => d.startsWith("-")), "ไม่มีค่าที่ลดลงถูกรายงาน").toBe(true);
});
