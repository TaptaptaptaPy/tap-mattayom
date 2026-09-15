/** เครื่องมือประกอบภาพตัวละครจากชิ้นส่วน CC0
 *
 *   node tools/sprites.mjs sheet <โฟลเดอร์> <ไฟล์ออก.png> [คอลัมน์]
 *   node tools/sprites.mjs build
 *
 *  ทำไมต้องผ่านเบราว์เซอร์: ชิ้นส่วนเป็น PNG มีอัลฟา 1400×1200 ชั้นละไฟล์
 *  ต้องซ้อนกันให้ถูกลำดับแล้วย่อลง เครื่อง Mac มีแต่ `sips` ซึ่งซ้อนภาพไม่ได้
 *  โปรเจกต์นี้มี Playwright อยู่แล้ว canvas ของเบราว์เซอร์ซ้อนอัลฟาได้ถูกต้องและเร็ว
 *
 *  ทำไมต้องเสิร์ฟผ่าน http: ถ้าโหลดรูปด้วย file:// แล้ววาดลง canvas
 *  Chromium จะถือว่า canvas ปนเปื้อนแล้วอ่านภาพกลับออกมาไม่ได้
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { chromium } from "@playwright/test";

const PACKS = `${process.env.HOME}/Downloads`;
const TYPE = { ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

function serve(root) {
  return new Promise((ok) => {
    const s = createServer(async (req, res) => {
      try {
        const p = join(root, decodeURIComponent(req.url.split("?")[0]));
        const body = await readFile(p);
        res.setHeader("Content-Type", TYPE[extname(p).toLowerCase()] ?? "application/octet-stream");
        res.end(body);
      } catch { res.statusCode = 404; res.end("ไม่เจอ"); }
    });
    s.listen(0, "127.0.0.1", () => ok({ server: s, port: s.address().port }));
  });
}

/** วาดภาพหลายใบซ้อนกันแล้วย่อ คืนค่าเป็น PNG (base64) */
const COMPOSE = `async (job) => {
  const cv = document.createElement("canvas");
  cv.width = job.w; cv.height = job.h;
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  for (const src of job.layers) {
    if (!src) continue;
    const img = new Image();
    img.src = src;
    try { await img.decode(); } catch { throw new Error("โหลดไม่ได้: " + src); }
    g.drawImage(img, job.sx || 0, job.sy || 0, job.sw || img.width, job.sh || img.height,
                0, 0, job.w, job.h);
  }
  return cv.toDataURL("image/png").split(",")[1];
}`;

async function sheet(dir, out, cols = 7) {
  const root = join(PACKS, dir);
  const dirents = await readdir(root, { withFileTypes: true });
  const direct = dirents.filter((e) => e.isFile() && e.name.endsWith(".png")).map((e) => e.name);
  const picks = [];
  if (direct.length) {
    // โฟลเดอร์นี้มีไฟล์อยู่ตรงๆ (เช่นสีของทรงผมทรงเดียว) แสดงทุกไฟล์
    const num = (x) => Number((x.match(/\d+/) ?? [0])[0]);
    for (const f of direct.sort((a, b) => num(a) - num(b)))
      picks.push({ name: f.replace(".png", ""), url: `/${encodeURIComponent(f)}` });
  } else {
    for (const name of dirents.filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const files = (await readdir(join(root, name))).filter((f) => f.endsWith(".png")).sort();
      if (files.length) picks.push({ name, url: `/${encodeURIComponent(name)}/${encodeURIComponent(files[0])}` });
    }
  }
  const { server, port } = await serve(root);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
  const cell = 200, rows = Math.ceil(picks.length / cols);
  const html = picks.map((p, i) =>
    `<figure style="margin:0;position:relative"><img src="${p.url}" style="width:100%;display:block">
     <figcaption style="position:absolute;left:0;bottom:0;background:#000a;color:#fff;font:11px system-ui;padding:2px 5px">${i}. ${p.name}</figcaption></figure>`).join("");
  await page.setContent(`<body style="margin:0;background:#2a2536;display:grid;
    grid-template-columns:repeat(${cols},1fr);width:${cols * cell}px">${html}</body>`);
  await page.setViewportSize({ width: cols * cell, height: Math.max(200, rows * Math.round(cell * 1200 / 1400)) });
  await page.screenshot({ path: out, fullPage: true });
  await browser.close(); server.close();
  console.log(`เขียนแผ่นรวม ${picks.length} รายการ -> ${out}`);
  picks.forEach((p, i) => console.log(`  ${i}. ${p.name}`));
}

async function build() {
  const looks = JSON.parse(await readFile("data/looks.json", "utf8"));
  const outDir = "public/assets/portraits";
  await mkdir(outDir, { recursive: true });
  const { server, port } = await serve(PACKS);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" }).catch(() => {});

  const enc = (p) => "/" + p.split("/").map(encodeURIComponent).join("/");
  let n = 0;
  for (const [id, look] of Object.entries(looks.characters)) {
    const pack = looks.packs[look.pack];
    const at = (rel) => (rel ? enc(`${pack}/${rel}`) : null);
    for (const [mood, face] of Object.entries(looks.moods)) {
      // ลำดับนี้ห้ามสลับ ตาขาวต้องอยู่ใต้ม่านตา ม่านตาอยู่ใต้เปลือกตา
      // ผมหน้าต้องอยู่บนสุดรองจากแว่น ไม่งั้นผมจะไปอยู่หลังหน้าผาก
      const layers = [
        at(look.backHair), at(look.body), at(look.clothes), at(look.face),
        at(look.sclera?.replace("{expr}", face.eyes)),
        at(look.iris),
        at(look.eyes.replace("{expr}", face.eyes)),
        at(look.brows.replace("{expr}", face.brows)),
        at(look.mouth.replace("{expr}", face.mouth)),
        at(look.bangs), at(look.extra),
      ].filter(Boolean);
      const b64 = await page.evaluate(new Function("job", `return (${COMPOSE})(job)`),
        { layers, w: looks.size.w, h: looks.size.h, sx: looks.crop.x, sy: looks.crop.y,
          sw: looks.crop.w, sh: looks.crop.h });
      await writeFile(join(outDir, `${id}-${mood}.png`), Buffer.from(b64, "base64"));
      n++;
    }
  }
  await browser.close(); server.close();
  console.log(`ประกอบภาพเสร็จ ${n} ใบ -> ${outDir}`);
}

/** หากรอบสี่เหลี่ยมของส่วนที่ไม่โปร่งใส — ใช้หาว่าตัวละครอยู่ตรงไหนของภาพ 1400x1200
 *  เดาเอาแล้วผิดสามรอบ วัดเองจบใน 30 วินาที */
async function bbox(rel) {
  const { server, port } = await serve(PACKS);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`).catch(() => {});
  const url = "/" + rel.split("/").map(encodeURIComponent).join("/");
  const r = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { w: cv.width, h: cv.height, x0, y0, x1, y1 };
  }, url);
  await browser.close(); server.close();
  console.log(`${rel}\n  ภาพ ${r.w}x${r.h} · เนื้อหาอยู่ที่ x ${r.x0}-${r.x1} · y ${r.y0}-${r.y1}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "sheet") await sheet(rest[0], rest[1], Number(rest[2]) || 7);
else if (cmd === "build") await build();
else if (cmd === "bbox") await bbox(rest[0]);
else { console.log("ใช้: sheet <โฟลเดอร์> <ออก.png> [คอลัมน์] | build"); process.exit(1); }
