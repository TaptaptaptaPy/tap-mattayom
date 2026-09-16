import { defineConfig, devices } from "@playwright/test";

/** เทสต์ภาพ — จับบั๊กชนิดที่ `lint:ink` / `story` / `balance` มองไม่เห็นเลยสักตัว
 *
 *  บั๊กที่เสียเวลาที่สุดของเกมนี้เป็นภาพพังเงียบๆ ทั้งนั้น ไม่มี error สักบรรทัด:
 *  id ของ gradient ชนกันจนการ์ดใบหลังไปหยิบสีของใบแรก · ผมคลุมทั้งหน้าเพราะลำดับชั้นผิด ·
 *  ฉากถูกยืด 5 เท่า · ตัวละครใหม่ได้ภาพธงชาติเพราะลืมเพิ่ม LOOKS
 *  ทั้งหมดนี้เห็นได้ด้วยตาอย่างเดียว ไฟล์นี้คือ "ตา" ที่รันได้ทุกครั้งที่ commit
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.008, animations: "disabled" } },
  use: {
    // กระจาย devices ก่อน ไม่งั้นมันเขียนทับ viewport ที่ตั้งข้างล่างเงียบๆ
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:5174",
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 1,
    // ปิดการเคลื่อนไหวทั้งหมดตอนเทสต์ภาพ
    // `animations: "disabled"` ของ toHaveScreenshot หยุด animation ตอนถ่ายก็จริง
    // แต่ของที่ใช้ animation-delay + fill backwards จะถูกจับตอนยังไม่เริ่มขยับ
    // ได้การ์ดที่ยังมองไม่เห็นบ้าง เห็นบ้าง คนละภาพทุกรอบ
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
