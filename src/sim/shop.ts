import shop from "../../data/shop.json";
import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { changeAffinity, changeTrust } from "./bonds";
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

/** ของที่คนคนนั้นอยากได้จริงๆ และของที่ผิดฝาผิดตัวสำหรับเขา
 *  เดิมจับคู่ด้วย `likes` ซึ่งเป็นค่าสถานะ แปลว่าคนที่ค่าสถานะคล้ายกันชอบของเหมือนกันหมด
 *  ทั้งที่สิ่งที่ทำให้ของฝากมีความหมายคือมันเจาะจงกับ *คนคนนั้น* ไม่ใช่กับประเภทของคน */
type Taste = { wants?: string; dislikes?: string; wantsWhy?: string };
const tasteOf = (id: string) => (chars.find((c) => c.id === id) as Taste | undefined) ?? {};

/** เขาอยากได้อะไร — บทกับ UI ใช้บอกใบ้ได้ */
export const wantsOf = (id: string) => {
  const t = tasteOf(id);
  return t.wants ? { item: itemById(t.wants), why: t.wantsWhy ?? "" } : null;
};

/** ให้ของชิ้นเดิมกับคนเดิมไปแล้วกี่ครั้ง */
export const giftedTimes = (s: GameState, charId: string, itemId: string) =>
  s.gifted[`${charId}:${itemId}`] ?? 0;

/** ของฝากที่ตรงกับสิ่งที่เขาให้ค่า ได้ใจมากกว่าของแพง */
export function gift(s: GameState, id: string, charId: string): string {
  const it = itemById(id);
  const ch = chars.find((c) => c.id === charId);
  if (!it || !ch) return "ให้ไม่ได้";
  if (!("gift" in it) || !it.gift) return "ของชิ้นนี้ไม่เหมาะจะเอาไปให้ใคร";
  if (!(s.inventory[id] > 0)) return "ไม่มีของชิ้นนี้ในกระเป๋า";
  s.inventory[id]--;

  const G = game.gift;
  const t = tasteOf(charId);
  const base = "giftValue" in it && typeof it.giftValue === "number" ? it.giftValue : 1;
  const likes = ("likes" in it ? (it.likes as string[]) : []) ?? [];
  const match = likes.some((l) => (ch.likes as StatId[]).includes(l as StatId));

  // ของเดิมซ้ำๆ ได้ใจน้อยลงทุกครั้ง — ครั้งแรกคือความตั้งใจ ครั้งที่สี่คือความเคยชิน
  const key = `${charId}:${id}`;
  const again = s.gifted[key] ?? 0;
  s.gifted[key] = again + 1;
  const worn = Math.max(G.repeatFloor, 1 - again * G.repeatDrop);

  if (t.dislikes === id) {
    // ผิดฝาผิดตัวไม่ได้แค่ได้น้อย มันบอกเขาว่าเราไม่ได้ดูเลยว่าเขาเป็นคนยังไง
    changeAffinity(s, charId, G.wrongAffinity);
    changeTrust(s, charId, G.wrongTrust);
    s.flags["wrong_gift"] = true;
    remember(s, `ให้${it.name}กับ${ch.name} ซึ่งเขาไม่ได้อยากได้เลย`);
    return `${ch.name}รับ${it.name}ไปแบบไม่รู้จะเอาไปทำอะไร`;
  }

  const amount = (t.wants === id ? base + G.wantsBonus : match ? base + G.likesBonus : base) * worn;
  changeAffinity(s, charId, amount);
  if (t.wants === id) { s.flags["perfect_gift"] = true; changeTrust(s, charId, G.wantsTrust); }
  remember(s, `ให้${it.name}กับ${ch.name}`);
  const tail = again > 0 ? " (ของเดิมอีกแล้ว)" : "";
  return t.wants === id
    ? `${ch.name}รับ${it.name}ไป · เขาอยากได้ชิ้นนี้มานานแล้ว (ความสัมพันธ์ +${amount.toFixed(1)})${tail}`
    : match
    ? `${ch.name}รับ${it.name}ไป · ตรงใจพอดี (ความสัมพันธ์ +${amount.toFixed(1)})${tail}`
    : `${ch.name}รับ${it.name}ไป (ความสัมพันธ์ +${amount.toFixed(1)})${tail}`;
}

export const giftable = (s: GameState) =>
  ITEMS.filter((i) => "gift" in i && i.gift && (s.inventory[i.id] ?? 0) > 0);
export const usable = (s: GameState) =>
  ITEMS.filter((i) => (("energy" in i) || ("study" in i)) && (s.inventory[i.id] ?? 0) > 0);
