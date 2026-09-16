import locations from "../../data/locations.json";
import chars from "../../data/characters.json";
import game from "../../data/game.json";
import { isLocked, isSchoolDay, periodId } from "./calendar";
import { applyStat, canAfford, maxEnergy } from "./economy";
import { signalAt, whoIsAt, type PlaceSignal } from "./presence";
import { trait } from "./traits";
import { rollCatch, inTrouble, type Rnd } from "./discipline";
import { canPush, dozeOff, push, whyNoPush } from "./push";
import { clubToday } from "./club";
import { studyAll, gradePerClass } from "./grades";
import { inspect } from "./grooming";
import { chapterOf, inChapter } from "./chapter";
import { remember, type GameState, type StatId } from "./state";

type RawLocation = (typeof locations)[number];

export interface LocationOption {
  id: string; name: string; icon: string;
  school?: boolean; risky?: boolean; catchBase?: number; subjectPick?: boolean; haircut?: boolean;
  action?: { label: string; stat: StatId; gain: number; energy: number; study?: number;
             cost?: number; /** ทำงานพิเศษแล้วได้เงิน — กริยาใหม่ของภาคมหาลัย */ pay?: number };
  rest?: { label: string; energy: number };
  club?: { label: string; name: string };
  /** ใครอยู่ตรงนั้นจริงๆ ตอนนี้ — **รู้ได้ต่อเมื่อเดินเข้าไปแล้วเท่านั้น**
   *  กระดานหน้าแรกอ่าน `signal` แทน ซึ่งบอกแค่เท่าที่ตามองเห็นจากระยะไกล */
  present: { id: string; name: string; color: string }[];
  /** เท่าที่มองเห็นจากตรงนี้ — ดู src/sim/presence.ts */
  signal: PlaceSignal;
  blocked?: string;
}

const LOCS = locations as RawLocation[];
const get = <T,>(o: object, k: string): T | undefined => (o as Record<string, T>)[k];

/** ที่ไหนไปได้บ้างในช่วงเวลานี้
 *
 *  **`present` ไม่ใช่ของที่กระดานหน้าแรกเอาไปโชว์ได้** — ใครอยู่ตรงไหนต้องเดินเข้าไปถึงจะรู้
 *  ฝั่ง UI ใช้ `signal` บนกระดาน แล้วค่อยเปิด `present` ตอนเข้าไปในที่นั้นจริง
 *  (ดูเหตุผลทั้งหมดใน src/sim/presence.ts) */
export function availableLocations(s: GameState): LocationOption[] {
  const period = periodId(s);
  const bonus = trait(s, "encounter", 0);
  if (isLocked(s)) {
    const roomId = chapterOf(s) === "uni" ? "lecture" : "classroom";
    const cls = LOCS.find((l) => l.id === roomId) ?? LOCS.find((l) => l.id === "classroom")!;
    return [{ ...cls, action: undefined, present: peopleAt(s, cls.id, period, bonus),
              signal: signalAt(s, cls.id, period, bonus) } as LocationOption];
  }
  const club = clubToday(s);
  return LOCS
    .filter((l) => inChapter(l as { chapter?: string }, chapterOf(s)))
    .filter((l) => l.periods.includes(period))
    // เสาร์อาทิตย์และวันหยุด โรงเรียนปิด — เดิมเข้าห้องสมุดได้ทุกวันไม่เว้น
    .filter((l) => !get<boolean>(l, "school") || isSchoolDay(s))
    .map((l) => {
      const o = { ...l, present: peopleAt(s, l.id, period, bonus),
                  signal: signalAt(s, l.id, period, bonus) } as LocationOption;
      if (get<boolean>(l, "risky") && inTrouble(s))
        o.blocked = "ครูปกครองสั่งห้ามเข้าแล้ว";
      if (club && club.location === l.id && period === "after")
        o.club = { label: `กิจกรรม${club.name}`, name: club.name };
      return o;
    });
}

/** ใครอยู่ตรงนั้นจริงๆ — `whoIsAt()` กรองภาคให้แล้ว เพื่อนมัธยมจึงไม่โผล่มาที่มหาลัย
 *  (แต่ยังทักไลน์มาได้ ซึ่งเป็นคนละเรื่องกันโดยตั้งใจ) */
function peopleAt(s: GameState, locId: string, period: string, bonus: number) {
  return whoIsAt(s, locId, period, bonus)
    .map((id) => chars.find((c) => c.id === id))
    .filter((c): c is (typeof chars)[number] => !!c)
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));
}

/** `ok` = ทำได้จริงไหม — เดิมฝั่ง UI เดาจากข้อความด้วย regex ซึ่งพังทันทีที่มีเหตุผลใหม่
 *  `forced` = ทำได้เพราะผู้เล่นเลือกฝืน */
export interface ActionResult {
  message: string; caught: string | null; penalty: number; ok: boolean; forced: boolean;
  /** ทำซ้ำในวันเดียวกัน ได้น้อยลง — ฝั่ง UI ใช้เลือกเสียง ไม่ต้องอ่านจากข้อความ */
  repeat: boolean;
}

/** `force` = ผู้เล่นกดยืนยันว่าจะฝืนทำทั้งที่แรงไม่พอ ดู src/sim/push.ts
 *  ฝั่ง UI ต้องถามก่อนเสมอ ห้ามฝืนให้เอง — ราคาของมันตกที่วันพรุ่งนี้ */
export function doAction(s: GameState, loc: LocationOption, rnd: Rnd = Math.random,
                         force = false): ActionResult | null {
  const a = loc.action;
  if (!a) return null;
  if (loc.blocked) return { message: loc.blocked, caught: null, penalty: 0, ok: false, forced: false, repeat: false };
  const why = canAfford(s, a.energy, a.cost ?? 0);
  // แรงไม่พอไม่ใช่กำแพงอีกแล้ว ถ้าผู้เล่นเลือกฝืน — แต่เงินไม่พอยังเป็นกำแพงอยู่
  const forcing = force && !!why && why !== "เงินไม่พอ" && canPush(s);
  if (why && !forcing) return { message: (force && whyNoPush(s)) || why, caught: null, penalty: 0, ok: false, forced: false, repeat: false };

  const times = s.doneToday[loc.id] ?? 0;
  // ฝืนแล้วได้ของน้อยลง — ลดที่ *ต้นทาง* ไม่ใช่ทำเต็มแล้วหักคืน เพราะ applyStat มีผลตอบแทนลดหลั่นในตัว
  const mult = forcing ? push(s) : 1;
  const got = applyStat(s, a.stat, a.gain * mult, times);
  s.energy = Math.max(0, Math.min(maxEnergy(s), s.energy + a.energy));
  if (a.cost) s.money -= a.cost;
  // ภูมิหลังที่เคยทำงานมาก่อนได้ค่าแรงมากกว่า — ของที่ทำให้เวลาหนึ่งช่วงมีค่าไม่เท่ากันในแต่ละรอบ
  const pay = a.pay ? Math.round(a.pay * trait(s, "pay", 1)) : 0;
  if (pay) s.money += pay;
  if (a.study) s.study += a.study * trait(s, "studyGain", 1);
  s.doneToday[loc.id] = times + 1;

  const nm = game.stats.find((x) => x.id === a.stat)!.name;
  let message = `${a.label} · ${nm} +${got.toFixed(1)}`;
  if (forcing) message += ` (ฝืน · หนี้การนอน ${Math.round(s.sleepDebt)})`;
  if (times > 0) message += " (ทำซ้ำวันนี้ ได้น้อยลง)";
  if (a.cost) message += ` · -${a.cost} บาท`;
  if (pay) message += ` · +${pay} บาท`;

  let caught: string | null = null, penalty = 0;
  if (loc.risky && loc.catchBase) {
    const r = rollCatch(s, loc.catchBase, rnd);
    if (r.caught) { caught = r.message; penalty = r.penalty; }
  }
  return { message, caught, penalty, ok: true, forced: forcing, repeat: times > 0 };
}

export function doRest(s: GameState, loc: LocationOption): string | null {
  if (!loc.rest) return null;
  s.energy = Math.min(maxEnergy(s), s.energy + loc.rest.energy);
  return `${loc.rest.label} · แรง +${loc.rest.energy}`;
}

/** คาบเรียนเช้า: เข้าแถวหน้าเสาธงแล้วเรียน — เดิมมีแค่ปุ่ม "ผ่านคาบไป" เฉยๆ */
/** เข้าแถวแล้วโดนตรวจ — คืนข้อความถ้าโดน ไม่งั้นคืน null */
export function morningInspect(s: GameState, rnd: Rnd = Math.random) {
  return inspect(s, rnd);
}

export function attendClass(s: GameState, rnd: Rnd = Math.random): string {
  // อดนอนมาหลายคืนแล้วนั่งอยู่ในคาบ — บางทีก็หลับ คาบนั้นเสียเปล่าและครูเห็น
  const doze = dozeOff(s, rnd);
  if (doze) { s.doneToday["_class"] = (s.doneToday["_class"] ?? 0) + 1; return doze; }
  const got = applyStat(s, "mind", 2, s.doneToday["_class"] ?? 0);
  s.doneToday["_class"] = (s.doneToday["_class"] ?? 0) + 1;
  s.study += 2;
  // เข้าเรียนหนึ่งคาบได้ทุกวิชานิดหน่อย วิชาที่ตรงกับค่าสถานะที่เราแข็งจะได้มากกว่า
  studyAll(s, gradePerClass);
  return `ตั้งใจเรียน · ปัญญา +${got.toFixed(1)}`;
}

export function skipClass(s: GameState, rnd: Rnd = Math.random): ActionResult {
  const got = applyStat(s, "nerve", 4, 0);
  const r = rollCatch(s, 0.34, rnd);
  if (!r.caught) remember(s, "โดดคาบเรียนแล้วรอด");
  return { message: `โดดคาบ · ความซ่า +${got.toFixed(1)}`, caught: r.message, penalty: r.penalty,
           ok: true, forced: false, repeat: false };
}
