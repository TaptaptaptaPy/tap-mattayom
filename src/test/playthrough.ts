/** เล่นจนจบจริงๆ ด้วยบทจริง — รันด้วย `npm run playthrough`
 *
 *  ช่องว่างที่เทสต์ตัวอื่นไม่ได้ปิด:
 *  - `npm run story` คอมไพล์บทและเดินทุกเส้นทาง แต่ external function เป็นของปลอมทั้งหมด
 *  - `npm run balance` เดินตัวเลขจนจบเทอม แต่ **ข้ามบททั้งหมด** (เหตุการณ์ตามปฏิทินถูก skip)
 *  ตรงกลางระหว่างสองอันนั้นคือ *สะพาน* — ink เรียก TS ด้วยสถานะจริงตอนเล่นจริง
 *  ซึ่งเป็นที่ที่บั๊กแบบ "ตัวละครไม่มีไฟล์บท" หรือ "external ชื่อไม่ตรง" จะโผล่
 *
 *  ที่นี่เล่นครบทั้งสองภาค ทุกภูมิหลัง ทุกเหตุการณ์ตามปฏิทิน เลือกทางเลือกแบบสุ่ม
 *  และเรียกทุกทางที่ผู้เล่นกดได้จริง — ไปหาคน ทำภาระ เข้าชมรม ไลน์ ให้ของ ฝืน
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Compiler } from "inkjs/full";
import { Story as InkStory } from "inkjs";
import type { Story } from "inkjs/types";
import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { mulberry32, clamp01, type Rnd } from "../core/rng";
import { newState, remember, type GameState } from "../sim/state";
import { bindStory, type SceneHooks } from "../story/bind";
import { advance, eventNow, isLocked, isTermOver, periodId } from "../sim/calendar";
import { availableLocations, doAction, doRest, attendClass, skipClass, morningInspect } from "../sim/actions";
import { applyBackground, BACKGROUNDS } from "../sim/background";
import { noteEncounter, bumpInto, whoIsAt } from "../sim/presence";
import { seenWith } from "../sim/seen";
import { changeAffinity, changeTrust, shiftStanding, takeSide, trustFromFlag } from "../sim/bonds";
import { claim } from "../sim/claims";
import { tutor, postBoard } from "../sim/board";
import { concede } from "../sim/rival";
import { askAmount, giveHome, refuseHome } from "../sim/home";
import { visited } from "../sim/offscreen";
import { acceptInvite, keepPlan, planToday, isPlanPeriod, offerChat, offerSecondChat,
         recordThread } from "../sim/chat";
import { joinClub, clubsFor, doClubActivity } from "../sim/club";
import { takeExam } from "../sim/exam";
import { escapeCatch } from "../sim/discipline";
import { milestoneToday, runMilestone } from "../sim/milestone";
import { hasHomework, doHomework } from "../sim/homework";
import { hasRetake, doRetake, projectPartner, workProject, assignProject } from "../sim/schoolwork";
import { needsHaircut, haircut } from "../sim/grooming";
import { studyOne, SUBJECTS } from "../sim/grades";
import { buy, use, gift, ITEMS } from "../sim/shop";
import { computeEnding } from "../sim/ending";
import { epilogues, selfEpilogue } from "../sim/epilogue";
import { startUni } from "../sim/chapter";

// ───────────────────── โหลดบทจากดิสก์ (ฝั่ง Vite ใช้ import.meta.glob) ─────────────────────

const dir = join(process.cwd(), "story");
const shared = readFileSync(join(dir, "_shared.ink"), "utf8");
const SRC = new Map<string, string>();
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".ink") || f.startsWith("_")) continue;
  SRC.set(f.replace(/\.ink$/, ""),
          readFileSync(join(dir, f), "utf8").replace(/^INCLUDE\s+.+$/gm, shared));
}
/** คอมไพล์ครั้งเดียวต่อบท แล้วใช้ซ้ำ — คอมไพล์ใหม่ทุกฉากช้าเกินกว่าจะเล่นจบ 8 รอบ */
const COMPILED = new Map<string, () => Story>();
function storyOf(name: string): Story | null {
  const src = SRC.get(name);
  if (!src) return null;
  if (!COMPILED.has(name)) {
    const json = new Compiler(src).Compile().ToJson()!;
    COMPILED.set(name, () => new InkStory(json) as unknown as Story);
  }
  return COMPILED.get(name)!();
}

// ───────────────────── ตัวนับของทั้งรอบ ─────────────────────

interface Tally {
  scenes: number; lines: number; choices: number; externals: Record<string, number>;
  events: string[]; missingInk: string[]; errors: string[];
}

function hooksFor(s: GameState, t: Tally): SceneHooks {
  const note = (k: string) => { t.externals[k] = (t.externals[k] ?? 0) + 1; };
  return {
    onStat: (id, n) => { note("stat"); s.stats[id] += n; },
    onAffinity: (cid, n) => { note("affinity"); changeAffinity(s, cid, n); },
    onTrust: (cid, n) => { note("trust"); changeTrust(s, cid, n); },
    onClaim: (topic, v, cid) => { note("claim"); claim(s, topic, v, cid); },
    onTutor: (cid) => { note("tutor"); tutor(s, cid); },
    onHome: (kind) => {
      note("home:" + kind);
      const amount = askAmount(s);
      if (kind === "give") giveHome(s, amount);
      else if (kind === "part") giveHome(s, Math.floor(s.money));
      else refuseHome(s, kind === "refuse");
    },
    onConcede: (cid) => { note("concede"); concede(s, cid); },
    onRecall: () => note("recall"),
    onFlag: (name) => { note("flag"); s.flags[name] = true; trustFromFlag(s, name); },
    onHint: () => note("hint"),
    onMoney: (amount) => { note("money"); s.money = Math.max(0, s.money + amount); },
    onInvite: (cid) => { note("invite"); acceptInvite(s, cid); },
    onStanding: (amount, why) => { note("standing"); shiftStanding(s, amount, why || undefined); },
    onSide: (cid) => { note("side"); takeSide(s, cid); },
    onIntroduce: () => note("introduce"),
    onFeel: () => note("feel"),
  };
}

/** เล่นบทหนึ่งฉากจนจบ เลือกทางเลือกแบบสุ่ม — เหมือนที่ playScene() ทำบนจอ */
function playInk(name: string, s: GameState, charId: string | null, t: Tally, rnd: Rnd) {
  const story = storyOf(name);
  if (!story) { t.missingInk.push(name); return; }
  bindStory(story, s, charId, hooksFor(s, t));
  t.scenes++;
  for (let guard = 0; guard < 200; guard++) {
    while (story.canContinue) { story.Continue(); t.lines++; }
    if (!story.currentChoices.length) return;
    story.ChooseChoiceIndex(Math.floor(rnd() * story.currentChoices.length));
    t.choices++;
  }
  t.errors.push(`${name}: เดินเกิน 200 รอบ อาจวนลูป`);
}

// ───────────────────── เล่นหนึ่งรอบ ─────────────────────

function playTerm(s: GameState, t: Tally, rnd: Rnd, mg: () => number) {
  let guard = 0;
  while (!isTermOver(s) && guard++ < 5000) {
    // เหตุการณ์ตามปฏิทิน — เล่นบทจริงทุกอัน ซึ่งเป็นสิ่งที่ balance.ts ข้ามไปทั้งหมด
    const ev = eventNow(s);
    if (ev) {
      s.seenEvents[ev.id] = true;
      t.events.push(`${s.chapter}/${ev.id}`);
      if (ev.pickClub && !s.club) joinClub(s, clubsFor(s)[Math.floor(rnd() * clubsFor(s).length)].id);
      if (ev.assignProject && !s.project) assignProject(s, s.chapter);
      if (ev.exam) { takeExam(s, ev.exam, mg()); postBoard(s, ev.exam); }
      const big = milestoneToday(s);
      if (big) runMilestone(s, mg());
      if (ev.ink) playInk(ev.ink, s, null, t, rnd);
      if (ev.ending) {
        for (const e of epilogues(s)) playInk(e.ink, s, e.charId, t, rnd);
        const self = selfEpilogue(s);
        if (self) playInk(self, s, null, t, rnd);
      }
      if (ev.wholeDay || ev.holiday) {
        while (s.periodIndex !== 0) advance(s, rnd);
        continue;
      }
    }

    // ไลน์ตอนกลางคืน — เล่นบทแชทจริง
    const who = offerChat(s, rnd);
    if (who) {
      playInk(`chat_${who}`, s, who, t, rnd);
      recordThread(s, who, [], false);
      const who2 = offerSecondChat(s, rnd, who);
      if (who2) { playInk(`chat_${who2}`, s, who2, t, rnd); recordThread(s, who2, [], false); }
    }

    act(s, t, rnd, mg);
    advance(s, rnd);
    bumpInto(s, rnd);
  }
}

/** หนึ่งช่วงเวลา — เลือกทำอะไรสักอย่างที่ผู้เล่นกดได้จริง */
function act(s: GameState, t: Tally, rnd: Rnd, mg: () => number) {
  const period = periodId(s);

  if (isLocked(s)) {
    if (rnd() < 0.12) { const r = skipClass(s, rnd); if (r.caught && mg() >= 0.6) escapeCatch(s, r.penalty); return; }
    if (!s.doneToday["_assembly"]) { s.doneToday["_assembly"] = 1; playInk("assembly", s, null, t, rnd); }
    morningInspect(s, rnd);
    attendClass(s, rnd);
    return;
  }

  // ภาระมาก่อน — สลับระหว่างลงแรงกับทำให้จบๆ เพื่อเดินทั้งสองทาง
  const effort = rnd() < 0.5 ? 0.8 : 0.7 + mg() * 0.6;
  if (hasHomework(s) && rnd() < 0.5) { doHomework(s, effort); return; }
  if (hasRetake(s) && s.money >= game.retake.cost) { doRetake(s, s.retakes[0], effort); return; }
  if (projectPartner(s) && rnd() < 0.4) { workProject(s, effort); return; }
  if (needsHaircut(s) && s.money >= game.grooming.cutCost && rnd() < 0.3) {
    s.money -= game.grooming.cutCost;
    s.energy = Math.max(0, s.energy + game.grooming.cutEnergy);
    haircut(s);
    return;
  }

  // ไปตามนัด
  const plan = planToday(s);
  if (plan && isPlanPeriod(s) && rnd() < 0.8) { meet(s, plan.charId, t, rnd); return; }

  const locs = availableLocations(s).filter((l) => !l.blocked);
  if (!locs.length) return;
  const loc = locs[Math.floor(rnd() * locs.length)];

  // เจอคนในที่นั้น — ทางหลักที่ระบบความสัมพันธ์ทั้งหมดวิ่งผ่าน
  const here = whoIsAt(s, loc.id, period);
  if (here.length && rnd() < 0.55) { meet(s, here[0], t, rnd, loc.id); return; }

  if (loc.club) { doClubActivity(s, s.doneToday[loc.id] ?? 0, 0.6 + mg() * 0.9); return; }
  if (loc.rest && rnd() < 0.3) { doRest(s, loc); return; }
  if (loc.action) {
    const r = doAction(s, loc, rnd, rnd() < 0.3);
    if (r?.caught && mg() >= 0.6) escapeCatch(s, r.penalty);
    if (loc.subjectPick && r?.ok) studyOne(s, SUBJECTS[Math.floor(rnd() * SUBJECTS.length)].id);
    return;
  }
  // ซื้อของและให้ของฝาก — สองทางที่ไม่มีเทสต์อื่นเดินผ่านพร้อมบทจริง
  if (rnd() < 0.25) {
    const it = ITEMS[Math.floor(rnd() * ITEMS.length)];
    buy(s, it.id);
    if (s.inventory[it.id]) {
      const met = chars.filter((c) => s.met[c.id] !== undefined);
      if (it.gift && met.length) gift(s, it.id, met[Math.floor(rnd() * met.length)].id);
      else use(s, it.id);
    }
  }
}

/** ไปหาใครสักคน — ทางเดียวกับ talkTo() ใน main.ts */
function meet(s: GameState, charId: string, t: Tally, rnd: Rnd, at?: string) {
  const c = chars.find((x) => x.id === charId)!;
  const period = periodId(s);
  const first = noteEncounter(s, charId, at ?? "", period);
  const fm = (c as { firstMeet?: string }).firstMeet;
  s.metToday[charId] = true;
  s.encounters++;
  visited(s, charId);
  keepPlan(s, charId);
  seenWith(s, charId, at);
  remember(s, `คุยกับ${c.name}`);
  playInk(first && fm ? fm : c.story, s, charId, t, rnd);
}

// ───────────────────── เดินจริง ─────────────────────

const SEEDS = [11, 47];
const tallies: { name: string; t: Tally; end: string; uni: string | null }[] = [];

console.log(`เล่นจนจบด้วยบทจริง · ${BACKGROUNDS.length} ภูมิหลัง × ${SEEDS.length} seed · สองภาค\n`);

for (const bg of BACKGROUNDS) {
  for (const seed of SEEDS) {
    const t: Tally = { scenes: 0, lines: 0, choices: 0, externals: {}, events: [], missingInk: [], errors: [] };
    const s = newState(seed);
    applyBackground(s, bg.id);
    const rnd = mulberry32(seed);
    const mg = () => clamp01(0.55 + (rnd() - 0.5) * 0.7);
    try {
      playTerm(s, t, rnd, mg);
      const en = computeEnding(s);
      let uni: string | null = null;
      if (en.score >= game.carryOver.minScoreToUni) {
        startUni(s, en);
        playTerm(s, t, rnd, mg);
        uni = computeEnding(s).tier;
      }
      tallies.push({ name: `${bg.name} · seed ${seed}`, t, end: en.tier, uni });
    } catch (e) {
      t.errors.push((e as Error).stack?.split("\n").slice(0, 3).join(" | ") ?? String(e));
      tallies.push({ name: `${bg.name} · seed ${seed}`, t, end: "พังกลางทาง", uni: null });
    }
  }
}

let bad = 0;
for (const r of tallies) {
  const ok = !r.t.errors.length && !r.t.missingInk.length;
  if (!ok) bad++;
  console.log(`${ok ? "  ok  " : "  พัง  "} ${r.name.padEnd(30)} ` +
    `ฉาก ${String(r.t.scenes).padStart(3)} · บรรทัด ${String(r.t.lines).padStart(5)} · ` +
    `ทางเลือก ${String(r.t.choices).padStart(4)} · ${r.end}${r.uni ? " → " + r.uni : ""}`);
  for (const m of [...new Set(r.t.missingInk)]) console.log(`         ← ไม่มีไฟล์บท: ${m}`);
  for (const e of r.t.errors) console.log(`         ← ${e}`);
}

// เหตุการณ์ตามปฏิทินทุกอันต้องถูกเล่นจริงอย่างน้อยหนึ่งรอบ
import eventsData from "../../data/events.json";
const seen = new Set(tallies.flatMap((r) => r.t.events));
const missed = (eventsData as { id: string; chapter?: string; skip?: boolean }[])
  .filter((e) => !e.skip)
  .filter((e) => !seen.has(`${e.chapter ?? "school"}/${e.id}`));
console.log(`\nเหตุการณ์ตามปฏิทิน: เล่นจริงแล้ว ${seen.size} จาก ` +
            `${(eventsData as { skip?: boolean }[]).filter((e) => !e.skip).length}`);
if (missed.length) {
  console.log(`  ← ไม่เคยถูกเล่นเลย: ${missed.map((e) => e.id).join(" ")}`);
  bad++;
}

// external ทุกตัวต้องถูกเรียกจริงอย่างน้อยครั้งหนึ่ง ไม่งั้นสะพานฝั่งนั้นไม่เคยถูกทดสอบ
const calls: Record<string, number> = {};
for (const r of tallies) for (const [k, n] of Object.entries(r.t.externals)) calls[k] = (calls[k] ?? 0) + n;
console.log(`\nสะพาน ink → TS ที่ถูกเรียกจริง:`);
console.log("  " + Object.entries(calls).sort((a, b) => b[1] - a[1])
  .map(([k, n]) => `${k} ${n}`).join(" · "));
for (const need of ["stat", "affinity", "flag", "invite", "trust", "introduce"])
  if (!calls[need]) { console.log(`  ← ไม่มีใครเรียก ${need}() เลย สะพานฝั่งนั้นไม่ถูกทดสอบ`); bad++; }

console.log(bad ? `\nมีปัญหา ${bad} จุด` : `\nเล่นจบครบทุกภูมิหลัง ไม่มีบทไหนหาย ไม่มีเส้นทางไหนพัง`);
process.exit(bad ? 1 : 0);
