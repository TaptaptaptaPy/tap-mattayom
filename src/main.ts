import "./style.css";
import game from "../data/game.json";
import chars from "../data/characters.json";
import locations from "../data/locations.json";
import game2 from "../data/game.json";
import { newState, statRank, affinityRank, trustRank, remember,
         type GameState, type StatId } from "./sim/state";
import { advance, dateLabel, eventNow, isLocked, isTermOver, daysLeft, isSchoolDay,
         nextEvent, periodId, termDays, type TermEvent } from "./sim/calendar";
import { availableLocations, doAction, doRest, attendClass, skipClass,
         morningInspect, type LocationOption } from "./sim/actions";
import { apptSpot, bumpInto, hasMet, noteEncounter } from "./sim/presence";
import { applyBackground, backgroundOf, maxEnergy } from "./sim/background";
import { clubToday, doClubActivity, joinClub, clubOf } from "./sim/club";
import { takeExam } from "./sim/exam";
import { postBoard, tutor } from "./sim/board";
import { debtName, energyLowFor, isSick, whyNoPush } from "./sim/push";
import { computeEnding } from "./sim/ending";
import { epilogues, selfEpilogue } from "./sim/epilogue";
import { behaviourLabel } from "./sim/discipline";
import { buy, use, gift } from "./sim/shop";
import { escapeCatch } from "./sim/discipline";
import { openMinigame, type MgKind } from "./ui/minigame";
import { milestoneToday, runMilestone } from "./sim/milestone";
import { seenWith } from "./sim/seen";
import { askAmount, giveHome, homeLevel, homeName, refuseHome } from "./sim/home";
import { teacherLevel, teacherName } from "./sim/teacher";
import { concede } from "./sim/rival";
import { offerChat, offerSecondChat, recordThread, acceptInvite, planToday, plansToday, planClash,
         keepPlan, isPlanPeriod,
         nameOf } from "./sim/chat";
import { hasHomework, doHomework } from "./sim/homework";
import { studyOne, subjectById } from "./sim/grades";
import { haircut, needsHaircut, groomingLabel } from "./sim/grooming";
import { hasRetake, retakeNames, retakeCost, doRetake, projectPartner, projectName,
         projectNeeded, workProject, assignProject } from "./sim/schoolwork";
import { startUni, isUni, chapterName, chapterDef, rentPerWeek } from "./sim/chapter";
import { changeAffinity, changeTrust, trustFromFlag, shiftStanding, takeSide,
         standingLabel } from "./sim/bonds";
import { takeNews, visited } from "./sim/offscreen";
import { claim } from "./sim/claims";
import { unlock as unlockAudio, sfx, setMuted, isMuted } from "./core/audio";
import { Bgm } from "./core/bgm";
import { openScene, storyNames } from "./story/bridge";
import { playChat, viewThread, chatListPanel } from "./ui/chat";
import { playScene, setMood, setSpeaker, showHint } from "./ui/scene";
import { applyTheme, periodStrip } from "./ui/theme";
import { icon } from "./ui/icons";
import { trait } from "./sim/traits";
import { backdrop, eventBackdrop } from "./ui/backdrop";
import { portraitHTML } from "./ui/portrait";
import * as P from "./ui/panels";
import { clearSlot, migrateOld, readSlot, slotMeta, writeSlot, SLOTS, type SlotId } from "./core/save";
import { asset } from "./core/asset";

migrateOld();
const loaded = readSlot("auto")?.state ?? null;
let s: GameState = loaded ?? newState();
/** เซฟเดิมไม่มี = เกมรอบใหม่ ต้องเลือกภูมิหลังก่อนถึงจะเริ่มได้ */
const isFreshStart = !loaded;
const $ = (id: string) => document.getElementById(id)!;

// ───────────────────────── แถบบน ─────────────────────────

/** ค่าที่โชว์อยู่บนแถบบนรอบที่แล้ว — ใช้หาว่าอะไรเพิ่งเปลี่ยน
 *  เดิมตัวเลขเปลี่ยนเงียบๆ ผู้เล่นจึงไม่รู้ว่าสิ่งที่เพิ่งทำไปให้ผลอะไร */
let lastChips: Record<string, number> = {};

/** ชิปไหนที่ค่าขยับ ให้เด้งและลอยส่วนต่างขึ้นมา
 *
 *  อ่านจาก `data-k` / `data-v` ที่ชิปประกาศไว้เอง ไม่ใช่จากข้อความบนจอ
 *  ของเดิมแกะตัวเลขจากข้อความใน `<b>` ซึ่งชิปค่าสถานะโชว์เป็น *ชื่อระดับ* ("พอไหว")
 *  `Number("")` คืน 0 ไม่ใช่ NaN ค่าสถานะทั้งห้าตัวจึงอ่านได้ 0 เท่ากันตลอดทั้งเกม
 *  แล้วเงื่อนไข "ค่าเดิมเท่าค่าใหม่" ก็เป็นจริงทุกครั้ง — **ค่าที่สำคัญที่สุดห้าตัว
 *  ไม่เคยกระพริบเลยสักครั้งเดียว** ทั้งที่ทั้งระบบถูกสร้างมาเพื่อบอกว่าอะไรเพิ่งเปลี่ยน */
function markChanged() {
  const now: Record<string, number> = {};
  const chips = [...document.querySelectorAll<HTMLElement>("#stats .gauge")];
  const first = Object.keys(lastChips).length === 0;
  for (const c of chips) {
    const key = c.dataset.k ?? "";
    const v = Number(c.dataset.v ?? NaN);
    if (!key || Number.isNaN(v)) continue;
    now[key] = v;
    if (first || !(key in lastChips) || lastChips[key] === v) continue;
    const diff = v - lastChips[key];
    c.classList.add("is-changed");
    const d = document.createElement("span");
    d.className = "delta " + (diff > 0 ? "up" : "down");
    d.textContent = (diff > 0 ? "+" : "") + Math.round(diff * 10) / 10;
    c.appendChild(d);
    setTimeout(() => { c.classList.remove("is-changed"); d.remove(); }, 1200);
  }
  lastChips = now;
}

/** แถบบนเคยเป็นกำแพงตัวหนังสือล้วน สิบกว่าชิ้นหน้าตาเหมือนกันหมด ต่างแค่คำข้างใน
 *  ผู้เล่นต้อง *อ่าน* ทั้งแถบทุกครั้งเพื่อหาว่าอะไรเปลี่ยน ซึ่งช้ากว่าการมองเห็นมาก
 *
 *  ตอนนี้แบ่งเป็นสามชั้นตามคำถามที่มันตอบ:
 *  - **เกจ** ค่าสถานะห้าตัว แรง เงิน — ไอคอน + หลอด อ่านด้วยตาไม่ต้องอ่านด้วยคำ
 *  - **เรื่องที่ไล่หลังอยู่** บ้านตึง หนี้การนอน ผมยาว การบ้านค้าง — โผล่เฉพาะตอนมีจริง
 *  - **ของที่ค่อยๆ ขยับทั้งเทอม** ครู ความประพฤติ ชื่อเสียง ชมรม — พับเก็บได้ */
let statsOpen = false;

/** หนึ่งเกจ: ไอคอน + หลอด + ตัวเลข — กวาดตาเจอได้โดยไม่ต้องอ่าน */
function gauge(o: { k: string; icon: string; name: string; pct: number; value: string;
                    v: number; tone?: string; title: string }) {
  return `<span class="gauge ${o.tone ?? ""}" data-k="${o.k}" data-v="${o.v}" title="${o.title}">
    <span class="gico">${icon(o.icon)}</span>
    <span class="gbody"><span class="gname">${o.name}</span>
      <span class="gbar"><i style="width:${Math.max(0, Math.min(100, o.pct))}%"></i></span></span>
    <b>${o.value}</b></span>`;
}

function renderTop() {
  applyTheme(s);
  const club = clubOf(s);
  // แยกเป็นชิ้นๆ แล้วห้ามตัดคำกลางชิ้น ไม่งั้นบนจอมือถือจะได้ "กลาง / คืน" คนละบรรทัด
  const parts = dateLabel(s).split(" · ");
  if (isLocked(s)) parts.push("คาบเรียน");
  $("date").innerHTML = parts.map((p) => `<span class="dseg">${p}</span>`).join('<i class="dsep">·</i>');
  $("periodStrip").innerHTML = periodStrip(s);
  const bg = backgroundOf(s);
  $("chapter").textContent = chapterName(s) + " · " + chapterDef(s).sub +
    (bg ? " · " + bg.name : "");

  // เทอมเดินไปถึงไหนแล้ว — เส้นเดียวใต้หัวข้อ ตอบคำถาม "เหลือเวลาอีกเท่าไหร่" ด้วยตา
  const gone = s.dayIndex / Math.max(1, termDays(s));
  $("termBar").innerHTML =
    `<i style="width:${Math.min(100, gone * 100)}%"></i>` +
    `<em>วันที่ ${s.dayIndex + 1} / ${termDays(s)} · เหลืออีก ${daysLeft(s)} วัน</em>`;

  const chatBtn = $("bChat");
  chatBtn.classList.toggle("is-unread", !!s.pendingChat);
  chatBtn.innerHTML = s.pendingChat ? 'ไลน์<span class="badge">1</span>' : "ไลน์";

  const ladder = game2.statRanks;
  const top = ladder[ladder.length - 1];

  // หลอดบอก "มาไกลแค่ไหนจากศูนย์ถึงตำนาน" ไม่ใช่ "ใกล้ระดับถัดไปแค่ไหน"
  // เพราะห้าเกจนี้อยู่ติดกันเพื่อให้ *เทียบกันเอง* — ถ้าแต่ละอันวัดจากฐานคนละอัน
  // ค่าที่เพิ่งขึ้นระดับใหม่จะดูแย่กว่าค่าที่ค้างอยู่ท้ายระดับเดิม ซึ่งกลับหัว
  let now = game.stats.map((st) => {
    const v = s.stats[st.id as StatId];
    const r = statRank(v);
    const next = ladder[Math.min(r + 1, ladder.length - 1)];
    const more = r >= ladder.length - 1 ? "สูงสุดแล้ว"
      : `อีก ${Math.ceil(next - v)} ถึง "${game.statRankNames[r + 1]}"`;
    return gauge({ k: st.id, icon: st.id, name: st.name, pct: (v / top) * 100,
      value: `${r}/${ladder.length - 1}`, v, tone: "stat",
      title: `${st.name} — ${st.desc}\n${game.statRankNames[r]} · ${more}` });
  }).join("");

  const eMax = maxEnergy(s);
  now += gauge({ k: "energy", icon: "energy", name: "แรง", pct: (s.energy / eMax) * 100,
    value: String(Math.round(s.energy)), v: Math.round(s.energy),
    tone: s.energy < game.energy.lowThreshold ? "energy low" : "energy",
    title: `แรงที่เหลือวันนี้ · เต็มของเราคือ ${eMax}` });
  now += `<span class="gauge flat money" data-k="money" data-v="${Math.round(s.money)}"
      title="เงินในกระเป๋า"><span class="gico">${icon("money")}</span>
      <b>${Math.round(s.money)}</b></span>`;

  // เรื่องที่กำลังไล่หลังอยู่ — โผล่เฉพาะตอนที่มันมีจริง ไม่งั้นแถบบนจะเต็มไปด้วยศูนย์
  const alerts: string[] = [];
  const alert = (k: string, ic: string, name: string, value: string, v: number,
                 title: string, hot = false) =>
    alerts.push(`<span class="gauge flat alert${hot ? " hot" : ""}" data-k="${k}" data-v="${v}"
      title="${title}"><span class="gico">${icon(ic)}</span>
      <span class="gname">${name}</span><b>${value}</b></span>`);

  if (homeLevel(s) > 0)
    alert("home", "home", "บ้าน", homeName(s), homeLevel(s),
      "เรื่องที่บ้านกินแรงที่ควรได้คืนตอนนอน และกดค่าขนมลง", homeLevel(s) >= 2);
  if (s.sleepDebt > 0)
    alert("sleepDebt", "sleep", "นอน", debtName(s), Math.round(s.sleepDebt),
      "ฝืนมาแล้วกี่ครั้ง — ไปหักแรงที่ควรได้คืนตอนเช้า", s.sleepDebt >= game.push.dozeAt);
  if (needsHaircut(s))
    alert("grooming", "barber", "ทรงผม", String(Math.round(s.grooming)), Math.round(s.grooming),
      `${groomingLabel(s.grooming)} — เสี่ยงโดนเรียกหน้าแถว`);
  if (s.homework > 0)
    alert("homework", "duty", "การบ้าน", `${s.homework} ชิ้น`, s.homework,
      "ไม่ส่งเช้าวันเปิดเรียนถัดไป ครูหักคะแนนความประพฤติ");
  if (isUni(s) && s.debt > 0)
    alert("debt", "money", "หนี้", String(Math.round(s.debt)), Math.round(s.debt),
      "ยืมเขามาเพราะจ่ายค่าหอไม่ไหว", true);

  // ของที่ค่อยๆ ขยับทั้งเทอม — พับเก็บได้ เพราะไม่ใช่ของที่ต้องอ่านทุกช่วงเวลา
  let slow = gauge({ k: "teacher", icon: "teacher", name: "ครู", pct: s.teacher,
    value: teacherName(s), v: Math.round(s.teacher),
    tone: teacherLevel(s) === 0 ? "low" : "",
    title: "ครูประจำชั้นมองเรายังไง — ขยับจากการส่งงาน ตัดผม ไปสอบซ่อม และการโดนจับ" });
  slow += gauge({ k: "behaviour", icon: "behaviour", name: "ความประพฤติ", pct: s.behaviour,
    value: String(Math.round(s.behaviour)), v: Math.round(s.behaviour),
    tone: s.behaviour < game.behaviour.troubleAt ? "low" : "",
    title: behaviourLabel(s.behaviour) });
  // ความประพฤติเป็นของฝ่ายปกครอง ชื่อเสียงเป็นของทั้งโรงเรียน คนละอย่างกัน
  slow += gauge({ k: "standing", icon: "standing", name: "ชื่อเสียง", pct: s.standing,
    value: String(Math.round(s.standing)), v: Math.round(s.standing),
    title: standingLabel(s.standing) });
  if (isUni(s))
    slow += `<span class="gauge flat" title="ค่าหอค่ากินรายสัปดาห์">
      <span class="gico">${icon("dorm")}</span><span class="gname">ค่าหอ</span>
      <b>${rentPerWeek}</b></span>`;
  if (club)
    slow += `<span class="gauge flat club" title="${club.blurb}">
      <span class="gico">${icon(club.id)}</span><span class="gname">ชมรม</span>
      <b>${club.name}</b></span>`;

  $("stats").innerHTML =
    `<div class="gaugerow">${now}<button class="gauge more" id="bMore"
       aria-expanded="${statsOpen}" title="ของที่ค่อยๆ ขยับทั้งเทอม">${statsOpen ? "ย่อ" : "···"}</button></div>` +
    (alerts.length ? `<div class="gaugerow alerts">${alerts.join("")}</div>` : "") +
    `<div class="gaugerow slow${statsOpen ? "" : " hidden"}">${slow}</div>`;
  $("bMore").onclick = () => { statsOpen = !statsOpen; renderTop(); };
  // แตะเกจไหนก็ได้เพื่อเปิดหน้าสถานะเต็ม — ที่ที่ชื่อระดับกับคำอธิบายมีที่ให้เขียนเป็นคำ
  $("stats").querySelectorAll<HTMLElement>(".gauge:not(.more)").forEach((g) =>
    (g.onclick = () => P.statusPanel(s)));
  markChanged();
}

/** การ์ดบอกวันใหม่ — ทำให้รู้สึกว่าวันหนึ่งจบลงจริง ไม่ใช่ตัวเลขขยับเฉยๆ */
let lastDayShown = -1;
function maybeDayCard() {
  if (s.dayIndex === lastDayShown) return;
  const first = lastDayShown === -1;
  lastDayShown = s.dayIndex;
  if (first) return;
  sfx.day();
  const el = $("daycard");
  el.innerHTML = `<div><b>${dateLabel(s).split(" · ")[0]}</b>
    <small>วันที่ ${s.dayIndex + 1} จาก ${game.term.days}</small></div>`;
  el.classList.remove("hidden");
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1150);
  setTimeout(() => el.classList.add("hidden"), 1650);
}

// ───────────────────────── กระดานของวัน ─────────────────────────

/** ที่ที่กำลังยืนอยู่ตอนนี้ — null คือกำลังกวาดตาดูว่าจะไปไหน
 *
 *  กระดานกับ "ข้างในที่นั้น" ถูกแยกออกจากกันด้วยเหตุผลเดียว:
 *  **ใครอยู่ตรงไหนต้องเดินเข้าไปถึงจะรู้** ของเดิมกระดานเขียนชื่อทุกคนไว้ตั้งแต่ก่อน
 *  ลุกจากโต๊ะ การเจอกันจึงไม่เคยเป็นการเจอ มันคือการไปเบิกคนจากช่องที่รู้อยู่แล้ว
 *
 *  เดินเข้าไปดูไม่เสียเวลา (เดินดูรอบโรงเรียนไม่ใช่กิจกรรม)
 *  เสียเวลาต่อเมื่อ *ลงมือทำอะไรสักอย่าง* ซึ่งรวมถึงการเข้าไปทัก */
let placeOpen: string | null = null;

/** ทำแบบไม่ลงแรงได้เท่าไหร่ของการตั้งใจทำ
 *  ภาระสามอย่าง (การบ้าน สอบซ่อม งานกลุ่ม) เกิดขึ้นเกือบทุกวันตลอด 120 วัน
 *  ถ้าบังคับเล่นมินิเกมทุกครั้ง ของที่ควรสนุกจะกลายเป็นภาษีที่เก็บทุกคืน
 *  จึงให้เลือกได้เสมอว่าจะลงแรงหรือทำให้มันจบๆ — และการเลือกนั้นมีราคาที่วัดได้ */
const SKIP_YIELD = 0.8;

/** ช่วงเวลาที่กระดานชุดปัจจุบันถูกสร้างขึ้นมา — ใช้บอกว่าเมื่อไหร่ควรไล่การ์ดขึ้นใหม่ */
let boardStamp = "";

const locName = (id: string) =>
  (locations as { id: string; name: string }[]).find((l) => l.id === id)?.name ?? id;

function renderBoard() {
  const board = $("board");
  board.innerHTML = "";
  // ไล่การ์ดขึ้นทีละใบเฉพาะตอนขึ้นช่วงเวลาใหม่ ไม่ใช่ทุกครั้งที่วาดซ้ำ
  // ถ้าไล่ทุกครั้ง การกดปุ่มหนึ่งทีจะทำให้ทั้งกระดานกระพริบ ซึ่งกวนกว่าไม่มีเลย
  const stamp = `${s.dayIndex}:${s.periodIndex}:${placeOpen ?? ""}`;
  const fresh = stamp !== boardStamp;
  boardStamp = stamp;
  board.classList.toggle("is-fresh", fresh);
  board.classList.toggle("is-place", !!placeOpen);

  if (isTermOver(s)) {
    const e = s.ending ?? computeEnding(s);
    board.innerHTML = `<div class="end"><b>${e.tier}</b>
      <small>คะแนนรวมทั้งเทอม ${e.score}</small>
      <button id="bSeeEnd">ดูสรุปเทอม</button>
      <button id="bSeeEpi">ดูปลายทางของแต่ละคน</button></div>`;
    $("bSeeEnd").onclick = () => P.endingPanel(e, P.closePanel);
    $("bSeeEpi").onclick = () => playEpilogues(() => renderBoard());
    return;
  }

  const locs = availableLocations(s);
  if (placeOpen) {
    const loc = locs.find((l) => l.id === placeOpen);
    if (loc) { renderPlace(board, loc, fresh); return; }
    placeOpen = null;          // ที่นั้นปิดไปแล้ว (ขึ้นช่วงเวลาใหม่) — กลับมาที่กระดาน
  }
  renderDuties(board);
  renderPlaceList(board, locs);
}

// ───────────────────────── ของที่ต้องทำก่อน ─────────────────────────

/** สามอย่างที่เกมยัดใส่มือ ไม่ใช่ของที่เลือกทำเอง — ต้องอยู่เหนือของที่เลือกได้เสมอ */
function renderDuties(board: HTMLElement) {
  // รับนัดไว้เมื่อคืนแล้วลืม = เสียความสัมพันธ์ฟรีๆ เตือนไว้ทั้งวันจนกว่าจะไป
  const plan = planToday(s);
  const clash = planClash(s);
  if (plan) {
    const pc = chars.find((c) => c.id === plan.charId);
    const spot = apptSpot(s);
    const note = document.createElement("div");
    note.className = "appt";
    const others = plansToday(s).slice(1)
      .map((p) => chars.find((c) => c.id === p.charId)?.name ?? p.charId);
    note.innerHTML = `<span class="avatar sm">${portraitHTML(plan.charId)}</span>
      <span class="apptText"><b style="color:${pc?.color ?? "#fff"}">${pc?.name ?? plan.charId}</b>
      ${isPlanPeriod(s)
        ? `รออยู่ที่${spot ? locName(spot.loc) : "ที่นัดไว้"}แล้ว`
        : "นัดไว้ช่วงหลังเลิกเรียนวันนี้"}`
      + (clash > 1
        ? `<i class="clash">รับ${others.join(" กับ ")}ไว้ช่วงเดียวกันด้วย — ไปได้คนเดียว</i>`
        : "") + "</span>";
    board.appendChild(note);
  }

  // สอบซ่อมมาก่อนทุกอย่าง เพราะมันคือหนี้ที่ติดไปถึงฉากจบถ้าไม่จัดการ
  if (hasRetake(s)) {
    const card = duty("exam", `ติดซ่อม ${retakeNames(s).join(" · ")}`,
      `ไม่ซ่อมก็ติด 0 · เกรดเฉลี่ยตอนจบโดนหักวิชาละ ${game.retake.gpaPenaltyPerFail}`);
    for (const id of [...s.retakes]) {
      const name = subjectById(id)?.name ?? id;
      const go = async (focus: number | null) => {
        // สอบซ่อมคือการกลับไปนั่งท่องของเดิม — ท่องมาจริงไหมมีผลกับคะแนนที่ได้คืน
        const f = focus ?? (0.6 + (await openMinigame("focus", 1)).score * 0.8);
        const msg = doRetake(s, id, f);
        const ok = !s.retakes.includes(id);
        flash(msg, ok ? "ok" : "bad");
        if (ok) { sfx.gain(); next(); } else { sfx.deny(); render(); }
      };
      const b1 = actBtn(`ท่องก่อนเข้าห้อง${name}`, [
        { icon: "money", text: `-${retakeCost}`, tone: "cost" },
        { icon: "energy", text: String(game.retake.energy), tone: "cost" },
        TIME_COST, { icon: "mind", text: "ได้คะแนนตามที่ท่องมา", tone: "gain" }]);
      b1.onclick = () => void go(null);
      card.acts.appendChild(b1);
      const b2 = actBtn(`เข้าไปนั่งสอบเฉยๆ`, [
        { icon: "money", text: `-${retakeCost}`, tone: "cost" },
        TIME_COST, { icon: "mind", text: "ผ่านแบบพอดีตัว" }]);
      b2.onclick = () => void go(SKIP_YIELD);
      card.acts.appendChild(b2);
    }
    board.appendChild(card.el);
  }

  // งานกลุ่ม — คู่ที่จับได้ ไม่ใช่คู่ที่เลือก
  const pj = projectPartner(s);
  if (pj) {
    const left = Math.max(0, projectNeeded - pj.done);
    const daysLeftPj = pj.due - s.dayIndex;
    const card = duty("academic", `งานกลุ่มกับ${projectName(s)} · เหลืออีก ${left} ครั้ง`,
      daysLeftPj >= 0
        ? `ส่งภายในอีก ${daysLeftPj} วัน · ไม่ทันแล้วหักความประพฤติกับชื่อเสียง`
        : "เลยกำหนดแล้ว");
    // คู่ที่จับได้คือคนที่สนิทน้อยที่สุดเสมอ — เรื่องทั้งหมดของมันคือการอ่านคนที่ยังอ่านไม่ออก
    const work = async (read: number | null) => {
      if (read === null) {
        const mgr = await openMinigame("talk", projectNeeded - pj.done <= 1 ? 2 : 1);
        flash(`${mgr.label} · ${mgr.detail}`);
        read = 0.6 + mgr.score * 0.8;
      }
      flash(workProject(s, read));
      sfx.gain();
      next();
    };
    const b1 = actBtn("นั่งคุยกับคู่จริงๆ", [
      { icon: "mind", text: "เกรดทุกวิชา +", tone: "gain" },
      { icon: "meet", text: "สนิทขึ้น", tone: "gain" }, TIME_COST]);
    b1.onclick = () => void work(null);
    card.acts.appendChild(b1);
    const b2 = actBtn("แบ่งงานแล้วต่างคนต่างทำ", [
      { icon: "mind", text: "เกรดทุกวิชา +", tone: "gain" },
      { icon: "meet", text: "ไม่ได้รู้จักเขาเพิ่ม" }, TIME_COST]);
    b2.onclick = () => void work(SKIP_YIELD);
    card.acts.appendChild(b2);
    board.appendChild(card.el);
  }

  if (hasHomework(s)) {
    const card = duty("library", `การบ้านค้างอยู่ ${s.homework} ชิ้น`,
      "ไม่ส่งเช้าวันเปิดเรียนถัดไป ครูหักคะแนนความประพฤติ");
    // ทำการบ้านเคยเป็นปุ่มที่กดแล้วจบ ตอนนี้เป็นการ *เลือก* ว่าจะลงแรงแค่ไหน
    // มินิเกมต้องเป็นของที่เลือกเล่น ไม่ใช่ด่านที่ต้องผ่านทุกคืนตลอด 120 วัน
    // ไม่งั้นของที่ควรสนุกจะกลายเป็นภาษีที่เก็บทุกคืน
    const doHw = async (focus: number | null) => {
      const canDo = s.homework > 0 && s.energy + game.homework.energy >= 0;
      if (focus === null && canDo) focus = 0.7 + (await openMinigame("focus", s.homework >= 3 ? 2 : 1)).score * 0.6;
      const msg = doHomework(s, focus ?? SKIP_YIELD);
      const ok = s.homework === 0;
      flash(msg, ok ? "ok" : "bad");
      if (ok) { sfx.homework(); next(); } else { sfx.deny(); render(); }
    };
    const b1 = actBtn("ตั้งใจนั่งทำ", [
      { icon: "mind", text: "ปัญญา + · ความพร้อมสอบ +", tone: "gain" },
      { icon: "energy", text: String(game.homework.energy), tone: "cost" }, TIME_COST]);
    b1.onclick = () => void doHw(null);
    card.acts.appendChild(b1);
    const b2 = actBtn("ลอกให้เสร็จๆ", [
      { icon: "mind", text: "ได้น้อยกว่า" },
      { icon: "energy", text: String(game.homework.energy), tone: "cost" }, TIME_COST]);
    b2.onclick = () => void doHw(SKIP_YIELD);
    card.acts.appendChild(b2);
    board.appendChild(card.el);
  }
}

function duty(iconId: string, title: string, warn: string) {
  const el = document.createElement("div");
  el.className = "loc wide hw duty";
  el.innerHTML = `<div class="nm"><span class="ico">${icon(iconId)}</span>${title}</div>`;
  const acts = document.createElement("div");
  acts.className = "acts";
  el.appendChild(acts);
  const w = document.createElement("div");
  w.className = "warn";
  w.textContent = warn;
  el.appendChild(w);
  return { el, acts };
}

/** ราคาหรือผลของการกดปุ่มหนึ่งครั้ง — ไอคอน + ตัวเลข
 *  ของเดิมเป็นข้อความยาวเส้นเดียว "ความพร้อมสอบ + · ปัญญา + · แรง -10"
 *  ซึ่งต้องอ่านทั้งบรรทัดถึงจะรู้ว่าแพงแค่ไหน · ชิปแยกอ่านได้ทีละชิ้นด้วยตา */
type Cost = { icon: string; text: string; tone?: "cost" | "gain" | "time" };
function costChips(cs: Cost[]): string {
  return `<span class="costs">${cs.map((c) =>
    `<span class="cost ${c.tone ?? ""}">${icon(c.icon)}${c.text}</span>`).join("")}</span>`;
}

function actBtn(label: string, costs: Cost[] | string, cls = "act") {
  const b = document.createElement("button");
  b.className = cls;
  const body = typeof costs === "string"
    ? `<em>${costs}</em>`
    : costChips(costs);
  b.innerHTML = `<span class="alab">${label}</span>${body}`;
  return b;
}

/** หนึ่งช่วงเวลาคือทรัพยากรที่แพงที่สุดในเกม และไม่เคยมีอะไรบอกเลยว่ามันถูกใช้ไป */
const TIME_COST: Cost = { icon: "time", text: "1 ช่วง", tone: "time" };

// ───────────────────────── จะไปไหน ─────────────────────────

/** สิ่งที่ตามองเห็นจากตรงนี้ — ไม่ใช่รายชื่อคน
 *  ดูเหตุผลใน src/sim/presence.ts: เห็นว่ามีคนได้ แต่จะรู้ว่าเป็นใครต้องเข้าไปใกล้ */
function signalHTML(sig: LocationOption["signal"]): string {
  if (sig.kind === "known")
    return sig.ids.map((id) => {
      const c = chars.find((x) => x.id === id);
      return `<span class="sig is-known" style="--who:${c?.color ?? "#fff"}">
        <i></i>${c?.name ?? id}</span>`;
    }).join("");
  if (sig.kind === "someone")
    return `<span class="sig is-some"><i></i>มีคนอยู่ตรงนั้น</span>`;
  if (sig.regulars.length) {
    const names = sig.regulars.map((id) => chars.find((c) => c.id === id)?.name ?? id);
    return `<span class="sig is-miss"><i></i>ปกติ${names.join("กับ")}อยู่แถวนี้ · วันนี้ไม่เห็น</span>`;
  }
  return "";
}

function renderPlaceList(board: HTMLElement, locs: LocationOption[]) {
  const head = document.createElement("div");
  head.className = "secthead";
  head.innerHTML = isLocked(s)
    ? `<b>คาบเรียน</b><small>ช่วงนี้ออกไปไหนไม่ได้</small>`
    : `<b>จะไปไหน</b><small>เข้าไปดูก่อนได้ ไม่เสียเวลา · ลงมือทำถึงจะหมดช่วงนี้</small>`;
  board.appendChild(head);

  for (const loc of locs) {
    const card = document.createElement("div");
    // ช่วงคาบเรียนมีที่เดียว การ์ดใบเดียวในกริดสองคอลัมน์อ่านออกมาเหมือนของที่วางค้างไว้
    card.className = "loc pick" + (locs.length === 1 ? " wide" : "") + (loc.blocked ? " blocked" : "");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    const sig = signalHTML(loc.signal);
    card.innerHTML = `<div class="locbg">${backdrop(loc.id, periodId(s))}</div>
      <div class="ico">${icon(loc.id)}</div>
      <div class="nm">${loc.name}</div>
      <div class="sigrow">${sig || '<span class="sig is-none">ไม่เห็นใครเลย</span>'}</div>
      ${loc.club ? `<div class="tagrow"><span class="tag club">${loc.club.label}</span></div>` : ""}
      ${loc.blocked ? `<div class="warn">${loc.blocked}</div>` : ""}`;
    const go = () => { placeOpen = loc.id; sfx.step(); render(); };
    card.onclick = go;
    card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    board.appendChild(card);
  }
}

// ───────────────────────── อยู่ในที่นั้นแล้ว ─────────────────────────

function renderPlace(board: HTMLElement, loc: LocationOption, fresh: boolean) {
  const wrap = document.createElement("div");
  wrap.className = "place";
  const period = game.periods[s.periodIndex].name;
  wrap.innerHTML = `<div class="placeHead">
      <button class="backBtn" id="bBack">‹ ที่อื่น</button>
      <div class="placeName"><b>${loc.name}</b><small>${period}</small></div>
    </div>
    <div class="placeBg">${backdrop(loc.id, periodId(s))}</div>`;
  board.appendChild(wrap);
  $("bBack").onclick = () => { placeOpen = null; render(); };

  // ใครอยู่ตรงนี้ — ตรงนี้คือจุดที่ความบังเอิญถูกเปิดออก
  const found = document.createElement("div");
  found.className = "found";
  if (loc.present.length) {
    // ดังตอนเพิ่งเปิดประตูเข้าไปเท่านั้น ไม่ใช่ทุกครั้งที่หน้าจอวาดใหม่
    if (fresh) sfx.meet();
    for (const p of loc.present) {
      const first = !hasMet(s, p.id);
      const waiting = planToday(s)?.charId === p.id && isPlanPeriod(s);
      const b = document.createElement("button");
      b.className = "metcard" + (waiting ? " is-appt" : "") + (first ? " is-new" : "");
      b.style.setProperty("--who", p.color);
      const rank = affinityRank(s.affinity[p.id] ?? 0);
      const tr = trustRank(s.trust[p.id] ?? 0);
      // ความสัมพันธ์สองแกนเป็นหลอด ไม่ใช่ตัวเลข — "สนิท 3 · เชื่อใจ 1" ต้องแปลในหัวก่อนถึงจะรู้ว่าไกลแค่ไหน
      const bars = first || waiting ? "" : `<span class="wbars">
        <span class="wbar" title="ความสนิท ${rank}/10"><i style="width:${(rank / 10) * 100}%;background:${p.color}"></i></span>
        <span class="wbar" title="ความเชื่อใจ ${tr}/5"><i style="width:${(tr / 5) * 100}%;background:var(--good)"></i></span>
      </span>`;
      b.innerHTML = `<span class="avatar lg">${portraitHTML(p.id)}</span>
        <span class="wname"><b style="color:${p.color}">${first ? unknownLabel(p.id) : p.name}</b>
        <em>${waiting ? "รออยู่ตามนัด" : first ? "ยังไม่เคยคุยกัน"
             : `สนิท ${rank}/10 · เชื่อใจ ${game.trust.rankNames[tr]}`}</em>${bars}</span>
        <span class="talkgo">${first ? "ทักดู" : "เข้าไปคุย"}</span>`;
      b.onclick = () => talkTo(p.id, loc.id);
      found.appendChild(b);
    }
  } else {
    const names = loc.signal.regulars.map((id) => chars.find((c) => c.id === id)?.name ?? id);
    found.innerHTML = `<div class="nobody">${names.length
      ? `ไม่มีใครอยู่ · ปกติ${names.join("กับ")}มาแถวนี้ตอนนี้`
      : "ตอนนี้ไม่มีใครที่เรารู้จักอยู่ตรงนี้"}</div>`;
  }
  wrap.appendChild(found);

  const acts = document.createElement("div");
  acts.className = "acts";
  wrap.appendChild(acts);
  if (isLocked(s)) { classroomActs(acts); return; }
  placeActs(acts, loc);
}

/** คนที่ยังไม่เคยคุยกันเรียกว่าอะไร
 *
 *  ยังไม่รู้จักชื่อ แต่ *รู้ชั้นปี* เพราะโรงเรียนไทยติดป้ายชั้นปีไว้บนเสื้อกับที่สีเนกไท
 *  ซึ่งเป็นสิ่งแรกที่คนมองเห็นจริงๆ — ไม่ใช่ข้อมูลที่เกมแจก แต่เป็นของที่ตาเห็น */
const YEAR_ORDER = ["ม.4", "ม.5", "ม.6", "ปี 1", "ปี 2", "ปี 3", "ปี 4"];
function unknownLabel(charId: string): string {
  const c = chars.find((x) => x.id === charId);
  if (!c) return "ใครสักคน";
  const me = isUni(s) ? "ปี 1" : "ม.5";
  if (c.year === me) return isUni(s) ? "เพื่อนร่วมคณะที่ยังไม่เคยคุยกัน" : "คนในห้องที่ยังไม่เคยคุยกัน";
  // เทียบด้วยลำดับที่เขียนไว้ ไม่ใช่เทียบสตริง — "ม.10" > "ม.5" เป็นเท็จถ้าเทียบตัวอักษร
  return YEAR_ORDER.indexOf(c.year) > YEAR_ORDER.indexOf(me) ? "รุ่นพี่คนหนึ่ง" : "รุ่นน้องคนหนึ่ง";
}

/** คาบเรียน — เข้าแถว เข้าเรียน หรือโดด */
function classroomActs(acts: HTMLElement) {
  const flagRaised = s.doneToday["_assembly"] > 0;
  const b1 = actBtn(flagRaised ? "เข้าเรียนต่อ" : "เข้าแถว แล้วเข้าเรียน", [
    { icon: "mind", text: "ปัญญา + · เกรดทุกวิชา +", tone: "gain" }, TIME_COST]);
  b1.onclick = () => {
    if (!flagRaised) {
      s.doneToday["_assembly"] = 1;
      playInk("assembly", null, "หน้าเสาธง", "#cfc8e8", () => {
        // ครูตรวจก่อน แล้วค่อยเข้าเรียน — ลำดับเดียวกับของจริง
        const chk = morningInspect(s);
        if (chk.caught) { flash(chk.message!, "bad"); sfx.caught(); }
        flash(attendClass(s));
        next();
      });
    } else { flash(attendClass(s)); next(); }
  };
  acts.appendChild(b1);

  const b2 = actBtn("โดดคาบ", [
    { icon: "nerve", text: "+4", tone: "gain" },
    { icon: "behaviour", text: "เสี่ยงโดนจับ", tone: "cost" }, TIME_COST], "act risky");
  b2.onclick = async () => {
    const r = skipClass(s);
    flash(r.message);
    if (r.caught) await runDodge(r.caught, r.penalty);
    next();
  };
  acts.appendChild(b2);
}

function placeActs(acts: HTMLElement, loc: LocationOption) {
  if (loc.club) {
    const cl = clubOf(s);
    const b = actBtn(loc.club.label, [
      { icon: cl?.stat ?? "heart", text: `+${cl?.gain ?? 4}`, tone: "gain" },
      { icon: "energy", text: String(cl?.energy ?? -12), tone: "cost" },
      TIME_COST,
      { icon: "meet", text: "นับเข้าผลงานวันงานใหญ่" },
    ], "act club");
    b.onclick = async () => {
      const club = clubOf(s);
      const mg: MgKind | null = club?.id === "music" ? "rhythm" : club?.id === "sport" ? "relay"
                              : club?.id === "volunteer" ? "serve" : club?.id === "academic" ? "focus" : null;
      let mult = 1;
      if (mg) {
        const res = await openMinigame(mg, 1);
        mult = 0.6 + res.score * 0.9;
        flash(`${res.label} · ${res.detail}`);
      }
      const r = doClubActivity(s, s.doneToday[loc.id] ?? 0, mult);
      if (r) { flash(r.message); s.doneToday[loc.id] = (s.doneToday[loc.id] ?? 0) + 1; }
      next();
    };
    acts.appendChild(b);
  }

  if (loc.action) {
    const a = loc.action;
    const times = s.doneToday[loc.id] ?? 0;
    const statName = game.stats.find((x) => x.id === a.stat)?.name ?? a.stat;
    const costs: Cost[] = [
      { icon: a.stat, text: `+${a.gain}`, tone: "gain" },
      { icon: "energy", text: `${a.energy > 0 ? "+" : ""}${a.energy}`,
        tone: a.energy < 0 ? "cost" : "gain" },
      TIME_COST,
    ];
    if (a.cost) costs.push({ icon: "money", text: `-${a.cost}`, tone: "cost" });
    if (a.pay) costs.push({ icon: "money", text: `+${Math.round(a.pay * trait(s, "pay", 1))}`, tone: "gain" });
    if (a.study) costs.push({ icon: "mind", text: "ความพร้อมสอบ +", tone: "gain" });
    if (times) costs.push({ icon: "time", text: "ทำแล้ววันนี้ ได้น้อยลง" });
    void statName;
    const b = actBtn(a.label, costs);
    b.disabled = !!loc.blocked;
    // แรงไม่พอไม่ทำให้ปุ่มดับอีกแล้ว — กดได้ แล้วเกมจะถามว่าจะฝืนไหม
    const tooTired = a.energy < 0 && energyLowFor(s) && !loc.blocked;
    if (tooTired) b.classList.add("tired");
    const runAction = async (force: boolean) => {
      if (loc.haircut) {
        const r = doAction(s, loc, Math.random, force);
        if (r && !r.ok) { flash(r.message, "bad"); sfx.deny(); next(); return; }
        flash(haircut(s));
        sfx.gain();
        next();
        return;
      }
      // กวดวิชาต้องเลือกก่อนว่าจะติววิชาไหน ไม่งั้นเงิน 320 บาทก็ไม่ต่างจากอ่านเองที่บ้าน
      if (loc.subjectPick) {
        P.subjectPanel(s, (subId) => {
          P.closePanel();
          const r = doAction(s, loc, Math.random, force);
          if (!r) { next(); return; }
          flash(r.message);
          if (r.ok) {
            const got = studyOne(s, subId);
            const sub = subjectById(subId);
            if (sub) flash(`ติว${sub.name} · ${sub.name} +${got.toFixed(0)}`);
            sfx.gain();
          } else sfx.deny();
          next();
        });
        return;
      }
      const r = doAction(s, loc, Math.random, force);
      if (r) {
        flash(r.message, r.ok ? "ok" : "bad");
        if (r.forced) sfx.push();
        if (r.caught) await runDodge(r.caught, r.penalty);
        else if (!r.ok) sfx.deny();
        else if (r.repeat) sfx.dull();
        else if (!r.forced) sfx.gain();
      }
      next();
    };
    b.onclick = async () => {
      // ฝืนต้องเป็นการตัดสินใจของผู้เล่น ไม่ใช่ของเกม
      if (tooTired) {
        const no = whyNoPush(s);
        if (no) { flash(no, "bad"); sfx.deny(); return; }
        P.pushPanel(
          `แรงเหลือ ${Math.round(s.energy)} แล้ว ถ้าฝืนทำต่อจะได้ผลราว ${Math.round(game.push.yield * 100)}% ` +
          `และหนี้การนอนจะเพิ่มเป็น ${Math.round(s.sleepDebt + game.push.debtPerPush)} ` +
          `ซึ่งไปหักแรงที่ควรได้คืนพรุ่งนี้` +
          `<br>ถ้าสิ่งนี้รอถึงพรุ่งนี้ได้ พักแล้วค่อยทำจะได้เต็มกว่าเสมอ — ฝืนมีไว้สำหรับของที่รอไม่ได้` +
          (s.sleepDebt + game.push.debtPerPush >= game.push.sickAt
            ? " · ระดับนี้เริ่มมีโอกาสตื่นมาแล้วลุกไม่ไหวทั้งวัน" : ""),
          `ตอนนี้หนี้การนอน ${Math.round(s.sleepDebt)}`,
          () => { P.closePanel(); void runAction(true); },
          () => { P.closePanel(); render(); });
        return;
      }
      await runAction(false);
    };
    acts.appendChild(b);
  }

  if (loc.rest) {
    const b = actBtn(loc.rest.label,
      [{ icon: "energy", text: `+${loc.rest.energy}`, tone: "gain" }, TIME_COST], "act rest");
    b.onclick = () => { flash(doRest(s, loc) ?? ""); next(); };
    acts.appendChild(b);
  }

  if (loc.blocked) {
    const w = document.createElement("div");
    w.className = "warn";
    w.textContent = loc.blocked;
    acts.appendChild(w);
  }
}

function renderBottom() {
  const el = $("bottom");
  el.innerHTML = "";
  if (isTermOver(s)) return;
  const skip = document.createElement("button");
  skip.className = "wide";
  const club = clubToday(s);
  skip.textContent = isLocked(s) ? "ผ่านคาบไปเฉยๆ"
    : club && !isSchoolDay(s) ? "อยู่บ้านเฉยๆ" : "ปล่อยให้ช่วงนี้ผ่านไป";
  skip.onclick = () => { placeOpen = null; next(); };
  el.appendChild(skip);
}


// ───────────────────────── บทสนทนา ─────────────────────────

function hooks() {
  return {
    onStat: (id: StatId, n: number) => { s.stats[id] += n; },
    onAffinity: (cid: string, n: number) => changeAffinity(s, cid, n),
    onTrust: (cid: string, n: number) => { changeTrust(s, cid, n); if (n > 0) sfx.trust(); else if (n < 0) sfx.broke(); },
    onClaim: (topic: string, version: string, cid: string) => claim(s, topic, version, cid),
    onRecall: () => sfx.recall(),
    onConcede: (cid: string) => { concede(s, cid); sfx.trust(); flash(`ยินดีกับ${nameOf(cid)}ไปตรงๆ`); },
    onHome: (kind: "give" | "part" | "refuse" | "cannot") => {
      const amount = askAmount(s);
      if (kind === "give") { giveHome(s, amount); flash(`ส่งให้ที่บ้าน ${amount} บาท`); }
      else if (kind === "part") { giveHome(s, Math.floor(s.money)); flash("ให้เท่าที่มี"); }
      else { refuseHome(s, kind === "refuse"); if (kind === "refuse") flash("เก็บเงินไว้เอง", "bad"); }
    },
    onTutor: (cid: string) => { tutor(s, cid); flash(`ติวให้${nameOf(cid)} — เวลาทบทวนของเราหายไปส่วนหนึ่ง`); },
    // ธงบางอันแปลว่าเราทำสิ่งที่ยากหรือซื่อสัตย์ ตารางใน game.json แปลงเป็นความเชื่อใจให้เอง
    onFlag: (name: string) => { s.flags[name] = true; trustFromFlag(s, name); },
    onHint: (text: string) => showHint(text),
    onMoney: (amount: number) => { s.money = Math.max(0, s.money + amount); },
    onInvite: (cid: string) => { acceptInvite(s, cid); invitedThisChat = true; },
    onStanding: (amount: number, why: string) => {
      shiftStanding(s, amount, why || undefined);
      if (Math.abs(amount) >= 3) flash(amount > 0 ? "ชื่อเสียงดีขึ้น" : "มีคนเอาไปพูดต่อ", amount > 0 ? "ok" : "bad");
    },
    onSide: (cid: string) => { takeSide(s, cid); flash(`เลือกยืนข้าง${nameOf(cid)}แล้ว — อีกฝั่งปิดถาวร`, "bad"); },
    // เพิ่งได้รู้ชื่อเขา — ป้ายชื่อเปลี่ยนตรงบรรทัดนั้นเลย ไม่ใช่รู้ไว้ก่อนตั้งแต่เปิดฉาก
    onIntroduce: (cid: string) => setSpeaker(nameOf(cid)),
    onFeel: (m: string) => setMood(m),
  };
}

// ───────────────────────── ไลน์ ─────────────────────────

/** บทแชทรอบนี้จบด้วยการนัดไหม — ตั้งโดย hook onInvite ตอน ink เรียก inviteTomorrow() */
let invitedThisChat = false;

function openChatList() {
  chatListPanel(s, {
    onOpenPending: (cid) => openPendingChat(cid),
    onOpenThread: (t) => viewThread(t, openChatList),
    onClose: () => { P.closePanel(); render(); },
  });
}

function openPendingChat(charId: string) {
  const name = `chat_${charId}`;
  if (!storyNames().includes(name)) {
    // ตัวละครที่เพิ่มใหม่แต่ยังไม่มีไฟล์แชท — อย่าให้เกมค้าง
    s.pendingChat = null;
    flash(`ยังไม่มีบทแชทของ${nameOf(charId)}`, "bad");
    openChatList();
    return;
  }
  invitedThisChat = false;
  const story = openScene(name, s, charId, hooks());
  playChat(story, charId, (msgs) => {
    recordThread(s, charId, msgs, invitedThisChat);
    if (invitedThisChat) { flash(`นัดกับ${nameOf(charId)}ไว้พรุ่งนี้หลังเลิกเรียนแล้ว`); sfx.plan(); }
    // คืนเดียวกันอาจมีคนที่สองทักมาอีก ถ้าเราสนิทกับหลายคน — นั่นคือจุดที่นัดเริ่มซ้อนกันได้
    const second = offerSecondChat(s, Math.random, charId);
    if (second) { flash(`${nameOf(second)}ส่งข้อความมาด้วย`); sfx.chat(); }
    save();
    openChatList();
  });
}

/** คืนนี้มีใครทักมาไหม — เรียกทุกครั้งที่ขยับช่วงเวลา */
function rollChat() {
  const who = offerChat(s, Math.random);
  if (who) { flash(`${nameOf(who)}ส่งข้อความมา`); sfx.chat(); }
}

function talkTo(charId: string, where?: string) {
  const c = chars.find((x) => x.id === charId)!;
  const period = periodId(s);
  // ครั้งแรกที่ได้คุยกันจริงๆ เล่นฉากแนะนำตัวของเขาแทนบทปกติ
  // บทปกติเขียนไว้สำหรับคนที่รู้จักกันแล้ว ถ้าเล่นตั้งแต่วินาทีแรกที่เจอหน้ากัน มันจะไม่มีวันแรก
  const first = noteEncounter(s, charId, where ?? "", period);
  const meetInk = (c as { firstMeet?: string }).firstMeet;
  const useMeet = first && !!meetInk && storyNames().includes(meetInk!);
  const story = openScene(useMeet ? meetInk! : c.story, s, charId, hooks());
  s.metToday[charId] = true;
  s.encounters++;
  if (first) { sfx.newface(); remember(s, `ได้รู้จักกับ${c.name}ที่${locName(where ?? "")}`); }
  // ไปหาเขาแล้ววันนี้ แรงกดดันของเขาลดลง เพราะมีคนฟัง
  visited(s, charId);
  // ไปตามนัดที่รับไว้ทางไลน์เมื่อคืน — ได้ใจเพิ่มจากการที่ไปจริง ไม่ใช่จากบทสนทนา
  const bonus = keepPlan(s, charId);
  if (bonus) flash(`ไปตามนัด${c.name} · สนิทขึ้น +${bonus}`);
  // ที่ที่เราไปนั่งคุยกันมีคนอื่นอยู่ด้วยเสมอ — การเลือกจึงมีพยาน ไม่ใช่เรื่องของเรากับตัวเลข
  for (const w of seenWith(s, charId, where)) {
    if (w.hadPlan) { sfx.stood(); flash(`${w.name}นั่งอยู่ตรงนั้นด้วย และวันนี้เรานัดเขาไว้`, "bad"); }
    else flash(`${w.name}อยู่ตรงนั้นด้วย`);
  }
  remember(s, `คุยกับ${c.name}`);
  placeOpen = null;
  playScene(story, useMeet ? unknownLabel(charId) : c.name, c.color, charId,
            () => next(), where, period, useMeet);
}

function playInk(name: string, charId: string | null, speaker: string, color: string,
                 onEnd: () => void, bgOverride?: string) {
  const story = openScene(name, s, charId, hooks());
  // เหตุการณ์ที่ยังไม่มีภาพของตัวเอง ยืมภาพของที่ที่มันเกิดขึ้น (ดู `EVENT_PLACE`)
  // ของเดิมใส่ภาพให้เฉพาะบทที่ชื่อตรงกับชื่อฉาก ที่เหลือเล่นบนจอดำเปล่า
  const bg = bgOverride ?? eventBackdrop(name, isUni(s) ? "uni" : "school");
  playScene(story, speaker, color, charId, onEnd, bg, periodId(s));
}

/** ฉากจบรายตัวละคร — เล่นก่อนแผงสรุปเทอม เรียงจากคนที่สนิทที่สุด แล้วปิดท้ายด้วยเรื่องของเราเอง
 *  นี่คือที่เดียวที่ธงของทางเลือกเล็กๆ ทั้งเทอมถูกอ่านกลับออกมา */
function playEpilogues(done: () => void) {
  const uni = isUni(s);
  const bg = uni ? "epilogue_uni" : "epilogue";
  const queue: { ink: string; charId: string | null; name: string; color: string }[] =
    epilogues(s).map((e) => ({ ink: e.ink, charId: e.charId, name: e.name, color: e.color }));
  const self = selfEpilogue(s);
  if (self) queue.push({ ink: self, charId: null, name: "หลังจากนั้น", color: "#cfc8e8" });
  const next = () => {
    const item = queue.shift();
    if (!item) { done(); return; }
    playInk(item.ink, item.charId, item.name, item.color, next, bg);
  };
  next();
}

// ───────────────────────── เหตุการณ์ตามปฏิทิน ─────────────────────────

/** ข้ามไปเช้าวันถัดไป — ใช้กับกิจกรรมที่กินทั้งวัน เช่น กีฬาสี เข้าค่าย */
function skipToNextDay() {
  const guard = game.periods.length + 1;
  for (let i = 0; i < guard && s.periodIndex !== 0; i++) advance(s);
  if (s.periodIndex === 0 && s.dayIndex === s.dayIndex) advance(s);
  while (s.periodIndex !== 0) advance(s);
}

function handleEvent(e: TermEvent): boolean {
  s.seenEvents[e.id] = true;
  remember(s, e.name);

  if (e.exam) {
    void (async () => {
      const mg = await openMinigame("quiz", e.exam === "final" ? 2 : 1);
      const r = takeExam(s, e.exam!, mg.score);
      // ผลสอบของเราคือเลขของเราคนเดียว กระดานหน้าห้องคือเลขที่ทั้งห้องเห็น
      const rows = postBoard(s, e.exam!);
      sfx.exam();
      P.examPanel(r, () => {
        P.closePanel();
        sfx.board();
        P.boardPanel(rows, () => { P.closePanel(); skipToNextDay(); afterStep(); });
      });
    })();
    return true;
  }
  if (e.holiday && !e.ink) {
    P.noticePanel(e.name, "วันนี้โรงเรียนหยุด", () => { P.closePanel(); afterStep(); });
    return true;
  }
  if (e.assignProject && !s.project) {
    const who = assignProject(s, s.chapter);
    if (who) flash(`จับคู่งานกลุ่มกับ${projectName(s)}`);
  }
  const finish = () => {
    if (e.pickClub && !s.club) { P.clubPickPanel(s, (id) => { joinClub(s, id); P.closePanel(); afterStep(); }); return; }
    if (e.ending) {
      const en = computeEnding(s);
      // จบมัธยมแล้วยังไม่จบเกม — ปีหนึ่งรออยู่ ถ้าไม่ได้ไปเรียนต่อก็จบตรงนี้จริงๆ
      const goesOn = !isUni(s) && en.score >= game.carryOver.minScoreToUni;
      playEpilogues(() => {
        sfx.ending();
        P.endingPanel(en, () => { P.closePanel(); afterStep(); },
          goesOn ? { label: "เข้าสู่ปีหนึ่ง", fn: () => {
            startUni(s, en);
            P.closePanel();
            save();
            flash("ปีหนึ่ง · เทอมแรกในมหาวิทยาลัย");
            afterStep();
          } } : undefined);
      });
      return;
    }
    if (e.wholeDay || e.holiday) skipToNextDay();
    afterStep();
  };
  // วันงานใหญ่ของชมรม — วันเดียวกับเหตุการณ์ที่ปฏิทินมีอยู่แล้ว
  // ทั้งเทอมที่ไปซ้อมมาถูกคิดบัญชีตรงนี้ ไม่ใช่มินิเกมอย่างเดียว
  const big = milestoneToday(s);
  if (big) {
    void (async () => {
      const kind: MgKind = big.id === "music" ? "rhythm" : big.id === "sport" ? "relay"
                         : big.id === "academic" ? "quiz" : "serve";
      const res = await openMinigame(kind, 2);
      const r = runMilestone(s, res.score)!;
      sfx.exam();
      P.milestonePanel(r, () => {
        P.closePanel();
        if (e.ink) { playInk(e.ink, null, e.name, "#cfc8e8", finish); return; }
        finish();
      });
    })();
    return true;
  }
  if (e.id === "sports_day") {
    void (async () => {
      const club = clubOf(s);
      const res = await openMinigame(club?.id === "music" ? "rhythm" : "relay", 2);
      s.stats.heart += 2 + res.score * 6;
      if (club) s.stats[club.stat as StatId] += res.score * 6;
      flash(`กีฬาสี · ${res.detail}`);
      playInk(e.ink ?? "ev_sports_day", null, e.name, "#cfc8e8", finish);
    })();
    return true;
  }
  if (e.ink) { playInk(e.ink, null, e.name, "#cfc8e8", finish); return true; }
  finish();
  return true;
}

// ───────────────────────── ลูปหลัก ─────────────────────────

function next() {
  // ขยับช่วงเวลาแล้วต้องออกมายืนที่กระดานเสมอ ไม่ใช่ค้างอยู่ในห้องเดิม
  // ไม่งั้นการ "เลือกว่าจะไปไหน" ซึ่งเป็นการตัดสินใจหลักของเกม จะถูกข้ามไปเงียบๆ
  placeOpen = null;
  const missedBefore = s.homeworkMissed;
  advance(s);
  const missed = s.homeworkMissed - missedBefore;
  if (missed > 0) {
    flash(`ไม่ได้ส่งการบ้าน ${missed} ชิ้น · ความประพฤติ -${game.homework.behaviourPenalty * missed}`, "bad");
    sfx.caught();
  }
  afterStep();
}

function afterStep() {
  // เมื่อคืนมีคนยืนรอเก้อ — เสียงนี้ต่างจาก "เรื่องที่เกิดลับหลัง" เพราะมันเป็นความผิดของเราเอง
  if (s.stoodUp > 0) { sfx.stood(); s.stoodUp = 0; }
  // ตื่นมาแล้วลุกไม่ไหว — เสียทั้งวัน ไม่ใช่แค่แรง นี่คือปลายทางของการฝืนหลายคืนติด
  // ต้องขึ้นก่อนทุกอย่าง เพราะวันนี้ไม่มีอะไรให้เลือกแล้ว
  if (isSick(s) && s.periodIndex === 0) {
    sfx.caught();
    P.noticePanel("ตื่นมาแล้วลุกไม่ไหว",
      "ฝืนมาหลายคืนติดกันจนร่างกายเก็บบิล วันนี้ทั้งวันหายไปกับการนอนอยู่บ้าน<br>" +
      "นัดที่รับไว้วันนี้ก็ไปไม่ได้ และคนที่รออยู่ไม่รู้ว่าทำไม",
      () => { P.closePanel(); skipToNextDay(); afterStep(); });
    renderTop();
    return;
  }
  // เรื่องที่เกิดขึ้นลับหลังต้องถูกบอก ไม่งั้นมันไม่ต่างจากไม่มีระบบนี้เลย
  const news = takeNews(s);
  if (news.length) sfx.news();
  for (const line of news) flash(line, "bad");
  // เดินสวนกับใครสักคนระหว่างทาง — ไม่กินช่วงเวลา แต่ทำให้โลกมีคนอยู่จริง
  const bumped = bumpInto(s, Math.random);
  if (bumped) { sfx.meet(); flash(`เดินสวนกับ${nameOf(bumped)} ทักกันแวบเดียว`); }
  rollChat();
  save();
  const e = isTermOver(s) ? null : eventNow(s);
  if (e && handleEvent(e)) { renderTop(); return; }
  render();
}

function render() {
  maybeDayCard();
  renderTop();
  renderBoard();
  renderBottom();
}

// ───────────────────────── เซฟ / เมนู ─────────────────────────

function metaOf() {
  return { day: s.dayIndex + 1, period: game.periods[s.periodIndex].name,
           club: clubOf(s)?.name ?? null, money: Math.round(s.money) };
}
/** เพลงเปลี่ยนตามช่วงเวลา และเปลี่ยนอีกทีถ้ามีอะไรค้างอยู่
 *  เพลงกลางวันกับเพลงตอนที่เรากำลังจะโดนเรียก ฟังไม่เหมือนกัน */
const bgm = new Bgm(asset("assets/audio"), ["day", "dusk"]);
// เพลงถูกมัดเป็น JSON (base64) เผื่อโฮสต์ที่เสิร์ฟเฉพาะชนิดไฟล์เว็บมาตรฐาน
// ซึ่ง .m4a ไม่อยู่ในนั้น · ถ้าไฟล์ชุดนี้ไม่มี ก็ใช้ไฟล์เสียงตรงๆ เหมือนเดิม
void fetch(asset("assets/audio.b64.json"))
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => { if (m) bgm.useSources(m); })
  .catch(() => { /* ไม่มีก็ไม่เป็นไร */ });
function bgmFor(st: GameState): string {
  const p = periodId(st);
  return p === "after" || p === "night" ? "dusk" : "day";
}

/** เกมนี้ไม่มีลูปเกม มันเดินตามการกดของผู้เล่น
 *  แต่การไล่ระดับเสียงต้องการเฟรม จึงมีลูปเล็กๆ ที่ทำแค่เรื่องเสียงอย่างเดียว */
let bgmLast = performance.now();
function bgmTick(now: number) {
  const dt = Math.min(0.1, (now - bgmLast) / 1000);
  bgmLast = now;
  bgm.want(bgmFor(s));
  bgm.update(dt);
  requestAnimationFrame(bgmTick);
}
requestAnimationFrame(bgmTick);

// เบราว์เซอร์บล็อกเสียงจนกว่าจะมีการกดจริง — ดักที่ระดับเอกสารเพราะเกมนี้กดได้หลายที่
document.addEventListener("pointerdown", () => { unlockAudio(); bgm.unlock(); }, { once: false });

const save = () => writeSlot("auto", s, metaOf());

function openMenu() {
  P.menuPanel(s, {
    onHow: () => { P.closePanel(); P.howToPanel(() => { P.closePanel(); openMenu(); }); },
    onDiary: () => { P.closePanel(); P.diaryPanel(s, () => { P.closePanel(); openMenu(); }); },
    slots: SLOTS.map((id) => {
      const m = slotMeta(id);
      return {
        id, label: id === "auto" ? "อัตโนมัติ" : `ช่อง ${id}`, has: !!m,
        desc: m ? `วันที่ ${m.day} · ${m.period}${m.club ? " · " + m.club : ""} · ${m.money} บาท` : "ว่าง",
      };
    }),
    onSave: (id) => { writeSlot(id as SlotId, s, metaOf()); openMenu(); flash(`บันทึกลงช่อง ${id} แล้ว`); },
    onLoad: (id) => {
      const r = readSlot(id as SlotId);
      if (!r) { flash("ช่องนี้ว่าง หรือเซฟมาจากเกมคนละรุ่น", "bad"); return; }
      s = r.state; P.closePanel(); render(); flash("โหลดแล้ว");
    },
    onWipe: (id) => { clearSlot(id as SlotId); openMenu(); },
    onNew: () => {
      if (!confirm("เริ่มเทอมใหม่? ความคืบหน้าที่ยังไม่บันทึกจะหายไป")) return;
      P.closePanel();
      startNewTerm();
    },
  });
}

/** เทอมใหม่เริ่มที่คำถามว่า "เราเป็นใครมาก่อน" ไม่ใช่ที่วันจันทร์แรก
 *  ภูมิหลังเปลี่ยนค่าตั้งต้น คนที่รู้จักเราอยู่แล้ว และกฎบางข้อของโลก — ดู src/sim/background.ts */
function startNewTerm() {
  renderTop();
  P.backgroundPanel((id) => {
    s = newState();
    applyBackground(s, id);
    placeOpen = null;
    lastDayShown = -1;
    lastChips = {};
    P.closePanel();
    save();
    const bg = backgroundOf(s);
    if (bg) flash(`เปิดเทอมในฐานะ${bg.name}`);
    afterStep();
  });
}

const soundIcon = () => (isMuted() ? "๏" : "♪");
$("bSound").textContent = soundIcon();
$("bSound").title = "เปิด/ปิดเสียง";
$("bSound").onclick = () => {
  unlockAudio();
  setMuted(!isMuted());
  bgm.setMuted(isMuted());
  $("bSound").textContent = soundIcon();
};
$("bChat").onclick = () => openChatList();
$("bChars").onclick = () => P.characterPanel(s);
$("bGrade").onclick = () => P.gradePanel(s);
$("bCal").onclick = () => P.calendarPanel(s);
$("bMenu").onclick = () => openMenu();
$("bBag").onclick = () => openBag();

function openBag() {
  P.bagPanel(s, {
    onBuy: (id) => { flash(buy(s, id)); save(); renderTop(); openBag(); },
    onUse: (id) => { flash(use(s, id)); save(); renderTop(); openBag(); },
    onGift: (id, cid) => { flash(gift(s, id, cid)); save(); openBag(); },
  });
}

/** โดนจับได้ = ได้โอกาสหลบหนึ่งครั้ง ถ้าเอาตัวรอดได้ก็ไม่โดนตัดคะแนน */
async function runDodge(message: string, penalty: number) {
  flash("ครูปกครองเห็นแล้ว!", "bad");
  const res = await openMinigame("dodge");
  if (res.score >= 0.6) { escapeCatch(s, penalty); flash("เอาตัวรอดมาได้ ไม่โดนตัดคะแนน"); sfx.escape(); }
  else { flash(message, "bad"); sfx.caught(); }
  renderTop();
}

function flash(msg: string, kind: "ok" | "bad" = "ok") {
  if (!msg) return;
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("out"), 2000);
  setTimeout(() => el.remove(), 2600);
}

// เปิดทางให้ตรวจสอบสถานะจาก console ตอนพัฒนา — เกมเดินทีละช่วงเวลา
// ถ้าต้องเล่นจริงทุกครั้งกว่าจะถึงจุดที่อยากดู จะดีบั๊กไม่ไหว (ฝั่ง genesis ใช้ __genesis เหมือนกัน)
if (import.meta.env.DEV)
  (window as unknown as Record<string, unknown>).__mattayom =
    { get s() { return s; }, render, next, save, openChatList, rollChat, playEpilogues,
      epilogues: () => epilogues(s),
      // เปิดกระดานประกาศผลโดยไม่ต้องเล่นถึงวันสอบจริง — เทสต์ภาพใช้
      showHow: () => P.howToPanel(() => P.closePanel()),
      showDiary: () => P.diaryPanel(s, () => P.closePanel()),
      // มินิเกมทั้งเจ็ดตัวเปิดดูตรงๆ ได้ — ไม่งั้นต้องเล่นถึงวันสอบ/วันงานจริงกว่าจะเห็นสักตัว
      // ห้ามคืน Promise ออกไป — ฝั่งเทสต์ page.evaluate() จะรอจนกว่าจะเล่นจบ ซึ่งไม่มีวันเกิด
      showMinigame: (kind: MgKind, diff = 1) => { void openMinigame(kind, diff); },
      // ตัวนี้คืน Promise ตั้งใจ — เทสต์ที่เล่นจนจบต้องอ่านคะแนนที่มันคืนกลับมาได้
      runMinigame: (kind: MgKind, diff = 1) => openMinigame(kind, diff),
      showBoard: (examId = "midterm") => P.boardPanel(postBoard(s, examId), () => P.closePanel()) };

// ───────────────────────── เปิดเกม ─────────────────────────
// เกมนี้มีระบบซ้อนกันสิบกว่าอย่าง ถ้าไม่มีอะไรบอกเลย ผู้เล่นจะไม่มีทางรู้ว่ามีอะไรให้ทำบ้าง
// (เป็นเหตุผลเดียวกับที่เคยต้องตัดขอบเขตของอีกเกมทิ้งทั้งชั้น)
// ลำดับ: วิธีเล่น (ครั้งแรกเท่านั้น) → เลือกภูมิหลัง (เฉพาะเกมใหม่) → เข้าเกม
function boot() {
  if (isFreshStart) { startNewTerm(); return; }
  const startEvent = isTermOver(s) ? null : eventNow(s);
  if (startEvent) { renderTop(); handleEvent(startEvent); }
  else render();
}

let seenHow = true;
try { seenHow = localStorage.getItem("mattayom:seenHow") === "1"; }
catch { /* โหมดส่วนตัวก็เล่นได้ */ }
if (!seenHow) {
  renderTop();
  P.howToPanel(() => {
    P.closePanel();
    try { localStorage.setItem("mattayom:seenHow", "1"); } catch { /* ไม่เป็นไร */ }
    boot();
  });
} else boot();
if (nextEvent(s)) { /* ปฏิทินพร้อมใช้ */ }
