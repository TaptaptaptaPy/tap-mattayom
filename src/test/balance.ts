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
import { newState, statRank, affinityRank, trustRank,
         type GameState, type StatId, type Ending, type ExamResult } from "../sim/state";
import { advance, isLocked, isTermOver, eventNow, eventsFor, isSchoolDay } from "../sim/calendar";
import { availableLocations, doAction, doRest, attendClass, skipClass,
         type ActionResult, type LocationOption } from "../sim/actions";
import { takeExam } from "../sim/exam";
import { joinClub, clubToday, doClubActivity } from "../sim/club";
import { escapeCatch, inTrouble } from "../sim/discipline";
import { changeAffinity, trustFromFlag } from "../sim/bonds";
import { stepLives, visited } from "../sim/offscreen";
import { offerChat, offerSecondChat, recordThread, acceptInvite, planToday, keepPlan, isPlanPeriod,
         planClash } from "../sim/chat";
import { claim } from "../sim/claims";
import { postBoard, tutor, myBoardRank } from "../sim/board";
import { isSick } from "../sim/push";
import { milestoneToday, runMilestone } from "../sim/milestone";
import { seenWith } from "../sim/seen";
import { askAmount, giveHome, refuseHome } from "../sim/home";
import { rivalLead, stepRivals } from "../sim/rival";
import { hasHomework, doHomework } from "../sim/homework";
import { inspect, needsHaircut, haircut } from "../sim/grooming";
import { hasRetake, doRetake, projectPartner, workProject, assignProject,
         projectNeeded } from "../sim/schoolwork";
import { gpa, gradeOf, SUBJECTS } from "../sim/grades";
import { computeEnding } from "../sim/ending";
import { startUni } from "../sim/chapter";
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
  /** กี่คืนที่บอกสองคนไม่ตรงกัน และกี่ครั้งที่โดนจับได้ */
  lied: number; caughtLying: number;
  /** กระดานประกาศผล: อันดับสุดท้ายของเรา · ติวให้เพื่อนกี่ครั้ง · เพื่อนร่วงกี่ครั้ง */
  boardRank: number; tutored: number; slipped: number;
  /** ฝืนทั้งที่หมดแรงกี่ครั้ง · หลับในคาบกี่ครั้ง · ล้มป่วยกี่วัน */
  pushes: number; dozes: number; sickDays: number;
  /** ไปซ้อมชมรมกี่ครั้ง และวันงานใหญ่ได้ระดับไหน (-1 = ไม่ได้อยู่ชมรมที่มีงาน) */
  clubDays: number; milestoneTier: number; bigCount: number;
  /** กี่ครั้งที่คนที่นัดเราไว้เห็นเราอยู่กับอีกคน · เรื่องแพร่ไปทั้งวงกี่ครั้ง */
  caughtOut: number; gossips: number;
  /** ส่งเงินให้ที่บ้านรวมเท่าไหร่ · ปฏิเสธทั้งที่มีกี่ครั้ง · บ้านตึงระดับไหนตอนจบ */
  homeGiven: number; homeRefused: number; homeStrain: number;
  /** ครูมองเรายังไงตอนจบ · ครูเข้าไปพูดแทนกี่ครั้ง · โทรหาที่บ้านกี่ครั้ง */
  teacher: number; shielded: number; calledHome: number;
  /** คู่แข่งแซงเราไปกี่คน และเรานำอยู่เฉลี่ยเท่าไหร่ */
  rivalsAhead: number; rivalLeadAvg: number; affinityTop: number;
  /** กี่วันที่รับนัดไว้ซ้อนกันเกินหนึ่งคน */
  clashDays: number;
  /** เรื่องที่เกิดขึ้นตอนเราไม่อยู่ และความทรงจำที่ตัวละครเก็บไว้ */
  offscreen: number; memories: number;
  /** ผลต่างของสองแกน (สนิท − เชื่อใจ) ต่อตัวละครหนึ่งคน ตอนจบเทอม */
  axisGap: number[];
  homeworkDone: number; homeworkMissed: number;
  haircuts: number; inspected: number;
  retakesDone: number; retakesLeft: number; projectDone: number; projectMissed: number;
  behaviour: number; money: number; standing: number; gpa: number;
  grades: Record<string, number>;
  ending: Ending;
  /** ปีหนึ่ง — null ถ้าคะแนนไม่ถึงเกณฑ์เข้ามหาลัย */
  uni: { ending: Ending; gpa: number; debt: number; money: number } | null;
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

/** อีกกี่วันถึงวันสอบถัดไป — สะท้อน examSoon ที่บทใช้กั้นทางเลือกติวให้ */
function nextExamIn(s: GameState): number {
  const days = eventsFor(s).filter((e) => e.exam && e.day > s.dayIndex).map((e) => e.day - s.dayIndex);
  return days.length ? Math.min(...days) : -1;
}

/** ฝืนแค่ไหน — "ไม่ฝืนเลย" คือพฤติกรรมเดิมก่อนมีระบบนี้
 *  "ฝืนเท่าที่ยังไหว" คือหยุดก่อนถึงระดับที่เริ่มหลับในคาบ · "ฝืนทุกครั้ง" คือโลภสุดตัว */
type PushPolicy = "never" | "careful" | "always";

function play(strat: Strategy, seed: number, skill: number, policy?: PushPolicy): Run {
  const s = newState();
  const rnd: Rnd = mulberry32(seed);
  /** จำลองผลมินิเกม: ฝีมือเป็นฐาน บวกความคลาดเคลื่อนของแต่ละรอบ */
  const mg = () => clamp01(skill + (rnd() - 0.5) * 0.3);

  let minEnergy = 999, blocked = 0, restPeriods = 0, escaped = 0, troublePeriods = 0;
  let chats = 0, invites = 0, kept = 0, clashDays = 0, homeworkDone = 0, haircuts = 0;
  let lied = 0, tutored = 0, pushes = 0, dozes = 0, sickDays = 0, milestoneTier = -1;
  // ต้องจำไว้ตอนวันงาน ไม่ใช่ไปอ่านตอนจบ — ขึ้นปีหนึ่งแล้ว s.clubDays ถูกล้างเป็น 0
  let milestoneAttended = 0, bigCount = 0, caughtOut = 0, homeGiven = 0, homeRefused = 0;
  let retakesDone = 0, projectDone = 0;
  /** ใครตามเก็บภาระให้ครบ — เด็กหลังห้องกับคนขี้เกียจปล่อยทิ้ง จะได้เห็นราคาของการไม่ตาม */
  const doesChores = strat === "mind" || strat === "spread" || strat === "social";
  /** ใครใส่ใจทรงผม — เด็กหลังห้องกับคนขี้เกียจไม่ตัด จะได้เห็นราคาของการปล่อยไว้ */
  const cutsHair = strat === "mind" || strat === "spread" || strat === "social";
  /** ใครส่งการบ้าน — คนขี้เกียจกับเด็กหลังห้องไม่ส่ง จะได้เห็นราคาของการไม่ส่งจริง */
  const doesHomework = strat === "mind" || strat === "spread" || strat === "social";
  /** ใครรับนัดแล้วไปจริง — คนที่ทุ่มเรียนกับเด็กหลังห้องเบี้ยวบ้าง จะได้เห็นราคาของการผิดนัด */
  const takesInvite = strat === "social" || strat === "spread" || strat === "rebel";
  const keepsInvite = strat === "social" || strat === "spread";
  /** ใครเลี่ยงความจริงเวลาถูกถามว่าเมื่อวานหายไปไหน
   *  คนที่คุยกับทุกคนมีเหตุให้เลี่ยงที่สุด เพราะคำตอบจริงคือ "ไปหาอีกคน"
   *  ถ้าไม่มีกลยุทธ์ไหนโกหกเลย ระบบคำพูดไม่ตรงกันจะไม่เคยถูกเดินผ่าน */
  const lies = strat === "social" || strat === "rebel";
  /** ใครยอมเสียเวลาทบทวนของตัวเองไปติวให้เพื่อน
   *  ถ้าไม่มีกลยุทธ์ไหนติวเลย ทั้งระบบกระดาน (ช่องติวให้ + ธง lifted_*) จะไม่ถูกเดินผ่าน */
  const tutors = strat === "social" || strat === "spread";
  /** ใครส่งเงินให้ที่บ้าน — คนขี้เกียจกับเด็กหลังห้องเก็บไว้เอง จะได้เห็นราคาของมัน
   *  ถ้าทุกกลยุทธ์ให้หมด ราคาของการไม่ให้จะไม่เคยถูกวัดเลย */
  const givesHome = strat === "mind" || strat === "spread" || strat === "social";
  /** ใครฝืนต่อทั้งที่หมดแรง — คนที่ทุ่มเรียนกับเด็กหลังห้องฝืนด้วยเหตุผลคนละอย่างกัน
   *  ถ้าไม่มีใครฝืนเลย ทั้งระบบหนี้การนอน หลับในคาบ และล้มป่วย จะไม่ถูกเดินผ่าน */
  const pol: PushPolicy = policy ?? (strat === "mind" || strat === "rebel" ? "careful" : "never");
  // "ฝืนเท่าที่ไหว" = ยอมหลับในคาบได้ แต่ไม่ยอมเสี่ยงล้มป่วยทั้งวัน
  const pushesOn = () => pol === "always" ||
    (pol === "careful" && s.sleepDebt + game.push.debtPerPush < game.push.sickAt);
  const VERSIONS = ["busy", "other", "tired"];
  const pick = () => VERSIONS[Math.floor(rnd() * VERSIONS.length)];
  const maxedAt: Partial<Record<StatId, number>> = {};

  /** โดนจับแล้วได้เล่นมินิเกมหลบ — ทางเดียวกับ runDodge() ใน main.ts */
  const afterCatch = (r: ActionResult | null) => {
    if (!r?.caught) return;
    if (mg() >= DODGE_PASS) { escapeCatch(s, r.penalty); escaped++; }
  };

  const runTerm = () => {
  while (!isTermOver(s)) {
    const beforeDay = s.dayIndex;
    // เหตุการณ์ตามปฏิทินถูกข้ามในโหมดจำลอง เพราะเนื้อหาอยู่ใน ink ที่ต้องมีคนเลือก
    // (`npm run story` เป็นตัวที่คุมฝั่งนั้น) ยกเว้นวันสอบซึ่งต้องเข้าสอบจริง
    const ev = eventNow(s);
    if (ev) {
      s.seenEvents[ev.id] = true;
      if (ev.exam) {
        takeExam(s, ev.exam, mg());
        // กระดานติดหน้าห้องทันทีหลังรู้ผล — ผลข้างเคียงทั้งหมดของมันเกิดตรงนี้
        postBoard(s, ev.exam);
      }
      if (ev.pickClub && !s.club) joinClub(s, clubFor(strat));
      // วันงานใหญ่ของชมรม — ทั้งเทอมที่ไปซ้อมมาถูกคิดบัญชีตรงนี้
      const big = milestoneToday(s);
      if (big) { const r = runMilestone(s, mg())!;
                 if (milestoneTier < 0) { milestoneTier = r.tier; milestoneAttended = r.attended; }
                 bigCount++; }
      if (ev.assignProject && !s.project) assignProject(s, s.chapter);
      // โทรศัพท์จากที่บ้าน — คำพูดอยู่ใน ink แต่การตัดสินใจเป็นตัวเลขล้วน
      // คนที่เก็บเงินไว้เองจะได้เห็นราคาของมันจริงๆ ไม่ใช่แค่ตัวเลขในกระเป๋าที่สูงกว่า
      if (ev.ink === "ev_home_ask") {
        const want = askAmount(s);
        if (s.money < want) refuseHome(s, false);
        else if (givesHome) { giveHome(s, want); homeGiven += want; }
        else { refuseHome(s, true); homeRefused++; }
      }
    }

    // ไลน์ตอนกลางคืน — ฝั่งตัวเลขล้วน คำพูดอยู่ใน ink ซึ่ง `npm run story` คุมอยู่แล้ว
    // จึงบันทึกบทสนทนาเปล่าไว้ เพื่อให้ตรรกะคูลดาวน์กับประวัติแชทถูกเดินจริง
    const who = offerChat(s, rnd);
    if (who) {
      chats++;
      // ถูกถามว่าเมื่อวานหายไปไหน — คนซื่อตอบเหมือนกันทุกคน คนเลี่ยงตอบไปเรื่อย
      const tonight = pick();
      claim(s, "yesterday", tonight, who);
      // สอบใกล้แล้วเขาขอให้ติว — บทกั้นด้วย examSoon เทสต์ต้องเคารพเงื่อนไขเดียวกัน
      const nx = nextExamIn(s);
      if (tutors && nx >= 0 && nx <= game.board.tutorWindow && !(s.tutored[who] ?? 0)) {
        tutor(s, who); tutored++;
      }
      // บทกั้นทางเลือกชวนนัดไว้ด้วย {tomorrowSchool} เทสต์ต้องเคารพเงื่อนไขเดียวกัน
      const canMeet = isSchoolDay({ ...s, dayIndex: s.dayIndex + 1 });
      const invited = canMeet && takesInvite && rnd() < 0.7;
      if (invited) { acceptInvite(s, who); invites++; }
      recordThread(s, who, [], invited);

      // คืนเดียวกันอาจมีคนที่สองทักมา ถ้าสนิทกับหลายคน — นี่คือทางที่นัดจะซ้อนกัน
      const who2 = offerSecondChat(s, rnd, who);
      if (who2) {
        chats++;
        const second = lies ? pick() : tonight;
        if (second !== tonight) lied++;
        claim(s, "yesterday", second, who2);
        const inv2 = canMeet && takesInvite && rnd() < 0.7;
        if (inv2) { acceptInvite(s, who2); invites++; }
        recordThread(s, who2, [], inv2);
      }
    }

    if (planClash(s) > 1) clashDays++;
    const appt = planToday(s);
    if (appt && isPlanPeriod(s) && keepsInvite) {
      // ไปตามนัดกินช่วงเวลานั้นไปทั้งช่วง เหมือนไปนั่งคุยกับเขาจริงๆ
      keepPlan(s, appt.charId);
      // ที่ที่ไปเจอกันมีคนอื่นอยู่ด้วย — คนที่นัดเราไว้เหมือนกันจะเห็นกับตา
      caughtOut += seenWith(s, appt.charId).filter((w) => w.hadPlan).length;
      visited(s, appt.charId);
      // ไปเจอกันแล้วย่อมมีอะไรให้ตัดสินใจ — หยิบธงของคนนั้นมาสักอันเป็นตัวแทน
      // เทสต์นี้ไม่ได้เดินบท จึงไม่มีทางได้ธงมาเองเหมือนตอนเล่นจริง
      // ถ้าไม่จำลองตรงนี้ ระบบความเชื่อใจกับความทรงจำจะไม่เคยถูกวัดเลย
      rollChoice(s, appt.charId, rnd);
      kept++;
    } else if (!isLocked(s) && doesHomework && hasHomework(s) && s.energy + game.homework.energy >= 0) {
      // การบ้านกินหนึ่งช่วงเวลาเต็มๆ เหมือนในเกมจริง
      doHomework(s);
      homeworkDone++;
    } else if (!isLocked(s) && doesChores && hasRetake(s) && s.money >= game.retake.cost) {
      // สอบซ่อมกินหนึ่งช่วงเวลากับเงินก้อนหนึ่ง เหมือนในเกมจริง
      const id = s.retakes[0];
      if (!/ไม่พอ|น้อยเกิน/.test(doRetake(s, id))) retakesDone++;
    } else if (!isLocked(s) && doesChores && projectPartner(s)) {
      workProject(s);
      projectDone++;
    } else if (!isLocked(s) && cutsHair && needsHaircut(s) && s.money >= game.grooming.cutCost) {
      // ตัดผมกินหนึ่งช่วงเวลากับเงินก้อนหนึ่ง เหมือนในเกมจริง
      s.money -= game.grooming.cutCost;
      s.energy = Math.max(0, s.energy + game.grooming.cutEnergy);
      haircut(s);
      haircuts++;
    } else if (isLocked(s)) {
      if (strat === "rebel") afterCatch(skipClass(s, rnd));
      else {
        inspect(s, rnd);
        if (attendClass(s, rnd).includes("หลับ")) dozes++;
      }
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
        const r = doAction(s, choose(strat, locs, s), rnd, pushesOn());
        if (r?.forced) pushes++;
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
    advance(s, rnd);
    // ป่วยแล้วเสียทั้งวัน เหมือนที่เกมจริงข้ามวันให้ — เทสต์ต้องเดินทางเดียวกัน
    if (isSick(s) && s.periodIndex === 0) {
      sickDays++;
      while (s.periodIndex !== 0 || s.dayIndex === beforeDay) { advance(s, rnd); if (isTermOver(s)) break; }
    }
  }
  };

  runTerm();
  const schoolEnding = computeEnding(s);

  // เล่นต่อถึงปีหนึ่ง — ถ้าเทสต์ไม่เดินภาคนี้ ทุกอย่างที่เพิ่งเขียนจะไม่มีอะไรคุมเลย
  let uni: Run["uni"] = null;
  if (schoolEnding.score >= game.carryOver.minScoreToUni) {
    startUni(s, schoolEnding);
    runTerm();
    const ue = computeEnding(s);
    uni = { ending: ue, gpa: gpa(s), debt: s.debt, money: s.money };
  }

  return {
    stats: { ...s.stats }, maxedAt, exams: { ...s.exams },
    minEnergy, blocked, restPeriods,
    caught: s.caught, escaped, troublePeriods, chats, invites, kept, clashDays,
    lied, caughtLying: s.history.filter((h) => h.includes("พูดไม่ตรงกัน")).length,
    boardRank: myBoardRank(s), tutored, pushes, dozes, sickDays,
    clubDays: milestoneAttended, milestoneTier, bigCount, caughtOut,
    gossips: s.history.filter((h) => h.includes("เรื่องนี้ไปถึง")).length,
    homeGiven, homeRefused, homeStrain: s.home.strain,
    teacher: s.teacher,
    rivalsAhead: Object.keys(s.flags).filter((f) => /^rival_.+_ahead$/.test(f)).length,
    rivalLeadAvg: mean(Object.keys(s.affinity).map((id) => rivalLead(s, id))),
    affinityTop: Math.max(...Object.values(s.affinity)),
    shielded: s.history.filter((h) => h.includes("เข้าไปคุยกับฝ่ายปกครองแทนเรา")).length,
    calledHome: s.history.filter((h) => h.includes("โทรหาที่บ้าน")).length,
    slipped: Object.keys(s.flags).filter((f) => f.endsWith("_slipped")).length,
    offscreen: Object.values(s.lives).reduce((n, l) => n + l.fired, 0),
    memories: Object.values(s.memories).reduce((n, m) => n + m.length, 0),
    axisGap: Object.keys(s.affinity).map((id) =>
      affinityRank(s.affinity[id] ?? 0) - trustRank(s.trust[id] ?? 0)),
    homeworkDone, homeworkMissed: s.homeworkMissed,
    haircuts, inspected: s.inspected,
    retakesDone, retakesLeft: s.retakes.length, projectDone,
    projectMissed: s.project && !s.project.settled ? 1
      : s.project && s.project.done < projectNeeded ? 1 : 0,
    behaviour: s.behaviour, money: s.money, standing: s.standing,
    gpa: gpa(s), grades: { ...s.grades },
    ending: schoolEnding, uni,
  };
}

// ───────────────────────── รวมผลหลาย seed ─────────────────────────

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** ธงของแต่ละคน แยกไว้ล่วงหน้าเพื่อไม่ต้องกรองซ้ำทุกครั้ง */
const FLAGS_BY_CHAR = (() => {
  const out: Record<string, string[]> = {};
  for (const [flag, rule] of Object.entries(
        game.trustFlags as unknown as Record<string, [string, number, string?]>))
    (out[rule[0]] ??= []).push(flag);
  return out;
})();

/** จำลองว่าผู้เล่นตัดสินใจอะไรสักอย่างกับคนนี้
 *
 *  สัดส่วนต้องใกล้ของจริง: ในบทมีธง 79 อัน แต่มีแค่ 39 อันที่อยู่ในตารางความเชื่อใจ
 *  อีกครึ่งเป็นทางเลือกที่อบอุ่นแต่ไม่ได้พิสูจน์อะไร — สนิทขึ้นโดยไม่ได้ไว้ใจขึ้น
 *  ถ้าจำลองแต่ทางที่ขยับความเชื่อใจ สองแกนจะดูเหมือนขยับไปด้วยกันเสมอ ซึ่งไม่จริง */
function rollChoice(s: GameState, charId: string, rnd: () => number) {
  if (rnd() > 0.55) return;
  const list = FLAGS_BY_CHAR[charId];
  const provesSomething = list && rnd() < 0.49;
  if (!provesSomething) {
    // คุยกันสนุกดี แต่ไม่ได้มีอะไรให้พิสูจน์ตัว
    changeAffinity(s, charId, 2 + Math.floor(rnd() * 3));
    return;
  }
  const flag = list[Math.floor(rnd() * list.length)];
  if (s.flags[flag]) return;
  s.flags[flag] = true;
  trustFromFlag(s, flag);
}
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
              ` · ความประพฤติ ${r0(mean(runs.map((r) => r.behaviour)))}` +
              ` · ชื่อเสียง ${r0(mean(runs.map((r) => r.standing)))}`);

  const sheet = SUBJECTS.map((x) =>
    `${x.short}${gradeOf(mean(runs.map((r) => r.grades[x.id] ?? 0))).name}`).join(" ");
  console.log(`    เกรดเฉลี่ย ${mean(runs.map((r) => r.gpa)).toFixed(2)} · ${sheet}`);
  console.log(`    การบ้าน: ส่ง ${r0(mean(runs.map((r) => r.homeworkDone)))} ครั้ง` +
              ` · ไม่ได้ส่ง ${r0(mean(runs.map((r) => r.homeworkMissed)))} ชิ้น`);

  console.log(`    ภาระ: สอบซ่อม ${r0(mean(runs.map((r) => r.retakesDone)))} ครั้ง` +
              ` · ยังติดซ่อม ${r0(mean(runs.map((r) => r.retakesLeft)))} วิชา` +
              ` · งานกลุ่ม ${r0(mean(runs.map((r) => r.projectDone)))}/${projectNeeded} ครั้ง` +
              `${mean(runs.map((r) => r.projectMissed)) > 0.4 ? " · ส่งไม่ทัน" : ""}`);
  console.log(`    ทรงผม: ตัด ${r0(mean(runs.map((r) => r.haircuts)))} ครั้ง` +
              ` · โดนเรียกหน้าแถว ${r0(mean(runs.map((r) => r.inspected)))} ครั้ง`);

  const ch = mean(runs.map((r) => r.chats));
  if (ch >= 0.5)
    console.log(`    ไลน์: มีคนทักมา ${r0(ch)} คืน · รับนัด ${r0(mean(runs.map((r) => r.invites)))}` +
                ` · ไปตามนัด ${r0(mean(runs.map((r) => r.kept)))}` +
                ` · ผิดนัด ${r0(mean(runs.map((r) => r.invites - r.kept)))}`);

  const withUni = runs.filter((r) => r.uni);
  if (withUni.length)
    console.log(`    ปีหนึ่ง: เกรดเฉลี่ย ${mean(withUni.map((r) => r.uni!.gpa)).toFixed(2)}` +
                ` · เงินเหลือ ${r0(mean(withUni.map((r) => r.uni!.money)))}` +
                ` · หนี้ ${r0(mean(withUni.map((r) => r.uni!.debt)))}` +
                ` · ${[...new Set(withUni.map((r) => r.uni!.ending.tier))].join(" / ")}`);
  else console.log(`    ปีหนึ่ง: คะแนนไม่ถึงเกณฑ์ ไม่ได้เรียนต่อ`);

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

// สองแกนต้องแยกจากกันได้จริงในการเล่นจริง ไม่ใช่แค่ในทฤษฎี
// ถ้าทุกคนได้ระดับเท่ากันทั้งสองแกนเสมอ แปลว่าแยกออกมาแล้วไม่ได้อะไร
const gaps = allRuns.flatMap((r) => r.axisGap ?? []);
const diverged = gaps.filter((g) => g !== 0).length;
console.log(`สองแกนแยกกันจริงไหม: วัด ${gaps.length} คู่ · ต่างกัน ${diverged} คู่` +
            ` (${gaps.length ? Math.round((diverged / gaps.length) * 100) : 0}%)` +
            ` · ห่างกันมากสุด ${gaps.length ? Math.max(...gaps.map(Math.abs)) : 0} ระดับ`);
if (gaps.length && diverged / gaps.length < 0.2)
  console.log("  ← สองแกนขยับไปด้วยกันเกือบตลอด แยกออกมาแล้วแทบไม่ได้อะไร");

const totalClash = sum(allRuns.map((r) => r.clashDays));
const totalLied = sum(allRuns.map((r) => r.lied));
const totalTutored = sum(allRuns.map((r) => r.tutored));
const totalPushes = sum(allRuns.map((r) => r.pushes));
const totalDozes = sum(allRuns.map((r) => r.dozes));
const totalSick = sum(allRuns.map((r) => r.sickDays));
const withBig = allRuns.filter((r) => r.milestoneTier >= 0);
const totalSlipped = sum(allRuns.map((r) => r.slipped));
const totalCaughtLying = sum(allRuns.map((r) => r.caughtLying));
console.log(`ไลน์ทำงานจริงไหม: ทักมารวม ${totalChats} คืน · รับนัด ${totalInvites} · ไปตามนัด ${totalKept}` +
            ` · ผิดนัด ${totalInvites - totalKept} · วันที่รับนัดซ้อนกัน ${totalClash}`);
if (totalClash === 0)
  console.log("  ← ไม่เคยรับนัดซ้อนกันเลยสักครั้ง ระบบนัดซ้อนไม่ได้ถูกทดสอบ");
const rankOfStrat = (st: Strategy) => mean((results.get(st) ?? []).map((r) => r.boardRank));
console.log(`กระดานหน้าห้อง: อันดับเฉลี่ยตอนจบ ทุ่มเรียน ${r0(rankOfStrat("mind"))}` +
            ` · เฉลี่ยทุกอย่าง ${r0(rankOfStrat("spread"))} · เด็กหลังห้อง ${r0(rankOfStrat("rebel"))}` +
            ` · ติวให้เพื่อนรวม ${totalTutored} ครั้ง · เพื่อนร่วงอันดับรวม ${totalSlipped} ครั้ง`);
if (rankOfStrat("mind") >= rankOfStrat("rebel"))
  console.log("  ← ทุ่มเรียนแล้วอันดับไม่ดีกว่าเด็กหลังห้อง กระดานไม่ได้สะท้อนอะไรเลย");
if (totalTutored === 0) console.log("  ← ไม่มีใครติวให้เพื่อนเลย ช่องติวให้ไม่ถูกทดสอบ");
if (totalSlipped === 0)
  console.log("  ← ไม่มีใครร่วงอันดับเลย ชีวิตที่เราปล่อยไว้ไม่เคยโผล่บนกระดาน");
// ฝืนคุ้มไหม ต้องเทียบในกลยุทธ์เดียวกัน seed เดียวกัน ไม่งั้นเป็นการเทียบคนละเรื่อง
// ต้องเทียบในกลยุทธ์ที่ *ชนกำแพงแรงจริง* ไม่งั้นนโยบายการฝืนไม่เคยถูกใช้เลยสักครั้ง
const pushAB = (["never", "careful", "always"] as PushPolicy[]).map((pol) => {
  const rs = SEEDS.map((sd) => play("mind", sd, SKILL, pol));
  const uni = rs.filter((r) => r.uni);
  return { pol, score: mean(rs.map((r) => r.ending.score)), sick: sum(rs.map((r) => r.sickDays)),
           mind: mean(rs.map((r) => r.stats.mind)), pushes: sum(rs.map((r) => r.pushes)),
           blocked: mean(rs.map((r) => r.blocked)), doze: sum(rs.map((r) => r.dozes)),
           debt: uni.length ? mean(uni.map((r) => r.uni!.debt)) : 0,
           money: uni.length ? mean(uni.map((r) => r.uni!.money)) : 0,
           kept: mean(rs.map((r) => r.kept)), invites: mean(rs.map((r) => r.invites)) };
});
console.log(`\nฝืนแล้วคุ้มไหม (กลยุทธ์ทุ่มเรียน seed เดียวกัน):`);
for (const x of pushAB)
  console.log(`  ${{ never: "ไม่ฝืนเลย  ", careful: "ฝืนเท่าที่ไหว", always: "ฝืนทุกครั้ง " }[x.pol]}` +
              ` ฝืน ${x.pushes} ครั้ง · ปัญญา ${r0(x.mind)} · หลับในคาบ ${x.doze}` +
              ` · ป่วย ${x.sick} วัน · คะแนนปลายทาง ${r0(x.score)}` +
              ` · ปีหนึ่ง: เงิน ${r0(x.money)} หนี้ ${r0(x.debt)}`);
const [never, careful, always] = pushAB;
// สิ่งที่ระบบนี้สัญญาไว้มีสองข้อ ไม่ใช่ "ฝืนแล้วต้องชนะ"
// 1. ฝืนแล้วได้ช่วงเวลาที่เคยเสียเปล่ากลับมาใช้จริง
// 2. ฝืนสุดตัวต้องแพ้ฝืนเท่าที่ไหว และแพ้การไม่ฝืนเลย — ไม่งั้นคำตอบคือฝืนไปเรื่อยๆ โดยไม่ต้องคิด
if (careful.pushes === 0)
  console.log("  ← ฝืนเท่าที่ไหวแล้วไม่ได้ฝืนเลยสักครั้ง กำแพงแรงไม่เคยถูกชน ระบบนี้ไม่ถูกทดสอบ");
if (always.score >= careful.score)
  console.log("  ← ฝืนสุดตัวไม่ได้แย่กว่าฝืนเท่าที่ไหว แปลว่าไม่ต้องคิด ฝืนไปเรื่อยๆ คือคำตอบ");
if (always.score >= never.score)
  console.log("  ← ฝืนสุดตัวไม่ได้แย่กว่าไม่ฝืนเลย ราคาของการฝืนยังเบาเกินไป");
// ข้อค้นพบที่ต้องจำไว้: ฝืนเพื่อเก็บค่าสถานะเฉยๆ ไม่มีวันคุ้ม เพราะค่าสถานะอิ่มตัวอยู่แล้ว
// มันคุ้มเฉพาะตอนที่ของวันนี้เอาไปทำพรุ่งนี้ไม่ได้ (นัดที่รับปากไว้ · กะที่ต้องเข้า · เส้นตาย)
console.log(`  ราคาที่วัดได้: ฝืนสุดตัวเสียคะแนนปลายทาง ${r0(never.score - always.score)}` +
            ` และเสียไปทั้งวัน ${always.sick} วันจากการล้มป่วย`);

const tierCount = [0, 1, 2, 3].map((t) => withBig.filter((r) => r.milestoneTier === t).length);
console.log(`งานใหญ่ของชมรม: ได้ไปงาน ${withBig.length}/${allRuns.length} รอบ` +
            ` · ซ้อมเฉลี่ย ${r0(mean(withBig.map((r) => r.clubDays)))} ครั้ง` +
            ` · ระดับที่ได้ ${tierCount.join("/")} · งานเกิดรวม ${sum(allRuns.map((r) => r.bigCount))} ครั้ง`);
if (!withBig.length)
  console.log("  ← ไม่มีรอบไหนได้ไปงานใหญ่เลย วันที่ clubs.json สัญญาไว้ยังไม่เกิดจริง");
else if (tierCount[0] === withBig.length)
  console.log("  ← ทุกรอบตกระดับล่างสุด เกณฑ์การซ้อมสูงเกินไปจนไม่มีทางทำได้");
else if (tierCount[3] === withBig.length)
  console.log("  ← ทุกรอบได้ระดับสูงสุด งานใหญ่ไม่ได้วัดอะไรเลย");
const totalSeenOut = sum(allRuns.map((r) => r.caughtOut));
const totalGossip = sum(allRuns.map((r) => r.gossips));
const givers = allRuns.filter((r) => r.homeGiven > 0);
const keepers = allRuns.filter((r) => r.homeRefused > 0);
const byStrat = (st: Strategy, f: (r: Run) => number) => mean((results.get(st) ?? []).map(f));
console.log(`คู่แข่ง: คนที่ถูกแซงเฉลี่ย ${mean(allRuns.map((r) => r.rivalsAhead)).toFixed(1)} คนต่อรอบ` +
            ` · เรานำอยู่เฉลี่ย ${r0(mean(allRuns.map((r) => r.rivalLeadAvg)))}` +
            ` · คนที่ทุ่มให้เพื่อน ${r0(byStrat("social", (r) => r.rivalsAhead))} คน` +
            ` · คนที่ทุ่มเรียน ${r0(byStrat("mind", (r) => r.rivalsAhead))} คน` +
            ` · ความสนิทสูงสุดที่ทำได้ ${r0(byStrat("social", (r) => r.affinityTop))}`);
// กลยุทธ์ปกติไม่มีอันไหน "เริ่มแล้วทิ้ง" ซึ่งเป็นกรณีเดียวที่ระบบคู่แข่งมีไว้รับ
// จึงต้องมีการทดลองแยกของมันเอง แบบเดียวกับการทดลองสามขาของการฝืน
{
  const dropped = SEEDS.map((sd) => {
    const s = newState();
    void sd;
    // สนิทกับคนหนึ่งจนเกินเกณฑ์ แล้วเลิกไปหาเขาเลยทั้งเทอม
    changeAffinity(s, "ploy", 12);
    for (let d = 0; d < game.term.days; d++) { s.dayIndex = d; stepLives(s); stepRivals(s); }
    return rivalLead(s, "ploy");
  });
  const tended = SEEDS.map((sd) => {
    const s = newState();
    void sd;
    changeAffinity(s, "ploy", 12);
    for (let d = 0; d < game.term.days; d++) {
      s.dayIndex = d;
      if (d % 4 === 0) { visited(s, "ploy"); changeAffinity(s, "ploy", 0.5); }
      stepLives(s); stepRivals(s);
    }
    return rivalLead(s, "ploy");
  });
  console.log(`  เริ่มแล้วทิ้งเทียบกับเริ่มแล้วไปต่อ: ทิ้งไว้จบที่ ${r0(mean(dropped))}` +
              ` · ไปหาทุกสี่วันจบที่ ${r0(mean(tended))} (ติดลบ = เขานำ)`);
  if (mean(dropped) >= 0)
    console.log("  ← เริ่มแล้วทิ้งไว้ทั้งเทอมแล้วยังไม่โดนแซง คู่แข่งไม่ได้กดดันอะไรเลย");
  if (mean(tended) <= mean(dropped))
    console.log("  ← ไปหาเขาแล้วไม่ได้ต่างจากทิ้งไว้ เวลาไม่ได้ช่วยอะไร");
}
console.log(`ครูประจำชั้น: ทุ่มเรียนจบที่ ${r0(byStrat("mind", (r) => r.teacher))}` +
            ` · เฉลี่ยทุกอย่าง ${r0(byStrat("spread", (r) => r.teacher))}` +
            ` · เด็กหลังห้อง ${r0(byStrat("rebel", (r) => r.teacher))}` +
            ` · ครูพูดแทนรวม ${sum(allRuns.map((r) => r.shielded))} ครั้ง` +
            ` · โทรหาที่บ้านรวม ${sum(allRuns.map((r) => r.calledHome))} ครั้ง`);
if (byStrat("mind", (r) => r.teacher) <= byStrat("rebel", (r) => r.teacher))
  console.log("  ← ตั้งใจเรียนแล้วครูไม่ได้มองต่างจากเด็กหลังห้าง ค่านี้ไม่ได้วัดอะไรเลย");
if (sum(allRuns.map((r) => r.shielded)) === 0)
  console.log("  ← ครูไม่เคยพูดแทนใครเลย รางวัลของการเป็นเด็กดีไม่ถูกทดสอบ");
if (sum(allRuns.map((r) => r.calledHome)) === 0)
  console.log("  ← ครูไม่เคยโทรหาที่บ้านเลย ราคาของการเป็นเด็กมีปัญหาไม่ถูกทดสอบ");
console.log(`ทางบ้าน: ส่งให้เฉลี่ย ${r0(mean(givers.map((r) => r.homeGiven)))} บาท` +
            ` · คนที่เก็บไว้เองจบด้วยบ้านตึง ${r0(mean(keepers.map((r) => r.homeStrain)))}` +
            ` · คนที่ส่งให้ ${r0(mean(givers.map((r) => r.homeStrain)))}`);
if (!givers.length || !keepers.length)
  console.log("  ← ไม่มีทั้งคนที่ให้และคนที่ไม่ให้ ราคาของการเลือกยังไม่ถูกวัด");
else if (mean(keepers.map((r) => r.homeStrain)) <= mean(givers.map((r) => r.homeStrain)))
  console.log("  ← เก็บเงินไว้เองแล้วบ้านไม่ได้ตึงกว่า การขอของที่บ้านไม่มีราคาอะไรเลย");
console.log(`การเลือกมีพยานไหม: คนที่นัดเราไว้เห็นเราอยู่กับอีกคน ${totalSeenOut} ครั้ง` +
            ` · เรื่องแพร่ไปทั้งวง ${totalGossip} ครั้ง`);
if (totalSeenOut === 0)
  console.log("  ← ไม่เคยมีใครเห็นเราอยู่กับอีกคนเลย ระบบพยานไม่ถูกทดสอบ (ดู where ใน characters.json)");
if (totalGossip === 0)
  console.log("  ← เรื่องไม่เคยแพร่ไปถึงใครเลย ระเบิดแบบ Tokimeki ยังไม่ทำงาน");
console.log(`ฝืนต่อทั้งที่หมดแรง: ฝืนรวม ${totalPushes} ครั้ง · หลับในคาบ ${totalDozes} ครั้ง` +
            ` · ล้มป่วยเสียทั้งวัน ${totalSick} วัน`);
if (totalPushes === 0)
  console.log("  ← ไม่มีใครฝืนเลย แรงยังเป็นกำแพงอยู่เหมือนเดิม ระบบฝืนไม่ถูกทดสอบ");
// ราคาของการฝืนวัดจากขาที่ฝืนสุดตัวในการทดลองข้างบน ไม่ใช่จากรอบปกติที่ทุกคนฝืนเท่าที่ไหว
if (always.doze === 0 && always.sick === 0)
  console.log("  ← ฝืนสุดตัวแล้วยังไม่เคยหลับในคาบหรือล้มป่วยเลย — ดู push.dozeAt/sickAt");
console.log(`คำพูดไม่ตรงกัน: บอกสองคนไม่ตรงกัน ${totalLied} คืน · โป๊ะ ${totalCaughtLying} ครั้ง`);
if (totalLied === 0)
  console.log("  ← ไม่มีใครบอกสองคนไม่ตรงกันเลย ระบบคำโกหกไม่ได้ถูกทดสอบ");
else if (totalCaughtLying === 0)
  console.log("  ← โกหกแล้วไม่เคยโป๊ะเลยสักครั้ง โกหกจึงไม่มีราคา — ดู claims.minBond กับ checkChance");

const offTotal = sum(allRuns.map((r) => r.offscreen));
const memTotal = sum(allRuns.map((r) => r.memories));
console.log(`โลกเดินตอนเราไม่อยู่ไหม: เรื่องที่เกิดลับหลังรวม ${offTotal} เรื่อง` +
            ` · ตัวละครจำเรื่องของเราไว้รวม ${memTotal} เรื่อง`);
if (offTotal === 0) console.log("  ← ไม่มีอะไรเกิดขึ้นลับหลังเลย ระบบนี้ไม่ได้ถูกทดสอบ");
if (memTotal === 0) console.log("  ← ไม่มีใครจำอะไรเกี่ยวกับเราได้เลย");

const rt = sum(allRuns.map((r) => r.retakesDone));
const rtLeft = sum(allRuns.map((r) => r.retakesLeft));
const pjDone = sum(allRuns.map((r) => r.projectDone));
const pjMiss = sum(allRuns.map((r) => r.projectMissed));
console.log(`สอบซ่อมกับงานกลุ่มทำงานจริงไหม: ซ่อมรวม ${rt} ครั้ง · ยังติดซ่อมรวม ${rtLeft} วิชา` +
            ` · ทำงานกลุ่มรวม ${pjDone} ครั้ง · ส่งไม่ทัน ${pjMiss} รอบ`);

const uniRuns = allRuns.filter((r) => r.uni);
console.log(`ภาคมหาลัยเดินจริงไหม: ${uniRuns.length}/${allRuns.length} รอบได้เรียนต่อ` +
            (uniRuns.length ? ` · เกรดเฉลี่ยปีหนึ่ง ${mean(uniRuns.map((r) => r.uni!.gpa)).toFixed(2)}` +
              ` · ติดหนี้ ${uniRuns.filter((r) => r.uni!.debt > 0).length} รอบ` : ""));

const cuts = sum(allRuns.map((r) => r.haircuts));
const inspected = sum(allRuns.map((r) => r.inspected));
console.log(`ตรวจหน้าเสาธงทำงานจริงไหม: ตัดผมรวม ${cuts} ครั้ง · โดนเรียกรวม ${inspected} ครั้ง`);

const hwDone = sum(allRuns.map((r) => r.homeworkDone));
const hwMissed = sum(allRuns.map((r) => r.homeworkMissed));
console.log(`การบ้านทำงานจริงไหม: ส่งรวม ${hwDone} ครั้ง · ไม่ได้ส่งรวม ${hwMissed} ชิ้น`);

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
if (hwDone === 0) console.log("เตือน: ไม่มีใครส่งการบ้านเลย ระบบการบ้านไม่ถูกทดสอบ");
if (inspected === 0) console.log("เตือน: ไม่มีใครโดนเรียกหน้าแถวเลย ระบบตรวจทรงผมไม่ถูกทดสอบ");
if (cuts === 0) console.log("เตือน: ไม่มีใครไปตัดผมเลย ทางแก้ไม่ถูกทดสอบ");
if (rt === 0) console.log("เตือน: ไม่มีใครไปสอบซ่อมเลย ระบบสอบซ่อมไม่ถูกทดสอบ");
if (rtLeft === 0) console.log("เตือน: ไม่มีใครติดซ่อมค้างเลย บทลงโทษไม่ถูกทดสอบ");
if (pjDone === 0) console.log("เตือน: ไม่มีใครทำงานกลุ่มเลย ระบบงานกลุ่มไม่ถูกทดสอบ");
if (pjMiss === 0) console.log("เตือน: ไม่มีใครส่งงานกลุ่มไม่ทันเลย บทลงโทษไม่ถูกทดสอบ");
if (uniRuns.length === 0) console.log("เตือน: ไม่มีรอบไหนได้เรียนต่อเลย ภาคมหาลัยไม่ถูกทดสอบ");
if (uniRuns.length === allRuns.length) console.log("เตือน: ทุกรอบได้เรียนต่อ เกณฑ์เข้ามหาลัยไม่ได้กั้นอะไร");
if (hwMissed === 0) console.log("เตือน: ไม่มีใครพลาดส่งการบ้านเลย บทลงโทษไม่ถูกทดสอบ");
if (totalInvites === totalKept) console.log("เตือน: ไม่มีใครผิดนัดเลย บทลงโทษการผิดนัดไม่ถูกทดสอบ");
if (skillSwing < 3) console.log(`เตือน: ฝีมือมินิเกมแทบไม่มีผลกับปลายทาง (ต่างกันแค่ ${skillSwing.toFixed(1)} คะแนน)`);
if (!early.length && tiring.length && serious > idle && totalCaught > 0 && skillSwing >= 3 &&
    totalChats > 0 && hwDone > 0 && hwMissed > 0)
  console.log("เศรษฐกิจของเกมอยู่ในเกณฑ์ที่ตั้งใจไว้");
