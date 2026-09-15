import questions from "../../data/questions.json";

export interface MgResult { score: number; label: string; detail: string; }
export type MgKind = "quiz" | "relay" | "rhythm" | "dodge";

interface Question { subject: string; q: string; choices: string[]; answer: number; level: number; skip?: boolean }
const QUESTIONS = (questions as Question[]).filter((q) => !q.skip);

const host = () => document.getElementById("minigame")!;

/** โครงร่วมของทุกมินิเกม: หัวเรื่อง เนื้อเกม และแถบความคืบหน้า
 *  ทุกเกมคืนคะแนน 0..1 ให้ฝั่งเกมหลักเอาไปคูณกับผลลัพธ์ */
function shell(title: string, subtitle: string): { body: HTMLElement; setBar: (v: number) => void; close: () => void } {
  const el = host();
  el.classList.remove("hidden");
  el.innerHTML = `<div class="mg">
    <div class="mgHead"><b>${title}</b><span>${subtitle}</span></div>
    <div class="mgBar"><i></i></div>
    <div class="mgBody"></div>
  </div>`;
  const bar = el.querySelector(".mgBar i") as HTMLElement;
  return {
    body: el.querySelector(".mgBody") as HTMLElement,
    setBar: (v) => { bar.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`; },
    close: () => { el.classList.add("hidden"); el.innerHTML = ""; },
  };
}

function finish(title: string, lines: string[], score: number): Promise<void> {
  return new Promise((res) => {
    const el = host();
    const tone = score >= 0.8 ? "great" : score >= 0.55 ? "good" : score >= 0.3 ? "ok" : "bad";
    el.innerHTML = `<div class="mg result ${tone}">
      <div class="mgHead"><b>${title}</b></div>
      <div class="mgScore">${Math.round(score * 100)}<small>%</small></div>
      ${lines.map((l) => `<div class="mgLine">${l}</div>`).join("")}
      <button class="mgBtn" id="mgDone">ต่อไป</button>
    </div>`;
    el.querySelector<HTMLButtonElement>("#mgDone")!.onclick = () => {
      el.classList.add("hidden"); el.innerHTML = ""; res();
    };
  });
}

// ───────────────────────── สอบ: ตอบคำถามจับเวลา ─────────────────────────

function quiz(count: number, seconds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const pool = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, count);
    const s = shell("ห้องสอบ", `${count} ข้อ · ข้อละ ${seconds} วินาที`);
    let i = 0, correct = 0, timeBonus = 0;
    let raf = 0, started = 0;

    const nextQuestion = () => {
      if (i >= pool.length) return done();
      const q = pool[i];
      s.body.innerHTML = `<div class="qmeta">ข้อ ${i + 1}/${pool.length} · ${q.subject}</div>
        <div class="qtext">${q.q}</div>
        <div class="qchoices">${q.choices.map((c, n) =>
          `<button class="qc" data-n="${n}">${c}</button>`).join("")}</div>`;
      started = performance.now();
      s.body.querySelectorAll<HTMLButtonElement>(".qc").forEach((b) =>
        (b.onclick = () => answer(Number(b.dataset.n), b)));
      cancelAnimationFrame(raf);
      const tick = () => {
        const left = 1 - (performance.now() - started) / (seconds * 1000);
        s.setBar(left);
        if (left <= 0) { answer(-1, null); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const answer = (n: number, btn: HTMLButtonElement | null) => {
      cancelAnimationFrame(raf);
      const q = pool[i];
      const ok = n === q.answer;
      if (ok) {
        correct++;
        timeBonus += Math.max(0, 1 - (performance.now() - started) / (seconds * 1000)) * 0.35;
      }
      s.body.querySelectorAll<HTMLButtonElement>(".qc").forEach((b, idx) => {
        b.disabled = true;
        if (idx === q.answer) b.classList.add("right");
        else if (b === btn) b.classList.add("wrong");
      });
      i++;
      setTimeout(nextQuestion, ok ? 420 : 900);
    };

    const done = async () => {
      const base = correct / pool.length;
      const score = Math.min(1, base + (timeBonus / pool.length) * 0.5);
      await finish("ผลการทำข้อสอบ", [
        `ตอบถูก ${correct} จาก ${pool.length} ข้อ`,
        correct === pool.length ? "เต็มทุกข้อ · ได้โบนัสความเร็วด้วย" : "ข้อที่พลาดคือข้อที่ต้องกลับไปอ่าน",
      ], score);
      resolve({ score, label: "ทำข้อสอบ", detail: `ตอบถูก ${correct}/${pool.length}` });
    };

    nextQuestion();
  });
}

// ───────────────────────── กีฬาสี: วิ่งผลัดจับจังหวะ ─────────────────────────

function relay(rounds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("วิ่งผลัด", `กดตอนตัวชี้อยู่ในแถบเขียว · ${rounds} ไม้`);
    let round = 0, total = 0, perfect = 0, raf = 0;

    const run = () => {
      if (round >= rounds) return done();
      const zoneW = 26 - round * 3;                 // ยิ่งไม้หลังยิ่งแคบ
      const zoneX = 20 + Math.random() * (70 - zoneW);
      const speed = 0.55 + round * 0.22;
      s.body.innerHTML = `<div class="relayInfo">ไม้ที่ ${round + 1} จาก ${rounds}</div>
        <div class="track">
          <div class="zone" style="left:${zoneX}%;width:${zoneW}%"></div>
          <div class="marker"></div>
        </div>
        <button class="mgBtn wide" id="relayHit">ส่งไม้!</button>`;
      const marker = s.body.querySelector(".marker") as HTMLElement;
      let t = 0, dir = 1;
      const step = () => {
        t += speed * dir;
        if (t > 100) { t = 100; dir = -1; }
        if (t < 0) { t = 0; dir = 1; }
        marker.style.left = t + "%";
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      s.body.querySelector<HTMLButtonElement>("#relayHit")!.onclick = () => {
        cancelAnimationFrame(raf);
        const centre = zoneX + zoneW / 2;
        const inZone = t >= zoneX && t <= zoneX + zoneW;
        const acc = inZone ? 1 - Math.abs(t - centre) / (zoneW / 2) : 0;
        total += inZone ? 0.5 + acc * 0.5 : 0;
        if (acc > 0.75) perfect++;
        marker.classList.add(inZone ? "hit" : "miss");
        s.body.querySelector<HTMLButtonElement>("#relayHit")!.disabled = true;
        round++;
        s.setBar(round / rounds);
        setTimeout(run, 620);
      };
    };

    const done = async () => {
      const score = total / rounds;
      await finish("จบการแข่งวิ่งผลัด", [
        `ส่งไม้เข้าเป้า ${Math.round(score * rounds)} จาก ${rounds} ไม้`,
        perfect ? `ส่งไม้เป๊ะ ${perfect} ครั้ง` : "ยังไม่มีไม้ไหนที่เป๊ะเลย",
      ], score);
      resolve({ score, label: "วิ่งผลัด", detail: `เข้าเป้า ${Math.round(score * 100)}%` });
    };

    run();
  });
}

// ───────────────────────── ชมรมดนตรี: กดตามโน้ต ─────────────────────────

const LANES = 4;
const LANE_KEY = ["ด", "ร", "ม", "ฟ"];

function rhythm(noteCount: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("ซ้อมดนตรี", "กดเลนตอนโน้ตแตะเส้น");
    s.body.innerHTML = `<div class="stageR">
      <div class="hitline"></div>
      ${Array.from({ length: LANES }, (_, i) => `<div class="lane" data-l="${i}"></div>`).join("")}
    </div>
    <div class="laneBtns">${LANE_KEY.map((k, i) =>
      `<button class="laneBtn" data-l="${i}">${k}</button>`).join("")}</div>`;

    const stage = s.body.querySelector(".stageR") as HTMLElement;
    const notes: { lane: number; time: number; el: HTMLElement; done: boolean }[] = [];
    const FALL = 1800;                              // เวลาที่โน้ตใช้ตกจากบนถึงเส้น
    const start = performance.now() + 900;
    for (let i = 0; i < noteCount; i++) {
      const lane = Math.floor(Math.random() * LANES);
      const time = start + i * (420 + Math.random() * 180);
      const el = document.createElement("div");
      el.className = "note";
      el.style.left = `calc(${(lane + 0.5) * (100 / LANES)}% - 18px)`;
      stage.appendChild(el);
      notes.push({ lane, time, el, done: false });
    }

    let hits = 0, perfect = 0, raf = 0;
    const endAt = notes[notes.length - 1].time + 700;
    // ระยะตกต้องคิดเป็นพิกเซลจากความสูงเวทีจริง
    // เดิมใช้ translateY เป็น % ซึ่งอิงขนาดของตัวโน้ตเอง โน้ตเลยขยับแค่ 24px
    const travel = () => stage.clientHeight - 24;

    const step = () => {
      const now = performance.now();
      for (const n of notes) {
        if (n.done) continue;
        const dt = n.time - now;
        const p = 1 - dt / FALL;
        if (p < 0) { n.el.style.opacity = "0"; continue; }
        n.el.style.opacity = "1";
        n.el.style.transform = `translateY(${p * travel()}px)`;
        if (dt < -220) { n.done = true; n.el.classList.add("miss"); }
      }
      s.setBar((now - start + 900) / (endAt - start + 900));
      if (now > endAt) { cancelAnimationFrame(raf); done(); return; }
      raf = requestAnimationFrame(step);
    };

    const press = (lane: number) => {
      const now = performance.now();
      let best: typeof notes[number] | null = null, bd = 260;
      for (const n of notes) {
        if (n.done || n.lane !== lane) continue;
        const d = Math.abs(n.time - now);
        if (d < bd) { bd = d; best = n; }
      }
      if (!best) return;
      best.done = true;
      hits++;
      if (bd < 90) { perfect++; best.el.classList.add("perfect"); } else best.el.classList.add("hit");
    };

    s.body.querySelectorAll<HTMLButtonElement>(".laneBtn").forEach((b) =>
      (b.onpointerdown = () => press(Number(b.dataset.l))));
    const onKey = (e: KeyboardEvent) => {
      const i = ["d", "f", "j", "k"].indexOf(e.key.toLowerCase());
      if (i >= 0) press(i);
    };
    window.addEventListener("keydown", onKey);

    const done = async () => {
      window.removeEventListener("keydown", onKey);
      const score = Math.min(1, (hits + perfect * 0.25) / noteCount);
      await finish("จบการซ้อม", [
        `กดถูกจังหวะ ${hits} จาก ${noteCount} โน้ต`,
        perfect ? `เป๊ะเลย ${perfect} โน้ต` : "ยังไม่มีโน้ตไหนที่เป๊ะ",
      ], score);
      resolve({ score, label: "ซ้อมดนตรี", detail: `กดถูก ${hits}/${noteCount}` });
    };

    raf = requestAnimationFrame(step);
  });
}

// ───────────────────────── หลบฝ่ายปกครอง: เกมไหวพริบ ─────────────────────────

function dodge(rounds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("หลบฝ่ายปกครอง", "เดินได้เฉพาะตอนครูหันหลัง");
    let round = 0, caught = 0, progress = 0, raf = 0;
    let watching = false, canMove = false, timer = 0;

    const render = () => {
      s.body.innerHTML = `<div class="dodgeWrap">
        <div class="teacher ${watching ? "watch" : "away"}">${watching ? "ครูหันมาแล้ว" : "ครูหันหลังอยู่"}</div>
        <div class="dodgeTrack"><i style="width:${progress * 100}%"></i></div>
        <button class="mgBtn wide" id="dodgeGo">เดินต่อ</button>
      </div>`;
      s.body.querySelector<HTMLButtonElement>("#dodgeGo")!.onclick = go;
    };

    const go = () => {
      if (!canMove) return;
      if (watching) {
        caught++;
        progress = Math.max(0, progress - 0.25);
        flash("โดนเห็นแล้ว!");
      } else {
        progress = Math.min(1, progress + 0.22);
        flash("รอดไปได้อีกก้าว");
      }
      round++;
      s.setBar(progress);
      if (progress >= 1 || round >= rounds) { cancelAnimationFrame(raf); done(); return; }
      schedule();
    };

    const flash = (t: string) => {
      const el = document.createElement("div");
      el.className = "dodgeFlash";
      el.textContent = t;
      s.body.appendChild(el);
      setTimeout(() => el.remove(), 700);
    };

    const schedule = () => {
      canMove = false;
      watching = Math.random() < 0.45;
      render();
      timer = performance.now() + 700 + Math.random() * 900;
      const tick = () => {
        if (performance.now() > timer) {
          watching = !watching;
          timer = performance.now() + 900 + Math.random() * 1100;
          render();
        }
        canMove = true;
        raf = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    const done = async () => {
      const score = Math.max(0, progress - caught * 0.08);
      await finish(progress >= 1 ? "รอดออกมาได้" : "ไปไม่ถึง", [
        progress >= 1 ? "ออกนอกโรงเรียนได้โดยไม่มีใครจดชื่อ" : "ต้องถอยกลับมาก่อน",
        caught ? `โดนครูเห็น ${caught} ครั้ง` : "ไม่โดนเห็นเลยสักครั้ง",
      ], score);
      resolve({ score, label: "หลบฝ่ายปกครอง", detail: progress >= 1 ? "รอด" : "ไม่รอด" });
    };

    schedule();
  });
}

export function openMinigame(kind: MgKind, difficulty = 1): Promise<MgResult> {
  if (kind === "quiz") return quiz(difficulty >= 2 ? 6 : 4, difficulty >= 2 ? 12 : 15);
  if (kind === "relay") return relay(4);
  if (kind === "rhythm") return rhythm(difficulty >= 2 ? 18 : 12);
  return dodge(6);
}
