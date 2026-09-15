import "./style.css";
import game from "../data/game.json";
import chars from "../data/characters.json";
import game2 from "../data/game.json";
import { newState, statRank, affinityRank, remember, type GameState, type StatId } from "./sim/state";
import { advance, dateLabel, eventNow, isLocked, isTermOver, daysLeft, isSchoolDay,
         nextEvent, type TermEvent } from "./sim/calendar";
import { availableLocations, doAction, doRest, attendClass, skipClass } from "./sim/actions";
import { clubToday, doClubActivity, joinClub, clubOf } from "./sim/club";
import { takeExam } from "./sim/exam";
import { computeEnding } from "./sim/ending";
import { behaviourLabel } from "./sim/discipline";
import { buy, use, gift } from "./sim/shop";
import { escapeCatch } from "./sim/discipline";
import { openMinigame } from "./ui/minigame";
import { offerChat, recordThread, acceptInvite, planToday, keepPlan, isPlanPeriod,
         nameOf } from "./sim/chat";
import { hasHomework, doHomework } from "./sim/homework";
import { changeAffinity, shiftStanding, takeSide, standingLabel } from "./sim/bonds";
import { unlock as unlockAudio, sfx, setMuted, isMuted } from "./core/audio";
import { openScene, storyNames } from "./story/bridge";
import { playChat, viewThread, chatListPanel } from "./ui/chat";
import { playScene, showHint } from "./ui/scene";
import { applyTheme, periodStrip } from "./ui/theme";
import { icon } from "./ui/icons";
import { backdrop, hasEventArt } from "./ui/backdrop";
import { portraitSVG } from "./ui/portrait";
import * as P from "./ui/panels";
import { clearSlot, migrateOld, readSlot, slotMeta, writeSlot, SLOTS, type SlotId } from "./core/save";

migrateOld();
let s: GameState = readSlot("auto")?.state ?? newState();
const $ = (id: string) => document.getElementById(id)!;

// ───────────────────────── แถบบน ─────────────────────────

function renderTop() {
  applyTheme(s);
  const club = clubOf(s);
  // แยกเป็นชิ้นๆ แล้วห้ามตัดคำกลางชิ้น ไม่งั้นบนจอมือถือจะได้ "กลาง / คืน" คนละบรรทัด
  const parts = dateLabel(s).split(" · ");
  if (isLocked(s)) parts.push("คาบเรียน");
  $("date").innerHTML = parts.map((p) => `<span class="dseg">${p}</span>`).join('<i class="dsep">·</i>') +
    `<small class="dseg">เหลืออีก ${daysLeft(s)} วัน</small>`;
  $("periodStrip").innerHTML = periodStrip(s);

  const chatBtn = $("bChat");
  chatBtn.classList.toggle("is-unread", !!s.pendingChat);
  chatBtn.innerHTML = s.pendingChat ? 'ไลน์<span class="badge">1</span>' : "ไลน์";

  const energyPct = (s.energy / game.energy.max) * 100;
  const low = s.energy < game.energy.lowThreshold;
  const ladder = game2.statRanks;

  let h = game.stats.map((st) => {
    const v = s.stats[st.id as StatId];
    const r = statRank(v);
    // หลอดบอกว่าใกล้ระดับถัดไปแค่ไหน — เดิมเห็นแค่ชื่อระดับ ไม่รู้ว่าอีกไกลไหม
    const from = ladder[r], to = ladder[Math.min(r + 1, ladder.length - 1)];
    const pct = to > from ? Math.min(100, ((v - from) / (to - from)) * 100) : 100;
    return `<span class="chip stat" title="${st.desc}">${st.name}
      <b>${game.statRankNames[r]}</b><i style="width:${pct}%"></i></span>`;
  }).join("");
  h += `<span class="chip energy${low ? " low" : ""}" title="แรงที่เหลือวันนี้">แรง
      <b>${Math.round(s.energy)}</b><i style="width:${energyPct}%"></i></span>`;
  h += `<span class="chip" title="เงินในกระเป๋า">เงิน <b>${Math.round(s.money)}</b></span>`;
  h += `<span class="chip" title="${behaviourLabel(s.behaviour)}">ความประพฤติ <b>${Math.round(s.behaviour)}</b></span>`;
  // ความประพฤติเป็นของฝ่ายปกครอง ชื่อเสียงเป็นของทั้งโรงเรียน คนละอย่างกัน
  h += `<span class="chip" title="${standingLabel(s.standing)}">ชื่อเสียง <b>${Math.round(s.standing)}</b></span>`;
  if (s.homework > 0) h += `<span class="chip hw" title="ไม่ส่งแล้วครูหักคะแนน">การบ้าน <b>${s.homework}</b></span>`;
  if (club) h += `<span class="chip club" title="${club.blurb}">${club.icon} <b>${club.name}</b></span>`;
  $("stats").innerHTML = h;
}

/** การ์ดบอกวันใหม่ — ทำให้รู้สึกว่าวันหนึ่งจบลงจริง ไม่ใช่ตัวเลขขยับเฉยๆ */
let lastDayShown = -1;
function maybeDayCard() {
  if (s.dayIndex === lastDayShown) return;
  const first = lastDayShown === -1;
  lastDayShown = s.dayIndex;
  if (first) return;
  const el = $("daycard");
  el.innerHTML = `<div><b>${dateLabel(s).split(" · ")[0]}</b>
    <small>วันที่ ${s.dayIndex + 1} จาก ${game.term.days}</small></div>`;
  el.classList.remove("hidden");
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1150);
  setTimeout(() => el.classList.add("hidden"), 1650);
}

// ───────────────────────── กระดานเลือกที่ไป ─────────────────────────

function renderBoard() {
  const board = $("board");
  board.innerHTML = "";
  if (isTermOver(s)) {
    const e = s.ending ?? computeEnding(s);
    board.innerHTML = `<div class="end"><b>${e.tier}</b>
      <small>คะแนนรวมทั้งเทอม ${e.score}</small>
      <button id="bSeeEnd">ดูสรุปเทอม</button></div>`;
    $("bSeeEnd").onclick = () => P.endingPanel(e, P.closePanel);
    return;
  }

  // รับนัดไว้เมื่อคืนแล้วลืม = เสียความสัมพันธ์ฟรีๆ เตือนไว้ทั้งวันจนกว่าจะไป
  const plan = planToday(s);
  if (plan) {
    const pc = chars.find((c) => c.id === plan.charId);
    const note = document.createElement("div");
    note.className = "appt";
    note.innerHTML = `<b style="color:${pc?.color ?? "#fff"}">${pc?.name ?? plan.charId}</b>
      ${isPlanPeriod(s) ? "รออยู่แล้ว ไปหาเลย" : "นัดไว้ช่วงหลังเลิกเรียนวันนี้"}`;
    board.appendChild(note);
  }

  if (hasHomework(s)) {
    const card = document.createElement("div");
    card.className = "loc wide hw";
    card.innerHTML = `<div class="ico">${icon("library")}</div>
      <div class="nm">การบ้านค้างอยู่ ${s.homework} ชิ้น</div>`;
    const acts = document.createElement("div");
    acts.className = "acts";
    const b = document.createElement("button");
    b.className = "act";
    b.innerHTML = `ทำการบ้าน<em>ความพร้อมสอบ + · ปัญญา + · แรง ${game.homework.energy}</em>`;
    b.onclick = () => {
      const msg = doHomework(s);
      const ok = s.homework === 0;
      flash(msg, ok ? "ok" : "bad");
      if (ok) { sfx.homework(); next(); } else { sfx.deny(); }
    };
    acts.appendChild(b);
    const warn = document.createElement("div");
    warn.className = "warn";
    warn.textContent = "ไม่ส่งเช้าวันเปิดเรียนถัดไป ครูหักคะแนนความประพฤติ";
    acts.appendChild(warn);
    card.appendChild(acts);
    board.appendChild(card);
  }

  if (isLocked(s)) { renderClassroom(board); return; }

  for (const loc of availableLocations(s)) {
    const card = document.createElement("div");
    card.className = "loc" + (loc.blocked ? " blocked" : "");
    card.innerHTML = `<div class="locbg">${backdrop(loc.id)}</div>
      <div class="ico">${icon(loc.id)}</div><div class="nm">${loc.name}</div>`;

    const acts = document.createElement("div");
    acts.className = "acts";

    for (const p of loc.present) {
      const b = document.createElement("button");
      const waiting = !!plan && plan.charId === p.id && isPlanPeriod(s);
      b.className = "who" + (waiting ? " is-appt" : "");
      b.style.borderColor = p.color;
      const rank = affinityRank(s.affinity[p.id] ?? 0);
      b.innerHTML = `<span class="avatar">${portraitSVG(p.id)}</span>
        <span class="wname" style="color:${p.color}">${p.name}<em>${
          waiting ? "ตามนัดเมื่อคืน" : "ระดับ " + rank}</em></span>`;
      b.onclick = () => talkTo(p.id, loc.id);
      acts.appendChild(b);
    }

    if (loc.club) {
      const b = document.createElement("button");
      b.className = "act club";
      b.textContent = loc.club.label;
      b.onclick = async () => {
        const club = clubOf(s);
        const mg = club?.id === "music" ? "rhythm" : club?.id === "sport" ? "relay" : null;
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
      const b = document.createElement("button");
      b.className = "act";
      const times = s.doneToday[loc.id] ?? 0;
      b.innerHTML = `${a.label}<em>${a.energy < 0 ? `แรง ${a.energy}` : `แรง +${a.energy}`}` +
        `${a.cost ? ` · ${a.cost} บาท` : ""}${times ? " · ทำแล้ววันนี้" : ""}</em>`;
      b.disabled = !!loc.blocked;
      b.onclick = async () => {
        const r = doAction(s, loc);
        if (r) {
          flash(r.message);
          if (r.caught) await runDodge(r.caught, r.penalty);
        }
        next();
      };
      acts.appendChild(b);
    }

    if (loc.rest) {
      const b = document.createElement("button");
      b.className = "act rest";
      b.innerHTML = `${loc.rest.label}<em>แรง +${loc.rest.energy}</em>`;
      b.onclick = () => { flash(doRest(s, loc) ?? ""); next(); };
      acts.appendChild(b);
    }

    if (loc.blocked) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = loc.blocked;
      acts.appendChild(w);
    }
    card.appendChild(acts);
    board.appendChild(card);
  }
}

function renderClassroom(board: HTMLElement) {
  const card = document.createElement("div");
  card.className = "loc wide";
  const flagRaised = s.doneToday["_assembly"] > 0;
  card.innerHTML = `<div class="locbg">${backdrop("assembly")}</div>
    <div class="ico">${icon("assembly")}</div>
    <div class="nm">เข้าแถวหน้าเสาธง แล้วเข้าเรียน</div>`;
  const acts = document.createElement("div");
  acts.className = "acts";

  const b1 = document.createElement("button");
  b1.className = "act";
  b1.innerHTML = flagRaised ? "เข้าเรียนต่อ<em>ปัญญา +</em>" : "เข้าแถว แล้วเข้าเรียน<em>ปัญญา + · ความพร้อมสอบ +</em>";
  b1.onclick = () => {
    if (!flagRaised) {
      s.doneToday["_assembly"] = 1;
      playInk("assembly", null, "หน้าเสาธง", "#cfc8e8", () => { flash(attendClass(s)); next(); });
    } else { flash(attendClass(s)); next(); }
  };
  acts.appendChild(b1);

  const b2 = document.createElement("button");
  b2.className = "act risky";
  b2.innerHTML = "โดดคาบ<em>ความซ่า + · เสี่ยงโดนจับ</em>";
  b2.onclick = async () => {
    const r = skipClass(s);
    flash(r.message);
    if (r.caught) await runDodge(r.caught, r.penalty);
    next();
  };
  acts.appendChild(b2);

  const atClass = chars.filter((c) =>
    (c.where as Record<string, string | undefined>)["morning"] === "classroom" && !s.metToday[c.id]);
  for (const p of atClass) {
    const b = document.createElement("button");
    b.className = "who";
    b.style.borderColor = p.color;
    b.innerHTML = `<span class="avatar">${portraitSVG(p.id)}</span>
      <span class="wname" style="color:${p.color}">${p.name}<em>ระดับ ${affinityRank(s.affinity[p.id] ?? 0)}</em></span>`;
    b.onclick = () => talkTo(p.id, "classroom");
    acts.appendChild(b);
  }
  card.appendChild(acts);
  board.appendChild(card);
}

function renderBottom() {
  const el = $("bottom");
  el.innerHTML = "";
  if (isTermOver(s)) return;
  const skip = document.createElement("button");
  skip.className = "wide";
  const club = clubToday(s);
  skip.textContent = isLocked(s) ? "ผ่านคาบไปเฉยๆ"
    : club && !isSchoolDay(s) ? "อยู่บ้านเฉยๆ" : "ไม่ทำอะไร";
  skip.onclick = () => next();
  el.appendChild(skip);
}

// ───────────────────────── บทสนทนา ─────────────────────────

function hooks() {
  return {
    onStat: (id: StatId, n: number) => { s.stats[id] += n; },
    onAffinity: (cid: string, n: number) => changeAffinity(s, cid, n),
    onFlag: (name: string) => { s.flags[name] = true; },
    onHint: (text: string) => showHint(text),
    onMoney: (amount: number) => { s.money = Math.max(0, s.money + amount); },
    onInvite: (cid: string) => { acceptInvite(s, cid); invitedThisChat = true; },
    onStanding: (amount: number, why: string) => {
      shiftStanding(s, amount, why || undefined);
      if (Math.abs(amount) >= 3) flash(amount > 0 ? "ชื่อเสียงดีขึ้น" : "มีคนเอาไปพูดต่อ", amount > 0 ? "ok" : "bad");
    },
    onSide: (cid: string) => { takeSide(s, cid); flash(`เลือกยืนข้าง${nameOf(cid)}แล้ว — อีกฝั่งปิดถาวร`, "bad"); },
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
  const story = openScene(c.story, s, charId, hooks());
  s.metToday[charId] = true;
  // ไปตามนัดที่รับไว้ทางไลน์เมื่อคืน — ได้ใจเพิ่มจากการที่ไปจริง ไม่ใช่จากบทสนทนา
  const bonus = keepPlan(s, charId);
  if (bonus) flash(`ไปตามนัด${c.name} · สนิทขึ้น +${bonus}`);
  remember(s, `คุยกับ${c.name}`);
  playScene(story, c.name, c.color, charId, () => next(), where);
}

function playInk(name: string, charId: string | null, speaker: string, color: string, onEnd: () => void) {
  const story = openScene(name, s, charId, hooks());
  const bg = hasEventArt(name) ? name : name === "assembly" ? "assembly" : undefined;
  playScene(story, speaker, color, charId, onEnd, bg);
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
      P.examPanel(r, () => { P.closePanel(); skipToNextDay(); afterStep(); });
    })();
    return true;
  }
  if (e.holiday && !e.ink) {
    P.noticePanel(e.name, "วันนี้โรงเรียนหยุด", () => { P.closePanel(); afterStep(); });
    return true;
  }
  const finish = () => {
    if (e.pickClub && !s.club) { P.clubPickPanel((id) => { joinClub(s, id); P.closePanel(); afterStep(); }); return; }
    if (e.ending) { const en = computeEnding(s); P.endingPanel(en, () => { P.closePanel(); afterStep(); }); return; }
    if (e.wholeDay || e.holiday) skipToNextDay();
    afterStep();
  };
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
const save = () => writeSlot("auto", s, metaOf());

function openMenu() {
  P.menuPanel(s, {
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
      s = newState(); P.closePanel(); save(); afterStep();
    },
  });
}

document.addEventListener("pointerdown", () => unlockAudio(), { once: true });
const soundIcon = () => (isMuted() ? "๏" : "♪");
$("bSound").textContent = soundIcon();
$("bSound").title = "เปิด/ปิดเสียง";
$("bSound").onclick = () => {
  unlockAudio();
  setMuted(!isMuted());
  $("bSound").textContent = soundIcon();
};
$("bChat").onclick = () => openChatList();
$("bChars").onclick = () => P.characterPanel(s);
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
    { get s() { return s; }, render, next, save, openChatList, rollChat };

// เปิดเกมมา ถ้ามีเหตุการณ์ค้างอยู่ตรงช่วงเวลานี้ ให้เล่นก่อน
const startEvent = isTermOver(s) ? null : eventNow(s);
if (startEvent) { renderTop(); handleEvent(startEvent); }
else render();
if (nextEvent(s)) { /* ปฏิทินพร้อมใช้ */ }
