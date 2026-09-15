import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { termScore } from "./exam";
import { clubOf } from "./club";
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

  const score = Math.round(
    exams * (1 - EN.behaviourWeight - EN.clubWeight - EN.statWeight) +
    behaviour * EN.behaviourWeight +
    clubScore * EN.clubWeight +
    statScore * EN.statWeight);

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
