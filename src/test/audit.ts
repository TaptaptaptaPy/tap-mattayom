/** ตรวจความสมเหตุสมผลข้ามระบบแบบ headless — ของที่เทสต์อื่นมองไม่เห็น */
import chars from "../../data/characters.json";
import locations from "../../data/locations.json";
import clubs from "../../data/clubs.json";
import game from "../../data/game.json";
import backgrounds from "../../data/backgrounds.json";
import { newState } from "../sim/state";
import { whereIs, meetSpot } from "../sim/presence";
import { acceptInvite } from "../sim/chat";
import { startUni } from "../sim/chapter";
import { computeEnding } from "../sim/ending";

const problems: string[] = [];
const say = (s: string) => console.log(s);

// 1) ทุกที่ที่ routine ชี้ไปต้องมีอยู่จริง และอยู่ภาคเดียวกับเจ้าของ routine
const LOCS = locations as { id: string; periods: string[]; chapter?: string }[];
for (const c of chars) {
  const routine = (c as unknown as { routine?: Record<string, Record<string, number>> }).routine ?? {};
  for (const [period, table] of Object.entries(routine)) {
    let sum = 0;
    for (const [loc, w] of Object.entries(table)) {
      sum += w;
      const L = LOCS.find((l) => l.id === loc);
      if (!L) { problems.push(`${c.id}: routine ชี้ไปที่ "${loc}" ซึ่งไม่มีในเกม`); continue; }
      if ((L.chapter ?? "school") !== (c.chapter ?? "school"))
        problems.push(`${c.id} (${c.chapter}) ไปอยู่ที่ ${loc} ซึ่งเป็นของภาค ${L.chapter}`);
      if (!L.periods.includes(period))
        problems.push(`${c.id}: ${loc} ไม่เปิดช่วง ${period} แต่ routine บอกว่าเขาอยู่ตรงนั้น`);
    }
    if (sum > 100) problems.push(`${c.id}/${period}: น้ำหนักรวม ${sum} เกิน 100`);
    if (sum >= 100) problems.push(`${c.id}/${period}: น้ำหนักเต็ม 100 — ไม่มีวันที่เขาไม่อยู่เลย`);
  }
  if (!meetSpot(c.id)) problems.push(`${c.id}: ไม่มีที่ให้ไปรอเวลานัด (routine ช่วง ${game.chat.planPeriod} ว่าง)`);
}

// 2) เลขที่ผู้เล่นเจอจริงคือ "ไปที่นี่ตอนนี้แล้วเขาอยู่ไหม" ไม่ใช่ "ทั้งวันเจอได้ไหม"
//    เพราะหนึ่งช่วงเวลาไปได้ที่เดียว ความบังเอิญวัดที่ช่องนั้นช่องเดียว
//    สูงเกินไป = ไปดักที่เดิมได้ทุกวัน · ต่ำเกินไป = ไม่มีทางเจอโดยไม่นัด
const HIGH = 0.68, LOW = 0.18;
say("\nไปที่นั้นตอนนั้นแล้วเจอเขากี่เปอร์เซ็นต์ (วัดจาก 400 วัน)");
for (const c of chars) {
  const s = newState(7);
  s.chapter = (c.chapter ?? "school") as "school" | "uni";
  const hit: Record<string, number> = {};
  const N = 400;
  for (let d = 0; d < N; d++) {
    s.dayIndex = d;
    for (const p of game.periods) {
      const at = whereIs(s, c.id, p.id);
      if (at) hit[`${p.id}|${at}`] = (hit[`${p.id}|${at}`] ?? 0) + 1;
    }
  }
  // ช่วงเช้าเป็นคาบเรียน ผู้เล่นถูกล็อกอยู่ในห้องอยู่แล้ว การเจอเพื่อนร่วมห้องทุกเช้า
  // ไม่ใช่ "ดักเจอ" มันคือการไปโรงเรียน — กฎเรื่องความบังเอิญใช้กับเวลาว่างเท่านั้น
  const free = Object.entries(hit).filter(([k]) => !k.startsWith("morning|"));
  const spots = free.sort((a, b) => b[1] - a[1]);
  const show = spots.slice(0, 3).map(([k, n]) => {
    const [p, loc] = k.split("|");
    const nm = LOCS.find((l) => l.id === loc)?.id ?? loc;
    return `${nm}/${p} ${Math.round((n / N) * 100)}%`;
  }).join(" · ");
  say(`  ${c.name.padEnd(8)} ${show}`);
  if (!spots.length) { problems.push(`${c.id}: ไม่มีที่ไหนเจอเขาได้เลย`); continue; }
  const best = spots[0][1] / N;
  if (best > HIGH) problems.push(`${c.id}: ดักที่ ${spots[0][0]} แล้วเจอ ${Math.round(best * 100)}% — ไม่ใช่ความบังเอิญแล้ว`);
  if (best < LOW) problems.push(`${c.id}: ที่ที่เจอบ่อยที่สุดยังเจอแค่ ${Math.round(best * 100)}% — หายากเกินไป`);
}

// 3) นัดแล้วต้องไปเจอได้จริงทุกครั้ง ทุกคน ทุกภาค
for (const c of chars) {
  const s = newState(3);
  s.chapter = (c.chapter ?? "school") as "school" | "uni";
  for (let d = 1; d < 40; d++) {
    s.dayIndex = d - 1; s.plans = [];
    acceptInvite(s, c.id);
    s.dayIndex = d;
    const at = whereIs(s, c.id, game.chat.planPeriod);
    if (!at) { problems.push(`${c.id}: นัดไว้วันที่ ${d} แล้วไม่อยู่ที่ไหนเลย`); break; }
  }
}

// 4) นัดข้ามภาค — เพื่อนมัธยมที่ทักไลน์มาตอนอยู่มหาลัย ต้องนัดไม่ได้
{
  const s = newState(3);
  const en = computeEnding(s);
  startUni(s, en);
  s.dayIndex = 5;
  for (const c of chars.filter((x) => (x.chapter ?? "school") === "school")) {
    const at = whereIs(s, c.id, game.chat.planPeriod);
    if (at) problems.push(`${c.id}: เพื่อนมัธยมโผล่ที่ ${at} ตอนอยู่มหาลัย`);
  }
}

// 5) สมาชิกชมรมต้องเป็นตัวละครที่มีอยู่จริงและอยู่ภาคเดียวกับชมรม
for (const cl of clubs as { id: string; chapter?: string; location: string; members: string[]; days: number[] }[]) {
  const L = LOCS.find((l) => l.id === cl.location);
  if (!L) problems.push(`ชมรม ${cl.id}: สถานที่ ${cl.location} ไม่มีในเกม`);
  else if ((L.chapter ?? "school") !== (cl.chapter ?? "school"))
    problems.push(`ชมรม ${cl.id} (${cl.chapter}) ซ้อมที่ ${cl.location} ซึ่งเป็นของภาค ${L.chapter}`);
  else if (!L.periods.includes(game.chat.planPeriod))
    problems.push(`ชมรม ${cl.id}: ${cl.location} ไม่เปิดช่วงหลังเลิกเรียน`);
  for (const m of cl.members) {
    const c = chars.find((x) => x.id === m);
    if (!c) { problems.push(`ชมรม ${cl.id}: สมาชิก "${m}" ไม่มีตัวตน`); continue; }
    if ((c.chapter ?? "school") !== (cl.chapter ?? "school"))
      problems.push(`ชมรม ${cl.id} (${cl.chapter}) มี ${m} (${c.chapter}) เป็นสมาชิก`);
  }
}

// 6) ภูมิหลัง — คนที่รู้จักอยู่แล้วต้องมีตัวตน และ habit ต้องชี้ไปที่ที่เขาไปจริง
for (const b of backgrounds.list as unknown as { id: string; knows: { id: string; habits?: string[] }[]; traits: Record<string, number> }[]) {
  for (const k of b.knows) {
    const c = chars.find((x) => x.id === k.id);
    if (!c) { problems.push(`ภูมิหลัง ${b.id}: รู้จัก "${k.id}" ซึ่งไม่มีตัวตน`); continue; }
    const routine = (c as unknown as { routine?: Record<string, Record<string, number>> }).routine ?? {};
    for (const h of k.habits ?? []) {
      const [p, loc] = h.split(":");
      if (!routine[p]?.[loc])
        problems.push(`ภูมิหลัง ${b.id}: บอกว่า ${k.id} มักอยู่ ${loc} ตอน ${p} แต่ routine ไม่มีช่องนั้น`);
    }
  }
  const known = new Set(["encounter","allowance","catch","escape","pay","energyMax","grade",
                         "heartGain","mindGain","charmGain","kindGain","nerveGain","studyGain"]);
  for (const t of Object.keys(b.traits))
    if (!known.has(t)) problems.push(`ภูมิหลัง ${b.id}: trait "${t}" ไม่มีใครอ่าน`);
}

// 7) ทุกคนต้องมีไฟล์บททักทายครั้งแรก และบทแชท
import { readdirSync } from "node:fs";
const inks = new Set(readdirSync("story").map((f) => f.replace(/\.ink$/, "")));
for (const c of chars) {
  const fm = (c as { firstMeet?: string }).firstMeet;
  if (!fm) problems.push(`${c.id}: ไม่มี firstMeet`);
  else if (!inks.has(fm)) problems.push(`${c.id}: firstMeet ชี้ไปที่ story/${fm}.ink ซึ่งไม่มีไฟล์`);
  if (!inks.has(c.story)) problems.push(`${c.id}: story/${c.story}.ink ไม่มีไฟล์`);
  if (!inks.has(`chat_${c.id}`)) problems.push(`${c.id}: ไม่มี story/chat_${c.id}.ink`);
  const epi = (c as { epilogue?: string }).epilogue;
  if (epi && !inks.has(epi)) problems.push(`${c.id}: epilogue ชี้ไปที่ story/${epi}.ink ซึ่งไม่มีไฟล์`);
}

say("");
if (problems.length) {
  say(`เจอเรื่องที่ไม่สมเหตุสมผล ${problems.length} ข้อ:`);
  for (const p of problems) say("  ← " + p);
} else say("ไม่เจอเรื่องที่ไม่สมเหตุสมผล");
process.exit(problems.length ? 1 : 0);
