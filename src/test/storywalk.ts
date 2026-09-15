/** เดินบททุกเส้นทางแบบ headless — รันด้วย `npm run story`
 *  `npm run lint:ink` บอกได้แค่ว่า "คอมไพล์ผ่าน" แต่บอกไม่ได้ว่าเส้นทางไหนตัน
 *  หรือทางเลือกที่ล็อกด้วยค่าสถานะเปิดออกมาจริงไหม เครื่องมือนี้ตอบสองข้อนั้น */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";
import game from "../../data/game.json";
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
process.exit(bad ? 1 : 0);
