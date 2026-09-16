import { Compiler } from "inkjs/full";
import type { Story } from "inkjs/types";
import type { GameState } from "../sim/state";
import { bindStory, type SceneHooks } from "./bind";

export * from "./bind";

// โหลดบททั้งหมดเป็นข้อความดิบ แล้วคอมไพล์ตอนรัน
// ข้อดี: แก้ไฟล์ .ink แล้ว Vite HMR รีโหลดทันที ไม่ต้อง build ใหม่
// ถ้าวันหนึ่งบทเยอะจนคอมไพล์ช้า ค่อยเปลี่ยนไป precompile เป็น .json
// **ไฟล์นี้เป็นของ Vite ล้วน** ตัวผูก external ทั้งหมดอยู่ที่ ./bind.ts ซึ่ง Node อ่านได้ด้วย
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

/** สร้าง story พร้อมฉีดสถานะปัจจุบันเข้าไป และต่อสะพานกลับมาที่ TS */
export function openScene(storyName: string, s: GameState, charId: string | null, hooks: SceneHooks): Story {
  return bindStory(new Compiler(sourceOf(storyName)).Compile(), s, charId, hooks);
}
