import { defineConfig } from "vite";

export default defineConfig({
  // ./ = เส้นทางทุกอย่างอิงตำแหน่งของหน้าเว็บเอง ไม่ใช่อิงรากของโดเมน
  // จำเป็นตอนเอาไปวางไว้ใต้โฟลเดอร์ย่อยของโฮสต์อื่น (เช่นเผยแพร่ให้เล่นบน iPad)
  base: "./",
  // host: true = iPad ในวง Wi-Fi เดียวกันเปิดได้ อย่าลบ
  server: { host: true, port: 5174 },   // คนละพอร์ตกับ genesis จะได้รันพร้อมกันได้
  preview: { host: true, port: 4174 },
  build: { target: "es2022" },
  // .ink ถูก import เป็นข้อความดิบ แล้วคอมไพล์ตอนรัน -> แก้บทแล้วเห็นผลทันทีผ่าน HMR
  assetsInclude: ["**/*.ink"],
});
