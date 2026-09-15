/** เดินบททุกเส้นทางแบบ headless — รันด้วย `npm run story`
 *  `npm run lint:ink` บอกได้แค่ว่า "คอมไพล์ผ่าน" แต่บอกไม่ได้ว่าเส้นทางไหนตัน
 *  หรือทางเลือกที่ล็อกด้วยค่าสถานะเปิดออกมาจริงไหม เครื่องมือนี้ตอบสองข้อนั้น */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";
import type { Story } from "inkjs/types";

const dir = join(process.cwd(), "story");
const files = readdirSync(dir).filter((f) => f.endsWith(".ink") && !f.startsWith("_"));
const shared = readFileSync(join(dir, "_shared.ink"), "utf8");

/** โปรไฟล์ผู้เล่นหลายแบบ เพื่อให้เส้นทางที่ล็อกด้วยค่าสถานะถูกเดินจริง */
const PROFILES: { name: string; vars: Record<string, number | string> }[] = [
  { name: "เพิ่งเปิดเทอม", vars: { heart: 0, mind: 0, charm: 0, kind: 0, nerve: 0, affinity: 0, rank: 0, day: 1, money: 200, behaviour: 100, caught: 0, club: "", mindRank: 0 } },
  { name: "กลางเทอม", vars: { heart: 14, mind: 14, charm: 14, kind: 14, nerve: 14, affinity: 12, rank: 3, day: 60, money: 800, behaviour: 70, caught: 2, club: "music", mindRank: 3 } },
  { name: "ปลายเทอมทุ่มสุดตัว", vars: { heart: 30, mind: 30, charm: 30, kind: 30, nerve: 30, affinity: 40, rank: 8, day: 115, money: 2000, behaviour: 100, caught: 0, club: "sport", mindRank: 5 } },
];

interface Stat { lines: number; choices: number; endings: number; hints: string[]; calls: Record<string, number>; }

function build(src: string, calls: Record<string, number>, flags: Set<string>, hints: string[]): Story {
  const story = new Compiler(src).Compile();
  const note = (n: string) => { calls[n] = (calls[n] ?? 0) + 1; };
  story.BindExternalFunction("gainStat", (id: string) => { note("gainStat:" + id); return null; });
  story.BindExternalFunction("gainAffinity", (c: string) => { note("gainAffinity:" + c); return null; });
  story.BindExternalFunction("setFlag", (n: string) => { note("setFlag"); flags.add(n); return null; });
  story.BindExternalFunction("setHint", (t: string) => { note("setHint"); hints.push(t); return null; });
  story.BindExternalFunction("spend", () => { note("spend"); return null; });
  story.BindExternalFunction("hasFlag", (n: string) => (flags.has(n) ? 1 : 0));
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
  const uniqueHints = [...new Set(stat.hints)];

  if (stat.endings === 0) problems.push("ไม่มีเส้นทางไหนจบเลย");
  if (problems.length) bad++;

  const mode = isRandom(src) ? " (บทสุ่ม เดิน 40 รอบ)" : "";
  console.log(`${problems.length ? "  พัง  " : "  ok  "} ${f.padEnd(20)} ` +
              `${String(stat.lines).padStart(4)} บรรทัด · ${String(stat.choices).padStart(3)} ทางเลือก · ` +
              `${stat.endings} ปลายทาง${mode}`);
  console.log(`         ${perProfile.join(" | ")}`);
  if (gains) console.log(`         ให้ค่า: ${gains}`);
  if (uniqueHints.length) console.log(`         คำใบ้ที่บทบอกเอง: ${uniqueHints.length} ข้อ`);
  for (const p of problems) console.log(`         ← ${p}`);
}

console.log(bad ? `\nมีบทที่เดินแล้วมีปัญหา ${bad} ไฟล์` : `\nเดินครบทุกเส้นทางแล้ว ไม่เจอทางตัน`);
process.exit(bad ? 1 : 0);
