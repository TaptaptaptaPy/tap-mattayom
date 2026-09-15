import { Compiler } from "inkjs/full";
import game from "../../data/game.json";
import events from "../../data/events.json";
import type { Story } from "inkjs/types";
import { affinityRank, statRank, trustRank, type GameState, type StatId } from "../sim/state";
import { clubOf } from "../sim/club";
import { isSchoolDay } from "../sim/calendar";
import { lastMemory, memoryCount, standingRank } from "../sim/bonds";
import { toldCount } from "../sim/claims";
import { myBoardRank, tutoredCount } from "../sim/board";

// โหลดบททั้งหมดเป็นข้อความดิบ แล้วคอมไพล์ตอนรัน
// ข้อดี: แก้ไฟล์ .ink แล้ว Vite HMR รีโหลดทันที ไม่ต้อง build ใหม่
// ถ้าวันหนึ่งบทเยอะจนคอมไพล์ช้า ค่อยเปลี่ยนไป precompile เป็น .json
const inkFiles = import.meta.glob("../../story/*.ink", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const storyNames = () =>
  Object.keys(inkFiles).map((k) => k.split("/").pop()!.replace(/\.ink$/, ""))
    .filter((n) => !n.startsWith("_"));

export function sourceOf(name: string): string {
  const key = Object.keys(inkFiles).find((k) => k.endsWith(`/${name}.ink`));
  if (!key) throw new Error(`ไม่พบบท: story/${name}.ink`);
  // inkjs ไม่รู้จัก INCLUDE ตอนคอมไพล์จากสตริง จึงต้องแทนที่เอง
  return inkFiles[key].replace(/^INCLUDE\s+(.+)$/gm, (_m, file: string) => {
    const inc = Object.keys(inkFiles).find((k) => k.endsWith("/" + file.trim()));
    return inc ? inkFiles[inc] : "";
  });
}

export interface SceneHooks {
  onStat: (id: StatId, amount: number) => void;
  onAffinity: (charId: string, amount: number) => void;
  onTrust: (charId: string, amount: number) => void;
  onClaim: (topic: string, version: string, charId: string) => void;
  onTutor: (charId: string) => void;
  onRecall: () => void;
  onFlag: (name: string) => void;
  onHint: (text: string) => void;
  onMoney: (amount: number) => void;
  onInvite: (charId: string) => void;
  onStanding: (amount: number, why: string) => void;
  onSide: (charId: string) => void;
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
  story.variablesState["tomorrowSchool"] = isSchoolDay({ ...s, dayIndex: s.dayIndex + 1 }) ? 1 : 0;
  story.variablesState["standingRank"] = standingRank(s.standing);
  story.variablesState["homeworkMissed"] = s.homeworkMissed;
  story.variablesState["term"] = s.dayIndex >= 95 ? 3 : s.dayIndex >= 49 ? 2 : 1;
  // สอบใกล้แค่ไหน — ทางเลือก "ติวให้ไหม" ต้องโผล่ตอนที่มันมีความหมายเท่านั้น
  const nx = nextExamDay(s);
  story.variablesState["examSoon"] = nx >= 0 && nx <= game.board.tutorWindow ? 1 : 0;
}

/** สร้าง story พร้อมฉีดสถานะปัจจุบันเข้าไป และต่อสะพานกลับมาที่ TS */
export function openScene(storyName: string, s: GameState, charId: string | null, hooks: SceneHooks): Story {
  const story = new Compiler(sourceOf(storyName)).Compile();

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
  story.BindExternalFunction("plansBooked", () =>
    s.plans.filter((p) => p.day === s.dayIndex + 1 && !p.kept).length);
  story.BindExternalFunction("standing", (amount: number, why: string) => {
    hooks.onStanding(amount, why); return null;
  });
  story.BindExternalFunction("takeSide", (cid: string) => { hooks.onSide(cid); return null; });
  story.BindExternalFunction("sideTaken", () => (s.sided ? 1 : 0));
  story.BindExternalFunction("sidedWith", (cid: string) => (s.sided === cid ? 1 : 0));

  injectVars(story, s, charId);
  return story;
}
