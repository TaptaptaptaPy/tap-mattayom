import type { Story } from "inkjs/types";
import { portraitHTML, MOODS, type Mood } from "./portrait";
import { backdrop } from "./backdrop";

const $ = (id: string) => document.getElementById(id)!;
const REVEAL_MS = 16;          // ความเร็วไล่ตัวอักษร
const AUTO_HOLD = 1500;        // เดินบทอัตโนมัติ: หยุดให้อ่านกี่มิลลิวินาทีต่อบรรทัด

let typing: number | null = null;
let autoTimer: number | null = null;
/** เดินบทอัตโนมัติอยู่ไหม — ค้างข้ามฉาก เพราะคนที่เปิดไว้อยากให้มันเปิดต่อ */
let auto = false;

/** บทที่ผ่านไปแล้วในฉากนี้ — ของที่เกมแนวนี้มีเสมอและเกมนี้ไม่เคยมี
 *  กดเร็วไปหนึ่งบรรทัดแล้วอ่านไม่ทัน เท่ากับอ่านไม่ได้อีกเลยทั้งเกม */
interface LogLine { who: string; text: string; mine: boolean; }
let backlog: LogLine[] = [];

/** อารมณ์ที่บทสั่งไว้เองสำหรับบรรทัดถัดไป — ตั้งผ่าน `~ feel("shy")` ในบท
 *  ผู้เขียนบทรู้ดีกว่าตัวเดาเสมอ ตัวเดาเป็นแค่ของสำรองตอนที่บทไม่ได้บอก */
let forced: Mood | null = null;
export function setMood(m: string) {
  forced = (MOODS as string[]).includes(m) ? (m as Mood) : null;
}

/** เดาอารมณ์จากคำในประโยค — ใช้เมื่อบทไม่ได้สั่งไว้
 *
 *  ของเดิมเดาจากเครื่องหมายท้ายประโยคอย่างเดียว: ลงท้ายด้วย ! หรือ ? = หน้าตึงทุกครั้ง
 *  ซึ่งแปลว่าทุกคำถามในเกมทำให้ตัวละครทำหน้าโกรธ · ตอนนี้ดูคำที่อยู่ในประโยคจริงๆ
 *  และเรียงจากเฉพาะเจาะจงไปหากว้าง เพราะบรรทัดหนึ่งเข้าได้หลายข้อ */
function moodOf(line: string): Mood {
  if (forced) { const m = forced; forced = null; return m; }
  const s = line.trim();
  if (/หัวเราะ|ขำ|ฮ่า|555/.test(s)) return "laugh";
  if (/เขิน|หน้าแดง|กระแอม|พูดไม่ออก|ลนลาน/.test(s)) return "shy";
  if (/ร้องไห้|น้ำตา|เสียใจ|ขอโทษ|เศร้า|สะอื้น/.test(s)) return "sad";
  if (/ตกใจ|สะดุ้ง|อ้าปากค้าง|ไม่อยากเชื่อ|หา\?|เฮ้ย/.test(s)) return "shock";
  if (/โกรธ|ตวาด|เสียงดัง|ตะโกน|ว่าไง.*วะ|กัดฟัน/.test(s)) return "angry";
  if (/เงียบ|ก้มหน้า|มองพื้น|ไม่พูด|มองออกไปนอกหน้าต่าง|ถอนหายใจ/.test(s)) return "away";
  if (/ยิ้ม|ขอบคุณ|ดีใจ|โล่ง/.test(s)) return "happy";
  if (/คิด|ลังเล|นึก|สงสัย|เอ่อ|\?$/.test(s)) return "think";
  if (/จริงจัง|มองตรงมา|ตัดสินใจ|ไม่ยอม|พอแล้ว/.test(s)) return "firm";
  return "calm";
}

function reveal(el: HTMLElement, text: string, done: () => void) {
  if (typing !== null) { clearInterval(typing); typing = null; }
  el.textContent = "";
  let i = 0;
  typing = window.setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      el.textContent = text;
      if (typing !== null) clearInterval(typing);
      typing = null;
      done();
    }
  }, REVEAL_MS);
}

function finishTyping(el: HTMLElement, text: string, done: () => void) {
  if (typing === null) return false;
  clearInterval(typing); typing = null;
  el.textContent = text;
  done();
  return true;
}

const clearAuto = () => { if (autoTimer !== null) { clearTimeout(autoTimer); autoTimer = null; } };

/** กล่องบทสนทนา: ภาพตัวละคร ป้ายชื่อ ข้อความที่ไล่ทีละตัว แล้วค่อยแสดงตัวเลือก
 *  บทบอกเองได้ว่ามีทางที่ยังเปิดไม่ได้ ผ่าน external setHint() — แสดงเป็นบรรทัดจางใต้ตัวเลือก */
export function playScene(story: Story, speaker: string, color: string,
                          charId: string | null, onEnd: () => void, bg?: string, period?: string,
                          unknown = false) {
  const box = $("scene"), lineEl = $("line"), choiceEl = $("choices"),
        spEl = $("speaker"), hintEl = $("hint"), artEl = $("portrait"),
        bgEl = $("sceneBg");
  bgEl.innerHTML = bg ? backdrop(bg, period) : "";
  bgEl.classList.toggle("hidden", !bg);
  box.classList.remove("hidden");
  spEl.textContent = speaker;
  spEl.classList.remove("is-named");
  (spEl as HTMLElement).style.color = color;
  box.style.setProperty("--who", color);
  hintEl.textContent = "";
  // ยังไม่รู้ว่าเป็นใคร ก็ยังไม่ควรเห็นหน้า — ภาพเป็นเงาจนกว่าบทจะเรียก introduce()
  artEl.classList.toggle("is-unknown", unknown);
  artEl.innerHTML = portraitHTML(charId);
  backlog = [];
  closeBacklog();
  wireTools();

  const finish = () => {
    clearAuto();
    box.classList.add("hidden");
    hintEl.textContent = "";
    closeBacklog();
    if (typing !== null) { clearInterval(typing); typing = null; }
    onEnd();
  };

  let current = "";
  const showChoices = () => {
    clearAuto();
    choiceEl.innerHTML = "";
    if (story.currentChoices.length > 0) {
      story.currentChoices.forEach((c, i) => {
        const b = addButton(choiceEl, c.text, () => {
          hintEl.textContent = "";
          backlog.push({ who: "เรา", text: c.text, mine: true });
          story.ChooseChoiceIndex(i);
          step();
        }, true);
        b.style.animationDelay = `${i * 55}ms`;
      });
    } else {
      addButton(choiceEl, "จบบทสนทนา", finish);
    }
  };

  /** บรรทัดจบแล้ว — รอกดต่อ หรือเดินเองถ้าเปิดออโต้ไว้
   *  ทางเลือกไม่เคยถูกกดเอง เพราะการตัดสินใจเป็นของผู้เล่นเสมอ */
  const settled = () => {
    if (story.canContinue) {
      choiceEl.innerHTML = "";
      addButton(choiceEl, "▸", step);
      clearAuto();
      if (auto) autoTimer = window.setTimeout(step, AUTO_HOLD);
    } else showChoices();
  };

  const step = () => {
    clearAuto();
    choiceEl.innerHTML = "";
    if (story.canContinue) {
      current = story.Continue()?.trim() ?? "";
      backlog.push({ who: spEl.textContent ?? "", text: current, mine: false });
      // เรียก moodOf() ครั้งเดียว — มันกิน `forced` ทิ้งหลังใช้ เรียกสองรอบได้คนละอารมณ์
      const mood = moodOf(current);
      artEl.dataset.mood = mood;
      artEl.innerHTML = portraitHTML(charId, mood);
      reveal(lineEl, current, settled);
      return;
    }
    showChoices();
  };

  // แตะที่ข้อความเพื่อข้ามการไล่ตัวอักษร — คนอ่านเร็วจะได้ไม่ต้องรอ
  lineEl.onclick = () => finishTyping(lineEl, current, settled);

  step();
}

/** เปลี่ยนป้ายชื่อกลางฉาก — ใช้ตอนที่เพิ่งได้รู้ว่าคนตรงหน้าชื่ออะไร
 *  ฉากเจอกันครั้งแรกขึ้นต้นด้วยคำเรียกกลางๆ แล้วกลายเป็นชื่อจริงตรงบรรทัดที่เขาบอกชื่อ
 *  ซึ่งเป็นจังหวะเดียวกับที่มันเกิดขึ้นจริงเวลาเจอคนใหม่ */
export function setSpeaker(name: string) {
  const el = $("speaker");
  // รู้ชื่อเขาแล้ว ก็เห็นหน้าเขาได้แล้ว — สองอย่างนี้เกิดพร้อมกันเสมอ
  $("portrait").classList.remove("is-unknown");
  if (el.textContent === name) return;
  el.textContent = name;
  el.classList.remove("is-named");
  void el.offsetWidth;
  el.classList.add("is-named");
}

export function showHint(text: string) {
  $("hint").textContent = "ยังมีทางที่เปิดไม่ได้ · " + text;
}

// ───────────────────────── ย้อนอ่าน / ออโต้ ─────────────────────────

const closeBacklog = () => { $("backlog").classList.add("hidden"); $("backlog").innerHTML = ""; };

function openBacklog() {
  const el = $("backlog");
  el.innerHTML = `<div class="logwrap"><h3>ย้อนอ่านฉากนี้</h3>` +
    (backlog.length
      ? backlog.map((l) => `<div class="logline${l.mine ? " mine" : ""}">
          <b>${l.who}</b>${l.text}</div>`).join("")
      : `<div class="sub">ยังไม่มีอะไรให้ย้อนอ่าน</div>`) +
    `<button class="pclose" id="bLogClose">ปิด</button></div>`;
  el.classList.remove("hidden");
  el.scrollTop = el.scrollHeight;
  $("bLogClose").onclick = closeBacklog;
}

function wireTools() {
  const autoBtn = $("bAuto");
  autoBtn.classList.toggle("is-on", auto);
  autoBtn.onclick = () => {
    auto = !auto;
    autoBtn.classList.toggle("is-on", auto);
    clearAuto();
    // เปิดออโต้ตอนที่บรรทัดพิมพ์จบแล้วและยังไม่มีตัวเลือก ต้องเดินต่อทันที ไม่ใช่รอบรรทัดหน้า
    if (auto) {
      const next = document.querySelector<HTMLButtonElement>("#choices .next");
      if (next) autoTimer = window.setTimeout(() => next.click(), AUTO_HOLD);
    }
  };
  $("bLog").onclick = openBacklog;
}

/** ตอนนี้เดินบทอัตโนมัติอยู่ไหม — เทสต์ใช้ตรวจว่าปุ่มทำงานจริง */
export const isAuto = () => auto;

function addButton(parent: HTMLElement, label: string, fn: () => void, isChoice = false) {
  const b = document.createElement("button");
  b.className = isChoice ? "choice" : "next";
  b.textContent = label;
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}
