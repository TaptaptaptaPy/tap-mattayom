/** ตรวจว่าไฟล์บททุกไฟล์คอมไพล์ผ่าน — รันด้วย `npm run lint:ink`
 *  ใช้ก่อน commit ทุกครั้งที่แก้บท จะได้ไม่ push บทที่พังขึ้นไป */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";

const dir = join(process.cwd(), "story");
const files = readdirSync(dir).filter((f) => f.endsWith(".ink") && !f.startsWith("_"));
const shared = readFileSync(join(dir, "_shared.ink"), "utf8");

let bad = 0;
for (const f of files) {
  const src = readFileSync(join(dir, f), "utf8").replace(/^INCLUDE\s+.+$/gm, shared);
  const errs: string[] = [];
  try {
    new Compiler(src, { errorHandler: (m: string) => errs.push(m.trim()) } as never).Compile();
    if (errs.length) throw new Error(errs.join("\n        "));
    console.log(`  ok    ${f}`);
  } catch (e) {
    bad++;
    console.log(`  พัง   ${f}\n        ${errs.length ? errs.join("\n        ") : (e as Error).message}`);
  }
}
console.log(bad ? `\nมีบทที่คอมไพล์ไม่ผ่าน ${bad} ไฟล์` : `\nบททั้ง ${files.length} ไฟล์ผ่านหมด`);
process.exit(bad ? 1 : 0);
