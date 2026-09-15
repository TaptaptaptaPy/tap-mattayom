/** จำลองการเล่นจนจบเทอมแบบ headless — รันด้วย `npm run balance`
 *
 *  เดิมเทสต์นี้ใช้ `rnd = () => 0.5` คงที่เพื่อให้ผลซ้ำได้ ซึ่งซ้ำได้จริง
 *  แต่โอกาสโดนครูปกครองจับสูงสุดในเกมคือ 0.34 (โดดเรียน) รองลงมา 0.22 และ 0.16
 *  ทุกค่าต่ำกว่า 0.5 หมด `rnd() > chance` จึงเป็นจริงทุกครั้ง
 *  ผลคือ "โดนจับ 0 ครั้ง" ทุกกลยุทธ์แบบที่เป็นอย่างอื่นไม่ได้เลย
 *  ฝ่ายปกครอง มินิเกมหลบ และ inTrouble ทั้งชุดจึงไม่เคยถูกทดสอบ
 *
 *  ตอนนี้ใช้ mulberry32 ที่ seed ได้ เล่นหลาย seed แล้วเฉลี่ย ได้ทั้งความซ้ำได้และความสุ่มจริง */
import game from "../../data/game.json";
import { mulberry32, clamp01, type Rnd } from "../core/rng";
import { newState, statRank, type GameState, type StatId, type Ending, type ExamResult } from "../sim/state";
import { advance, isLocked, isTermOver, eventNow, isSchoolDay } from "../sim/calendar";
import { availableLocations, doAction, doRest, attendClass, skipClass,
         type ActionResult, type LocationOption } from "../sim/actions";
import { takeExam } from "../sim/exam";
import { joinClub, clubToday, doClubActivity } from "../sim/club";
import { escapeCatch, inTrouble } from "../sim/discipline";
import { offerChat, recordThread, acceptInvite, planToday, keepPlan, isPlanPeriod } from "../sim/chat";
import { computeEnding } from "../sim/ending";
import { buy, use } from "../sim/shop";

const SEEDS = [11, 23, 47, 91, 137];
/** ฝีมือมินิเกมกลางๆ ของผู้เล่นจำลอง — มินิเกมคืนคะแนน 0..1 เสมอ */
const SKILL = 0.6;
/** คะแนนมินิเกมหลบที่ถือว่ารอด — ต้องตรงกับ runDodge() ใน main.ts */
const DODGE_PASS = 0.6;

type Strategy = "mind" | "spread" | "social" | "lazy" | "rebel";
const STRAT_NAME: Record<Strategy, string> = {
  mind: "ทุ่มเรียนอย่างเดียว",
  spread: "เฉลี่ยทุกค่า",
  social: "เน้นกิจกรรมที่ได้เยอะสุด",
  lazy: "ไม่ทำอะไรเลยทั้งเทอม",
  rebel: "เด็กหลังห้อง",
};
const clubFor = (strat: Strategy) =>
  strat === "mind" ? "academic" : strat === "social" ? "music" : "sport";

interface Run {
  stats: Record<StatId, number>;
  maxedAt: Partial<Record<StatId, number>>;
  exams: Record<string, ExamResult>;
  minEnergy: number; blocked: number; restPeriods: number;
  caught: number; escaped: number; troublePeriods: number;
  chats: number; invites: number; kept: number;
  behaviour: number; money: number;
  ending: Ending;
}

// ───────────────────────── เลือกที่จะไป ─────────────────────────

const actionable = (s: GameState) =>
  availableLocations(s)
    .filter((l) => l.action && !l.blocked)
    .filter((l) => (l.action!.cost ?? 0) <= s.money);

function choose(strat: Strategy, locs: LocationOption[], s: GameState): LocationOption {
  const gain = (l: LocationOption) => l.action!.gain;
  switch (strat) {
    case "mind":
      return [...locs].sort((a, b) =>
        (b.action!.stat === "mind" ? 1 : 0) - (a.action!.stat === "mind" ? 1 : 0))[0];
    case "social":
      return [...locs].sort((a, b) => gain(b) - gain(a))[0];
    // เด็กหลังห้องเลือกที่เสี่ยงก่อนเสมอ นี่คือทางเดียวที่ rollCatch() จะได้ทำงาน
    case "rebel":
      return [...locs].sort((a, b) =>
        (b.risky ? 1 : 0) - (a.risky ? 1 : 0) ||
        (b.action!.stat === "nerve" ? 1 : 0) - (a.action!.stat === "nerve" ? 1 : 0) ||
        gain(b) - gain(a))[0];
    default:
      return [...locs].sort((a, b) => s.stats[a.action!.stat] - s.stats[b.action!.stat])[0];
  }
}

// ───────────────────────── เล่นหนึ่งเทอม ─────────────────────────

function play(strat: Strategy, seed: number, skill: number): Run {
  const s = newState();
  const rnd: Rnd = mulberry32(seed);
  /** จำลองผลมินิเกม: ฝีมือเป็นฐาน บวกความคลาดเคลื่อนของแต่ละรอบ */
  const mg = () => clamp01(skill + (rnd() - 0.5) * 0.3);

  let minEnergy = 999, blocked = 0, restPeriods = 0, escaped = 0, troublePeriods = 0;
  let chats = 0, invites = 0, kept = 0;
  /** ใครรับนัดแล้วไปจริง — คนที่ทุ่มเรียนกับเด็กหลังห้องเบี้ยวบ้าง จะได้เห็นราคาของการผิดนัด */
  const takesInvite = strat === "social" || strat === "spread" || strat === "rebel";
  const keepsInvite = strat === "social" || strat === "spread";
  const maxedAt: Partial<Record<StatId, number>> = {};

  /** โดนจับแล้วได้เล่นมินิเกมหลบ — ทางเดียวกับ runDodge() ใน main.ts */
  const afterCatch = (r: ActionResult | null) => {
    if (!r?.caught) return;
    if (mg() >= DODGE_PASS) { escapeCatch(s, r.penalty); escaped++; }
  };

  while (!isTermOver(s)) {
    // เหตุการณ์ตามปฏิทินถูกข้ามในโหมดจำลอง เพราะเนื้อหาอยู่ใน ink ที่ต้องมีคนเลือก
    // (`npm run story` เป็นตัวที่คุมฝั่งนั้น) ยกเว้นวันสอบซึ่งต้องเข้าสอบจริง
    const ev = eventNow(s);
    if (ev) {
      s.seenEvents[ev.id] = true;
      if (ev.exam) takeExam(s, ev.exam, mg());
      if (ev.pickClub && !s.club) joinClub(s, clubFor(strat));
    }

    // ไลน์ตอนกลางคืน — ฝั่งตัวเลขล้วน คำพูดอยู่ใน ink ซึ่ง `npm run story` คุมอยู่แล้ว
    // จึงบันทึกบทสนทนาเปล่าไว้ เพื่อให้ตรรกะคูลดาวน์กับประวัติแชทถูกเดินจริง
    const who = offerChat(s, rnd);
    if (who) {
      chats++;
      // บทกั้นทางเลือกชวนนัดไว้ด้วย {tomorrowSchool} เทสต์ต้องเคารพเงื่อนไขเดียวกัน
      const canMeet = isSchoolDay({ ...s, dayIndex: s.dayIndex + 1 });
      const invited = canMeet && takesInvite && rnd() < 0.7;
      if (invited) { acceptInvite(s, who); invites++; }
      recordThread(s, who, [], invited);
    }

    const appt = planToday(s);
    if (appt && isPlanPeriod(s) && keepsInvite) {
      // ไปตามนัดกินช่วงเวลานั้นไปทั้งช่วง เหมือนไปนั่งคุยกับเขาจริงๆ
      keepPlan(s, appt.charId);
      kept++;
    } else if (isLocked(s)) {
      if (strat === "rebel") afterCatch(skipClass(s, rnd));
      else attendClass(s);
    } else if (strat === "lazy") {
      const home = availableLocations(s).find((l) => l.rest);
      if (home) { doRest(s, home); restPeriods++; }
    } else {
      if (inTrouble(s)) troublePeriods++;
      const club = clubToday(s);
      const locs = actionable(s);
      const clubLoc = club ? availableLocations(s).find((l) => l.club) : undefined;

      if (clubLoc) {
        // ชมรมดนตรีกับกีฬามีมินิเกม ตัวคูณช่วง 0.6–1.5 ตรงกับที่ main.ts คิด
        const mult = club!.id === "music" || club!.id === "sport" ? 0.6 + mg() * 0.9 : 1;
        const times = s.doneToday[clubLoc.id] ?? 0;
        doClubActivity(s, times, mult);
        s.doneToday[clubLoc.id] = times + 1;   // เกมจริงนับ ตัวเทสต์เดิมส่ง 0 ตลอดจนผลตอบแทนไม่เคยลดหลั่น
      } else if (locs.length) {
        const r = doAction(s, choose(strat, locs, s), rnd);
        afterCatch(r);
        if (r && /หมดแรง|แรงเหลือน้อย|เงินไม่พอ/.test(r.message)) {
          blocked++;
          const home = availableLocations(s).find((l) => l.rest);
          if (home) doRest(s, home);
          else if (s.money >= 90) { buy(s, "energydrink"); use(s, "energydrink"); }
        }
      }
    }

    minEnergy = Math.min(minEnergy, s.energy);
    for (const st of game.stats) {
      const id = st.id as StatId;
      if (statRank(s.stats[id]) === game.statRankNames.length - 1 && maxedAt[id] === undefined)
        maxedAt[id] = s.dayIndex + 1;
    }
    advance(s);
  }

  return {
    stats: { ...s.stats }, maxedAt, exams: { ...s.exams },
    minEnergy, blocked, restPeriods,
    caught: s.caught, escaped, troublePeriods, chats, invites, kept,
    behaviour: s.behaviour, money: s.money,
    ending: computeEnding(s),
  };
}

// ───────────────────────── รวมผลหลาย seed ─────────────────────────

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r0 = (v: number) => Math.round(v);

function runAll(strat: Strategy, skill = SKILL) { return SEEDS.map((sd) => play(strat, sd, skill)); }

function report(strat: Strategy, runs: Run[]) {
  console.log(`\nกลยุทธ์: ${STRAT_NAME[strat]}`);

  const statLine = game.stats.map((st) => {
    const id = st.id as StatId;
    const v = mean(runs.map((r) => r.stats[id]));
    const days = runs.map((r) => r.maxedAt[id]).filter((d): d is number => d !== undefined);
    const tag = days.length ? ` ← เต็มวันที่ ${Math.min(...days)}` : "";
    return `    ${st.name.padEnd(8)} ${r0(v).toString().padStart(4)}  ${game.statRankNames[statRank(v)]}${tag}`;
  });
  console.log(statLine.join("\n"));

  const ex = game.exams.map((x) => {
    const got = runs.map((r) => r.exams[x.id]).filter(Boolean);
    if (!got.length) return `${x.name} ไม่ได้สอบ`;
    return `${x.name} ${r0(mean(got.map((g) => g.score)))} (ที่ ${r0(mean(got.map((g) => g.rank)))})`;
  }).join(" · ");
  console.log(`    ${ex}`);

  const rest = mean(runs.map((r) => r.restPeriods));
  console.log(`    แรงต่ำสุด ${r0(mean(runs.map((r) => r.minEnergy)))}/${game.energy.max}` +
              ` · ถูกบล็อกเพราะหมดแรง/เงิน ${r0(mean(runs.map((r) => r.blocked)))} ครั้ง` +
              (rest ? ` · พัก ${r0(rest)} ช่วง` : ""));

  const caught = mean(runs.map((r) => r.caught + r.escaped));   // caught ถูกหักคืนตอนหลบรอด
  console.log(`    ฝ่ายปกครอง: โดนจับ ${r0(caught)} ครั้ง · หลบรอด ${r0(mean(runs.map((r) => r.escaped)))}` +
              ` · โดนห้ามเข้าที่เสี่ยง ${r0(mean(runs.map((r) => r.troublePeriods)))} ช่วง` +
              ` · ความประพฤติ ${r0(mean(runs.map((r) => r.behaviour)))}`);

  const ch = mean(runs.map((r) => r.chats));
  if (ch >= 0.5)
    console.log(`    ไลน์: มีคนทักมา ${r0(ch)} คืน · รับนัด ${r0(mean(runs.map((r) => r.invites)))}` +
                ` · ไปตามนัด ${r0(mean(runs.map((r) => r.kept)))}` +
                ` · ผิดนัด ${r0(mean(runs.map((r) => r.invites - r.kept)))}`);

  const scores = runs.map((r) => r.ending.score);
  const tiers = [...new Set(runs.map((r) => r.ending.tier))];
  console.log(`    เงินคงเหลือ ${r0(mean(runs.map((r) => r.money)))}` +
              ` · ปลายทาง: ${tiers.join(" / ")} (${r0(mean(scores))}` +
              (Math.min(...scores) === Math.max(...scores) ? ")" : `, ช่วง ${Math.min(...scores)}–${Math.max(...scores)})`));
}

// ───────────────────────── เดินจริง ─────────────────────────

console.log(`จำลองเล่นจนจบเทอม ${game.term.days} วัน · ${Object.keys(STRAT_NAME).length} กลยุทธ์ × ${SEEDS.length} seed · ฝีมือมินิเกม ${SKILL}`);

const STRATS: Strategy[] = ["mind", "spread", "social", "lazy", "rebel"];
const results = new Map<Strategy, Run[]>();
for (const st of STRATS) { const rs = runAll(st); results.set(st, rs); report(st, rs); }

// ───────────────────────── ฝีมือมินิเกมมีผลแค่ไหน ─────────────────────────
// นี่คือช่องที่เทสต์เดิมมองไม่เห็นเลย เพราะ takeExam() ถูกเรียกโดยไม่ส่งคะแนนมินิเกม
// เลยใช้ค่า default 0.5 ตลอด ตัวคูณ 0.72–1.28 จึงไม่เคยถูกแตะที่ปลายทั้งสองข้าง

console.log("\n" + "─".repeat(58));
console.log("ฝีมือมินิเกมมีผลแค่ไหน (กลยุทธ์เฉลี่ยทุกค่า)");
const sweep = [0.1, 0.6, 0.95].map((sk) => {
  const rs = runAll("spread", sk);
  const finals = rs.map((r) => r.exams["final"]?.score ?? 0);
  return { sk, final: mean(finals), score: mean(rs.map((r) => r.ending.score)) };
});
for (const x of sweep)
  console.log(`  ฝีมือ ${x.sk.toFixed(2)}  สอบปลายภาค ${r0(x.final)} · คะแนนปลายทาง ${r0(x.score)}`);
const skillSwing = sweep[2].score - sweep[0].score;

// ───────────────────────── สรุปและคำเตือน ─────────────────────────

console.log("\n" + "─".repeat(58));
const maxLines: string[] = [];
for (const [, rs] of results)
  for (const s of game.stats) {
    const id = s.id as StatId;
    const days = rs.map((r) => r.maxedAt[id]).filter((d): d is number => d !== undefined);
    if (days.length) maxLines.push(`${id} เต็มวันที่ ${Math.min(...days)}/${game.term.days}`);
  }
console.log(maxLines.length ? `ค่าที่แตะเพดาน: ${maxLines.join(" · ")}` : "ไม่มีค่าสถานะไหนแตะเพดานเลยทั้งเทอม");

const allRuns = [...results.values()].flat();
const totalChats = sum(allRuns.map((r) => r.chats));
const totalInvites = sum(allRuns.map((r) => r.invites));
const totalKept = sum(allRuns.map((r) => r.kept));
console.log(`ไลน์ทำงานจริงไหม: ทักมารวม ${totalChats} คืน · รับนัด ${totalInvites} · ไปตามนัด ${totalKept}` +
            ` · ผิดนัด ${totalInvites - totalKept}`);

const totalCaught = sum(allRuns.map((r) => r.caught + r.escaped));
const totalEscaped = sum(allRuns.map((r) => r.escaped));
console.log(`ฝ่ายปกครองทำงานจริงไหม: โดนจับรวม ${totalCaught} ครั้ง · หลบรอด ${totalEscaped} ครั้ง`);

const early = [...results.values()].flat()
  .filter((r) => Object.values(r.maxedAt).some((d) => (d ?? 999) < game.term.days * 0.25));
const tiring = STRATS.filter((st) => st !== "lazy")
  .filter((st) => mean(results.get(st)!.map((r) => r.minEnergy)) <= game.energy.lowThreshold);
const serious = mean(results.get("spread")!.map((r) => r.ending.score));
const idle = mean(results.get("lazy")!.map((r) => r.ending.score));

if (early.length) console.log(`เตือน: มีกลยุทธ์ที่แตะเพดานก่อน 1 ใน 4 ของเทอม เร็วเกินไป`);
if (!tiring.length) console.log("เตือน: ไม่มีกลยุทธ์ไหนที่แรงลงต่ำกว่าเกณฑ์เลย ระบบแรงยังไม่มีผล");
if (serious <= idle) console.log("เตือน: เล่นจริงจังได้ผลไม่ต่างจากไม่ทำอะไรเลย");
if (totalCaught === 0) console.log("เตือน: ไม่มีใครโดนฝ่ายปกครองจับเลยสักครั้ง ทั้งระบบความประพฤติไม่ถูกทดสอบ");
if (totalEscaped === 0) console.log("เตือน: มินิเกมหลบฝ่ายปกครองไม่เคยช่วยใครรอดเลย");
if (totalChats === 0) console.log("เตือน: ไม่มีใครส่งไลน์มาเลยสักคืน ระบบไลน์ไม่ถูกทดสอบ");
if (totalInvites === totalKept) console.log("เตือน: ไม่มีใครผิดนัดเลย บทลงโทษการผิดนัดไม่ถูกทดสอบ");
if (skillSwing < 3) console.log(`เตือน: ฝีมือมินิเกมแทบไม่มีผลกับปลายทาง (ต่างกันแค่ ${skillSwing.toFixed(1)} คะแนน)`);
if (!early.length && tiring.length && serious > idle && totalCaught > 0 && skillSwing >= 3 && totalChats > 0)
  console.log("เศรษฐกิจของเกมอยู่ในเกณฑ์ที่ตั้งใจไว้");
