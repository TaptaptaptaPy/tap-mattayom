/** จำลองการเล่นจนจบเทอมแบบ headless — รันด้วย `npm run balance`
 *  เดิมเกมนี้ไม่มีเครื่องมือแบบนี้เลย เลยไม่มีใครเห็นว่าค่าสถานะเฟ้อตั้งแต่วันที่ 12 */
import game from "../../data/game.json";
import { newState, statRank, type GameState, type StatId } from "../sim/state";
import { advance, isLocked, isTermOver, eventNow } from "../sim/calendar";
import { availableLocations, doAction, doRest, attendClass } from "../sim/actions";
import { takeExam } from "../sim/exam";
import { joinClub, clubToday, doClubActivity } from "../sim/club";
import { computeEnding } from "../sim/ending";
import { buy, use } from "../sim/shop";

type Strategy = "mind" | "spread" | "social" | "lazy";
const rnd = () => 0.5;   // ไม่สุ่ม เพื่อให้ผลซ้ำได้

function play(strat: Strategy) {
  const s: GameState = newState();
  let minEnergy = 999, blocked = 0, restDays = 0;
  const maxedAt: Partial<Record<StatId, number>> = {};

  while (!isTermOver(s)) {
    // เหตุการณ์ตามปฏิทินถูกข้ามในโหมดจำลอง ยกเว้นวันสอบซึ่งต้องเข้าสอบจริง
    const ev = eventNow(s);
    if (ev) {
      s.seenEvents[ev.id] = true;
      if (ev.exam) takeExam(s, ev.exam);
      if (ev.pickClub && !s.club) joinClub(s, strat === "mind" ? "academic" : strat === "social" ? "music" : "sport");
    }

    if (isLocked(s)) {
      attendClass(s);
    } else if (strat === "lazy") {
      const home = availableLocations(s).find((l) => l.rest);
      if (home) { doRest(s, home); restDays++; }
    } else {
      const club = clubToday(s);
      const locs = availableLocations(s)
        .filter((l) => l.action && !l.blocked)
        .filter((l) => (l.action!.cost ?? 0) <= s.money);
      if (club && locs.some((l) => l.club)) {
        doClubActivity(s, 0);
      } else if (locs.length) {
        const pick = strat === "mind"
          ? locs.sort((a, b) => (b.action!.stat === "mind" ? 1 : 0) - (a.action!.stat === "mind" ? 1 : 0))[0]
          : strat === "social"
            ? locs.sort((a, b) => b.action!.gain - a.action!.gain)[0]
            : locs.sort((a, b) => s.stats[a.action!.stat] - s.stats[b.action!.stat])[0];
        const r = doAction(s, pick, rnd);
        if (r && /หมดแรง|แรงเหลือน้อย|เงินไม่พอ/.test(r.message)) {
          blocked++;
          const home = availableLocations(s).find((l) => l.rest);
          if (home) doRest(s, home);
          else if (s.money >= 90) { buy(s, "energydrink"); use(s, "energydrink"); }
        }
      }
    }

    minEnergy = Math.min(minEnergy, s.energy);
    for (const st of game.stats) {
      const id = st.id as StatId;
      if (statRank(s.stats[id]) === game.statRankNames.length - 1 && maxedAt[id] === undefined)
        maxedAt[id] = s.dayIndex + 1;
    }
    advance(s);
  }

  const e = computeEnding(s);
  console.log(`\nกลยุทธ์: ${
    strat === "mind" ? "ทุ่มเรียนอย่างเดียว" : strat === "spread" ? "เฉลี่ยทุกค่า"
    : strat === "social" ? "เน้นกิจกรรมที่ได้เยอะสุด" : "ไม่ทำอะไรเลยทั้งเทอม"}`);
  for (const st of game.stats) {
    const id = st.id as StatId;
    const v = s.stats[id];
    console.log(`    ${st.name.padEnd(8)} ${v.toFixed(0).padStart(4)}  ${game.statRankNames[statRank(v)]}` +
      (maxedAt[id] ? `   ← แตะเพดานตั้งแต่วันที่ ${maxedAt[id]}` : ""));
  }
  const ex = game.exams.map((x) => {
    const r = s.exams[x.id];
    return r ? `${x.name} ${r.score} (ที่ ${r.rank})` : `${x.name} ไม่ได้สอบ`;
  }).join(" · ");
  console.log(`    ${ex}`);
  console.log(`    แรงต่ำสุด ${minEnergy.toFixed(0)}/${game.energy.max} · ถูกบล็อกเพราะหมดแรง/เงิน ${blocked} ครั้ง` +
              (restDays ? ` · พัก ${restDays} ช่วง` : ""));
  console.log(`    เงินคงเหลือ ${Math.round(s.money)} · ความประพฤติ ${Math.round(s.behaviour)} · โดนจับ ${s.caught} ครั้ง`);
  console.log(`    ปลายทาง: ${e.tier} (คะแนนรวม ${e.score})`);
  return { s, e, maxedAt, minEnergy };
}

console.log(`จำลองเล่นจนจบเทอม ${game.term.days} วัน ด้วย 4 กลยุทธ์`);
const results = (["mind", "spread", "social", "lazy"] as Strategy[]).map(play);

console.log("\n" + "─".repeat(56));
const maxLines: string[] = [];
for (const r of results)
  for (const [k, d] of Object.entries(r.maxedAt))
    if (d !== undefined) maxLines.push(`${k} เต็มวันที่ ${d}/${game.term.days}`);
const early = results.filter((r) => Object.values(r.maxedAt).some((d) => (d ?? 999) < game.term.days * 0.25));
const neverTired = results.slice(0, 3).filter((r) => r.minEnergy > game.energy.lowThreshold);
console.log(maxLines.length ? `ค่าที่แตะเพดาน: ${maxLines.join(" · ")}` : "ไม่มีค่าสถานะไหนแตะเพดานเลยทั้งเทอม");
if (early.length) console.log(`เตือน: มี ${early.length} กลยุทธ์ที่แตะเพดานก่อน 1 ใน 4 ของเทอม เร็วเกินไป`);
if (neverTired.length >= 3) console.log("เตือน: ไม่มีกลยุทธ์ไหนที่แรงลงต่ำกว่าเกณฑ์เลย ระบบแรงยังไม่มีผล");
else if (neverTired.length) console.log(`หมายเหตุ: ${neverTired.length} กลยุทธ์จัดการแรงได้โดยไม่เคยแตะขีดล่าง`);
const spread = results[3].e.score, best = results[1].e.score;
if (best <= spread) console.log("เตือน: เล่นจริงจังได้ผลไม่ต่างจากไม่ทำอะไรเลย");
if (!early.length && neverTired.length < 3 && best > spread) console.log("เศรษฐกิจของเกมอยู่ในเกณฑ์ที่ตั้งใจไว้");
