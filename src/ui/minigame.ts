import questions from "../../data/questions.json";
import { sfx } from "../core/audio";

export interface MgResult { score: number; label: string; detail: string; }
export type MgKind = "quiz" | "relay" | "rhythm" | "dodge" | "focus" | "serve" | "talk";

interface Question { subject: string; q: string; choices: string[]; answer: number; level: number; skip?: boolean }
const QUESTIONS = (questions as Question[]).filter((q) => !q.skip);

const host = () => document.getElementById("minigame")!;

/** นาฬิกาที่หยุดเดินตอนผู้เล่นสลับไปแอปอื่นหรือล็อกจอ
 *
 *  iPad คือเป้าหมายหลักของเกมนี้ และการสลับแอปกลางคันเป็นเรื่องปกติที่สุด
 *  เบราว์เซอร์หยุด requestAnimationFrame ตอนแท็บไม่ได้อยู่หน้าจอ แต่ `performance.now()`
 *  ยังเดินต่อ — ถ้าจับเวลาจากมันตรงๆ กลับมาอีกทีคำที่ต้องจำหายไปแล้ว ข้อสอบหมดเวลาไปแล้ว
 *  และเวลาจัดของหมดไปแล้ว โดยที่ผู้เล่นไม่ได้ทำอะไรผิดเลยสักอย่าง
 *
 *  มินิเกมเดียวเล่นได้ทีละเกม จึงเก็บนาฬิกาที่กำลังเดินอยู่ไว้ตัวเดียว
 *  แล้วให้ `finish()` เป็นคนเก็บกวาด */
let activeClock: { now: () => number; stop: () => void } | null = null;

function startClock() {
  let hiddenAt = 0, lost = 0;
  const onVis = () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt) { lost += performance.now() - hiddenAt; hiddenAt = 0; }
  };
  document.addEventListener("visibilitychange", onVis);
  activeClock?.stop();
  activeClock = {
    // ตอนซ่อนอยู่ เวลาค้างที่ hiddenAt - lost · ตอนเห็นอยู่ เดินตามปกติ
    now: () => performance.now() - lost - (hiddenAt ? performance.now() - hiddenAt : 0),
    stop: () => document.removeEventListener("visibilitychange", onVis),
  };
  return activeClock;
}
const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const shuffled = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

/** โครงร่วมของทุกมินิเกม: หัวเรื่อง เนื้อเกม แถบความคืบหน้า และแถบสายคอมโบ
 *  ทุกเกมคืนคะแนน 0..1 ให้ฝั่งเกมหลักเอาไปคูณกับผลลัพธ์ ไม่ใช่ตัวตัดสินทั้งหมด */
interface Shell {
  body: HTMLElement;
  /** เวลาที่เดินเฉพาะตอนที่ผู้เล่นมองอยู่ — ใช้แทน performance.now() ทุกที่ที่จับเวลา */
  now: () => number;
  setBar: (v: number) => void;
  /** ข้อความสั้นที่ลอยขึ้นกลางจอ — บอกว่าเพิ่งทำได้ดีหรือพลาด ไม่ต้องอ่านตัวเลข */
  pop: (text: string, tone?: "good" | "bad" | "best") => void;
  streak: (n: number) => void;
  close: () => void;
}

function shell(title: string, subtitle: string, hint = ""): Shell {
  const el = host();
  el.classList.remove("hidden");
  el.innerHTML = `<div class="mg">
    <div class="mgHead"><b>${title}</b><span>${subtitle}</span></div>
    <div class="mgBar"><i></i></div>
    <div class="mgBody"></div>
    ${hint ? `<div class="mgHint">${hint}</div>` : ""}
    <div class="mgStreak"></div>
  </div>`;
  const bar = el.querySelector(".mgBar i") as HTMLElement;
  const stk = el.querySelector(".mgStreak") as HTMLElement;
  const card = el.querySelector(".mg") as HTMLElement;
  const clock = startClock();
  return {
    body: el.querySelector(".mgBody") as HTMLElement,
    now: clock.now,
    setBar: (v) => { bar.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`; },
    pop: (text, tone = "good") => {
      const d = document.createElement("div");
      d.className = `mgPop ${tone}`;
      d.textContent = text;
      card.appendChild(d);
      setTimeout(() => d.remove(), 900);
      if (tone === "bad") card.classList.add("is-shake");
      setTimeout(() => card.classList.remove("is-shake"), 400);
    },
    streak: (n) => {
      stk.textContent = n >= 2 ? `ติดกัน ${n} ครั้ง` : "";
      stk.className = "mgStreak" + (n >= 4 ? " hot" : n >= 2 ? " on" : "");
    },
    close: () => { el.classList.add("hidden"); el.innerHTML = ""; },
  };
}

function finish(title: string, lines: string[], score: number): Promise<void> {
  return new Promise((res) => {
    activeClock?.stop();
    activeClock = null;
    const el = host();
    const tone = score >= 0.8 ? "great" : score >= 0.55 ? "good" : score >= 0.3 ? "ok" : "bad";
    const pct = Math.round(score * 100);
    el.innerHTML = `<div class="mg result ${tone}">
      <div class="mgHead"><b>${title}</b></div>
      <div class="mgRing" style="--p:${pct}">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ringbg" cx="60" cy="60" r="52"/>
          <circle class="ringfg" cx="60" cy="60" r="52"
            stroke-dasharray="${(pct / 100) * 327} 327"/>
        </svg>
        <div class="mgScore">${pct}<small>%</small></div>
      </div>
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
    const pool = shuffled(QUESTIONS).slice(0, count);
    const s = shell("ห้องสอบ", `${count} ข้อ · ข้อละ ${seconds} วินาที`,
      "ตอบเร็วได้โบนัส · ตอบถูกติดกันได้เพิ่มอีก");
    let i = 0, correct = 0, timeBonus = 0, run = 0, best = 0;
    let raf = 0, started = 0;

    const nextQuestion = () => {
      if (i >= pool.length) return done();
      const q = pool[i];
      s.body.innerHTML = `<div class="qmeta"><span>ข้อ ${i + 1}/${pool.length}</span>
          <span class="qsub">${q.subject}</span></div>
        <div class="qtext">${q.q}</div>
        <div class="qchoices">${q.choices.map((c, n) =>
          `<button class="qc" data-n="${n}"><i>${"กขคง"[n] ?? n + 1}</i>${c}</button>`).join("")}</div>`;
      started = s.now();
      s.body.querySelectorAll<HTMLButtonElement>(".qc").forEach((b) =>
        (b.onclick = () => answer(Number(b.dataset.n), b)));
      cancelAnimationFrame(raf);
      const tick = () => {
        const left = 1 - (s.now() - started) / (seconds * 1000);
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
      const fast = Math.max(0, 1 - (s.now() - started) / (seconds * 1000));
      if (ok) {
        correct++;
        run++;
        best = Math.max(best, run);
        timeBonus += fast * 0.35;
        s.pop(fast > 0.7 ? "เร็วและถูก" : "ถูกต้อง", fast > 0.7 ? "best" : "good");
        sfx.gain();
      } else {
        run = 0;
        s.pop(n < 0 ? "หมดเวลา" : "ผิด", "bad");
        sfx.deny();
      }
      s.streak(run);
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
      // สายที่ตอบถูกติดกันมีค่าในตัวมันเอง — ความมั่นใจคือส่วนหนึ่งของการทำข้อสอบ
      const streakBonus = Math.min(0.12, (best - 1) * 0.04);
      const score = Math.min(1, base + (timeBonus / pool.length) * 0.5 + (base > 0 ? streakBonus : 0));
      await finish("ผลการทำข้อสอบ", [
        `ตอบถูก ${correct} จาก ${pool.length} ข้อ`,
        best >= 2 ? `ตอบถูกติดกันสูงสุด ${best} ข้อ` : "ยังไม่มีช่วงที่ตอบถูกติดกัน",
        correct === pool.length ? "เต็มทุกข้อ · ได้โบนัสความเร็วด้วย" : "ข้อที่พลาดคือข้อที่ต้องกลับไปอ่าน",
      ], score);
      resolve({ score, label: "ทำข้อสอบ", detail: `ตอบถูก ${correct}/${pool.length}` });
    };

    nextQuestion();
  });
}

// ───────────────────────── ท่องหนังสือ: จำแล้วเรียงให้ถูก ─────────────────────────

/** คำที่เอามาให้ท่อง — ของจริงจากห้าวิชาที่เกมมี ไม่ใช่สัญลักษณ์ลอยๆ
 *  เพราะการนั่งท่องคือสิ่งที่เด็กมัธยมไทยทำจริงและจำหน้าตาของมันได้ */
const TERMS = [
  "อนุพันธ์", "เมทริกซ์", "ลอการิทึม", "เวกเตอร์", "ตรีโกณ",
  "ไมโทคอนเดรีย", "โฟโตซินเทซิส", "ไอโซโทป", "พันธะไอออนิก", "เอนโทรปี",
  "อุปมาอุปไมย", "สัมผัสสระ", "ฉันทลักษณ์", "คำสมาส", "ราชาศัพท์",
  "อยุธยา", "สนธิสัญญาเบาว์ริง", "ประชาธิปไตย", "อุปสงค์", "รัฐธรรมนูญ",
  "Gerund", "Past Perfect", "Relative Clause", "Idiom", "Passive Voice",
];

/** ท่องหนังสือ — ขึ้นคำมาชุดหนึ่งให้ดูสามวินาที แล้วต้องกดเรียงตามลำดับเดิม
 *
 *  มินิเกมเดิมทั้งสี่ตัววัดจังหวะมือกับความรู้ ไม่มีตัวไหนวัด *ความจำ* เลย
 *  ทั้งที่การบ้านกับสอบซ่อมคือการนั่งท่องของเดิมให้เข้าหัว ซึ่งเป็นคนละทักษะกัน */
function focus(rounds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("นั่งท่อง", `${rounds} ชุด · ดูให้ทัน แล้วเรียงตามลำดับเดิม`,
      "ชุดหลังยาวขึ้นและเวลาดูสั้นลง");
    let round = 0, total = 0, run = 0, best = 0;

    const run1 = () => {
      if (round >= rounds) return done();
      const n = 3 + round;
      const seq = shuffled(TERMS).slice(0, n);
      const showMs = 1400 + n * 520;
      s.body.innerHTML = `<div class="focusInfo">ชุดที่ ${round + 1} จาก ${rounds} · จำลำดับนี้ไว้</div>
        <div class="focusSeq">${seq.map((w, i) =>
          `<span class="fw" style="animation-delay:${i * 70}ms"><i>${i + 1}</i>${w}</span>`).join("")}</div>`;
      const t0 = s.now();
      let raf = requestAnimationFrame(function tick() {
        const left = 1 - (s.now() - t0) / showMs;
        s.setBar(left);
        if (left <= 0) { ask(seq); return; }
        raf = requestAnimationFrame(tick);
      });
      void raf;
    };

    const ask = (seq: string[]) => {
      const opts = shuffled(seq);
      let want = 0, wrong = 0;
      s.body.innerHTML = `<div class="focusInfo">เรียงตามลำดับที่เพิ่งเห็น</div>
        <div class="focusPick">${opts.map((w) =>
          `<button class="fpick" data-w="${w}">${w}</button>`).join("")}</div>
        <div class="focusSlot">${seq.map(() => `<span class="fslot"></span>`).join("")}</div>`;
      const slots = [...s.body.querySelectorAll<HTMLElement>(".fslot")];
      s.body.querySelectorAll<HTMLButtonElement>(".fpick").forEach((b) => {
        b.onclick = () => {
          if (b.disabled) return;
          const ok = b.dataset.w === seq[want];
          b.disabled = true;
          b.classList.add(ok ? "right" : "wrong");
          slots[want].textContent = b.dataset.w!;
          slots[want].className = "fslot " + (ok ? "right" : "wrong");
          if (ok) sfx.gain(); else { wrong++; sfx.deny(); }
          want++;
          if (want < seq.length) return;
          const acc = Math.max(0, 1 - wrong / seq.length);
          total += acc;
          if (wrong === 0) { run++; best = Math.max(best, run); s.pop("จำได้ครบ", "best"); }
          else { run = 0; s.pop(`พลาด ${wrong} คำ`, "bad"); }
          s.streak(run);
          round++;
          setTimeout(run1, 750);
        };
      });
    };

    const done = async () => {
      const score = Math.min(1, total / rounds + Math.min(0.1, best * 0.035));
      await finish("ท่องจบแล้ว", [
        `จำได้เฉลี่ย ${Math.round((total / rounds) * 100)}% ของแต่ละชุด`,
        best >= 2 ? `จำครบติดกัน ${best} ชุด` : "ยังไม่มีชุดไหนที่จำครบติดกัน",
      ], score);
      resolve({ score, label: "นั่งท่อง", detail: `จำได้ ${Math.round((total / rounds) * 100)}%` });
    };

    run1();
  });
}

// ───────────────────────── กีฬาสี: วิ่งผลัดจับจังหวะ ─────────────────────────

function relay(rounds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("วิ่งผลัด", `กดตอนตัวชี้อยู่ในแถบเขียว · ${rounds} ไม้`,
      "ยิ่งใกล้กลางแถบยิ่งได้มาก · ไม้หลังแถบแคบลงและเร็วขึ้น");
    let round = 0, total = 0, perfect = 0, run = 0, best = 0, raf = 0;

    const go = () => {
      if (round >= rounds) return done();
      const zoneW = 26 - round * 3;                 // ยิ่งไม้หลังยิ่งแคบ
      const zoneX = 20 + Math.random() * (70 - zoneW);
      const speed = 0.55 + round * 0.22;
      s.body.innerHTML = `<div class="relayInfo">ไม้ที่ ${round + 1} จาก ${rounds}</div>
        <div class="track">
          <div class="zone" style="left:${zoneX}%;width:${zoneW}%">
            <i class="core" style="left:${zoneW / 2}%"></i></div>
          <div class="marker"></div>
          <div class="runner" style="left:0%">🏃</div>
        </div>
        <button class="mgBtn wide" id="relayHit">ส่งไม้!</button>`;
      const marker = s.body.querySelector(".marker") as HTMLElement;
      const runner = s.body.querySelector(".runner") as HTMLElement;
      let t = 0, dir = 1;
      const step = () => {
        t += speed * dir;
        if (t > 100) { t = 100; dir = -1; }
        if (t < 0) { t = 0; dir = 1; }
        marker.style.left = t + "%";
        runner.style.left = `${(round / rounds) * 88 + t * 0.06}%`;
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      s.body.querySelector<HTMLButtonElement>("#relayHit")!.onclick = () => {
        cancelAnimationFrame(raf);
        const centre = zoneX + zoneW / 2;
        const inZone = t >= zoneX && t <= zoneX + zoneW;
        const acc = inZone ? 1 - Math.abs(t - centre) / (zoneW / 2) : 0;
        total += inZone ? 0.5 + acc * 0.5 : 0;
        if (acc > 0.75) { perfect++; run++; best = Math.max(best, run); s.pop("เป๊ะ!", "best"); sfx.gain(); }
        else if (inZone) { run++; best = Math.max(best, run); s.pop("เข้าเป้า", "good"); sfx.gain(); }
        else { run = 0; s.pop("หลุดเป้า", "bad"); sfx.deny(); }
        s.streak(run);
        marker.classList.add(inZone ? "hit" : "miss");
        s.body.querySelector<HTMLButtonElement>("#relayHit")!.disabled = true;
        round++;
        s.setBar(round / rounds);
        setTimeout(go, 620);
      };
    };

    const done = async () => {
      const score = Math.min(1, total / rounds + Math.min(0.1, best * 0.03));
      await finish("จบการแข่งวิ่งผลัด", [
        `ส่งไม้เข้าเป้า ${Math.round(score * rounds)} จาก ${rounds} ไม้`,
        perfect ? `ส่งไม้เป๊ะ ${perfect} ครั้ง` : "ยังไม่มีไม้ไหนที่เป๊ะเลย",
      ], score);
      resolve({ score, label: "วิ่งผลัด", detail: `เข้าเป้า ${Math.round(score * 100)}%` });
    };

    go();
  });
}

// ───────────────────────── ชมรมดนตรี: กดตามโน้ต ─────────────────────────

const LANES = 4;
const LANE_KEY = ["ด", "ร", "ม", "ฟ"];

function rhythm(noteCount: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("ซ้อมดนตรี", "กดเลนตอนโน้ตแตะเส้น",
      "กดเป๊ะติดกันได้คอมโบ · คีย์ D F J K ก็ได้");
    s.body.innerHTML = `<div class="stageR">
      <div class="hitline"></div>
      ${Array.from({ length: LANES }, (_, i) => `<div class="lane" data-l="${i}"></div>`).join("")}
      <div class="combo"></div>
    </div>
    <div class="laneBtns">${LANE_KEY.map((k, i) =>
      `<button class="laneBtn" data-l="${i}">${k}</button>`).join("")}</div>`;

    const stage = s.body.querySelector(".stageR") as HTMLElement;
    const comboEl = s.body.querySelector(".combo") as HTMLElement;
    const notes: { lane: number; time: number; el: HTMLElement; done: boolean }[] = [];
    const FALL = 1800;                              // เวลาที่โน้ตใช้ตกจากบนถึงเส้น
    const start = s.now() + 900;
    for (let i = 0; i < noteCount; i++) {
      const lane = Math.floor(Math.random() * LANES);
      const time = start + i * (420 + Math.random() * 180);
      const el = document.createElement("div");
      el.className = "note";
      el.style.left = `calc(${(lane + 0.5) * (100 / LANES)}% - 18px)`;
      stage.appendChild(el);
      notes.push({ lane, time, el, done: false });
    }

    let hits = 0, perfect = 0, run = 0, best = 0, raf = 0;
    const endAt = notes[notes.length - 1].time + 700;
    // ระยะตกต้องคิดเป็นพิกเซลจากความสูงเวทีจริง
    // เดิมใช้ translateY เป็น % ซึ่งอิงขนาดของตัวโน้ตเอง โน้ตเลยขยับแค่ 24px
    const travel = () => stage.clientHeight - 24;

    const step = () => {
      const now = s.now();
      for (const n of notes) {
        if (n.done) continue;
        const dt = n.time - now;
        const p = 1 - dt / FALL;
        if (p < 0) { n.el.style.opacity = "0"; continue; }
        n.el.style.opacity = "1";
        n.el.style.transform = `translateY(${p * travel()}px)`;
        if (dt < -220) { n.done = true; n.el.classList.add("miss"); run = 0; showCombo(); }
      }
      s.setBar((now - start + 900) / (endAt - start + 900));
      if (now > endAt) { cancelAnimationFrame(raf); done(); return; }
      raf = requestAnimationFrame(step);
    };

    const showCombo = () => {
      comboEl.textContent = run >= 3 ? `${run} ติด` : "";
      comboEl.className = "combo" + (run >= 8 ? " hot" : run >= 3 ? " on" : "");
    };

    const press = (lane: number) => {
      const now = s.now();
      let bestNote: typeof notes[number] | null = null, bd = 260;
      for (const n of notes) {
        if (n.done || n.lane !== lane) continue;
        const d = Math.abs(n.time - now);
        if (d < bd) { bd = d; bestNote = n; }
      }
      const btn = s.body.querySelector<HTMLElement>(`.laneBtn[data-l="${lane}"]`);
      btn?.classList.add("is-hit");
      setTimeout(() => btn?.classList.remove("is-hit"), 130);
      if (!bestNote) return;
      bestNote.done = true;
      hits++;
      run++;
      best = Math.max(best, run);
      if (bd < 90) { perfect++; bestNote.el.classList.add("perfect"); }
      else bestNote.el.classList.add("hit");
      showCombo();
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
      const score = Math.min(1, (hits + perfect * 0.25) / noteCount + Math.min(0.08, best * 0.008));
      await finish("จบการซ้อม", [
        `กดถูกจังหวะ ${hits} จาก ${noteCount} โน้ต`,
        perfect ? `เป๊ะเลย ${perfect} โน้ต` : "ยังไม่มีโน้ตไหนที่เป๊ะ",
        best >= 3 ? `คอมโบยาวสุด ${best} โน้ต` : "ยังไม่มีคอมโบยาวๆ",
      ], score);
      resolve({ score, label: "ซ้อมดนตรี", detail: `กดถูก ${hits}/${noteCount}` });
    };

    raf = requestAnimationFrame(step);
  });
}

// ───────────────────────── ชมรมอาสา: จัดของให้ทันเวลา ─────────────────────────

const SERVE_SETS: { name: string; items: string[] }[] = [
  { name: "ของถวายพระ", items: ["ธูป", "เทียน", "ดอกไม้", "น้ำดื่ม"] },
  { name: "ของบริจาค", items: ["เสื้อผ้า", "หนังสือ", "ข้าวสาร", "ยาสามัญ"] },
  { name: "ของค่ายอาสา", items: ["สี", "แปรง", "ตะปู", "ค้อน"] },
];

/** ชมรมบำเพ็ญประโยชน์ไม่เคยมีมินิเกมของตัวเอง — วันงานเลยไปยืมเกมหลบครูมาใช้
 *  ซึ่งอ่านออกมาว่า "ออกค่ายอาสา = หนีครู" · ที่นี่คือการจับคู่ของให้ตรงถุงก่อนหมดเวลา
 *  เร็วอย่างเดียวไม่พอ หยิบผิดถุงเสียเวลามากกว่าที่ได้ */
function serve(seconds: number, need: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("จัดของ", `จัดให้ครบ ${need} ชิ้นใน ${seconds} วินาที`,
      "แตะของ แล้วแตะถุงที่ตรงกัน · หยิบผิดเสียเวลา");
    let done = 0, wrong = 0, picked: string | null = null, over = false;
    const sets = shuffled(SERVE_SETS);
    // กองของถูกสร้างครั้งเดียวแล้ววางอยู่กับที่ — ของเดิมสุ่มกองใหม่ทุกครั้งที่จัดเสร็จหนึ่งชิ้น
    // ผลคือของกระโดดสลับตำแหน่งทุกครั้งที่กด ซึ่งวัดสายตาแทนที่จะวัดการจัดของ
    const pile = shuffled(sets.flatMap((g) => g.items.map((i) => ({ i, g: g.name }))))
      .slice(0, need)
      .map((x, n) => ({ ...x, key: `${n}`, gone: false }));
    const t0 = s.now();

    const bagsHTML = sets.map((g) => `<button class="bag" data-bag="${g.name}">
        <b>${g.name}</b><small>${g.items.length} อย่าง</small></button>`).join("");
    s.body.innerHTML = `<div class="serveInfo"></div>
      <div class="things">${pile.map((x) =>
        `<button class="thing" data-key="${x.key}" data-of="${x.g}">${x.i}</button>`).join("")}</div>
      <div class="bags">${bagsHTML}</div>`;
    const info = s.body.querySelector(".serveInfo") as HTMLElement;

    const status = () => {
      info.textContent = `จัดไปแล้ว ${done}/${need}` + (wrong ? ` · หยิบผิด ${wrong} ครั้ง` : "");
    };
    status();

    s.body.querySelectorAll<HTMLButtonElement>(".thing").forEach((b) =>
      (b.onclick = () => {
        if (b.disabled) return;
        s.body.querySelectorAll(".thing").forEach((x) => x.classList.remove("is-on"));
        b.classList.add("is-on");
        picked = b.dataset.key!;
        sfx.step();
      }));
    s.body.querySelectorAll<HTMLButtonElement>(".bag").forEach((b) =>
      (b.onclick = () => {
        if (over) return;
        const item = pile.find((x) => x.key === picked && !x.gone);
        if (!item) { s.pop("เลือกของก่อน", "bad"); return; }
        const el = s.body.querySelector<HTMLButtonElement>(`.thing[data-key="${item.key}"]`)!;
        if (b.dataset.bag === item.g) {
          item.gone = true;
          el.disabled = true;
          el.classList.remove("is-on");
          el.classList.add("is-done");
          done++;
          s.pop("เข้าถุงแล้ว", "good");
          sfx.gain();
        } else {
          wrong++;
          el.classList.remove("is-on");
          s.pop("ผิดถุง", "bad");
          sfx.deny();
        }
        picked = null;
        status();
        if (done >= need) { over = true; void end(); }
      }));

    const tick = () => {
      if (over) return;
      const left = 1 - (s.now() - t0) / (seconds * 1000);
      s.setBar(left);
      if (left <= 0) { over = true; void end(); return; }
      requestAnimationFrame(tick);
    };

    const end = async () => {
      const timeUsed = (s.now() - t0) / (seconds * 1000);
      const base = Math.min(1, done / need);
      const speed = done >= need ? Math.max(0, 1 - timeUsed) * 0.25 : 0;
      const score = Math.max(0, Math.min(1, base + speed - wrong * 0.06));
      await finish(done >= need ? "จัดครบแล้ว" : "หมดเวลา", [
        `จัดได้ ${done} จาก ${need} ชิ้น`,
        wrong ? `หยิบผิดถุง ${wrong} ครั้ง` : "ไม่หยิบผิดเลยสักครั้ง",
      ], score);
      resolve({ score, label: "จัดของ", detail: `${done}/${need} ชิ้น` });
    };

    requestAnimationFrame(tick);
  });
}

// ───────────────────────── งานกลุ่ม: อ่านอารมณ์คนตรงหน้า ─────────────────────────

interface Mood { id: string; name: string; want: string; reply: string[] }
const MOODS: Mood[] = [
  { id: "tired", name: "เขาดูล้า", want: "ผ่อน", reply: ["พักก่อนก็ได้", "เดี๋ยวพี่ทำต่อเอง", "วันนี้พอแค่นี้"] },
  { id: "lost", name: "เขาดูไม่เข้าใจ", want: "อธิบาย", reply: ["เริ่มจากตรงนี้ก่อน", "ขออธิบายอีกรอบ", "ลองดูตัวอย่างนี้"] },
  { id: "stuck", name: "เขาดูอึดอัด", want: "ถาม", reply: ["ติดตรงไหนบอกได้", "อยากทำส่วนไหน", "มีอะไรอยากบอกไหม"] },
  { id: "keen", name: "เขาดูอยากลุย", want: "ดัน", reply: ["ลุยต่อเลย", "อีกนิดเดียวเสร็จ", "แบ่งกันคนละครึ่ง"] },
];

/** งานกลุ่มจับคู่กับคนที่สนิทน้อยที่สุดเสมอ ซึ่งเป็นประเด็นของระบบ
 *  แต่เดิมมันคือปุ่มเดียวที่กดสามครั้งแล้วจบ ทั้งที่เรื่องทั้งหมดของมันคือ
 *  การต้องทำงานกับคนที่ยังอ่านไม่ออก — มินิเกมนี้คือการอ่านเขาให้ออกทีละตา */
function talk(rounds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("งานกลุ่ม", `อ่านให้ออกว่าเขาต้องการอะไร · ${rounds} ตา`,
      "ตอบผิดจังหวะไม่ได้แปลว่าพูดผิด แค่ยังไม่ใช่ตอนนี้");
    let round = 0, hit = 0, run = 0, best = 0;

    const go = () => {
      if (round >= rounds) return done();
      const mood = rand(MOODS);
      const opts = shuffled(MOODS).slice(0, 3);
      if (!opts.find((m) => m.id === mood.id)) opts[0] = mood;
      s.body.innerHTML = `<div class="talkMood"><b>${mood.name}</b>
          <span>${round + 1}/${rounds}</span></div>
        <div class="talkFace mood-${mood.id}"><i></i><i></i><u></u></div>
        <div class="talkOpts">${shuffled(opts).map((m) =>
          `<button class="topt" data-m="${m.id}">${rand(m.reply)}</button>`).join("")}</div>`;
      s.body.querySelectorAll<HTMLButtonElement>(".topt").forEach((b) =>
        (b.onclick = () => {
          const ok = b.dataset.m === mood.id;
          s.body.querySelectorAll<HTMLButtonElement>(".topt").forEach((x) => {
            x.disabled = true;
            if (x.dataset.m === mood.id) x.classList.add("right");
            else if (x === b) x.classList.add("wrong");
          });
          if (ok) { hit++; run++; best = Math.max(best, run); s.pop("อ่านออก", "best"); sfx.trust(); }
          else { run = 0; s.pop("ยังไม่ใช่ตอนนี้", "bad"); sfx.deny(); }
          s.streak(run);
          round++;
          s.setBar(round / rounds);
          setTimeout(go, 700);
        }));
    };

    const done = async () => {
      const score = Math.min(1, hit / rounds + Math.min(0.1, best * 0.035));
      await finish("คุยกันจบรอบนี้", [
        `อ่านเขาออก ${hit} จาก ${rounds} ตา`,
        best >= 2 ? `อ่านออกติดกัน ${best} ตา` : "ยังจับทางเขาไม่ค่อยได้",
      ], score);
      resolve({ score, label: "งานกลุ่ม", detail: `อ่านออก ${hit}/${rounds}` });
    };

    go();
  });
}

// ───────────────────────── หลบฝ่ายปกครอง: เกมไหวพริบ ─────────────────────────

function dodge(rounds: number): Promise<MgResult> {
  return new Promise((resolve) => {
    const s = shell("หลบฝ่ายปกครอง", "เดินได้เฉพาะตอนครูหันหลัง",
      "ครูหันกลับมาเมื่อไหร่ไม่แน่นอน · ถอยหนึ่งก้าวดีกว่าโดนจด");
    let round = 0, caught = 0, progress = 0, raf = 0;
    let watching = false, canMove = false, timer = 0;

    const render = () => {
      s.body.innerHTML = `<div class="dodgeWrap">
        <div class="teacher ${watching ? "watch" : "away"}">
          <span class="teye">${watching ? "๏ ๏" : "‿ ‿"}</span>
          ${watching ? "ครูหันมาแล้ว" : "ครูหันหลังอยู่"}</div>
        <div class="dodgeTrack">
          <i style="width:${progress * 100}%"></i>
          <span class="you" style="left:${progress * 100}%">◆</span>
        </div>
        <button class="mgBtn wide" id="dodgeGo">เดินต่อ</button>
      </div>`;
      s.body.querySelector<HTMLButtonElement>("#dodgeGo")!.onclick = go;
    };

    const go = () => {
      if (!canMove) return;
      if (watching) {
        caught++;
        progress = Math.max(0, progress - 0.25);
        s.pop("โดนเห็นแล้ว!", "bad");
        sfx.deny();
      } else {
        progress = Math.min(1, progress + 0.22);
        s.pop("รอดไปได้อีกก้าว", "good");
        sfx.step();
      }
      round++;
      s.setBar(progress);
      if (progress >= 1 || round >= rounds) { cancelAnimationFrame(raf); done(); return; }
      schedule();
    };

    const schedule = () => {
      canMove = false;
      watching = Math.random() < 0.45;
      render();
      timer = s.now() + 700 + Math.random() * 900;
      const tick = () => {
        if (s.now() > timer) {
          watching = !watching;
          timer = s.now() + 900 + Math.random() * 1100;
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
  if (kind === "focus") return focus(difficulty >= 2 ? 4 : 3);
  // กองของมีทั้งหมด 12 ชิ้น จำนวนที่ขอต้องไม่เกินนั้น ไม่งั้นจัดครบไม่ได้ตลอดกาล
  if (kind === "serve") return serve(difficulty >= 2 ? 28 : 22, difficulty >= 2 ? 10 : 7);
  if (kind === "talk") return talk(difficulty >= 2 ? 6 : 4);
  return dodge(6);
}

/** มินิเกมทุกตัวที่มี — เทสต์ใช้ตรวจว่าไม่มีตัวไหนถูกเขียนไว้แล้วไม่มีใครเรียก */
export const MG_KINDS: MgKind[] = ["quiz", "relay", "rhythm", "dodge", "focus", "serve", "talk"];
