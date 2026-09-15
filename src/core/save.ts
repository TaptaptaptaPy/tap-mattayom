import { SAVE_VERSION, type GameState } from "../sim/state";

const PREFIX = "mattayom:save:v2:";
export const SLOTS = ["auto", "1", "2", "3"] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SlotMeta { day: number; period: string; club: string | null; money: number; at: number; }
interface Envelope { v: number; at: number; meta: SlotMeta; state: GameState; }

export function writeSlot(slot: SlotId, state: GameState, meta: Omit<SlotMeta, "at">): boolean {
  try {
    const env: Envelope = { v: SAVE_VERSION, at: Date.now(), meta: { ...meta, at: Date.now() }, state };
    localStorage.setItem(PREFIX + slot, JSON.stringify(env));
    return true;
  } catch { return false; }
}

export function readSlot(slot: SlotId): { state: GameState; meta: SlotMeta } | null {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope;
    // เซฟจากโครงเกมคนละรุ่นใช้ต่อไม่ได้ ดีกว่าโหลดมาแล้วพังกลางทาง
    if (env.v !== SAVE_VERSION || !env.state || env.state.v !== SAVE_VERSION) return null;
    return { state: env.state, meta: env.meta };
  } catch { return null; }
}

export const slotMeta = (slot: SlotId) => readSlot(slot)?.meta ?? null;
export function clearSlot(slot: SlotId) {
  try { localStorage.removeItem(PREFIX + slot); } catch { /* ไม่เป็นไร */ }
}

/** เซฟรุ่นเก่า (v1) ใช้ต่อไม่ได้ ล้างทิ้งเงียบๆ ครั้งเดียว */
export function migrateOld() {
  try { localStorage.removeItem("mattayom:save:v1"); } catch { /* ไม่เป็นไร */ }
}
