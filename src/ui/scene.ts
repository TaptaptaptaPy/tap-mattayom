import type { Story } from "inkjs/types";
import { portraitSVG, type Mood } from "./portrait";

const $ = (id: string) => document.getElementById(id)!;
const REVEAL_MS = 16;          // ความเร็วไล่ตัวอักษร

let typing: number | null = null;

/** เดาอารมณ์จากเครื่องหมายในประโยค — ถูกบ้างผิดบ้าง แต่ทำให้หน้าไม่นิ่งสนิท */
function moodOf(line: string): Mood {
  if (/[!?]$/.test(line.trim())) return "tense";
  if (/ยิ้ม|หัวเราะ|ขอบคุณ/.test(line)) return "happy";
  if (/เงียบ|ก้มหน้า|มองพื้น|ไม่พูด/.test(line)) return "away";
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

/** กล่องบทสนทนา: ภาพตัวละคร ป้ายชื่อ ข้อความที่ไล่ทีละตัว แล้วค่อยแสดงตัวเลือก
 *  บทบอกเองได้ว่ามีทางที่ยังเปิดไม่ได้ ผ่าน external setHint() — แสดงเป็นบรรทัดจางใต้ตัวเลือก */
export function playScene(story: Story, speaker: string, color: string,
                          charId: string | null, onEnd: () => void) {
  const box = $("scene"), lineEl = $("line"), choiceEl = $("choices"),
        spEl = $("speaker"), hintEl = $("hint"), artEl = $("portrait");
  box.classList.remove("hidden");
  spEl.textContent = speaker;
  (spEl as HTMLElement).style.color = color;
  box.style.setProperty("--who", color);
  hintEl.textContent = "";
  artEl.innerHTML = portraitSVG(charId);

  const finish = () => {
    box.classList.add("hidden");
    hintEl.textContent = "";
    if (typing !== null) { clearInterval(typing); typing = null; }
    onEnd();
  };

  let current = "";
  const showChoices = () => {
    choiceEl.innerHTML = "";
    if (story.currentChoices.length > 0) {
      story.currentChoices.forEach((c, i) => {
        const b = addButton(choiceEl, c.text, () => {
          hintEl.textContent = "";
          story.ChooseChoiceIndex(i);
          step();
        }, true);
        b.style.animationDelay = `${i * 55}ms`;
      });
    } else {
      addButton(choiceEl, "จบบทสนทนา", finish);
    }
  };

  const step = () => {
    choiceEl.innerHTML = "";
    if (story.canContinue) {
      current = story.Continue()?.trim() ?? "";
      artEl.dataset.mood = moodOf(current);
      artEl.innerHTML = portraitSVG(charId, moodOf(current));
      reveal(lineEl, current, () => {
        if (story.canContinue) addButton(choiceEl, "▸", step);
        else showChoices();
      });
      return;
    }
    showChoices();
  };

  // แตะที่ข้อความเพื่อข้ามการไล่ตัวอักษร — คนอ่านเร็วจะได้ไม่ต้องรอ
  lineEl.onclick = () => finishTyping(lineEl, current, () => {
    if (story.canContinue) { choiceEl.innerHTML = ""; addButton(choiceEl, "▸", step); }
    else showChoices();
  });

  step();
}

export function showHint(text: string) {
  $("hint").textContent = "ยังมีทางที่เปิดไม่ได้ · " + text;
}

function addButton(parent: HTMLElement, label: string, fn: () => void, isChoice = false) {
  const b = document.createElement("button");
  b.className = isChoice ? "choice" : "next";
  b.textContent = label;
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}
