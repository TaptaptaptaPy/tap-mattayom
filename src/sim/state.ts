import game from "../../data/game.json";
import chars from "../../data/characters.json";

export type StatId = "heart" | "mind" | "charm" | "kind" | "nerve";

export interface ExamResult { score: number; rank: number; }

/** หนึ่งฟองข้อความในแชท — `mine` คือฝั่งเรา (ข้อความที่เราเลือกตอบ) */
export interface ChatMsg { text: string; mine: boolean; }
/** บทสนทนาไลน์หนึ่งคืน เก็บไว้ทั้งก้อนเพื่อให้ย้อนอ่านได้เหมือนแชทจริง */
export interface ChatThread {
  id: string; charId: string; day: number; invited: boolean; msgs: ChatMsg[];
}
/** นัดที่รับไว้ — `day` คือวันที่ต้องไป ไม่ไปแล้วมีราคาต้องจ่าย */
export interface Plan { charId: string; day: number; kept: boolean; }
export interface Ending {
  tier: string; tone: string; score: number;
  closest: string | null; closestRank: number;
  behaviour: number; club: string | null;
  lines: string[];
}

export interface GameState {
  v: number;
  dayIndex: number;          // 0 = วันเปิดเทอม
  periodIndex: number;       // อ้างอิง data/game.json > periods
  energy: number;
  stats: Record<StatId, number>;
  affinity: Record<string, number>;
  flags: Record<string, true>;
  metToday: Record<string, true>;
  doneToday: Record<string, number>;   // กิจกรรมไหนทำไปกี่รอบแล้ววันนี้
  history: string[];

  money: number;
  behaviour: number;
  study: number;                       // ความพร้อมสอบ ค่อยๆ จางถ้าไม่ทบทวน
  club: string | null;
  inventory: Record<string, number>;
  exams: Record<string, ExamResult>;
  seenEvents: Record<string, true>;
  caught: number;
  sleepDebt: number;

  /** การบ้านที่ยังไม่ได้ส่ง (ชิ้น) */
  homework: number;
  /** ส่งไม่ทันมากี่ชิ้นแล้วทั้งเทอม — ฉากจบกับเทสต์ใช้ดู */
  homeworkMissed: number;

  chats: ChatThread[];
  /** ใครทักมาแล้วยังไม่ได้เปิดอ่าน — ตัวข้อความจะถูกสร้างตอนเปิดจริง เพราะคำพูดเป็นของ ink */
  pendingChat: string | null;
  /** คืนล่าสุดที่ทอยว่ามีคนทักไหมไปแล้ว กันไม่ให้ทอยซ้ำหลายรอบในคืนเดียว */
  chatDay: number;
  plan: Plan | null;
  lastQuiz: number;
  ending: Ending | null;
}

// 4: เพิ่มระบบไลน์ (chats · pendingChat · chatDay · plan)
// 5: เพิ่มการบ้าน (homework · homeworkMissed)
export const SAVE_VERSION = 5;

export function newState(): GameState {
  const stats = {} as Record<StatId, number>;
  for (const s of game.stats) stats[s.id as StatId] = 0;
  const affinity: Record<string, number> = {};
  for (const c of chars) affinity[c.id] = 0;
  return {
    v: SAVE_VERSION,
    dayIndex: 0, periodIndex: 0, energy: game.energy.max,
    stats, affinity, flags: {}, metToday: {}, doneToday: {}, history: [],
    money: game.money.start, behaviour: game.behaviour.start, study: 0,
    club: null, inventory: {}, exams: {}, seenEvents: {}, caught: 0,
    sleepDebt: 0, lastQuiz: 0, ending: null,
    homework: 0, homeworkMissed: 0,
    chats: [], pendingChat: null, chatDay: -1, plan: null,
  };
}

export const rankOf = (value: number, ladder: number[]) => {
  let r = 0;
  for (let i = 0; i < ladder.length; i++) if (value >= ladder[i]) r = i;
  return r;
};
export const statRank = (v: number) => rankOf(v, game.statRanks);
export const affinityRank = (v: number) => rankOf(v, game.affinityRanks);
export const statName = (id: StatId) => game.stats.find((s) => s.id === id)!.name;

/** บันทึกเหตุการณ์สำคัญไว้ให้ฉากจบหยิบไปเล่า — เดิมฟิลด์นี้ประกาศไว้แต่ไม่เคยถูกเขียน */
export function remember(s: GameState, line: string) {
  s.history.push(`วันที่ ${s.dayIndex + 1}: ${line}`);
  if (s.history.length > 200) s.history.shift();
}
