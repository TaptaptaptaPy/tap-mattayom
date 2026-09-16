import backgrounds from "../../data/backgrounds.json";
import game from "../../data/game.json";
import type { GameState, StatId } from "./state";

/** กฎที่ภูมิหลังเปลี่ยน — แยกออกมาจาก `background.ts` เพราะไฟล์นี้ต้องไม่ import อะไรเลย
 *
 *  `economy` `discipline` `calendar` ต้องอ่านค่าพวกนี้ได้ แต่ `background.ts` ต้อง import
 *  `presence` กับ `bonds` เพื่อเขียนค่าตอนเริ่มเกม ถ้ารวมไว้ไฟล์เดียว import จะวนกันทันที
 *  (economy → background → presence → club → economy) · ที่นี่คือฝั่ง *อ่าน* อย่างเดียว
 */

export interface KnownFrom {
  id: string; affinity: number; trust: number; memory: string; habits?: string[];
}
export interface Background {
  id: string; name: string; tag: string; blurb: string; detail: string;
  stats: Partial<Record<StatId, number>>;
  start: { money?: number; standing?: number; teacher?: number; behaviour?: number;
           homeStrain?: number; study?: number };
  knows: KnownFrom[];
  traits: Record<string, number>;
  perk: string; flaw: string;
}

export const BACKGROUNDS = backgrounds.list as unknown as Background[];
export const backgroundById = (id: string | null | undefined) =>
  BACKGROUNDS.find((b) => b.id === id) ?? null;
export const backgroundOf = (s: GameState) => backgroundById(s.background);
export const backgroundName = (s: GameState) => backgroundOf(s)?.name ?? "นักเรียนธรรมดา";

/** ค่าของกฎที่ภูมิหลังนี้เปลี่ยน — ไม่ระบุก็คืนค่าเริ่มต้นที่ส่งมา
 *  ทุกที่ในเกมที่อยากให้ภูมิหลังมีผล ต้องอ่านผ่านฟังก์ชันนี้เท่านั้น */
export function trait(s: GameState, key: string, fallback: number): number {
  const t = backgroundOf(s)?.traits;
  return t && key in t ? t[key] : fallback;
}

/** เพดานแรงของคนคนนี้ — เด็กห้องคิงที่ไม่เคยออกกำลังมีน้อยกว่าคนอื่น
 *  ทุกที่ที่เคยเขียน `game.energy.max` ต้องเรียกอันนี้แทน ไม่งั้นแรงจะทะลุเพดานของตัวเอง */
export const maxEnergy = (s: GameState) =>
  Math.round(game.energy.max * trait(s, "energyMax", 1));

/** ตัวคูณของค่าสถานะแต่ละตัว — `nerveGain` `mindGain` ... ในตาราง traits */
export const statGainMult = (s: GameState, id: StatId) => trait(s, `${id}Gain`, 1);
