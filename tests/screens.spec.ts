import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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
