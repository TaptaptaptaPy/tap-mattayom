import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { termScore } from "./exam";
import { clubOf } from "./club";
import { homeLevel, homeName, homeOf } from "./home";
import { teacherName } from "./teacher";
import { standingLabel } from "./bonds";
import { gpa, gradeOf, bestWorst, SUBJECTS } from "./grades";
import { retakePenalty, retakeNames } from "./schoolwork";
import { isUni } from "./chapter";
import { affinityRank, statRank, trustRank, type Ending, type GameState, type StatId } from "./state";

const EN = game.entrance;

/** ปลายทางของปีหนึ่ง — ไม่ได้วัดว่าสอบติดที่ไหน แต่วัดว่ารอดมาได้ยังไง
 *  คำถามของภาคนี้ไม่ใช่ "เก่งแค่ไหน" แต่เป็น "เหลืออะไรอยู่บ้างตอนเทอมจบ" */
export function computeUniEnding(s: GameState): Ending {
  const g = gpa(s);
  const bw = bestWorst(s);
  const closest = pickClosest(s);
  const broke = s.debt > 0;

  const score = Math.round(
    (g / 4) * 55 + Math.min(25, s.standing * 0.25) +
    (broke ? 0 : 12) + Math.min(8, (closest?.value ?? 0) * 0.2));

  const tier =
    g >= 3.2 && !broke ? "ผ่านปีหนึ่งมาได้แบบที่ไม่ต้องอธิบายใคร"
    : g >= 2.0 && !broke ? "ผ่านมาได้ แบบที่ไม่มีใครถามว่าผ่านมายังไง"
    : g >= 2.0 ? "ผ่านมาได้ แต่ยังติดหนี้ค่าหออยู่"
    : g >= 1.0 ? "รอดมาได้แบบเฉียดฉิว ต้องซ่อมหลายวิชา"
    : "ปีหนึ่งที่ไม่ผ่านอะไรเลยสักอย่าง";

  const tone =
    broke ? "เงินหมดก่อนเทอมจบ และนั่นคือสิ่งที่จำได้มากที่สุด"
    : g >= 3.2 ? "ไม่มีใครที่บ้านรู้ว่ามันยากแค่ไหน และเราก็ไม่ได้เล่า"
    : "ปีแรกผ่านไปแล้ว และเราไม่เหมือนคนที่ลงรถทัวร์วันนั้นอีกต่อไป";

  const lines: string[] = [];
  if (s.schoolEnding) lines.push(`มาจาก: ${s.schoolEnding.tier}`);
  lines.push(`เกรดเฉลี่ยปีหนึ่ง ${g.toFixed(2)}` +
    ` · ${SUBJECTS.map((x) => `${x.short}${gradeOf(s.grades[x.id] ?? 0).name}`).join(" ")}`);
  if (bw) lines.push(`แข็ง${bw.best.name} อ่อน${bw.worst.name}`);
  lines.push(broke ? `ติดหนี้ค่าหอ ${Math.round(s.debt)} บาท` : `จบเทอมโดยไม่ติดหนี้ใคร`);
  lines.push(`เงินเหลือ ${Math.round(s.money)} บาท`);
  lines.push(s.inspected === 0 ? "ที่นี่ไม่มีใครตรวจทรงผม และไม่มีใครสนใจว่าเราตัดหรือยัง"
                               : `ยังติดนิสัยกลัวโดนเรียกหน้าแถวอยู่`);
  if (closest && closest.rank > 0)
    lines.push(`คนที่สนิทที่สุดในมหาลัย: ${closest.name} (ระดับ ${closest.rank})`);
  else lines.push("ผ่านปีหนึ่งมาโดยไม่สนิทกับใครเป็นพิเศษ");

  const deep: [string, string][] = [
    ["tar_key", "ได้กุญแจห้องชุมนุมมาจากรุ่นพี่"],
    ["tar_quit", "รู้ก่อนคนอื่นว่าต้าร์จะไม่ลงทะเบียนเทอมหน้า"],
    ["nun_tutored", "ติวแคลฯ ให้นุ่นจนเธอสอบผ่าน"],
    ["nun_stayed", "เป็นเหตุผลที่นุ่นไม่ขึ้นรถทัวร์กลับบ้านเดือนนั้น"],
    ["u_spoke_up", "เป็นคนที่พูดขัดรุ่นพี่กลางห้องเชียร์"],
    ["u_walked_out", "พาเพื่อนเดินออกจากห้องเชียร์"],
  ];
  for (const [f, t] of deep) if (s.flags[f]) lines.push(t);

  const ending: Ending = {
    tier, tone, score,
    closest: closest?.name ?? null, closestRank: closest?.rank ?? 0,
    behaviour: s.behaviour, club: clubOf(s)?.name ?? null, lines,
  };
  s.ending = ending;
  return ending;
}

/** คนที่ไว้ใจเรามากที่สุด — มักไม่ใช่คนเดียวกับคนที่สนิทที่สุด
 *  ซึ่งเป็นประเด็นทั้งหมดของการแยกสองแกนนี้ออกจากกัน */
function pickTrusting(s: GameState) {
  let best: { name: string; rank: number } | null = null;
  for (const c of chars) {
    const r = trustRank(s.trust[c.id] ?? 0);
    if (r >= 3 && (!best || r > best.rank)) best = { name: c.name, rank: r };
  }
  return best;
}

function pickClosest(s: GameState) {
  let best: { name: string; value: number; rank: number } | null = null;
  for (const c of chars) {
    const v = s.affinity[c.id] ?? 0;
    if (!best || v > best.value) best = { name: c.name, value: v, rank: affinityRank(v) };
  }
  return best;
}

/** ปลายทางของเทอม: สอบเข้ามหาลัย + สรุปว่าเทอมนี้ผู้เล่นเป็นคนแบบไหน */
export function computeEnding(s: GameState): Ending {
  if (isUni(s)) return computeUniEnding(s);
  const exams = termScore(s);
  const behaviour = (s.behaviour / game.behaviour.start) * 100;
  const club = clubOf(s);
  const clubScore = club ? Math.min(100, (s.stats[club.stat as StatId] / 60) * 100) : 0;
  const statAvg = Object.values(s.stats).reduce((a, b) => a + b, 0) / 5;
  const statScore = Math.min(100, (statAvg / 55) * 100);

  // ครูประจำชั้นเขียนหนังสือรับรองให้ — ในระบบจริงนี่คือเกณฑ์หนึ่งที่มีน้ำหนักจริง
  const teacherScore = s.teacher;
  // ผลงานที่เป็นชิ้นเป็นอัน ไม่ใช่แค่ค่าสถานะที่ได้จากการไปซ้อม
  // `clubScore` วัดว่าเราเก่งขึ้นแค่ไหน · อันนี้วัดว่าเคยทำอะไรให้ใครเห็นบ้าง
  const folioScore = s.milestoneDone
    ? (s.flags["milestone_won"] ? 100 : s.flags["milestone_flopped"] ? 25 : 60) : 0;
  // บ้านที่มีเรื่องไม่ได้ทำให้เราเป็นคนไม่ดี มันทำให้เราอ่านหนังสือไม่ออก — จึงเป็นตัวหัก
  const homePenalty = Math.min(1, homeOf(s).strain / game.home.strainMax) * EN.homePenalty;

  // ชื่อเสียงคือสิ่งที่คนที่ไม่รู้จักเราใช้ตัดสินเรา — กรรมการสอบสัมภาษณ์ก็เป็นคนกลุ่มนั้น
  const carried = EN.behaviourWeight + EN.clubWeight + EN.statWeight + EN.standingWeight +
                  EN.gpaWeight + EN.teacherWeight + EN.folioWeight;
  const score = Math.max(0, Math.round(
    exams * (1 - carried) +
    behaviour * EN.behaviourWeight +
    clubScore * EN.clubWeight +
    statScore * EN.statWeight +
    s.standing * EN.standingWeight +
    (gpa(s) / 4) * 100 * EN.gpaWeight +
    teacherScore * EN.teacherWeight +
    folioScore * EN.folioWeight -
    homePenalty));

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
  const g = Math.max(0, gpa(s) - retakePenalty(s));
  const bw = bestWorst(s);
  if (s.retakes.length)
    lines.push(`ยังติดซ่อม ${retakeNames(s).join(" ")} — เกรดเฉลี่ยโดนหักไป ${retakePenalty(s).toFixed(2)}`);
  lines.push(`เกรดเฉลี่ย ${g.toFixed(2)}` +
    (bw ? ` · ${SUBJECTS.map((x) => `${x.short}${gradeOf(s.grades[x.id] ?? 0).name}`).join(" ")}` : ""));
  if (bw && (s.grades[bw.best.id] ?? 0) - (s.grades[bw.worst.id] ?? 0) > 12)
    lines.push(`แข็ง${bw.best.name} อ่อน${bw.worst.name}`);
  lines.push(`ชื่อเสียงในโรงเรียน: ${standingLabel(s.standing)} (${Math.round(s.standing)})`);
  lines.push(`ครูประจำชั้น: ${teacherName(s)} (${Math.round(s.teacher)})`);
  if (s.milestoneDone)
    lines.push(`งานใหญ่ของชมรม: ${s.flags["milestone_won"] ? "ทำได้ดีจนมีคนพูดถึง"
      : s.flags["milestone_flopped"] ? "ผ่านไปโดยไม่มีใครจำ" : "ผ่านไปได้"}` +
      ` (ไปซ้อมมา ${s.clubDays} ครั้ง)`);
  else if (club) lines.push("งานใหญ่ของชมรม: ไม่ได้ขึ้นเวที");
  if (homeOf(s).gave > 0)
    lines.push(`ส่งเงินให้ที่บ้าน ${homeOf(s).gave} รอบ รวม ${homeOf(s).given} บาท`);
  if (homeLevel(s) > 0) lines.push(`ที่บ้าน: ${homeName(s)}`);
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
  const trusting = pickTrusting(s);
  if (trusting && trusting.name !== closest)
    lines.push(`คนที่ไว้ใจเรามากที่สุดคือ${trusting.name} ซึ่งไม่ใช่คนเดียวกับคนที่สนิทที่สุด`);
  else if (trusting) lines.push(`${trusting.name}ทั้งสนิทและไว้ใจเรา — ซึ่งเกิดขึ้นไม่บ่อย`);
  else lines.push("ไม่มีใครไว้ใจเรามากพอจะฝากเรื่องสำคัญไว้");

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
