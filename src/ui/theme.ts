import game from "../../data/game.json";
import { isSchoolDay, periodId } from "../sim/calendar";
import type { GameState } from "../sim/state";

/** บรรยากาศเปลี่ยนตามช่วงเวลาของวัน — เช้าฟ้าซีด กลางวันอุ่น เย็นทอง กลางคืนคราม
 *  เป็นวิธีที่ถูกที่สุดที่ทำให้ "เวลา" รู้สึกเดินจริง โดยไม่ต้องมีภาพพื้นหลัง */
interface Mood { top: string; bottom: string; accent: string; label: string; }

const MOODS: Record<string, Mood> = {
  morning: { top: "#26314a", bottom: "#161320", accent: "#8fb6e0", label: "เช้า" },
  noon:    { top: "#3a3550", bottom: "#191527", accent: "#e8c98a", label: "กลางวัน" },
  after:   { top: "#4a3040", bottom: "#1c1524", accent: "#e8a075", label: "หลังเลิกเรียน" },
  night:   { top: "#1d1c34", bottom: "#120f1c", accent: "#9b8fd0", label: "กลางคืน" },
};

export function applyTheme(s: GameState) {
  const m = MOODS[periodId(s)] ?? MOODS.noon;
  const root = document.documentElement;
  root.style.setProperty("--sky-top", m.top);
  root.style.setProperty("--sky-bottom", m.bottom);
  root.style.setProperty("--period-accent", m.accent);
  root.dataset.period = periodId(s);
  root.dataset.school = isSchoolDay(s) ? "1" : "0";
}

/** แถบจุดสี่จุดบอกว่าตอนนี้อยู่ช่วงไหนของวัน */
export function periodStrip(s: GameState): string {
  return game.periods.map((p, i) => {
    // ใช้คำนำหน้า is- เพราะคลาสชื่อ next ชนกับคลาสของปุ่ม ".next" ที่มีอยู่แล้ว
    const state = i < s.periodIndex ? "is-past" : i === s.periodIndex ? "is-now" : "is-next";
    return `<i class="pdot ${state}" title="${p.name}"></i>`;
  }).join("");
}

export const periodLabel = (s: GameState) => MOODS[periodId(s)]?.label ?? "";
