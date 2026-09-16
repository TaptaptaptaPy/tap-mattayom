import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// หน้าวิธีเล่นเปิดเองครั้งแรกที่เล่น ซึ่งจะบังทุกภาพในไฟล์นี้
// เทสต์ที่อยากดูหน้านั้นจริงๆ เรียก __mattayom.showHow() เอง
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem("mattayom:seenHow", "1"); } catch { /* โหมดส่วนตัว */ }
  });
});

/** หน้าจอจริงของเกม — คนละเรื่องกับ art.spec.ts ที่ดูของทีละชิ้น
 *  ไฟล์นี้ดูว่า "ของทุกชิ้นวางรวมกันแล้วยังอ่านออกไหม" ซึ่งเป็นคนละคำถาม
 *  (แถบภาพฉากเคยลอยอยู่บนสุดแล้วเหลือพื้นดำเปล่าสูง 300px คั่นกลาง — ชิ้นส่วนไม่ผิดสักชิ้น) */

/** เกมใหม่เริ่มที่หน้าเลือกภูมิหลังเสมอ ต้องเลือกก่อนถึงจะเข้าเกมได้
 *  เทสต์เลือกผ่าน UI จริง ไม่ใช่ยัดค่าเข้า state เพราะหน้านี้คือหน้าแรกที่ผู้เล่นเห็น */
async function start(page: Page, bg = "transfer") {
  await page.goto("/");
  await page.waitForSelector(`[data-bg="${bg}"]`);
  await page.locator(`[data-bg="${bg}"]`).click();
  await page.waitForFunction(() => !!(window as any).__mattayom);
}

/** ข้ามฉากเปิดเทอมไปที่กระดานตรงๆ — สิ่งที่อยากดูคือหน้าจอ ไม่ใช่ทางเดินไปหามัน
 *  **ต้องตรึงเมล็ดของโลกด้วย** ไม่งั้นตารางชีวิตของทุกคนสุ่มใหม่ทุกรอบ
 *  แล้วป้าย "มีคนอยู่ตรงนั้น" บนกระดานจะเปลี่ยนไปมา ภาพเทียบกันไม่ได้เลย */
async function toBoard(page: Page, patch: (s: any) => void = () => {}) {
  await page.evaluate((src) => {
    const M = (window as any).__mattayom, s = M.s;
    s.seed = 12345;
    s.seenEvents["opening"] = true;
    document.getElementById("scene")!.classList.add("hidden");
    // eslint-disable-next-line no-new-func
    new Function("s", src)(s);
    M.render();
  }, `(${patch.toString()})(s)`);
}

/** รอจนตัวพิมพ์ดีดพิมพ์จบ ไม่งั้นภาพจะจับข้อความครึ่งประโยค */
async function typed(page: Page) {
  await page.waitForSelector("#scene:not(.hidden)");
  await expect.poll(async () => page.locator("#line").textContent(), { timeout: 10_000 })
    .not.toBe("");
  let prev = "";
  await expect.poll(async () => {
    const now = (await page.locator("#line").textContent()) ?? "";
    const same = now === prev; prev = now; return same;
  }, { timeout: 10_000 }).toBe(true);
}

test("หน้าแรกของเกมคือคำถามว่าเราเป็นใครมาก่อน", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("[data-bg]");
  const cards = await page.locator("[data-bg]").count();
  expect(cards, "ภูมิหลังน้อยเกินกว่าจะเล่นซ้ำแล้วไม่เหมือนเดิม").toBeGreaterThan(3);
  // ทุกใบต้องบอกทั้งข้อดีและข้อเสีย ไม่งั้นมันคือตัวเลือกที่เลือกไม่ได้จริง
  expect(await page.locator("[data-bg] .bgline.good").count()).toBe(cards);
  expect(await page.locator("[data-bg] .bgline.bad").count()).toBe(cards);
  // ปิดไม่ได้จนกว่าจะเลือก
  expect(await page.locator("#panel .pclose").isVisible()).toBe(false);
  await expect(page).toHaveScreenshot("background.png");
});

test("เปิดเกมมาเจอฉากวันเปิดเทอม", async ({ page }) => {
  await start(page);
  await typed(page);
  await expect(page).toHaveScreenshot("opening.png");
});

test("กระดานเลือกที่ไป — บอกได้ว่ามีคนอยู่ แต่ไม่บอกว่าใคร", async ({ page }) => {
  await start(page);
  await toBoard(page, (s: any) => { s.periodIndex = 2; });
  await page.waitForSelector("#board .loc.pick");
  // ที่ที่มีคนอยู่ต้องมีสัญญาณ แต่ห้ามมีชื่อคนโผล่บนกระดานตอนที่ยังไม่สนิทกับใคร
  const names = await page.locator("#board .sig.is-known").count();
  expect(names, "กระดานบอกชื่อคนทั้งที่ยังไม่รู้จักใครเลย").toBe(0);
  await expect(page).toHaveScreenshot("board.png");
});

test("เดินเข้าไปแล้วถึงจะรู้ว่าใครอยู่ตรงนั้น", async ({ page }) => {
  await start(page);
  await toBoard(page, (s: any) => { s.periodIndex = 2; });
  await page.waitForSelector("#board .loc.pick");
  // หาที่ที่มีคนอยู่ แล้วเดินเข้าไป
  const withSomeone = page.locator(".loc.pick").filter({ has: page.locator(".sig.is-some") });
  expect(await withSomeone.count(), "ไม่มีที่ไหนมีคนอยู่เลยทั้งช่วงเวลา").toBeGreaterThan(0);
  await withSomeone.first().click();
  await page.waitForSelector(".place .metcard");
  // คนที่ยังไม่เคยคุยกันต้องยังไม่มีชื่อ
  const label = await page.locator(".metcard.is-new .wname b").first().textContent();
  expect(label).not.toBe("");
  expect(await page.locator(".metcard.is-new").count()).toBeGreaterThan(0);
  await expect(page).toHaveScreenshot("place.png");
});

test("ฉากจบรายคน — ภาพฉาก ภาพตัวละคร และข้อความต้องอยู่ด้วยกัน", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const M = (window as any).__mattayom, s = M.s;
    s.affinity = { ploy: 120, kanin: 90, minta: 70, palm: 40 };
    for (const f of ["ploy_book", "ploy_stayed", "ploy_refused", "ploy_sister_known",
                     "kanin_cleared", "minta_signed", "palm_spoke",
                     "meet_ploy_sharp", "meet_kanin_open"]) s.flags[f] = true;
    M.playEpilogues(() => { /* จบแล้ว */ });
  });
  await typed(page);
  await expect(page).toHaveScreenshot("epilogue.png");
});

test("เปิดเกมแล้วต้องไม่มี error ใน console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await typed(page);
  expect(errors).toEqual([]);
});

test("กระดานประกาศผลหน้าห้อง — ชื่อเราต้องหาเจอในหนึ่งวินาที", async ({ page }) => {
  await start(page);
  await toBoard(page, (s: any) => {
    // ผลสอบของเราถูกยัดเข้าไปตรงๆ เพราะสิ่งที่อยากดูคือกระดาน ไม่ใช่ทางเดินไปหาวันสอบ
    s.exams["midterm"] = { score: 61, rank: 11 };
  });
  await page.evaluate(() => (window as any).__mattayom.showBoard("midterm"));
  await page.waitForSelector(".board .brow.is-me");
  await expect(page).toHaveScreenshot("board-exam.png");
});

test("ปุ่มที่ต้องฝืนต้องดูออกว่ากดได้ ไม่ใช่ปุ่มที่ดับ", async ({ page }) => {
  await start(page);
  await toBoard(page, (s: any) => {
    s.periodIndex = 2;          // หลังเลิกเรียน — ช่วงที่มีที่ให้ไปมากที่สุด
    s.energy = 8;               // ต่ำกว่าเกณฑ์ ทุกกิจกรรมต้องฝืนถึงจะทำได้
    s.sleepDebt = 12;
  });
  // ปุ่มกิจกรรมอยู่ข้างในที่นั้น ต้องเดินเข้าไปก่อน
  await page.waitForSelector("#board .loc.pick");
  await page.locator("#board .loc.pick").first().click();
  await page.waitForSelector(".act.tired");
  // ปุ่มที่ต้องฝืนต้องยังกดได้จริง ไม่งั้นแรงกลับไปเป็นกำแพงเหมือนเดิม
  expect(await page.locator(".act.tired").first().isDisabled()).toBe(false);
  await expect(page).toHaveScreenshot("board-tired.png");
});

test("หน้าคนรู้จักขึ้นทีละคนตามที่เจอจริง ไม่ใช่ครบตั้งแต่วันแรก", async ({ page }) => {
  await start(page);
  await toBoard(page);
  await page.locator("#bChars").click();
  await page.waitForSelector("#panel .pwrap");
  // ยังไม่เจอใครเลย — ต้องไม่มีการ์ดคนสักใบ
  expect(await page.locator(".card.person").count(), "ขึ้นชื่อคนทั้งที่ยังไม่เคยเจอใคร").toBe(0);
  await page.locator("#panel .pclose").click();

  await page.evaluate(() => {
    const M = (window as any).__mattayom, s = M.s;
    s.met["ploy"] = 0;
    s.affinity["ploy"] = 20;
    s.trust["ploy"] = 9;
    s.memories["ploy"] = ["วันที่นายได้อ่านสมุดเล่มนั้น"];
    M.render();
  });
  await page.locator("#bChars").click();
  await page.waitForSelector(".card.person");
  expect(await page.locator(".card.person").count()).toBe(1);
  await expect(page).toHaveScreenshot("people.png");
});

test("หน้าวิธีเล่นต้องอ่านออกและไม่ล้นจอ", async ({ page }) => {
  await start(page);
  await toBoard(page);
  await page.evaluate(() => (window as any).__mattayom.showHow());
  await page.waitForSelector(".howto .hrow");
  // ทุกหัวข้อต้องมีเนื้อหาจริง ไม่ใช่หัวข้อเปล่า
  const rows = await page.locator(".howto .hrow").count();
  expect(rows).toBeGreaterThan(5);
  await expect(page).toHaveScreenshot("howto.png");
});

test("สมุดบันทึกต้องอ่านได้ทั้งเทอม ไม่ใช่แค่สิบสองบรรทัดสุดท้าย", async ({ page }) => {
  await start(page);
  await toBoard(page, (s: any) => {
    // ยัดเรื่องเข้าไปให้ครบทุกหมวด เพื่อดูว่าตัวกรองทำงานจริง
    s.history = [
      "วันที่ 3: คุยกับพลอย", "วันที่ 5: ส่งการบ้าน 2 ชิ้น",
      "วันที่ 8: ไปตามนัดกนิน", "วันที่ 12: ครูประจำชั้นโทรหาที่บ้าน",
      "วันที่ 20: ส่งเงินให้ที่บ้าน 550 บาท", "วันที่ 30: สอบกลางภาค ได้ 74 คะแนน",
      "วันที่ 33: ปาล์มเห็นเราอยู่กับพลอย ทั้งที่วันนี้นัดกันไว้",
      "วันที่ 40: หลับในคาบจนครูเรียกชื่อ",
    ];
  });
  await page.evaluate(() => (window as any).__mattayom.showDiary());
  await page.waitForSelector(".diary .dline");
  const all = await page.locator(".diary .dline").count();
  await page.locator('[data-tab="home"]').click();
  const home = await page.locator(".diary .dline").count();
  expect(home).toBeGreaterThan(0);
  expect(home).toBeLessThan(all);
  await page.locator('[data-tab="all"]').click();
  await expect(page).toHaveScreenshot("diary.png");
});

/** แถบบนต้องบอกได้สองอย่าง: ตอนนี้เท่าไหร่ และเมื่อกี้เปลี่ยนไปเท่าไหร่
 *
 *  ทั้งสองอย่างเคยตายเงียบพร้อมกัน — หลอดใต้ชิปไม่มีกฎ CSS ของตัวเอง (เห็นเฉพาะชิป "แรง")
 *  และตัวจับความเปลี่ยนแปลงแกะตัวเลขจากข้อความ ซึ่งชิปค่าสถานะโชว์เป็นชื่อระดับ
 *  `Number("")` คืน 0 ค่าสถานะห้าตัวจึงอ่านได้ 0 เท่ากันตลอด แล้วไม่เคยถูกนับว่าเปลี่ยนเลย
 *  ภาพนิ่งจับข้อนี้ไม่ได้ เพราะทั้งคู่เป็นของที่ "ควรโผล่มา" ไม่ใช่ของที่ "หายไป" */
test("แถบบน: หลอดค่าสถานะต้องมองเห็น และค่าที่เพิ่งเปลี่ยนต้องลอยตัวเลขขึ้นมา", async ({ page }) => {
  await start(page);
  await toBoard(page, (s: any) => {
    s.stats.heart = 30; s.stats.mind = 70; s.stats.charm = 5;
  });

  const widths = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#stats .chip.stat i")]
      .map((i) => i.getBoundingClientRect().width));
  console.log("ความกว้างหลอดค่าสถานะ: " + widths.map((w) => w.toFixed(1)).join(" · "));
  expect(widths.length, "ไม่มีหลอดค่าสถานะเลย").toBe(5);
  expect(Math.max(...widths), "หลอดกว้างศูนย์ทุกใบ — แปลว่าไม่มีกฎ CSS ให้มัน").toBeGreaterThan(4);
  // ค่าไม่เท่ากันต้องได้หลอดไม่เท่ากัน ไม่งั้นหลอดก็ไม่ได้บอกอะไร
  expect(new Set(widths.map((w) => Math.round(w))).size).toBeGreaterThan(2);

  await page.evaluate(() => {
    const M = (window as any).__mattayom;
    M.s.stats.heart += 40;
    M.s.money -= 60;
    M.render();
  });
  const deltas = await page.evaluate(() =>
    [...document.querySelectorAll("#stats .delta")].map((d) => d.textContent ?? ""));
  console.log("ตัวเลขที่ลอยขึ้นมา: " + (deltas.join(" · ") || "ไม่มีเลย"));
  expect(deltas.length, "ค่าเปลี่ยนแล้วแต่ไม่มีอะไรลอยขึ้นมาบอก").toBeGreaterThan(1);
  expect(deltas.some((d) => d.startsWith("+")), "ไม่มีค่าที่เพิ่มขึ้นถูกรายงาน").toBe(true);
  expect(deltas.some((d) => d.startsWith("-")), "ไม่มีค่าที่ลดลงถูกรายงาน").toBe(true);
});

/** มินิเกมทั้งเจ็ดตัวต้องขึ้นจอได้จริง
 *  สามตัวเป็นของใหม่และไม่มีเทสต์อื่นแตะเลย ถ้าตัวไหนพังตอนเปิด จะไม่มีใครรู้
 *  จนกว่าจะเล่นไปเจอเองกลางเทอม */
const MG = ["quiz", "relay", "rhythm", "dodge", "focus", "serve", "talk"] as const;
for (const kind of MG) {
  test(`มินิเกม ${kind} เปิดขึ้นมาแล้วมีของให้กดจริง`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    await toBoard(page);
    await page.evaluate((k) => (window as any).__mattayom.showMinigame(k), kind);
    await page.waitForSelector("#minigame .mg");
    // ทุกตัวต้องมีหัวเรื่องและมีของให้กดอย่างน้อยหนึ่งอย่าง (เกมจังหวะรอโน้ตตกก่อน)
    expect(await page.locator("#minigame .mgHead b").textContent()).not.toBe("");
    await expect.poll(async () =>
      page.locator("#minigame button, #minigame .fw").count(), { timeout: 5_000 })
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

/** ย้อนอ่านกับออโต้ — สองอย่างที่คนเล่นเกมแนวนี้คาดว่าจะมี
 *  ถ้าปุ่มอยู่แต่ไม่ทำงาน จะไม่มีใครรู้จนกว่าจะอ่านไม่ทันจริงๆ กลางฉากสำคัญ */
test("ย้อนอ่านบทที่ผ่านไปแล้วได้ และเดินบทอัตโนมัติได้", async ({ page }) => {
  await start(page);
  await typed(page);
  await page.locator("#bLog").click();
  await page.waitForSelector("#backlog .logline");
  expect(await page.locator("#backlog .logline").count(),
         "ย้อนอ่านแล้วไม่มีบรรทัดไหนถูกเก็บไว้เลย").toBeGreaterThan(0);
  await expect(page).toHaveScreenshot("backlog.png");
  await page.locator("#bLogClose").click();
  await expect(page.locator("#backlog")).toBeHidden();

  // ออโต้ต้องเดินบทเองจริง ไม่ใช่แค่ปุ่มที่เปลี่ยนสี
  const before = await page.locator("#line").textContent();
  await page.locator("#bAuto").click();
  expect(await page.locator("#bAuto").getAttribute("class")).toContain("is-on");
  await expect.poll(async () => page.locator("#line").textContent(), { timeout: 8_000 })
    .not.toBe(before);
});

/** มินิเกมทุกตัวต้องเล่นจนจบได้จริง และคืนคะแนนในช่วง 0..1
 *
 *  เทสต์ข้างบนดูแค่ว่า "เปิดขึ้นมาแล้วมีของให้กด" ซึ่งไม่พอ —
 *  เกมที่เปิดได้แต่จบไม่ลง จะทำให้ผู้เล่นค้างอยู่กลางเทอมโดยไม่มีทางออก
 *  และคะแนนที่หลุดช่วง 0..1 จะไปคูณกับคะแนนสอบ/ผลงานชมรมแบบเงียบๆ
 *  ที่นี่กดรัวทุกปุ่มจนกว่าจะเห็นหน้าสรุปผล แล้วอ่านคะแนนที่มันคืนกลับมาจริงๆ */
for (const kind of MG) {
  test(`มินิเกม ${kind} เล่นจนจบได้และคืนคะแนนในช่วง 0..1`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    await toBoard(page);
    const score = await page.evaluate(async (k) => {
      const M = (window as any).__mattayom;
      let got: number | null = null;
      M.runMinigame(k, 1).then((r: { score: number }) => { got = r.score; });
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const pick = (sel: string) => document.querySelector<HTMLButtonElement>("#minigame " + sel);
      // เล่นให้เหมือนคนเล่นจริง: เกมจัดของต้องแตะ "ของ" แล้วตามด้วย "ถุง"
      // กดแต่ของอย่างเดียวไม่มีอะไรเกิดขึ้น ซึ่งถูกแล้ว แต่ตัวกดอัตโนมัติต้องรู้เรื่องนี้
      for (let i = 0; i < 900 && got === null; i++) {
        const done = pick("#mgDone");
        if (done) { done.click(); await wait(40); continue; }
        const thing = pick(".thing:not(:disabled)");
        if (thing) {
          thing.click();
          await wait(30);
          pick(".bag")?.click();
          await wait(40);
          continue;
        }
        const b = pick(".qc:not(:disabled)") ?? pick(".laneBtn") ?? pick(".fpick:not(:disabled)")
               ?? pick(".topt:not(:disabled)") ?? pick(".mgBtn:not(:disabled)");
        if (b) b.click();
        await wait(45);
      }
      return got;
    }, kind);
    expect(score, `มินิเกม ${kind} เล่นจนจบไม่ได้`).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    // เล่นจบแล้วต้องคืนจอให้เกมหลัก ไม่ใช่ค้างทับอยู่
    await expect(page.locator("#minigame")).toBeHidden();
    expect(errors).toEqual([]);
  });
}

/** สลับไปแอปอื่นกลางมินิเกมแล้วกลับมา ต้องไม่เสียรอบนั้นฟรี
 *
 *  iPad คือเป้าหมายหลัก การสลับแอปกลางคันเป็นเรื่องปกติที่สุด
 *  เบราว์เซอร์หยุด requestAnimationFrame ตอนแท็บไม่ได้อยู่หน้าจอ แต่ performance.now() ยังเดิน
 *  ถ้าจับเวลาจากมันตรงๆ กลับมาอีกทีคำที่ต้องจำหายไปแล้วและเสียรอบนั้นไปโดยไม่ได้ทำอะไรผิด */
test("ซ่อนจอกลางมินิเกมแล้วกลับมา นาฬิกาต้องไม่เดินตอนที่ไม่ได้มอง", async ({ page }) => {
  await start(page);
  await toBoard(page);
  const elapsed = await page.evaluate(async () => {
    const M = (window as any).__mattayom;
    void M.runMinigame("quiz", 1);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(200);
    const bar = () => parseFloat(
      (document.querySelector("#minigame .mgBar i") as HTMLElement).style.width) || 0;
    const before = bar();
    // แกล้งทำเป็นสลับแอปไปสองวินาที
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    await wait(2000);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    await wait(200);
    const after = bar();
    return { before, after };
  });
  // แถบเวลาเหลือต้องลดลงไม่เกินที่ควรลดใน ~0.4 วินาที ไม่ใช่ลดไปสองวินาทีเต็ม
  // (ข้อสอบระดับ 1 ให้ข้อละ 15 วินาที · 2 วินาทีที่หายไป = ราว 13% ของแถบ)
  expect(elapsed.before - elapsed.after,
         "เวลาเดินต่อตอนที่ผู้เล่นไม่ได้มองอยู่").toBeLessThan(8);
});
