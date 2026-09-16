import game from "../../data/game.json";
import chars from "../../data/characters.json";
import events from "../../data/events.json";
import type { Story } from "inkjs/types";
import { affinityRank, statRank, trustRank, type GameState, type StatId } from "../sim/state";
import { clubOf } from "../sim/club";
import { isSchoolDay } from "../sim/calendar";
import { inChapter } from "../sim/chapter";
import { lastMemory, memoryCount, standingRank } from "../sim/bonds";
import { toldCount } from "../sim/claims";
import { myBoardRank, tutoredCount } from "../sim/board";
import { askAmount, homeLevel } from "../sim/home";
import { rivalLead, rivalOf } from "../sim/rival";
import { backgroundOf } from "../sim/traits";
import { daysKnown } from "../sim/presence";
import { plotStage, clueCount, suspectLevel, backers, hasClue } from "../sim/plot";

/** สะพาน ink ↔ TS — ฝั่งที่ไม่รู้จักว่าไฟล์บทมาจากไหน
 *
 *  แยกออกมาจาก `bridge.ts` เพราะไฟล์นั้นโหลดบทด้วย `import.meta.glob` ซึ่งเป็นของ Vite
 *  พอ import จาก tsx (เทสต์ที่รันบน Node) มันพังตั้งแต่บรรทัดแรก
 *  ที่นี่รับ `Story` ที่คอมไพล์มาแล้วเข้ามา ใครจะอ่านไฟล์มาจากไหนก็เรื่องของคนนั้น
 *  ผลคือ `npm run playthrough` เดินบทจริงด้วยสถานะจริงได้ ไม่ใช่ด้วยของจำลอง
 */

export interface SceneHooks {
  onStat: (id: StatId, amount: number) => void;
  onAffinity: (charId: string, amount: number) => void;
  onTrust: (charId: string, amount: number) => void;
  onClaim: (topic: string, version: string, charId: string) => void;
  onTutor: (charId: string) => void;
  onHome: (kind: "give" | "part" | "refuse" | "cannot") => void;
  onConcede: (charId: string) => void;
  onRecall: () => void;
  onFlag: (name: string) => void;
  onHint: (text: string) => void;
  onMoney: (amount: number) => void;
  onInvite: (charId: string) => void;
  onStanding: (amount: number, why: string) => void;
  onSide: (charId: string) => void;
  onIntroduce: (charId: string) => void;
  onFeel: (mood: string) => void;
  onSpeak: (charId: string) => void;
  onClue: (id: string) => void;
  onVerdict: (v: string) => void;
}

/** ตัวแปรทุกตัวที่บทอ่านได้ — ประกาศคู่กันไว้ใน story/_shared.ink
 *  กติกา: ink อ่านค่าเหล่านี้เพื่อตั้งเงื่อนไขเท่านั้น การ "เปลี่ยน" ค่าต้องผ่าน external function */
/** อีกกี่วันถึงวันสอบถัดไป — -1 ถ้าสอบครบแล้ว */
function nextExamDay(s: GameState): number {
  const days = (events as { id: string; day: number; exam?: string; chapter?: string }[])
    .filter((e) => e.exam && (e.chapter ?? "school") === s.chapter && e.day > s.dayIndex)
    .map((e) => e.day - s.dayIndex)
    .sort((a, b) => a - b);
  return days.length ? days[0] : -1;
}

export function injectVars(story: Story, s: GameState, charId: string | null) {
  for (const [k, v] of Object.entries(s.stats)) story.variablesState[k] = Math.round(v);
  story.variablesState["affinity"] = charId ? Math.round(s.affinity[charId] ?? 0) : 0;
  story.variablesState["trust"] = charId ? trustRank(s.trust[charId] ?? 0) : 0;
  story.variablesState["rank"] = charId ? affinityRank(s.affinity[charId] ?? 0) : 0;
  story.variablesState["day"] = s.dayIndex + 1;
  story.variablesState["money"] = Math.round(s.money);
  story.variablesState["behaviour"] = Math.round(s.behaviour);
  story.variablesState["caught"] = s.caught;
  story.variablesState["club"] = clubOf(s)?.id ?? "";
  story.variablesState["mindRank"] = statRank(s.stats.mind);
  // นัดเจอกันที่โรงเรียนในวันที่โรงเรียนปิดไม่ได้ บทต้องรู้ก่อนจะยื่นทางเลือกชวนออกไป
  // ไม่งั้นผู้เล่นจะผิดนัดทั้งที่ไม่ได้ทำอะไรผิด แล้วโดนหักความสัมพันธ์ฟรีๆ
  //
  // เงื่อนไขเดียวกันนี้ต้องคลุม **เพื่อนคนละภาค** ด้วย เพื่อนมัธยมยังทักไลน์มาตอนเราอยู่มหาลัยได้
  // (ตั้งใจ) แต่เขาไม่ได้อยู่ในรายชื่อสถานที่ของภาคนี้ ถ้ารับนัดไป พรุ่งนี้จะไม่มีเขาอยู่ที่ไหนเลย
  // แล้วโดนหักผิดนัดแน่นอน 100% — ซึ่งเป็นการลงโทษสิ่งที่ผู้เล่นทำอะไรไม่ได้เลย
  const here = !charId || inChapter(chars.find((c) => c.id === charId) ?? {}, s.chapter);
  story.variablesState["tomorrowSchool"] =
    here && isSchoolDay({ ...s, dayIndex: s.dayIndex + 1 }) ? 1 : 0;
  story.variablesState["standingRank"] = standingRank(s.standing);
  story.variablesState["homeworkMissed"] = s.homeworkMissed;
  story.variablesState["term"] = s.dayIndex >= 95 ? 3 : s.dayIndex >= 49 ? 2 : 1;
  // สอบใกล้แค่ไหน — ทางเลือก "ติวให้ไหม" ต้องโผล่ตอนที่มันมีความหมายเท่านั้น
  const nx = nextExamDay(s);
  story.variablesState["examSoon"] = nx >= 0 && nx <= game.board.tutorWindow ? 1 : 0;
  // รู้จักกันมานานแค่ไหน — บทใช้เลือกน้ำเสียง คนที่เพิ่งเจอกันวันนี้พูดไม่เหมือนคนที่รู้จักกันมาสองเดือน
  story.variablesState["known"] = charId ? Math.max(0, daysKnown(s, charId)) : 0;
}

/** สร้าง story พร้อมฉีดสถานะปัจจุบันเข้าไป และต่อสะพานกลับมาที่ TS */
export function bindStory(story: Story, s: GameState, charId: string | null, hooks: SceneHooks): Story {

  story.BindExternalFunction("gainStat", (id: string, amount: number) => {
    hooks.onStat(id as StatId, amount); return null;
  });
  story.BindExternalFunction("gainAffinity", (cid: string, amount: number) => {
    hooks.onAffinity(cid, amount); return null;
  });
  story.BindExternalFunction("setFlag", (name: string) => { hooks.onFlag(name); return null; });
  // บทบอกเองได้ว่า "ตรงนี้มีทางที่ยังเปิดไม่ได้" ผู้เล่นจะได้รู้ว่าพลาดอะไรไป
  story.BindExternalFunction("setHint", (text: string) => { hooks.onHint(text); return null; });
  story.BindExternalFunction("spend", (amount: number) => { hooks.onMoney(-amount); return null; });
  story.BindExternalFunction("hasFlag", (name: string) => (s.flags[name] ? 1 : 0));
  // บทถามได้ว่าคนนี้ไว้ใจเราถึงระดับไหนแล้ว ใช้เปิดทางที่คนไม่สนิทไม่มีวันได้เห็น
  story.BindExternalFunction("trustOf", (cid: string) => trustRank(s.trust[cid] ?? 0));
  story.BindExternalFunction("gainTrust", (cid: string, amount: number) => {
    hooks.onTrust(cid, amount); return null;
  });
  story.BindExternalFunction("inviteTomorrow", (cid: string) => { hooks.onInvite(cid); return null; });
  // ตัวละครจำเรื่องที่เราทำกับเขาได้ แล้วหยิบมาพูดเองโดยเราไม่ได้ถาม
  story.BindExternalFunction("recalls", (cid: string) => memoryCount(s, cid));
  // เขาหยิบเรื่องเก่าขึ้นมาพูดเอง — ต้องมีเสียงของมันเอง ไม่งั้นมันกลืนไปกับบทปกติ
  story.BindExternalFunction("memoryOf", (cid: string) => { hooks.onRecall(); return lastMemory(s, cid); });
  // บอกคนที่อยู่ตรงหน้าไปว่าอะไร — ถ้าบอกคนอื่นไม่ตรงกัน วันหนึ่งจะโป๊ะ
  story.BindExternalFunction("tellThem", (topic: string, version: string) => {
    if (charId) hooks.onClaim(topic, version, charId);
    return null;
  });
  story.BindExternalFunction("toldAlready", (topic: string) => toldCount(s, topic));
  // ติวให้เขาก่อนสอบ — ราคาคือเวลาทบทวนของเราเอง ผลไปโผล่บนกระดานหน้าห้องรอบหน้า
  story.BindExternalFunction("tutorThem", () => { if (charId) hooks.onTutor(charId); return null; });
  story.BindExternalFunction("tutoredTimes", () => (charId ? tutoredCount(s, charId) : 0));
  story.BindExternalFunction("myRank", () => myBoardRank(s));
  // เรื่องที่บ้าน — บทเป็นคนถาม TS เป็นคนตอบว่าเท่าไหร่และเกิดอะไรขึ้น
  story.BindExternalFunction("homeAsk", () => askAmount(s));
  story.BindExternalFunction("homeStrain", () => homeLevel(s));
  story.BindExternalFunction("homeGive", () => { hooks.onHome("give"); return null; });
  story.BindExternalFunction("homeGivePartial", () => { hooks.onHome("part"); return null; });
  story.BindExternalFunction("homeRefuse", () => { hooks.onHome("refuse"); return null; });
  story.BindExternalFunction("homeCannot", () => { hooks.onHome("cannot"); return null; });
  // คู่แข่งไม่มีภาพและไม่มีบทของตัวเอง เขาเป็นชื่อที่ตัวละครเอ่ยถึงเอง
  story.BindExternalFunction("rivalName", () => (charId ? rivalOf(charId)?.name ?? "" : ""));
  story.BindExternalFunction("rivalLead", () => (charId ? rivalLead(s, charId) : 0));
  story.BindExternalFunction("letThemGo", () => { if (charId) hooks.onConcede(charId); return null; });
  story.BindExternalFunction("plansBooked", () =>
    s.plans.filter((p) => p.day === s.dayIndex + 1 && !p.kept).length);
  story.BindExternalFunction("standing", (amount: number, why: string) => {
    hooks.onStanding(amount, why); return null;
  });
  story.BindExternalFunction("takeSide", (cid: string) => { hooks.onSide(cid); return null; });
  // เราเป็นใครมาก่อนเทอมนี้ — บททักทายครั้งแรกใช้ข้อนี้มากที่สุด
  story.BindExternalFunction("background", () => backgroundOf(s)?.id ?? "");
  story.BindExternalFunction("knewBefore", (cid: string) =>
    (backgroundOf(s)?.knows.some((k) => k.id === cid) ? 1 : 0));
  story.BindExternalFunction("introduce", (cid: string) => { hooks.onIntroduce(cid); return null; });
  // สีหน้าของบรรทัดถัดไป — บทสั่งเองได้ ไม่ต้องให้ตัวเดาทาย
  story.BindExternalFunction("feel", (m: string) => { hooks.onFeel(m); return null; });
  // ใครกำลังพูดอยู่ — ฉากเหตุการณ์มีตัวละครจริงเดินเข้ามาพูดได้ ไม่ใช่เสียงบรรยายอย่างเดียว
  story.BindExternalFunction("speak", (cid: string) => { hooks.onSpeak(cid); return null; });
  // เรื่องหลักของเทอม — บทอ่านสถานะได้ และเปลี่ยนได้ผ่านสองทางนี้เท่านั้น
  story.BindExternalFunction("plotStage", () => plotStage(s));
  story.BindExternalFunction("plotClues", () => clueCount(s));
  story.BindExternalFunction("suspectLevel", () => suspectLevel(s));
  story.BindExternalFunction("backerCount", () => backers(s).length);
  // ใครคือคนแรกที่ยืนขึ้นด้วย — ที่ประชุมต้องเห็นหน้าคนจริง ไม่ใช่เห็นแค่จำนวน
  story.BindExternalFunction("backerId", () => backers(s)[0] ?? "");
  story.BindExternalFunction("hasClue", (id: string) => (hasClue(s, id) ? 1 : 0));
  story.BindExternalFunction("learnClue", (id: string) => { hooks.onClue(id); return null; });
  story.BindExternalFunction("verdict", (v: string) => { hooks.onVerdict(v); return null; });
  story.BindExternalFunction("sideTaken", () => (s.sided ? 1 : 0));
  story.BindExternalFunction("sidedWith", (cid: string) => (s.sided === cid ? 1 : 0));

  injectVars(story, s, charId);
  return story;
}
