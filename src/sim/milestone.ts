import game from "../../data/game.json";
import { applyStat } from "./economy";
import { changeAffinity, changeTrust, shiftStanding } from "./bonds";
import { clubOf, type Club } from "./club";
import { remember, type GameState, type StatId } from "./state";

/** งานใหญ่ของชมรม
 *
 *  `data/clubs.json` มี `milestoneDay` กับ `milestoneName` มาตั้งแต่ต้น และหน้าชมรม
 *  **เอาไปแสดงให้ผู้เล่นอ่านด้วย** ("งานใหญ่: แข่งตอบปัญหาระดับเขต")
 *  แต่ไม่มีโค้ดบรรทัดไหนอ่าน `milestoneDay` เลย — เข้าชมรมทั้งเทอม
 *  วันนั้นมาถึงแล้วผ่านไปเงียบๆ เป็นสัญญาที่เกมให้ไว้บนจอแล้วไม่เคยทำตาม
 *
 *  ที่นี่วันนั้นมีจริง และผลของมันมาจากสิ่งที่ทำมาทั้งเทอม ไม่ใช่จากมินิเกมอย่างเดียว:
 *  **ไปซ้อมกี่ครั้ง** เป็นฐาน มินิเกมเป็นตัวคูณ — แบบเดียวกับข้อสอบ
 *  สมัครชมรมแล้วไม่เคยไปเลย วันงานคือที่ที่ทั้งโรงเรียนได้เห็นพร้อมกัน
 */

const M = game.milestone;

/** ไปซ้อมชมรมมาแล้วกี่ครั้ง — นับใน `doClubActivity()` ที่เดียว */
export const attendance = (s: GameState) => s.clubDays;

/** ชมรมที่มีงานใหญ่ตรงกับวันนี้ และเราอยู่ชมรมนั้นจริง */
export function milestoneToday(s: GameState): Club | null {
  const c = clubOf(s);
  if (!c || s.milestoneDone) return null;
  const day = (c as { milestoneDay?: number }).milestoneDay;
  return day !== undefined && s.dayIndex + 1 >= day ? c : null;
}

export interface MilestoneResult {
  club: string; name: string; tier: number; tierName: string;
  attended: number; needed: number; lines: string[];
}

/** วันงานใหญ่ — `skill` คือคะแนนมินิเกม 0..1
 *  ผลข้างเคียงทั้งหมดเกิดที่นี่ที่เดียว และเกิดได้ครั้งเดียวต่อเทอม */
export function runMilestone(s: GameState, skill = 0.5): MilestoneResult | null {
  const c = milestoneToday(s);
  if (!c) return null;
  s.milestoneDone = true;

  const name = (c as { milestoneName?: string }).milestoneName ?? "งานใหญ่ของชมรม";
  const attended = attendance(s);
  // ความพร้อมคือสัดส่วนของการซ้อมที่ทำได้จริง เทียบกับที่ควรจะไปได้ทั้งเทอม
  const ready = Math.min(1, attended / M.fullAttendance);
  const raw = ready * M.readyWeight + skill * M.skillWeight;
  const tier = raw >= M.tiers[2] ? 3 : raw >= M.tiers[1] ? 2 : raw >= M.tiers[0] ? 1 : 0;
  const tierName = M.tierNames[tier];

  const lines: string[] = [];
  shiftStanding(s, M.standing[tier]);
  lines.push(M.standing[tier] >= 0
    ? `ทั้งโรงเรียนได้เห็น · ชื่อเสียง +${M.standing[tier]}`
    : `ทั้งโรงเรียนได้เห็นเหมือนกัน · ชื่อเสียง ${M.standing[tier]}`);

  const got = applyStat(s, c.stat as StatId, M.statGain[tier]);
  if (got > 0) lines.push(`${game.stats.find((x) => x.id === c.stat)!.name} +${got.toFixed(1)}`);

  // คนที่อยู่ในชมรมเดียวกับเรา เป็นคนที่ยืนอยู่ตรงนั้นด้วย
  for (const m of c.members) {
    changeAffinity(s, m, M.memberAffinity[tier]);
    changeTrust(s, m, M.memberTrust[tier]);
  }
  if (c.members.length)
    lines.push(tier >= 2 ? "คนในชมรมมองเราไม่เหมือนเดิมอีกแล้ว"
                         : "คนในชมรมไม่ได้พูดอะไร แต่เราเห็นหน้าเขา");

  if (M.money[tier] > 0) { s.money += M.money[tier]; lines.push(`เงินรางวัล ${M.money[tier]} บาท`); }

  // เขียนชื่อธงแบบตรงๆ ไม่ประกอบจากตัวแปร — `npm run story` ต้องมองเห็นมันได้
  // และคนอ่านโค้ดก็ควรเห็นชื่อธงจริงโดยไม่ต้องไล่ว่าตัวแปรกลายเป็นอะไร
  if (tier >= 2) s.flags["milestone_won"] = true;
  else s.flags["milestone_flopped"] = true;
  remember(s, `${name} · ${tierName} (ซ้อมมา ${attended} ครั้ง)`);
  s.offscreenNews.push(`${name} — ${tierName}`);

  return { club: c.id, name, tier, tierName, attended, needed: M.fullAttendance, lines };
}
