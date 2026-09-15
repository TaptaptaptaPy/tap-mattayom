import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { CLUBS, clubOf } from "../sim/club";
import { ITEMS, giftable, usable } from "../sim/shop";
import { behaviourLabel } from "../sim/discipline";
import { standingLabel } from "../sim/bonds";
import { SUBJECTS, gradeOf, gpa } from "../sim/grades";
import type { BoardRow } from "../sim/state";
import type { MilestoneResult } from "../sim/milestone";
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
  onHow: () => void;
  onDiary: () => void;
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
  h += `<hr><div class="row"><span>วิธีเล่น<small>ระบบทั้งหมดของเกมในหน้าเดียว</small></span>
    <button data-how="1">เปิด</button></div>`;
  h += `<hr><div class="row"><span>เริ่มเทอมใหม่<small>ความคืบหน้าที่ยังไม่บันทึกจะหายไป</small></span>
    <button data-new="1" class="danger">เริ่มใหม่</button></div>`;
  if (s.history.length) {
    h += `<hr><div class="row"><span>สมุดบันทึกของเทอม<small>${s.history.length} เรื่องที่เกิดขึ้นมาแล้ว</small></span>
      <button data-diary="1">เปิด</button></div>`;
    for (const line of s.history.slice(-4).reverse()) h += `<div class="sub">${line}</div>`;
  }
  const p = open(h);
  p.querySelector<HTMLButtonElement>("[data-diary]")?.addEventListener("click", hx.onDiary);
  p.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((b) => (b.onclick = () => hx.onSave(b.dataset.save!)));
  p.querySelectorAll<HTMLButtonElement>("[data-load]").forEach((b) => (b.onclick = () => hx.onLoad(b.dataset.load!)));
  p.querySelectorAll<HTMLButtonElement>("[data-wipe]").forEach((b) => (b.onclick = () => hx.onWipe(b.dataset.wipe!)));
  p.querySelector<HTMLButtonElement>("[data-new]")!.onclick = hx.onNew;
  p.querySelector<HTMLButtonElement>("[data-how]")!.onclick = hx.onHow;
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

/** ถามก่อนฝืน — ราคาของการฝืนตกที่วันพรุ่งนี้ ผู้เล่นต้องเห็นราคานั้นก่อนกด
 *  ห้ามฝืนให้เอง ไม่งั้นมันกลับไปเป็นกำแพงที่เกมตัดสินใจแทนเหมือนเดิม */
export function pushPanel(body: string, cost: string, onYes: () => void, onNo: () => void) {
  const p = open(`<h2>ฝืนต่อไหม<small>${cost}</small></h2>
    <div class="sub">${body}</div>
    <button class="nextchap" id="bPush">ฝืน</button>`, onNo);
  p.querySelector<HTMLButtonElement>("#bPush")!.onclick = onYes;
}

/** ผลของวันงานใหญ่ — ต้องบอกให้ชัดว่าที่ได้เท่านี้เพราะซ้อมมาเท่านี้
 *  ไม่งั้นผู้เล่นจะอ่านว่า "มินิเกมทำได้ไม่ดี" ทั้งที่เรื่องจริงคือทั้งเทอมไม่ค่อยไป */
export function milestonePanel(r: MilestoneResult, onClose: () => void) {
  const pct = Math.min(100, (r.attended / r.needed) * 100);
  let h = `<h2>${r.name}<small>${r.tierName}</small></h2>
    <div class="sheet"><div class="row"><b>ซ้อมมา</b>
      <i style="width:${pct}%"></i>
      <span class="gr">${r.attended}/${r.needed} ครั้ง</span></div></div>`;
  for (const line of r.lines) h += `<div class="row"><span>${line}</span></div>`;
  if (r.tier === 0)
    h += `<p class="dimline">สมัครไว้แต่แทบไม่ได้ไป วันนี้คือวันที่ทั้งโรงเรียนได้เห็นพร้อมกัน</p>`;
  open(h, onClose);
}

/** สมุดบันทึกของเทอม
 *
 *  `remember()` เก็บไว้ 200 บรรทัด แต่เมนูเคยโชว์แค่ 12 บรรทัดสุดท้ายและเลื่อนดูไม่ได้
 *  ตอนนี้ทุกระบบเขียนลงสมุดนี้ (กระดาน · คำโกหก · งานชมรม · ครู · ที่บ้าน · เรื่องลับหลัง)
 *  แปลว่าบันทึกของทั้งเทอมมีอยู่จริงแต่ผู้เล่นอ่านไม่ได้ ซึ่งเท่ากับไม่มี
 *
 *  กรองตามหมวดได้ เพราะ 200 บรรทัดเรียงกันรวดเดียวก็อ่านไม่ออกเหมือนกัน */
const DIARY_TABS: { id: string; name: string; match: RegExp }[] = [
  { id: "all", name: "ทั้งหมด", match: /./ },
  { id: "people", name: "คน", match: /ไปตามนัด|ผิดนัด|เห็นเราอยู่กับ|พูดไม่ตรงกัน|เรื่องนี้ไปถึง|คุยกับ|ติว/ },
  { id: "school", name: "โรงเรียน", match: /สอบ|การบ้าน|เกรด|กระดาน|ชมรม|ครู|ซ่อม|งานกลุ่ม|ผม|ปกครอง/ },
  { id: "home", name: "ที่บ้าน", match: /ที่บ้าน|ค่าขนม|แม่|ลุกไม่ไหว|หลับในคาบ/ },
];

export function diaryPanel(s: GameState, onClose: () => void) {
  let tab = "all";
  const p = open("", onClose);
  const draw = () => {
    const re = DIARY_TABS.find((t) => t.id === tab)!.match;
    const rows = s.history.filter((l) => re.test(l)).reverse();
    let h = `<h2>สมุดบันทึกของเทอม<small>${rows.length} จาก ${s.history.length} เรื่อง</small></h2>
      <div class="dtabs">` +
      DIARY_TABS.map((t) => `<button class="dtab${t.id === tab ? " is-on" : ""}" data-tab="${t.id}">${t.name}</button>`).join("") +
      `</div><div class="diary">`;
    h += rows.length
      ? rows.map((l) => `<div class="dline">${l}</div>`).join("")
      : `<div class="sub">ยังไม่มีเรื่องในหมวดนี้</div>`;
    h += `</div>`;
    p.innerHTML = `<div class="pwrap">${h}<button class="pclose">ปิด</button></div>`;
    p.querySelector<HTMLButtonElement>(".pclose")!.onclick = onClose;
    p.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) =>
      (b.onclick = () => { tab = b.dataset.tab!; draw(); }));
  };
  draw();
}

/** วิธีเล่น — เกมนี้มี 14 ระบบซ้อนกันอยู่ และเดิมไม่มีอะไรบอกผู้เล่นเลยสักบรรทัด
 *  ซึ่งเป็นเหตุผลเดียวกับที่เคยต้องตัดขอบเขตของอีกเกมทิ้ง
 *  เปิดเองครั้งแรก และเปิดซ้ำได้จากเมนูเสมอ */
export function howToPanel(onClose: () => void) {
  const h = `<h2>ชีวิตหนึ่งเทอม<small>วันละสี่ช่วงเวลา · ${game.term.days} วัน</small></h2>
    <div class="howto">
      <div class="hrow"><b>เวลาคือของที่มีจำกัด</b>
        ทุกอย่างที่ทำกินไปหนึ่งช่วงเวลา เลือกอันหนึ่งคือไม่ได้อีกอันเสมอ</div>
      <div class="hrow"><b>สามอย่างที่เกมยัดใส่มือ ไม่ใช่ของที่เลือกทำ</b>
        การบ้านทุกวันเรียน · สอบซ่อมหลังประกาศผล · งานกลุ่มที่จับคู่ให้กับคนที่สนิทน้อยที่สุด
        ทั้งสามโผล่เป็นการ์ดบนสุดของกระดาน เพราะมันมาก่อนของที่เลือกทำได้</div>
      <div class="hrow"><b>ความสัมพันธ์มีสองแกน</b>
        <em>ความสนิท</em> มาจากการใช้เวลาด้วยกัน · <em>ความเชื่อใจ</em> มาจากการทำสิ่งที่ยาก
        ชอบเราได้โดยไม่กล้าฝากเรื่องสำคัญไว้กับเรา</div>
      <div class="hrow"><b>คนอื่นมีชีวิตตอนเราไม่อยู่</b>
        ไม่ไปหาใครนานๆ เรื่องจะเกิดขึ้นเองโดยที่เราไม่อยู่ตรงนั้น แล้วเขาจะเล่าให้เพื่อนฟัง</div>
      <div class="hrow"><b>การเลือกมีพยาน</b>
        ที่ที่เราไปนั่งคุยกันมีคนอื่นอยู่ด้วย คนที่นัดเราไว้แล้วเห็นเราอยู่กับอีกคน เจ็บกว่าการผิดนัดเฉยๆ</div>
      <div class="hrow"><b>แรงเป็นทางเลือก ไม่ใช่กำแพง</b>
        หมดแรงแล้วยังฝืนทำต่อได้ แต่ได้ผลน้อยลงและเป็นหนี้การนอน
        ฝืนหลายคืนติดจะหลับในคาบ และมากกว่านั้นจะตื่นมาแล้วลุกไม่ไหวทั้งวัน</div>
      <div class="hrow"><b>ครูประจำชั้นมองอยู่</b>
        ค่านี้ขยับจากความรับผิดชอบ ไม่ใช่จากการไปหา
        ครูที่ไว้ใจเราจะพูดแทนตอนโดนจับ ครูที่ไม่ไว้ใจจะโทรหาที่บ้าน</div>
      <div class="hrow"><b>ผลสอบติดหน้าห้องให้ทุกคนอ่าน</b>
        เพื่อนทุกคนมีคะแนนของตัวเอง และแรงกดดันในชีวิตที่เราปล่อยไว้ไปโผล่บนกระดานนั้นด้วย</div>
      <div class="hrow"><b>ทางบ้านจะโทรมา</b>
        เงินที่เก็บไว้คือเงินที่ทางบ้านต้องใช้ ให้ไปแล้วหายจริง ไม่ให้ก็มีราคาอีกแบบ</div>
    </div>
    <p class="dimline">เปิดหน้านี้ซ้ำได้จากเมนูตลอดเวลา</p>`;
  open(h, onClose);
}

export function noticePanel(title: string, body: string, onClose: () => void) {
  open(`<h2>${title}</h2><div class="sub">${body}</div>`, onClose);
}

export const statLabel = (id: StatId, v: number) =>
  `${statName(id)} ${game.statRankNames[statRank(v)]}`;
