import { defineConfig } from "vitest/config";

/** เทสต์หน่วย — คนละงานกับ `story` และ `balance`
 *  `story` ตอบว่า "บทเดินครบทุกเส้นไหม" · `balance` ตอบว่า "ตัวเลขรวมทั้งเทอมสมเหตุสมผลไหม"
 *  ไฟล์ในนี้ตอบว่า "ฟังก์ชันนี้คืนค่าถูกไหม" ทุกข้อมาจากบั๊กที่เคยเกิดขึ้นจริงแล้ว */
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
