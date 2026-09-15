import shop from "../../data/shop.json";
import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { remember, type GameState, type StatId } from "./state";

export type Item = (typeof shop)[number];
export const ITEMS = shop as Item[];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id) ?? null;

export function buy(s: GameState, id: string): string {
  const it = itemById(id);
  if (!it) return "ไม่มีของชิ้นนี้";
  if (s.money < it.price) return "เงินไม่พอ";
  s.money -= it.price;
  s.inventory[id] = (s.inventory[id] ?? 0) + 1;
  return `ซื้อ${it.name}แล้ว · เหลือ ${s.money} บาท`;
}

export function use(s: GameState, id: string): string {
  const it = itemById(id);
  if (!it || !(s.inventory[id] > 0)) return "ไม่มีของชิ้นนี้ในกระเป๋า";
  if (!("energy" in it) && !("study" in it)) return "ของชิ้นนี้เอาไว้ให้คนอื่น ไม่ได้ใช้เอง";
  s.inventory[id]--;
  const parts: string[] = [];
  if ("energy" in it && typeof it.energy === "number") {
    s.energy = Math.min(game.energy.max, s.energy + it.energy);
    parts.push(`แรง +${it.energy}`);
  }
  if ("sleepPenalty" in it && typeof it.sleepPenalty === "number") {
    s.sleepDebt += it.sleepPenalty;
    parts.push("คืนนี้จะนอนไม่ค่อยหลับ");
  }
  if ("study" in it && typeof it.study === "number") {
    s.study += it.study;
    parts.push(`ความพร้อมสอบ +${it.study}`);
  }
  return `${it.name} · ${parts.join(" · ")}`;
}

/** ของฝากที่ตรงกับสิ่งที่เขาให้ค่า ได้ใจมากกว่าของแพง */
export function gift(s: GameState, id: string, charId: string): string {
  const it = itemById(id);
  const ch = chars.find((c) => c.id === charId);
  if (!it || !ch) return "ให้ไม่ได้";
  if (!("gift" in it) || !it.gift) return "ของชิ้นนี้ไม่เหมาะจะเอาไปให้ใคร";
  if (!(s.inventory[id] > 0)) return "ไม่มีของชิ้นนี้ในกระเป๋า";
  s.inventory[id]--;
  const base = "giftValue" in it && typeof it.giftValue === "number" ? it.giftValue : 1;
  const likes = ("likes" in it ? (it.likes as string[]) : []) ?? [];
  const match = likes.some((l) => (ch.likes as StatId[]).includes(l as StatId));
  const amount = match ? base + 2 : base;
  s.affinity[charId] = (s.affinity[charId] ?? 0) + amount;
  remember(s, `ให้${it.name}กับ${ch.name}`);
  return match
    ? `${ch.name}รับ${it.name}ไป · ตรงใจพอดี (ความสัมพันธ์ +${amount})`
    : `${ch.name}รับ${it.name}ไป (ความสัมพันธ์ +${amount})`;
}

export const giftable = (s: GameState) =>
  ITEMS.filter((i) => "gift" in i && i.gift && (s.inventory[i.id] ?? 0) > 0);
export const usable = (s: GameState) =>
  ITEMS.filter((i) => (("energy" in i) || ("study" in i)) && (s.inventory[i.id] ?? 0) > 0);
