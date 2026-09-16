import type { Story } from "inkjs/types";
import chars from "../../data/characters.json";
import { nameOf } from "../sim/chat";
import type { ChatMsg, ChatThread, GameState } from "../sim/state";
import { portraitHTML } from "./portrait";

/** หน้าจอไลน์ — ฟองซ้ายคือเขา ฟองขวาคือเรา
 *  ข้อความของ "เรา" คือข้อความในวงเล็บเหลี่ยมของทางเลือกใน ink
 *  ฝั่งนี้เป็นคนเอาไปทำฟองขวาเอง คนเขียนบทจึงใช้ + ["..."] แบบเดียวกับบททั่วไปได้เลย */

const el = () => document.getElementById("panel")!;
/** หน่วงก่อนข้อความถัดไปโผล่ ให้รู้สึกว่าอีกฝั่งกำลังพิมพ์อยู่จริง */
const TYPING_MS = 520;

const charOf = (id: string) => chars.find((c) => c.id === id);

/** บทเขียนทางเลือกเป็น "..." เหมือนบทสนทนาปกติทั้งโปรเจกต์ (ดู ploy.ink)
 *  แต่ในหน้าแชท เครื่องหมายคำพูดดูแปลกเพราะฟองข้อความบอกอยู่แล้วว่าใครพูด จึงตัดออกตอนแสดง
 *  ทำที่ชั้นแสดงผล ไม่ใช่ที่บท เพื่อให้คนเขียนบทใช้รูปแบบเดียวกันได้ทุกไฟล์ */
const strip = (t: string) => t.trim().replace(/^["“”]+|["“”]+$/g, "").trim();

function shell(charId: string, sub: string) {
  const c = charOf(charId);
  const p = el();
  p.classList.remove("hidden");
  p.innerHTML = `<div class="pwrap chat">
    <div class="chead chat">
      <span class="cavatar">${portraitHTML(charId)}</span>
      <span class="cwho"><b style="color:${c?.color ?? "#fff"}">${nameOf(charId)}</b>
        <small>${sub}</small></span>
    </div>
    <div class="bubbles" id="chatBubbles"></div>
    <div class="replies" id="chatReplies"></div>
  </div>`;
  return {
    bubbles: document.getElementById("chatBubbles")!,
    replies: document.getElementById("chatReplies")!,
  };
}

function bubble(parent: HTMLElement, text: string, mine: boolean) {
  const b = document.createElement("div");
  b.className = "bub " + (mine ? "me" : "them");
  b.textContent = text;
  parent.appendChild(b);
  parent.scrollTop = parent.scrollHeight;
}

function button(parent: HTMLElement, label: string, fn: () => void, cls = "reply") {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}

/** เล่นบทแชทหนึ่งคืน แล้วคืนข้อความทั้งหมดกลับไปให้เก็บลงประวัติ */
export function playChat(story: Story, charId: string, onDone: (msgs: ChatMsg[]) => void) {
  const { bubbles, replies } = shell(charId, "ออนไลน์");
  const msgs: ChatMsg[] = [];
  let timer: number | null = null;

  const say = (text: string, mine: boolean) => {
    msgs.push({ text, mine });
    bubble(bubbles, text, mine);
  };

  /** ข้ามบรรทัดว่างไปเลย ไม่งั้นจะขึ้น "กำลังพิมพ์" ค้างไว้เฉยๆ โดยไม่มีข้อความตามมา */
  const nextLine = (): string | null => {
    while (story.canContinue) {
      const t = story.Continue()?.trim() ?? "";
      if (t) return t;
    }
    return null;
  };

  const step = () => {
    replies.innerHTML = "";
    const line = nextLine();
    if (line !== null) {
      const dots = document.createElement("div");
      dots.className = "bub them is-typing";
      dots.innerHTML = "<i></i><i></i><i></i>";
      bubbles.appendChild(dots);
      bubbles.scrollTop = bubbles.scrollHeight;
      timer = window.setTimeout(() => { dots.remove(); say(line, false); step(); }, TYPING_MS);
      return;
    }
    if (story.currentChoices.length) {
      story.currentChoices.forEach((ch, i) => {
        const said = strip(ch.text);
        button(replies, said, () => { say(said, true); story.ChooseChoiceIndex(i); step(); });
      });
      return;
    }
    button(replies, "ปิดแชท", () => {
      if (timer !== null) clearTimeout(timer);
      onDone(msgs);
    }, "reply close");
  };

  step();
}

/** ย้อนอ่านบทสนทนาเก่า — ไม่มีทางเลือกให้กดแล้ว เพราะมันเกิดไปแล้ว */
export function viewThread(t: ChatThread, onBack: () => void) {
  const { bubbles, replies } = shell(t.charId, `วันที่ ${t.day + 1}`);
  for (const m of t.msgs) bubble(bubbles, m.text, m.mine);
  button(replies, "ย้อนกลับ", onBack, "reply close");
}

/** รายชื่อแชททั้งหมด พร้อมปุ่มเปิดอันที่ยังไม่ได้อ่าน */
export function chatListPanel(s: GameState, hx: {
  onOpenPending: (charId: string) => void;
  onOpenThread: (t: ChatThread) => void;
  onClose: () => void;
}) {
  const p = el();
  p.classList.remove("hidden");

  let h = "<h2>ไลน์</h2>";
  if (s.pendingChat) {
    const c = charOf(s.pendingChat);
    h += `<button class="thread is-new" data-pending="1">
      <span class="cavatar">${portraitHTML(s.pendingChat)}</span>
      <span class="tinfo"><b style="color:${c?.color ?? "#fff"}">${nameOf(s.pendingChat)}</b>
        <small>ส่งข้อความมาเมื่อคืนนี้</small></span>
      <span class="dot"></span></button>`;
  }
  const past = [...s.chats].reverse();
  if (!past.length && !s.pendingChat)
    h += `<p class="dimline">ยังไม่มีใครทักมา ยิ่งสนิทกับใครมากขึ้น เขาก็ยิ่งทักมาตอนกลางคืนบ่อยขึ้น</p>`;
  for (const t of past) {
    const c = charOf(t.charId);
    const last = t.msgs[t.msgs.length - 1]?.text ?? "";
    h += `<button class="thread" data-id="${t.id}">
      <span class="cavatar">${portraitHTML(t.charId)}</span>
      <span class="tinfo"><b style="color:${c?.color ?? "#fff"}">${nameOf(t.charId)}</b>
        <small>${last.length > 38 ? last.slice(0, 38) + "…" : last}</small></span>
      <span class="tday">วันที่ ${t.day + 1}${t.invited ? " · นัดแล้ว" : ""}</span></button>`;
  }

  p.innerHTML = `<div class="pwrap">${h}<button class="pclose">ปิด</button></div>`;
  p.querySelector<HTMLButtonElement>(".pclose")!.onclick = hx.onClose;
  p.onclick = (e) => { if (e.target === p) hx.onClose(); };
  p.querySelector<HTMLButtonElement>("[data-pending]")?.addEventListener("click",
    () => hx.onOpenPending(s.pendingChat!));
  p.querySelectorAll<HTMLButtonElement>("[data-id]").forEach((b) =>
    (b.onclick = () => {
      const t = s.chats.find((x) => x.id === b.dataset.id);
      if (t) hx.onOpenThread(t);
    }));
}
