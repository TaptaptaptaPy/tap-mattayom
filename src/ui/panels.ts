import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { CLUBS, clubOf } from "../sim/club";
import { ITEMS, giftable, usable } from "../sim/shop";
import { behaviourLabel } from "../sim/discipline";
import { standingLabel } from "../sim/bonds";
import { SUBJECTS, gradeOf, gpa } from "../sim/grades";
import type { BoardRow } from "../sim/state";
import { EVENTS } from "../sim/calendar";
import { affinityRank, statRank, type Ending, type GameState, type StatId } from "../sim/state";
import type { ExamReport } from "../sim/exam";
import { portraitHTML } from "./portrait";
import { icon } from "./icons";

const el = () => document.getElementById("panel")!;
export const closePanel = () => { el().classList.add("hidden"); el().innerHTML = ""; };
const statName = (id: string) => game.stats.find((s) => s.id === id)?.name ?? id;

function open(html: string, onClose = closePanel) {
  const p = el();
  p.classList.remove("hidden");
  p.innerHTML = `<div class="pwrap">${html}<button class="pclose">ปิด</button></div>`;
  p.querySelector<HTMLButtonElement>(".pclose")!.onclick = onClose;
  p.onclick = (e) => { if (e.target === p) onClose(); };
  return p;
}

/** หน้าคนรู้จัก — ใช้ข้อมูลใน characters.json ที่เดิมมีครบแต่ไม่เคยถูกแสดงเลยสักฟิลด์ */
export function characterPanel(s: GameState) {
  let h = `<h2>คนรู้จัก<small>${standingLabel(s.standing)}</small></h2>`;
  if (s.sided) {
    const side = chars.find((c) => c.id === s.sided);
    h += `<p class="dimline">เทอมนี้เราเลือกยืนข้าง<b style="color:${side?.color}">${side?.name}</b>ไปแล้ว
      อีกฝั่งปิดถาวรจนจบเทอม</p>`;
  }
  for (const c of chars) {
    const v = s.affinity[c.id] ?? 0;
    const r = affinityRank(v);
    const likes = (c.likes as string[]).map(statName).join(" · ");
    const gate = c.gate as { stat: string; value: number; hint: string } | undefined;
    const locked = gate && s.stats[gate.stat as StatId] < gate.value;
    h += `<div class="card person" style="border-color:${c.color}44">
      <div class="prow">
        <span class="avatar lg">${portraitHTML(c.id)}</span>
        <div class="pinfo">
          <div class="chead"><b style="color:${c.color}">${c.name}</b>
            <small>${c.year} · ${c.tag}</small></div>
          <div class="cblurb">${c.blurb}</div>
        </div>
      </div>
      <div class="kv"><span>ความสัมพันธ์</span>
        <div class="minibar"><i style="width:${(r / 10) * 100}%;background:${c.color}"></i></div>
        <b>ระดับ ${r}</b></div>
      <div class="kv"><span>ให้ค่ากับ</span><b>${likes}</b></div>
      ${locked ? `<div class="gate">🔒 ${gate!.hint} (ตอนนี้${statName(gate!.stat)} ${Math.floor(s.stats[gate!.stat as StatId])}/${gate!.value})</div>` : ""}
    </div>`;
  }
  open(h);
}

export interface BagHandlers {
  onBuy: (id: string) => void;
  onUse: (id: string) => void;
  onGift: (itemId: string, charId: string) => void;
}

export function bagPanel(s: GameState, hx: BagHandlers) {
  let h = `<h2>กระเป๋า <small>${Math.round(s.money)} บาท</small></h2>`;
  const mine = usable(s), gifts = giftable(s);
  h += "<h3>ของที่มีอยู่</h3>";
  if (!mine.length && !gifts.length) h += '<div class="sub">ยังไม่มีอะไรในกระเป๋า</div>';
  for (const it of mine)
    h += `<div class="row"><span>${it.icon} ${it.name} ×${s.inventory[it.id]}</span>
      <button data-use="${it.id}">ใช้</button></div>`;
  for (const it of gifts)
    h += `<div class="row"><span>${it.icon} ${it.name} ×${s.inventory[it.id]}</span>
      <span class="giftrow">${chars.map((c) =>
        `<button data-gift="${it.id}" data-char="${c.id}" style="border-color:${c.color}66">ให้${c.name}</button>`).join("")}</span></div>`;

  h += "<h3>ร้านหน้าโรงเรียน</h3>";
  for (const it of ITEMS) {
    const can = s.money >= it.price;
    h += `<div class="row"><span>${it.icon} ${it.name}<small>${it.desc}</small></span>
      <button data-buy="${it.id}" ${can ? "" : "disabled"}>${it.price} บาท</button></div>`;
  }
  const p = open(h);
  p.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => (b.onclick = () => hx.onBuy(b.dataset.buy!)));
  p.querySelectorAll<HTMLButtonElement>("[data-use]").forEach((b) => (b.onclick = () => hx.onUse(b.dataset.use!)));
  p.querySelectorAll<HTMLButtonElement>("[data-gift]").forEach((b) =>
    (b.onclick = () => hx.onGift(b.dataset.gift!, b.dataset.char!)));
}

/** ปฏิทินเทอม — ให้ผู้เล่นวางแผนได้ว่าอีกกี่วันถึงสอบ กี่วันถึงกีฬาสี */
export function calendarPanel(s: GameState) {
  const club = clubOf(s);
  let h = `<h2>ปฏิทินเทอม</h2><div class="sub">วันนี้คือวันที่ ${s.dayIndex + 1} จาก ${game.term.days}</div>`;
  if (club) h += `<div class="sub">ชมรม: ${club.icon} ${club.name} · กิจกรรมทุกวัน${club.days.map((d) => ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"][d]).join(" และ ")}</div>`;
  const MONTH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const start = new Date(game.term.startDate + "T00:00:00");
  let lastMonth = -1;
  for (const e of EVENTS) {
    const d = new Date(start); d.setDate(d.getDate() + e.day);
    if (d.getMonth() !== lastMonth) { lastMonth = d.getMonth(); h += `<h3>${MONTH[lastMonth]}</h3>`; }
    const past = e.day < s.dayIndex, today = e.day === s.dayIndex;
    const away = e.day - s.dayIndex;
    h += `<div class="row ev ${past ? "past" : today ? "today" : ""}${e.exam ? " exam" : ""}">
      <span><b class="evday">${d.getDate()}</b></span>
      <span>${e.name}${e.holiday ? " <small>โรงเรียนหยุด</small>" : ""}</span>
      <b>${past ? "ผ่านไปแล้ว" : today ? "วันนี้" : `อีก ${away} วัน`}</b></div>`;
  }
  open(h);
}

export interface MenuHandlers {
  slots: { id: string; label: string; desc: string; has: boolean }[];
  onSave: (id: string) => void;
  onLoad: (id: string) => void;
  onWipe: (id: string) => void;
  onNew: () => void;
}

export function menuPanel(s: GameState, hx: MenuHandlers) {
  let h = `<h2>เมนู</h2>
    <div class="kv"><span>ความประพฤติ</span><b>${Math.round(s.behaviour)} · ${behaviourLabel(s.behaviour)}</b></div>
    <div class="kv"><span>ความพร้อมสอบ</span><b>${Math.round(s.study)}</b></div>
    <div class="kv"><span>โดนจับได้</span><b>${s.caught} ครั้ง</b></div><hr>`;
  for (const sl of hx.slots)
    h += `<div class="row"><span>${sl.label}<small>${sl.desc}</small></span>
      <span><button data-save="${sl.id}">บันทึก</button>
      <button data-load="${sl.id}" ${sl.has ? "" : "disabled"}>โหลด</button>
      <button data-wipe="${sl.id}" class="danger" ${sl.has ? "" : "disabled"}>ลบ</button></span></div>`;
  h += `<hr><div class="row"><span>เริ่มเทอมใหม่<small>ความคืบหน้าที่ยังไม่บันทึกจะหายไป</small></span>
    <button data-new="1" class="danger">เริ่มใหม่</button></div>`;
  if (s.history.length) {
    h += `<hr><h3>สิ่งที่เกิดขึ้นมาแล้ว</h3>`;
    for (const line of s.history.slice(-12).reverse()) h += `<div class="sub">${line}</div>`;
  }
  const p = open(h);
  p.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((b) => (b.onclick = () => hx.onSave(b.dataset.save!)));
  p.querySelectorAll<HTMLButtonElement>("[data-load]").forEach((b) => (b.onclick = () => hx.onLoad(b.dataset.load!)));
  p.querySelectorAll<HTMLButtonElement>("[data-wipe]").forEach((b) => (b.onclick = () => hx.onWipe(b.dataset.wipe!)));
  p.querySelector<HTMLButtonElement>("[data-new]")!.onclick = hx.onNew;
}

export function clubPickPanel(onPick: (id: string) => void) {
  let h = `<h2>เลือกชมรม</h2><div class="sub">เลือกได้ครั้งเดียวทั้งเทอม ชมรมจะล็อกตารางเย็นบางวัน
    และทำให้ได้เจอบางคนบ่อยขึ้น</div>`;
  for (const c of CLUBS) {
    const days = c.days.map((d) => ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"][d]).join(" · ");
    h += `<div class="card clickable" data-club="${c.id}">
      <div class="chead"><b>${icon(c.id)} ${c.name}</b><small>${days}</small></div>
      <div class="cblurb">${c.blurb}</div>
      <div class="kv"><span>ได้</span><b>${statName(c.stat)} +${c.gain} ต่อครั้ง</b></div>
      <div class="kv"><span>งานใหญ่</span><b>${c.milestoneName}</b></div>
    </div>`;
  }
  const p = open(h, () => { /* เลือกก่อนถึงจะปิดได้ */ });
  p.querySelector<HTMLButtonElement>(".pclose")!.style.display = "none";
  p.onclick = null;
  p.querySelectorAll<HTMLElement>("[data-club]").forEach((c) =>
    (c.onclick = () => onPick(c.dataset.club!)));
}

export function examPanel(r: ExamReport, onClose: () => void) {
  const pct = Math.round(((r.classSize - r.rank) / (r.classSize - 1)) * 100);
  const h = `<h2>${r.name}</h2>
    <div class="big">${r.score}<small> / 100</small></div>
    <div class="kv"><span>อันดับในห้อง</span><b>ที่ ${r.rank} จาก ${r.classSize} คน</b></div>
    <div class="kv"><span>ดีกว่าเพื่อน</span>
      <div class="minibar"><i style="width:${pct}%;background:#8ec7a0"></i></div><b>${pct}%</b></div>
    ${r.note ? `<div class="gate">${r.note}</div>` : ""}`;
  open(h, onClose);
}

export function endingPanel(e: Ending, onClose: () => void, next?: { label: string; fn: () => void }) {
  const tone = e.tone === "great" ? "#8ec7a0" : e.tone === "good" ? "#c8b06a"
             : e.tone === "ok" ? "#9aa6c8" : "#c88a8a";
  let h = `<h2>จบเทอม</h2>
    <div class="big" style="color:${tone}">${e.tier}</div>
    <div class="kv"><span>คะแนนรวมทั้งเทอม</span><b>${e.score}</b></div><hr>`;
  for (const line of e.lines) h += `<div class="row"><span>${line}</span></div>`;
  h += next
    ? `<button class="nextchap" id="bNextChap">${next.label}</button>`
    : `<div class="sub">เทอมหน้ายังมาได้อีก — กด "เริ่มใหม่" ในเมนูเมื่อพร้อม</div>`;
  const p = open(h, onClose);
  if (next) p.querySelector<HTMLButtonElement>("#bNextChap")!.onclick = next.fn;
}

/** สมุดพก — เกรดรายวิชาแบบ ปพ. ที่คนไทยทุกคนรู้ว่าหน้าตาเป็นยังไง */
export function gradePanel(s: GameState) {
  const g = gpa(s);
  let h = `<h2>สมุดพก<small>เกรดเฉลี่ย ${g.toFixed(2)}</small></h2><div class="sheet">`;
  for (const sub of SUBJECTS) {
    const v = s.grades[sub.id] ?? 0;
    const gr = gradeOf(v);
    h += `<div class="row"><b>${sub.name}</b>
      <i style="width:${Math.min(100, v)}%"></i>
      <span class="gr g${gr.grade}">${gr.name}</span></div>`;
  }
  h += `</div><p class="dimline">เข้าเรียนได้ทุกวิชานิดหน่อย ส่งการบ้านได้เพิ่ม
    และติวที่โรงเรียนกวดวิชาได้เจาะวิชาเดียว · ความรู้จางลงทุกวันถ้าไม่ได้ทบทวน</p>`;
  open(h);
}

/** กระดานประกาศผลสอบหน้าห้อง — ของที่ทั้งห้องยืนอ่าน ไม่ใช่สมุดพกของเราคนเดียว
 *  เรียงตามคะแนน ชื่อเราถูกไฮไลต์ และมีลูกศรบอกว่าใครขึ้นใครร่วงจากรอบก่อน */
export function boardPanel(rows: BoardRow[], onClose: () => void) {
  const me = rows.find((r) => r.me);
  let h = `<h2>ประกาศผลสอบ<small>${me ? `เราอยู่อันดับ ${me.rank} ของห้อง` : ""}</small></h2>
    <div class="board">`;
  for (const r of rows) {
    const mv = r.move > 0 ? `<em class="up">▲${r.move}</em>`
             : r.move < 0 ? `<em class="down">▼${-r.move}</em>` : "";
    h += `<div class="brow${r.me ? " is-me" : ""}">
      <span class="brank">${r.rank}</span>
      <b>${r.name}</b>${r.tutored ? '<span class="btut">ติวให้</span>' : ""}
      ${mv}<span class="bscore">${r.score}</span></div>`;
  }
  h += `</div><p class="dimline">กระดานติดอยู่หน้าห้องทั้งสัปดาห์ ทุกคนที่เดินผ่านอ่านได้หมด</p>`;
  open(h, onClose);
}

/** เลือกวิชาที่จะติว — นี่คือสิ่งที่ทำให้โรงเรียนกวดวิชา 320 บาทมีความหมาย */
export function subjectPanel(s: GameState, onPick: (id: string) => void) {
  let h = "<h2>จะติววิชาอะไร<small>เลือกได้วิชาเดียว</small></h2>";
  for (const sub of SUBJECTS) {
    const v = s.grades[sub.id] ?? 0;
    h += `<button class="thread" data-sub="${sub.id}">
      <span class="tinfo"><b>${sub.name}</b><small>ตอนนี้ ${gradeOf(v).name} (${Math.round(v)}/100)</small></span>
      <span class="tday">${v < 50 ? "ควรติว" : v < 75 ? "พอไหว" : "ดีอยู่แล้ว"}</span></button>`;
  }
  const p = open(h);
  p.querySelectorAll<HTMLButtonElement>("[data-sub]").forEach((b) =>
    (b.onclick = () => onPick(b.dataset.sub!)));
}

export function noticePanel(title: string, body: string, onClose: () => void) {
  open(`<h2>${title}</h2><div class="sub">${body}</div>`, onClose);
}

export const statLabel = (id: StatId, v: number) =>
  `${statName(id)} ${game.statRankNames[statRank(v)]}`;
