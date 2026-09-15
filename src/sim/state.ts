import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { newGrades } from "./grades";

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

/** หนึ่งบรรทัดบนกระดานประกาศผล — นิยามอยู่ที่นี่เพื่อไม่ให้ state กับ board import วนกัน */
export interface BoardRow {
  id: string; name: string; score: number; rank: number; me: boolean; move: number; tutored: boolean;
}

export interface GameState {
  v: number;
  dayIndex: number;          // 0 = วันเปิดเทอม
  periodIndex: number;       // อ้างอิง data/game.json > periods
  energy: number;
  stats: Record<StatId, number>;
  affinity: Record<string, number>;
  /** ความเชื่อใจ — คนละแกนกับความสนิท ดู src/sim/bonds.ts */
  trust: Record<string, number>;
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

  /** ทั้งโรงเรียนมองเรายังไง 0-100 — ต่างจากความประพฤติตรงที่นั่นเป็นของฝ่ายปกครอง */
  standing: number;
  /** เลือกยืนข้างใครไปแล้ว เลือกแล้วอีกฝั่งปิดถาวร */
  sided: string | null;

  /** ภาคที่กำลังเล่นอยู่ — "school" คือมัธยม "uni" คือปีหนึ่ง */
  chapter: "school" | "uni";
  /** ฉากจบของมัธยม เก็บไว้เพราะปีหนึ่งอ้างถึงมันตลอด */
  schoolEnding: Ending | null;
  /** หนี้ค่าหอที่ค้างอยู่ (เฉพาะภาคมหาลัย) */
  debt: number;
  rentDue: number;

  /** วิชาที่ติดซ่อมอยู่ตอนนี้ */
  retakes: string[];
  /** งานกลุ่มที่กำลังค้างอยู่ — `charId` คือคนที่จับได้ ไม่ใช่คนที่เลือก */
  project: { charId: string; done: number; due: number; settled: boolean } | null;

  /** ความเรียบร้อยของทรงผม/เครื่องแบบ 0-100 ลดลงทุกวัน */
  grooming: number;
  /** โดนเรียกหน้าแถวไปกี่ครั้งแล้วทั้งเทอม */
  inspected: number;

  /** เกรดรายวิชา 0-100 สะสมทั้งเทอม แล้วแปลงเป็นเกรด 4 ขั้นตอนจบ */
  grades: Record<string, number>;

  /** การบ้านที่ยังไม่ได้ส่ง (ชิ้น) */
  homework: number;
  /** ส่งไม่ทันมากี่ชิ้นแล้วทั้งเทอม — ฉากจบกับเทสต์ใช้ดู */
  homeworkMissed: number;

  chats: ChatThread[];
  /** ใครทักมาแล้วยังไม่ได้เปิดอ่าน — ตัวข้อความจะถูกสร้างตอนเปิดจริง เพราะคำพูดเป็นของ ink */
  pendingChat: string | null;
  /** คืนล่าสุดที่ทอยว่ามีคนทักไหมไปแล้ว กันไม่ให้ทอยซ้ำหลายรอบในคืนเดียว */
  chatDay: number;
  /** นัดที่รับไว้ — เป็นรายการ ไม่ใช่ช่องเดียว
   *  รับนัดสองคนในวันเดียวกันได้ แต่ไปได้คนเดียว นั่นคือทั้งหมดของความหมายมัน */
  plans: Plan[];
  /** ชีวิตของแต่ละคนตอนเราไม่อยู่ — ดู src/sim/offscreen.ts */
  lives: Record<string, { pressure: number; lastSeen: number; fired: number; cooldown: number }>;
  /** เรื่องที่เพิ่งเกิดลับหลัง ยังไม่ได้บอกผู้เล่น */
  offscreenNews: string[];
  /** สิ่งที่แต่ละคนจำได้เกี่ยวกับเรา แล้วหยิบมาพูดเองทีหลัง */
  memories: Record<string, string[]>;
  /** เรื่องไหนเราบอกใครไปว่าอะไร — ดู src/sim/claims.ts */
  claims: Record<string, Record<string, string>>;
  /** กระดานประกาศผลสอบที่ติดไปแล้ว รอบละหนึ่งตาราง — ดู src/sim/board.ts
   *  เก็บไว้เพราะกระดานต้องเปิดดูซ้ำได้และต้องเทียบกับรอบก่อนได้ */
  board: Record<string, BoardRow[]>;
  /** เราติวให้ใครไปกี่ครั้ง */
  tutored: Record<string, number>;
  /** ให้ของชิ้นไหนกับใครไปแล้วกี่ครั้ง คีย์คือ "คน:ของ" */
  gifted: Record<string, number>;
  /** คนอื่นที่กำลังสนิทกับเขาเหมือนกัน 0-100 — ดู src/sim/rival.ts */
  rivals: Record<string, number>;
  /** คนที่เรายินดีด้วยแล้ว เรื่องนั้นจบไปแล้ว */
  conceded: Record<string, true>;
  /** ครูประจำชั้นมองเรายังไง 0-100 — ขยับจากความรับผิดชอบ ไม่ใช่จากการไปหา
   *  ดู src/sim/teacher.ts */
  teacher: number;
  /** วันล่าสุดที่ครูโทรหาที่บ้าน — กันไม่ให้โทรซ้ำทุกสัปดาห์ */
  teacherCalled: number;
  /** เรื่องที่บ้าน — ดู src/sim/home.ts */
  home: { strain: number; gave: number; refused: number; given: number };
  /** ใครเห็นเราอยู่กับคนอื่นไปแล้ววันนี้ — วันละครั้งต่อคน ล้างทุกเช้าพร้อม metToday */
  seenToday: Record<string, true>;
  /** ไปซ้อมชมรมมาแล้วกี่ครั้งทั้งเทอม — ฐานของผลงานในวันงานใหญ่ */
  clubDays: number;
  /** งานใหญ่ของชมรมผ่านไปแล้วหรือยัง เทอมละครั้งเดียว */
  milestoneDone: boolean;
  /** เมื่อคืนมีคนยืนรอเก้อกี่คน — ฝั่ง UI เอาไปทำเสียงและข้อความแล้วล้างทิ้ง
   *  ไม่ใช่สถานะถาวรของโลก แต่ต้องข้ามกำแพง sim→UI มาให้ได้ */
  stoodUp: number;
  lastQuiz: number;
  ending: Ending | null;
}

// 4: เพิ่มระบบไลน์ (chats · pendingChat · chatDay · plan)
// 5: เพิ่มการบ้าน (homework · homeworkMissed)
// 6: เพิ่มชื่อเสียงและการเลือกข้าง (standing · sided)
// 7: เพิ่มเกรดรายวิชา (grades)
// 8: เพิ่มตรวจหน้าเสาธง (grooming · inspected)
// 9: เพิ่มภาคมหาลัย (chapter · schoolEnding · debt · rentDue)
// 10: เพิ่มสอบซ่อมและงานกลุ่ม (retakes · project)
// 14: เพิ่มคำพูดที่ไม่ตรงกัน (claims)
// 15: เพิ่มกระดานประกาศผลและการติวให้เพื่อน (board · tutored)
// 16: เพิ่มงานใหญ่ของชมรม (clubDays · milestoneDone)
// 17: เพิ่มการถูกเห็นตอนอยู่กับอีกคน (seenToday)
// 18: เพิ่มเรื่องที่บ้าน (home)
// 19: เพิ่มครูประจำชั้น (teacher)
// 20: เพิ่มคู่แข่ง (rivals · conceded)
// 21: เพิ่มรสนิยมของฝากรายคน (gifted)
export const SAVE_VERSION = 21;

export function newState(): GameState {
  const stats = {} as Record<StatId, number>;
  for (const s of game.stats) stats[s.id as StatId] = 0;
  const affinity: Record<string, number> = {};
  const trust: Record<string, number> = {};
  for (const c of chars) { affinity[c.id] = 0; trust[c.id] = 0; }
  return {
    v: SAVE_VERSION,
    dayIndex: 0, periodIndex: 0, energy: game.energy.max,
    stats, affinity, trust, flags: {}, metToday: {}, doneToday: {}, history: [],
    money: game.money.start, behaviour: game.behaviour.start, study: 0,
    club: null, inventory: {}, exams: {}, seenEvents: {}, caught: 0,
    sleepDebt: 0, lastQuiz: 0, stoodUp: 0, ending: null,
    standing: 50, sided: null, grades: newGrades(),
    grooming: game.grooming.start, inspected: 0, retakes: [], project: null,
    chapter: "school", schoolEnding: null, debt: 0, rentDue: 0,
    homework: 0, homeworkMissed: 0,
    chats: [], pendingChat: null, chatDay: -1, plans: [],
    lives: {}, offscreenNews: [], memories: {}, claims: {}, board: {}, tutored: {}, clubDays: 0, milestoneDone: false, seenToday: {},
    home: { strain: 0, gave: 0, refused: 0, given: 0 }, teacher: game.teacher.start, teacherCalled: -99, rivals: {}, conceded: {}, gifted: {},
  };
}

export const rankOf = (value: number, ladder: number[]) => {
  let r = 0;
  for (let i = 0; i < ladder.length; i++) if (value >= ladder[i]) r = i;
  return r;
};
export const statRank = (v: number) => rankOf(v, game.statRanks);
export const affinityRank = (v: number) => rankOf(v, game.affinityRanks);
/** ความเชื่อใจมีหกระดับ คนละสเกลกับความสนิท เพราะมันไต่ช้ากว่าและเสียเร็วกว่า */
export const trustRank = (v: number) => rankOf(v, game.trust.ranks);
export const trustName = (v: number) => game.trust.rankNames[trustRank(v)];
export const statName = (id: StatId) => game.stats.find((s) => s.id === id)!.name;

/** บันทึกเหตุการณ์สำคัญไว้ให้ฉากจบหยิบไปเล่า — เดิมฟิลด์นี้ประกาศไว้แต่ไม่เคยถูกเขียน */
export function remember(s: GameState, line: string) {
  s.history.push(`วันที่ ${s.dayIndex + 1}: ${line}`);
  if (s.history.length > 200) s.history.shift();
}
