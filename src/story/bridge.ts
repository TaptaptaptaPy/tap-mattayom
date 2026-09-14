import { Compiler } from "inkjs/full";
import type { Story } from "inkjs/types";
import type { GameState, StatId } from "../sim/state";

// โหลดบททั้งหมดเป็นข้อความดิบ แล้วคอมไพล์ตอนรัน
// ข้อดี: แก้ไฟล์ .ink แล้ว Vite HMR รีโหลดทันที ไม่ต้อง build ใหม่
// ถ้าวันหนึ่งบทเยอะจนคอมไพล์ช้า ค่อยเปลี่ยนไป precompile เป็น .json
const inkFiles = import.meta.glob("../../story/*.ink", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function sourceOf(name: string): string {
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
  onFlag: (name: string) => void;
}

/** สร้าง story พร้อมฉีดสถานะปัจจุบันเข้าไป และต่อสะพานกลับมาที่ TS */
export function openScene(storyName: string, s: GameState, charId: string, hooks: SceneHooks): Story {
  const story = new Compiler(sourceOf(storyName)).Compile();

  story.BindExternalFunction("gainStat", (id: string, amount: number) => {
    hooks.onStat(id as StatId, amount); return null;
  });
  story.BindExternalFunction("gainAffinity", (cid: string, amount: number) => {
    hooks.onAffinity(cid, amount); return null;
  });
  story.BindExternalFunction("setFlag", (name: string) => {
    hooks.onFlag(name); return null;
  });

  // ฉีดค่าจากเกมเข้าไปใน ink เพื่อให้เงื่อนไขในบทใช้งานได้
  for (const [k, v] of Object.entries(s.stats)) story.variablesState[k] = v;
  story.variablesState["affinity"] = s.affinity[charId] ?? 0;
  story.variablesState["day"] = s.dayIndex + 1;
  return story;
}
