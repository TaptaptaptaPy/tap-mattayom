import { expect, test } from "@playwright/test";

/** แผ่นภาพรวม — วาดของทุกชิ้นลงหน้าเดียวแล้วถ่ายทีเดียว
 *
 *  นี่คือเทสต์ที่สำคัญที่สุดในไฟล์นี้ บั๊ก id ซ้ำใน SVG โผล่ก็ต่อเมื่อมีหลายชิ้น
 *  อยู่ในเอกสารเดียวกันเท่านั้น ถ่ายทีละใบจะไม่มีวันเจอ
 *  และตัวละคร/สถานที่ที่ลืมใส่ข้อมูลจะกลายเป็นภาพสำรองเงียบๆ ซึ่งเห็นทันทีบนแผ่นนี้
 */

test("ภาพตัวละครทุกคน ทุกอารมณ์ เรียงกันในแผ่นเดียว", async ({ page }) => {
  await page.goto("/");
  const html = await page.evaluate(async () => {
    const { portraitHTML } = await import("/src/ui/portrait.ts");
    const chars = (await import("/data/characters.json")).default as { id: string; name: string }[];
    const moods = ["calm", "happy", "away", "tense"] as const;
    // ทุกคน × ทุกอารมณ์ อยู่ในแผ่นเดียว — ถ้าไฟล์ไหนหาย จะเห็นเป็นช่องว่างทันที
    const cells = chars.flatMap((c) =>
      moods.map((m) => `<figure><div class="p">${portraitHTML(c.id, m)}</div>
                        <figcaption>${c.name} · ${m}</figcaption></figure>`));
    cells.push(`<figure><div class="p">${portraitHTML(null)}</div>
                <figcaption>ผู้บรรยาย</figcaption></figure>`);
    return cells.join("");
  });
  await page.setContent(`<style>
    body{margin:0;background:#16131f;font:13px system-ui;color:#f2eef7;
         display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px;align-content:start}
    figure{margin:0}.p{width:100%;border-radius:14px;overflow:hidden;line-height:0}
    .p svg,.p img{width:100%;height:auto;display:block}
    figcaption{text-align:center;padding-top:5px}</style>${html}`);
  await expect(page).toHaveScreenshot("portraits.png", { fullPage: true });
});

test("ฉากหลังทุกฉากเรียงกัน — ต้องไม่มีใบไหนได้สีของใบแรก", async ({ page }) => {
  await page.goto("/");
  const html = await page.evaluate(async () => {
    const m = await import("/src/ui/backdrop.ts");
    const ids = m.allBackdropIds();
    return ids.map((id: string) =>
      `<figure><div class="b">${m.backdrop(id)}</div><figcaption>${id}</figcaption></figure>`).join("");
  });
  await page.setContent(`<style>
    body{margin:0;background:#16131f;font:11px system-ui;color:#f2eef7;
         display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px;align-content:start}
    figure{margin:0}.b{border-radius:10px;overflow:hidden;line-height:0;aspect-ratio:400/150}
    .b svg{width:100%;height:100%;display:block}
    figcaption{text-align:center;padding-top:4px;opacity:.75}</style>${html}`);
  await expect(page).toHaveScreenshot("backdrops.png", { fullPage: true });
});
