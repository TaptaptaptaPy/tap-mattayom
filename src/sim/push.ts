import game from "../../data/game.json";
import { remember, type GameState } from "./state";
import type { Rnd } from "./discipline";

/** ฝืนต่อทั้งที่หมดแรง
 *
 *  ปัญหาเดิม: แรงต่ำกว่าเกณฑ์แล้วปุ่มทุกปุ่มดับหมด — แรงจึงเป็น *กำแพง* ไม่ใช่ *ทางเลือก*
 *  ผู้เล่นไม่ได้ตัดสินใจอะไรเลย เกมตัดสินใจแทนว่าวันนี้พอแค่นี้
 *  ทั้งที่สิ่งที่คนจริงๆ ทำคือฝืน แล้วไปจ่ายเอาวันหลัง
 *
 *  ที่นี่ฝืนได้เสมอ แต่ราคาสามชั้น:
 *  1. ได้ของน้อยลง (`yield`) — ฝืนทำตอนหมดแรงไม่เท่ากับทำตอนเต็มแรง
 *  2. หนี้การนอนสะสม แล้วไปหักแรงที่ควรได้คืนตอนเช้า (`calendar.ts`)
 *  3. หนี้มากพอจะหลับในคาบ และมากกว่านั้นจะล้มป่วยจนเสียไปทั้งวัน
 *
 *  กติกา: ฝืนต้อง *คุ้ม* ในระยะสั้นเสมอ ไม่งั้นไม่มีใครเลือกมัน
 *  และต้อง *ไม่คุ้ม* ถ้าทำติดกันหลายวัน ไม่งั้นมันกลายเป็นวิธีเล่นที่ถูกต้องวิธีเดียว
 */

const P = game.push;

export const energyLowFor = (s: GameState) => s.energy < game.energy.lowThreshold;

/** ฝืนได้ไหม — ฝืนไม่ได้ก็ต่อเมื่อร่างกายไปต่อไม่ไหวจริงๆ แล้ว */
export const canPush = (s: GameState) => s.sleepDebt < P.maxDebt && !s.flags["sick_today"];

/** เหตุผลที่ฝืนไม่ได้ ถ้าฝืนได้คืน null */
export function whyNoPush(s: GameState): string | null {
  if (s.flags["sick_today"]) return "วันนี้ไข้ขึ้น ร่างกายไม่ไปไหนแล้ว";
  if (s.sleepDebt >= P.maxDebt) return "ฝืนมาหลายคืนแล้ว ร่างกายไม่ยอมแล้วจริงๆ";
  return null;
}

/** จ่ายราคาของการฝืนหนึ่งครั้ง คืนตัวคูณที่ต้องเอาไปคูณกับของที่ได้ */
export function push(s: GameState): number {
  s.sleepDebt += P.debtPerPush;
  s.flags["pushed_through"] = true;
  return P.yield;
}

export const debtLevel = (s: GameState): number =>
  s.sleepDebt >= P.sickAt ? 2 : s.sleepDebt >= P.dozeAt ? 1 : 0;

export const debtName = (s: GameState) => P.levelNames[debtLevel(s)];

/** หลับในคาบเรียน — เกิดได้เฉพาะตอนหนี้การนอนถึงระดับหนึ่ง
 *  คืนข้อความถ้าหลับ ไม่งั้น null · ผลคือคาบนั้นเสียเปล่าและครูเห็น */
export function dozeOff(s: GameState, rnd: Rnd = Math.random): string | null {
  if (debtLevel(s) < 1) return null;
  if (rnd() > P.dozeChance) return null;
  s.behaviour = Math.max(0, s.behaviour - P.dozeBehaviour);
  s.flags["dozed_in_class"] = true;
  remember(s, "หลับในคาบจนครูเรียกชื่อ ทั้งห้องหันมามอง");
  return "หลับในคาบ ครูเรียกชื่อกลางห้อง";
}

/** เช้าวันใหม่: ฝืนมามากพอจะล้มป่วย — เสียทั้งวัน ไม่ใช่แค่แรง
 *  เรียกจาก `advance()` ตอนขึ้นวันใหม่ ก่อนหนี้ถูกล้าง */
export function stepSickness(s: GameState, rnd: Rnd = Math.random): string | null {
  delete s.flags["sick_today"];
  if (s.sleepDebt < P.sickAt) return null;
  if (rnd() > P.sickChance) return null;
  s.flags["sick_today"] = true;
  s.flags["fell_sick"] = true;
  s.energy = Math.min(s.energy, P.sickEnergy);
  const line = "ตื่นมาแล้วลุกไม่ไหว วันนี้ทั้งวันหายไปกับการนอนอยู่บ้าน";
  remember(s, line);
  s.offscreenNews.push(line);
  return line;
}

/** วันนี้ป่วยอยู่ไหม — ฝั่ง UI ใช้ปิดทุกอย่างนอกจากพัก */
export const isSick = (s: GameState) => !!s.flags["sick_today"];
