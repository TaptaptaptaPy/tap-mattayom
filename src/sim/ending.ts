import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { termScore } from "./exam";
import { clubOf } from "./club";
import { standingLabel } from "./bonds";
import { affinityRank, statRank, type Ending, type GameState, type StatId } from "./state";

const EN = game.entrance;

/** ปลายทางของเทอม: สอบเข้ามหาลัย + สรุปว่าเทอมนี้ผู้เล่นเป็นคนแบบไหน */
export function computeEnding(s: GameState): Ending {
  const exams = termScore(s);
  const behaviour = (s.behaviour / game.behaviour.start) * 100;
  const club = clubOf(s);
  const clubScore = club ? Math.min(100, (s.stats[club.stat as StatId] / 60) * 100) : 0;
  const statAvg = Object.values(s.stats).reduce((a, b) => a + b, 0) / 5;
  const statScore = Math.min(100, (statAvg / 55) * 100);

  // ชื่อเสียงคือสิ่งที่คนที่ไม่รู้จักเราใช้ตัดสินเรา — กรรมการสอบสัมภาษณ์ก็เป็นคนกลุ่มนั้น
  const score = Math.round(
    exams * (1 - EN.behaviourWeight - EN.clubWeight - EN.statWeight - EN.standingWeight) +
    behaviour * EN.behaviourWeight +
    clubScore * EN.clubWeight +
    statScore * EN.statWeight +
    s.standing * EN.standingWeight);

  const tier = EN.tiers.find((t) => score >= t.min) ?? EN.tiers[EN.tiers.length - 1];

  let closest: string | null = null, closestVal = -1;
  for (const c of chars) {
    const v = s.affinity[c.id] ?? 0;
    if (v > closestVal) { closestVal = v; closest = c.name; }
  }
  const closestRank = affinityRank(closestVal);

  const lines: string[] = [];
  for (const e of game.exams) {
    const r = s.exams[e.id];
    lines.push(r ? `${e.name}: ${r.score} คะแนน อันดับที่ ${r.rank} ของห้อง`
                 : `${e.name}: ไม่ได้เข้าสอบ`);
  }
  lines.push(club ? `ชมรม: ${club.name}` : "ชมรม: ไม่ได้สมัครชมรมไหนเลย");
  lines.push(s.caught === 0 ? "ไม่เคยโดนฝ่ายปกครองจับได้เลยสักครั้ง"
                            : `โดนฝ่ายปกครองจับได้ ${s.caught} ครั้ง`);
  lines.push(`ชื่อเสียงในโรงเรียน: ${standingLabel(s.standing)} (${Math.round(s.standing)})`);
  if (s.homeworkMissed > 0)
    lines.push(`ไม่ได้ส่งการบ้านรวม ${s.homeworkMissed} ชิ้น`);
  if (s.sided) {
    const side = chars.find((c) => c.id === s.sided);
    lines.push(`ตอนที่ต้องเลือก เราเลือกยืนข้าง${side?.name ?? s.sided}`);
  }
  // ปมที่คลี่ออกได้เฉพาะตอนสนิทมากๆ — ถ้าไม่ได้ไปถึงตรงนั้น เทอมนี้ก็ผ่านไปโดยไม่รู้
  const deep: [string, string][] = [
    ["ploy_book", "ได้อ่านสมุดเล่มที่พลอยไม่เคยให้ใครอ่าน"],
    ["kanin_truth", "รู้แล้วว่าทำไมกนินถึงโดนหมายหัวมาตั้งแต่ ม.4"],
    ["kanin_cleared", "กนินได้ชื่อของตัวเองคืนมา"],
    ["minta_signed", "มินตราได้ขึ้นเล่นเป็นครั้งสุดท้ายก่อนจบ"],
    ["minta_key", "ได้กุญแจห้องดนตรีมาจากรุ่นพี่"],
  ];
  const found = deep.filter(([f]) => s.flags[f]).map(([, t]) => t);
  if (found.length) for (const t of found) lines.push(t);
  else lines.push("ไม่มีใครเล่าเรื่องที่เขาไม่เคยเล่าให้ใครฟังให้เราฟังเลยทั้งเทอม");

  if (closest && closestRank > 0)
    lines.push(`คนที่สนิทที่สุด: ${closest} (ความสัมพันธ์ระดับ ${closestRank})`);
  else lines.push("ผ่านไปทั้งเทอมโดยไม่สนิทกับใครเป็นพิเศษ");
  const top = (Object.entries(s.stats) as [StatId, number][])
    .sort((a, b) => b[1] - a[1])[0];
  lines.push(`สิ่งที่โดดเด่นที่สุด: ${game.stats.find((x) => x.id === top[0])!.name} ` +
             `ระดับ${game.statRankNames[statRank(top[1])]}`);

  const ending: Ending = {
    tier: tier.name, tone: tier.tone, score,
    closest, closestRank, behaviour: s.behaviour, club: club?.name ?? null, lines,
  };
  s.ending = ending;
  return ending;
}
