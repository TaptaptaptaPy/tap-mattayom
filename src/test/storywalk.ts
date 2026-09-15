/** เดินบททุกเส้นทางแบบ headless — รันด้วย `npm run story`
 *  `npm run lint:ink` บอกได้แค่ว่า "คอมไพล์ผ่าน" แต่บอกไม่ได้ว่าเส้นทางไหนตัน
 *  หรือทางเลือกที่ล็อกด้วยค่าสถานะเปิดออกมาจริงไหม เครื่องมือนี้ตอบสองข้อนั้น */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";
import game from "../../data/game.json";
import chars from "../../data/characters.json";
import type { Story } from "inkjs/types";

const dir = join(process.cwd(), "story");
const files = readdirSync(dir).filter((f) => f.endsWith(".ink") && !f.startsWith("_"));
const shared = readFileSync(join(dir, "_shared.ink"), "utf8");

/** โปรไฟล์ผู้เล่นหลายแบบ เพื่อให้เส้นทางที่ล็อกด้วยค่าสถานะถูกเดินจริง */
/** โปรไฟล์ผู้เล่นหนึ่งอันต่อหนึ่งระดับความสัมพันธ์ (0-10)
 *
 *  บทแบ่ง knot ตาม `rank` ถ้าเดินไม่ครบทุกระดับ knot ที่เขียนใหม่จะไม่เคยถูกแตะเลย
 *  แล้วเทสต์จะรายงานว่า "ผ่าน" ทั้งที่ไม่ได้ตรวจอะไรของใหม่สักบรรทัด
 *  (เคยเกิดขึ้นมาแล้วตอนเพิ่มบทระดับ 6-10 — โปรไฟล์มีแค่ระดับ 0/3/8)
 *
 *  ค่าสถานะอื่นไต่ตามระดับไปด้วย เพราะในเกมจริงคนที่สนิทระดับ 10 ย่อมผ่านอะไรมาเยอะแล้ว
 *  และตัวกั้นอย่าง tomorrowSchool / standingRank ถูกสลับไปมาเพื่อให้ทั้งสองฝั่งถูกเดิน */
const PROFILES: { name: string; vars: Record<string, number | string> }[] =
  Array.from({ length: 11 }, (_, r) => {
    const t = r / 10;
    return {
      name: `ระดับ ${r}`,
      vars: {
        heart: Math.round(t * 30), mind: Math.round(t * 30), charm: Math.round(t * 30),
        kind: Math.round(t * 30), nerve: Math.round(t * 30),
        affinity: game.affinityRanks[r], rank: r,
        trust: Math.min(5, Math.round((r / 10) * 5)),
        day: 1 + Math.round(t * 115),
        money: 200 + Math.round(t * 1800),
        behaviour: 100 - Math.round(t * 30),
        caught: Math.round(t * 3),
        club: r % 2 ? "music" : "sport",
        mindRank: Math.min(5, Math.round(t * 5)),
        tomorrowSchool: r % 3 === 0 ? 0 : 1,
        standingRank: Math.min(4, Math.round(t * 4)),
        homeworkMissed: Math.round(t * 8),
        term: r < 4 ? 1 : r < 8 ? 2 : 3,
      },
    };
  });

interface Stat { lines: number; choices: number; endings: number; hints: string[]; calls: Record<string, number>; }

function build(src: string, calls: Record<string, number>, flags: Set<string>, hints: string[],
               sides: Set<string> = new Set()): Story {
  const story = new Compiler(src).Compile();
  const note = (n: string) => { calls[n] = (calls[n] ?? 0) + 1; };
  story.BindExternalFunction("gainStat", (id: string) => { note("gainStat:" + id); return null; });
  story.BindExternalFunction("gainAffinity", (c: string) => { note("gainAffinity:" + c); return null; });
  story.BindExternalFunction("setFlag", (n: string) => { note("setFlag"); flags.add(n); return null; });
  story.BindExternalFunction("setHint", (t: string) => { note("setHint"); hints.push(t); return null; });
  story.BindExternalFunction("spend", () => { note("spend"); return null; });
  story.BindExternalFunction("hasFlag", (n: string) => (flags.has(n) ? 1 : 0));
  story.BindExternalFunction("inviteTomorrow", (c: string) => { note("inviteTomorrow:" + c); return null; });
  story.BindExternalFunction("standing", (n: number) => { note(n >= 0 ? "standing+" : "standing-"); return null; });
  story.BindExternalFunction("takeSide", (c: string) => { note("takeSide:" + c); sides.add(c); return null; });
  story.BindExternalFunction("sideTaken", () => (sides.size ? 1 : 0));
  story.BindExternalFunction("sidedWith", (c: string) => (sides.has(c) ? 1 : 0));
  story.BindExternalFunction("trustOf", () => 3);
  story.BindExternalFunction("plansBooked", () => 1);
  story.BindExternalFunction("recalls", () => 1);
  story.BindExternalFunction("tellThem", (t: string, v: string) => { note("tellThem:" + v); return null; });
  story.BindExternalFunction("toldAlready", () => 1);
  story.BindExternalFunction("tutorThem", () => { note("tutor"); return null; });
  story.BindExternalFunction("tutoredTimes", () => 0);
  story.BindExternalFunction("myRank", () => 12);
  story.BindExternalFunction("homeAsk", () => 900);
  story.BindExternalFunction("homeStrain", () => 1);
  story.BindExternalFunction("homeGive", () => { note("homeGive"); return null; });
  story.BindExternalFunction("homeGivePartial", () => { note("homePart"); return null; });
  story.BindExternalFunction("homeRefuse", () => { note("homeRefuse"); return null; });
  story.BindExternalFunction("homeCannot", () => { note("homeCannot"); return null; });
  story.BindExternalFunction("rivalName", () => "ฟ้า");
  story.BindExternalFunction("rivalLead", () => -20);
  story.BindExternalFunction("letThemGo", () => { note("letThemGo"); return null; });
  story.BindExternalFunction("memoryOf", () => "เรื่องที่เขายังจำได้");
  story.BindExternalFunction("gainTrust", (c: string) => { note("gainTrust:" + c); return null; });
  return story;
}

/** บทที่ใช้การสุ่มของ ink ({~ ...}) เล่นซ้ำแล้วได้คนละเส้นทาง เดินแบบ BFS ไม่ได้
 *  ต้องสุ่มเดินหลายรอบแทน แล้วดูว่าทุกรอบไปจบได้จริงไหม */
const isRandom = (src: string) => /\{\s*~/.test(src);

function walkRandom(src: string, vars: Record<string, number | string>, stat: Stat, problems: string[]) {
  for (let run = 0; run < 40; run++) {
    const flags = new Set<string>();
    const story = build(src, stat.calls, flags, stat.hints);
    for (const [k, v] of Object.entries(vars)) {
      try { story.variablesState[k] = v; } catch { /* ตัวแปรที่บทนี้ไม่ได้ประกาศ ข้ามไป */ }
    }
    let depth = 0;
    for (;;) {
      while (story.canContinue) { story.Continue(); stat.lines++; }
      if (story.currentChoices.length === 0) { stat.endings++; break; }
      if (depth++ > 12) { problems.push("เส้นทางยาวผิดปกติ อาจวนลูป"); break; }
      story.ChooseChoiceIndex(Math.floor(Math.random() * story.currentChoices.length));
      stat.choices++;
    }
  }
}

/** เดินทุกเส้นทางด้วยการเล่นซ้ำจากต้นทุกครั้ง แล้วบังคับเลือกตามลำดับที่กำหนด */
function walk(src: string, vars: Record<string, number | string>, stat: Stat, problems: string[]) {
  const queue: number[][] = [[]];
  let guard = 0;
  while (queue.length && guard++ < 600) {
    const path = queue.shift()!;
    const flags = new Set<string>();
    const story = build(src, stat.calls, flags, stat.hints);
    for (const [k, v] of Object.entries(vars)) {
      try { story.variablesState[k] = v; } catch { /* ตัวแปรที่บทนี้ไม่ได้ประกาศ ข้ามไป */ }
    }

    let step = 0, depth = 0;
    for (;;) {
      while (story.canContinue) { story.Continue(); stat.lines++; }
      if (story.currentChoices.length === 0) { stat.endings++; break; }
      if (depth++ > 12) { problems.push("เส้นทางยาวผิดปกติ อาจวนลูป"); break; }
      if (step < path.length) {
        // เส้นทางที่จดไว้อาจใช้ไม่ได้ถ้าบทมีเงื่อนไขที่ให้ผลต่างกันในแต่ละรอบ — ข้ามไป ไม่ใช่ล้ม
        if (path[step] >= story.currentChoices.length) break;
        story.ChooseChoiceIndex(path[step]);
        stat.choices++;
        step++;
      } else {
        for (let i = 0; i < story.currentChoices.length; i++) queue.push([...path, i]);
        story.ChooseChoiceIndex(0);
        stat.choices++;
        step++;
      }
    }
  }
}

let bad = 0;
console.log(`เดินบท ${files.length} ไฟล์ × ${PROFILES.length} โปรไฟล์ผู้เล่น\n`);

for (const f of files) {
  const src = readFileSync(join(dir, f), "utf8").replace(/^INCLUDE\s+.+$/gm, shared);
  const problems: string[] = [];
  const stat: Stat = { lines: 0, choices: 0, endings: 0, hints: [], calls: {} };
  const perProfile: string[] = [];

  for (const p of PROFILES) {
    const before = { ...stat, calls: { ...stat.calls } };
    try {
      if (isRandom(src)) walkRandom(src, p.vars, stat, problems);
      else walk(src, p.vars, stat, problems);
    } catch (e) {
      problems.push(`${p.name}: ${(e as Error).message.split("\n")[0]}`);
    }
    perProfile.push(`${p.name} ${stat.choices - before.choices} ทาง`);
  }

  const gains = Object.entries(stat.calls).filter(([k]) => k.startsWith("gain"))
    .map(([k, n]) => `${k.replace("gainStat:", "").replace("gainAffinity:", "+")}×${n}`).join(" ");
  // ทางที่ชวนนัดถูกกั้นด้วย {tomorrowSchool} ถ้าโปรไฟล์ไหนไม่ตั้งค่าไว้ เส้นทางนี้จะไม่เคยถูกเดินเลย
  const invites = Object.entries(stat.calls)
    .filter(([k]) => k.startsWith("inviteTomorrow")).reduce((a, [, n]) => a + n, 0);
  const uniqueHints = [...new Set(stat.hints)];

  if (stat.endings === 0) problems.push("ไม่มีเส้นทางไหนจบเลย");
  if (problems.length) bad++;

  const mode = isRandom(src) ? " (บทสุ่ม เดิน 40 รอบ)" : "";
  console.log(`${problems.length ? "  พัง  " : "  ok  "} ${f.padEnd(20)} ` +
              `${String(stat.lines).padStart(4)} บรรทัด · ${String(stat.choices).padStart(3)} ทางเลือก · ` +
              `${stat.endings} ปลายทาง${mode}`);
  const dead = perProfile.filter((x) => x.endsWith(" 0 ทาง")).map((x) => x.split(" ")[1]);
  console.log(`         เดินครบ ${PROFILES.length} ระดับ` +
              (dead.length ? ` · ระดับที่ไม่มีทางเลือกเลย: ${dead.join(",")}` : ""));
  if (gains) console.log(`         ให้ค่า: ${gains}`);
  if (invites) console.log(`         ชวนนัดพรุ่งนี้: ${invites} ครั้ง`);
  if (f.startsWith("chat_") && !invites)
    problems.push("บทแชทนี้ไม่มีเส้นทางไหนชวนนัดเลย ระบบนัดจะไม่ถูกทดสอบ");
  if (uniqueHints.length) console.log(`         คำใบ้ที่บทบอกเอง: ${uniqueHints.length} ข้อ`);
  for (const p of problems) console.log(`         ← ${p}`);
}

console.log(bad ? `\nมีบทที่เดินแล้วมีปัญหา ${bad} ไฟล์` : `\nเดินครบทุกเส้นทางแล้ว ไม่เจอทางตัน`);

const srcAll = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const srcAllFlags = () => [...srcAll.matchAll(/setFlag\("([a-z0-9_]+)"\)/g)].map((m) => m[1]);

// ───────────────────── ฉากจบรายคนตอบสนองจริงไหม ─────────────────────
// ฉากจบทั้งไฟล์เป็นเงื่อนไขล้วน ไม่มีทางเลือกสักอัน การเดินแบบปกติจึงได้แต่ทางที่ "ไม่มีธงเลย"
// ถ้าเขียนเงื่อนไขผิดหรือสะกดชื่อธงผิด มันจะเงียบสนิท ไม่มี error ไม่มีบรรทัดหาย
// ต้องเดินสองรอบเทียบกัน: รอบที่ไม่ตัดสินใจอะไรเลย กับรอบที่ตัดสินใจครบทุกอย่าง
const epiFiles = files.filter((f) => f.startsWith("epi_"));
const allFlags = new Set([...srcAllFlags()]);
let epiBad = 0;
console.log("\nฉากจบรายคน");
for (const f of epiFiles) {
  const src = readFileSync(join(dir, f), "utf8").replace(/^INCLUDE\s+.+$/gm, shared);
  const run = (flags: Set<string>) => {
    const st: Stat = { lines: 0, choices: 0, endings: 0, hints: [], calls: {} };
    const story = build(src, st.calls, flags, st.hints);
    // ค่าสถานะของคนที่เล่นมาเต็มเทอม เพื่อให้กิ่งที่อ่าน behaviour/standingRank ถูกเดินด้วย
    if (flags.size) for (const [k, v] of Object.entries({ behaviour: 68, standingRank: 4, homeworkMissed: 13, trust: 5 }))
      { try { story.variablesState[k] = v; } catch { /* บทนี้ไม่ได้ประกาศ */ } }
    let text = "";
    while (story.canContinue) { text += story.Continue(); st.lines++; }
    return { lines: st.lines, chars: text.trim().length };
  };
  const bare = run(new Set());
  const full = run(new Set(allFlags));
  const ok = full.chars > bare.chars * 1.2 && bare.chars > 0;
  if (!ok) epiBad++;
  console.log(`${ok ? "  ok  " : "  พัง  "} ${f.padEnd(18)} ` +
              `ไม่ตัดสินใจอะไรเลย ${String(bare.chars).padStart(4)} ตัวอักษร · ` +
              `ตัดสินใจครบ ${String(full.chars).padStart(4)} ตัวอักษร`);
  if (!ok) console.log("         ← ฉากจบนี้แทบไม่เปลี่ยนตามสิ่งที่ผู้เล่นทำ เงื่อนไขอาจสะกดชื่อธงผิด");
}

// ───────────────────── ธงที่ไม่มีใครอ่าน ─────────────────────
// ทางเลือกที่ตั้งธงไว้แล้วไม่มีใครอ่านธงนั้น = ทางเลือกที่ผู้เล่นคิดนาน แต่เกมลืมทันที
// ตอนตรวจครั้งแรกเจอ 79 ตั้ง / 34 อ่าน — ค้าง 45 อัน ทั้งหมดเป็นฉากที่เขียนมาแล้วไม่ได้ใช้
// เทสต์นี้กันไม่ให้มันกลับมาอีก ถ้าเขียนทางเลือกใหม่ต้องมีที่ให้มันไปออก

const tsDir = join(process.cwd(), "src");
const tsFiles: string[] = [];
(function collect(d: string) {
  for (const e of readdirSync(d, { withFileTypes: true }))
    if (e.isDirectory()) collect(join(d, e.name));
    // ไฟล์เทสต์ไม่นับ — `expect(s.flags["x"]).toBe(true)` คือการตรวจ ไม่ใช่การที่เกมเอาธงไปใช้
    // ถ้านับรวม ธงที่มีแต่เทสต์อ่านจะดูเหมือนมีปลายทางแล้ว ทั้งที่ในเกมจริงไม่มีใครแตะเลย
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) tsFiles.push(join(d, e.name));
})(tsDir);
// ตัดบรรทัดคอมเมนต์ทิ้งก่อนสแกน ไม่งั้นตัวอย่างในคอมเมนต์จะถูกนับเป็นธงจริง
// (คอมเมนต์ในไฟล์นี้เองเคยทำให้มีธงผีชื่อ x โผล่ในรายงาน)
const tsAll = tsFiles
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("//"))
  .join("\n");

const grab = (re: RegExp, text: string) =>
  new Set([...text.matchAll(re)].map((m) => m[1]));

const setFlags = new Set([
  ...grab(/setFlag\("([a-z0-9_]+)"\)/g, srcAll),
  // ธงที่ตั้งจากฝั่ง TS ก็ต้องมีคนอ่านเหมือนกัน (เช่นเรื่องที่เกิดลับหลัง คำโกหกที่โป๊ะ)
  ...grab(/s\.flags\[["']([a-z0-9_]+)["']\]\s*=[^=]/g, tsAll),
  // ธงที่ประกอบชื่อจากตัวแปร เช่น s.flags[`beat_${r.id}`] — กางออกตามรายชื่อตัวละครจริง
  // ถ้าไม่กาง ธงพวกนี้จะไม่มีใครตรวจเลย ทั้งที่มันคือธงที่ระบบใหม่ตั้งเยอะที่สุด
  ...[...tsAll.matchAll(/s\.flags\[`([a-z0-9_]*)\$\{[^}]+\}([a-z0-9_]*)`\]\s*=[^=]/g)]
     .flatMap((m) => chars.map((c) => m[1] + c.id + m[2])),
  // เหตุการณ์ลับหลังตั้งธงจากตารางใน game.json ช่องแรกของแต่ละแถวคือชื่อธง
  ...Object.values(game.offscreenEvents as unknown as Record<string, [string, string, number][]>)
      .flat().map((e) => e[0]),
]);
const readInk = grab(/hasFlag\("([a-z0-9_]+)"\)/g, srcAll);
const readTs = new Set([
  // ต้องไม่นับการ *เขียน* เป็นการ *อ่าน* — `s.flags["x"] = true` คือการตั้งธงจากฝั่ง TS
  // ไม่ใช่การอ่านมันไปใช้ ถ้านับรวมกัน ธงที่ตั้งจาก TS แล้วไม่มีใครอ่านจะรอดสายตาไป
  ...grab(/s\.flags\[["']([a-z0-9_]+)["']\](?!\s*=[^=])/g, tsAll),
  ...grab(/^\s*\[\s*"([a-z0-9_]+)",\s*"/gm, tsAll),   // ตาราง deep ใน ending.ts
]);
const readAll = new Set([...readInk, ...readTs]);

const orphans = [...setFlags].filter((f) => !readAll.has(f)).sort();
const dangling = [...readAll].filter((f) => !setFlags.has(f) && /_/.test(f)).sort();

// เสียงที่นิยามไว้แต่ไม่มีใครเรียก = เหตุการณ์ที่เกิดขึ้นแล้วเงียบสนิท
// เป็นบั๊กชนิดที่ไม่มีวันมี error ให้เห็น และเล่นเองก็ไม่รู้ว่าพลาดอะไรไป
const audio = readFileSync(join(tsDir, "core/audio.ts"), "utf8");
const sfxBlock = audio.slice(audio.indexOf("export const sfx"));
const sfxNames = [...sfxBlock.matchAll(/^\s{2}([a-z]+):\s*\(\)/gm)].map((m) => m[1]);
const silent = sfxNames.filter((n) => !new RegExp(`sfx\\.${n}\\(`).test(tsAll));
console.log(`\nเสียงประกอบ: นิยามไว้ ${sfxNames.length} · มีคนเรียกจริง ${sfxNames.length - silent.length}`);
if (silent.length) {
  console.log(`  ← เสียงที่ไม่มีใครเรียก ${silent.length} อัน (เหตุการณ์ที่เกิดแล้วเงียบ):`);
  console.log(`     ${silent.join("  ")}`);
}

console.log(`\nธงการตัดสินใจ: ตั้ง ${setFlags.size} · อ่าน ${[...readAll].filter((f) => setFlags.has(f)).length}`);
if (orphans.length) {
  console.log(`  ← ธงที่ตั้งแล้วไม่มีใครอ่าน ${orphans.length} อัน (ทางเลือกที่ไม่ส่งผลอะไรเลย):`);
  for (let i = 0; i < orphans.length; i += 6)
    console.log(`     ${orphans.slice(i, i + 6).join("  ")}`);
}
if (dangling.length)
  console.log(`  ← ธงที่มีคนอ่านแต่ไม่มีใครตั้ง ${dangling.length} อัน: ${dangling.join("  ")}`);

const flagBad = orphans.length > 0 || dangling.length > 0 || epiBad > 0 || silent.length > 0;
if (!flagBad) console.log("  ทุกทางเลือกมีปลายทางของมัน");
process.exit(bad || flagBad ? 1 : 0);
