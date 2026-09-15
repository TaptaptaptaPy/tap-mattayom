/** ภาพตัวละครวาดด้วย SVG ล้วน ไม่มีไฟล์รูป — คมทุกขนาด เปลี่ยนสีได้ และไม่ถ่วงการโหลด
 *
 *  สไตล์: อนิเมะญี่ปุ่น ไม่ใช่ทรงแบนแบบเดิม สิ่งที่ทำให้มันอ่านเป็นอนิเมะมีสี่อย่าง
 *  1. ตาใหญ่ มีม่านตาไล่สี รูม่านตา และไฮไลต์สองจุด (ดวงใหญ่บนซ้าย ดวงเล็กล่างขวา)
 *  2. เส้นขนตาบนหนาทึบและสะบัดออกที่หางตา
 *  3. ผมมีแถบแสงสะท้อนพาดขวาง และมีเส้นแบ่งปอยผม
 *  4. แก้มมีสีเลือดจางๆ และคางแหลมกว่าคนจริง
 *
 *  ชุดยังเป็นชุดนักเรียนไทยคอปกขาว เพราะนั่นคือจุดต่างของเกมนี้
 */

export type Mood = "calm" | "happy" | "away" | "tense";

interface Look {
  skin: string; skinShade: string; hair: string; hairDark: string; hairLight: string;
  iris: string; irisDeep: string;
  accent: string; bg: [string, string];
  hairPath: string;        // ผมด้านหลัง/ทรงหลัก
  frontPath: string;       // หน้าม้า/ผมด้านหน้า
  strands?: string;        // เส้นแบ่งปอยผมด้านหน้า
  extra?: string;          // ของประจำตัว เช่น แว่น กิ๊บ
  collar: string;          // สีปกและโบว์
}

const LOOKS: Record<string, Look> = {
  ploy: {
    skin: "#fbe0cd", skinShade: "#eec3ab", hair: "#3f2c38", hairDark: "#241823",
    hairLight: "#6b4f61", iris: "#e08aa8", irisDeep: "#8e3f5c",
    accent: "#e4a0b7", bg: ["#f0c6d6", "#b87a97"], collar: "#d4809c",
    // ผมบ๊อบตรง เรียบร้อยเป๊ะเหมือนตารางของเธอ
    hairPath: "M30 60 q-4-38 30-40 q34 2 30 40 l3 24 q-7-14-11-16 l0-9 q-22 9-44 0 l0 9 q-4 2-11 16 z",
    frontPath: "M31 46 q11-16 29-16 q18 0 29 16 q-16-9-29-8 q-13-1-29 8 z",
    strands: "M47 31 l-5 16 M60 28 l0 17 M73 31 l5 16",
    extra: `<g stroke="#5b4654" stroke-width="1.6" fill="none" opacity=".92">
      <rect x="33" y="55" width="25" height="16" rx="7"/>
      <rect x="62" y="55" width="25" height="16" rx="7"/>
      <path d="M58 62h4"/><path d="M33 61l-5-2M87 61l5-2"/></g>`,
  },
  kanin: {
    skin: "#eec0a0", skinShade: "#d7a184", hair: "#282019", hairDark: "#140f0b",
    hairLight: "#4e3f30", iris: "#7fb2e8", irisDeep: "#2f5f92",
    accent: "#7fb2e8", bg: ["#bcd6f2", "#5f88b5"], collar: "#5a86b8",
    // ผมยาวรุงรัง ไม่เคยตัดตามที่ครูสั่ง
    hairPath: "M28 62 q-5-40 32-42 q37 2 32 42 l4 20 q-9-18-13-18 q-7 7-19 6 q-13 1-20-6 q-4 0-13 18 z",
    frontPath: "M29 50 q7-12 16-15 q-3 10-7 15 q10-8 17-16 q2 10-3 17 q12-8 16-17 q7 6 10 15 q-24 8-49-1 z",
    strands: "M44 34 l-4 18 M58 30 l1 20 M72 34 l4 17",
  },
  minta: {
    skin: "#f7d9c2", skinShade: "#e3b79c", hair: "#503659", hairDark: "#33223a",
    hairLight: "#7d5c88", iris: "#c8a6e8", irisDeep: "#6f4a92",
    accent: "#c8a6e8", bg: ["#dcc6f2", "#8f6cb5"], collar: "#9b7bc4",
    // ผมยาวรวบหลวมๆ แบบคนที่ซ้อมดนตรีจนลืมจัดทรง
    hairPath: "M28 62 q-4-39 32-41 q36 2 32 41 l5 33 q-11-22-15-24 q2 13 0 20 q-22 7-44 0 q-2-7 0-20 q-4 2-15 24 z",
    frontPath: "M31 48 q13-15 29-15 q16 0 29 15 q-18-6-29-5 q-11-1-29 5 z",
    strands: "M45 32 l-4 17 M60 29 l0 19 M75 32 l4 17",
    extra: `<path d="M86 76 q12 5 11 19" stroke="#503659" stroke-width="5.5" fill="none" stroke-linecap="round"/>`,
  },
  tar: {
    skin: "#e8bd97", skinShade: "#d0a17c", hair: "#2f2a22", hairDark: "#191510",
    hairLight: "#5a5140", iris: "#8fd6a6", irisDeep: "#3d7a52",
    accent: "#8fd6a6", bg: ["#bfe8cd", "#6aa882"], collar: "#5d9973",
    // ผมสั้นเกรียนแบบคนที่ตัดเองที่ร้านหน้ามอ
    hairPath: "M30 58 q-3-36 30-38 q33 2 30 38 l2 16 q-7-12-11-13 l0-7 q-21 8-42 0 l0 7 q-4 1-11 13 z",
    frontPath: "M32 44 q10-13 28-13 q18 0 28 13 q-16-6-28-5 q-12-1-28 5 z",
    strands: "M48 33 l-3 13 M60 30 l0 14 M72 33 l3 13",
  },
  nun: {
    skin: "#f7dcc4", skinShade: "#e0b99c", hair: "#3b2f26", hairDark: "#221a14",
    hairLight: "#66513f", iris: "#e8c98a", irisDeep: "#9a7a3a",
    accent: "#e8c98a", bg: ["#f2e0bb", "#bd9d62"], collar: "#c9a86a",
    // ผมยาวมัดสองข้างแบบคนที่รีบออกจากหอทุกเช้า
    hairPath: "M28 60 q-4-38 32-40 q36 2 32 40 l4 28 q-9-18-13-20 q1 11-1 17 q-22 7-44 0 q-2-6-1-17 q-4 2-13 20 z",
    frontPath: "M31 46 q12-15 29-15 q17 0 29 15 q-17-7-29-6 q-12-1-29 6 z",
    strands: "M46 32 l-4 15 M60 29 l0 17 M74 32 l4 15",
    extra: `<g fill="#c9a86a" opacity=".9">
      <circle cx="26" cy="64" r="5"/><circle cx="94" cy="64" r="5"/></g>`,
  },
};

const NARRATOR: Look = {
  skin: "#dcd4e6", skinShade: "#c2b8d2", hair: "#6f6285", hairDark: "#544a66",
  hairLight: "#8d80a6", iris: "#cfc8e8", irisDeep: "#8a7fb0",
  accent: "#cfc8e8", bg: ["#2c2640", "#1a1628"],
  collar: "#8a7fb0", hairPath: "", frontPath: "",
};

/** ผมคลุมกระหม่อม ใช้ร่วมกันทุกคน — ถ้าไม่มีชั้นนี้ หนังหัวจะโผล่เหนือหน้าม้า
 *  เพราะรูปหน้ากับผมหลังสูงเท่ากัน หน้าม้าอย่างเดียวปิดได้แค่หน้าผาก */
const CROWN = "M60 18 C82 18 92 34 92 56 q-5-10-8-14 q-24-13-48 0 q-3 4-8 14 C28 34 38 18 60 18 Z";

/** id ของ gradient ต้องไม่ชนกันทั้งเอกสาร
 *
 *  เคยใช้ตัวนับ `uid++` แล้วเจอว่ามันชนจริง เพราะตัวนับรีเซ็ตได้ (HMR หรือโมดูลถูกโหลดสองครั้ง)
 *  พอ id ซ้ำ `url(#pb1)` จะไปหยิบ gradient ของภาพแรกในเอกสารเสมอ
 *  ผลคือภาพหลังๆ พื้นหลังหายไปเฉยๆ โดยไม่มี error ให้เห็น — หาสาเหตุยากมาก */
const rid = () => Math.random().toString(36).slice(2, 9);

/** ตาหนึ่งข้างแบบอนิเมะ — `side` -1 คือตาซ้ายของภาพ, +1 คือตาขวา */
function eye(side: -1 | 1, look: Look, mood: Mood, gid: string): string {
  const cx = 60 + side * 12.5;
  const out = cx + side * 9.5;      // ทางหางตา
  const lash = look.hairDark;

  if (mood === "happy")
    return `<path d="M${cx - 8} 64 q8-9 16 0" stroke="${lash}" stroke-width="3"
              fill="none" stroke-linecap="round"/>
            <path d="M${out} 56 q${side * 3}-2 ${side * 4}-4" stroke="${lash}"
              stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>`;

  if (mood === "away")
    return `<path d="M${cx - 8.5} 61 q8.5 4 17 0" stroke="${lash}" stroke-width="3.2"
              fill="none" stroke-linecap="round"/>
            <path d="M${cx - 7} 65 q7 2 14 0" stroke="${lash}" stroke-width="1"
              fill="none" opacity=".45"/>`;

  const narrow = mood === "tense" ? 0.86 : 1;
  const ry = 10 * narrow;
  return `
    <ellipse cx="${cx}" cy="62" rx="8.4" ry="${ry}" fill="#fdfbff"/>
    <ellipse cx="${cx}" cy="${63}" rx="6.3" ry="${8.2 * narrow}" fill="url(#${gid})"/>
    <ellipse cx="${cx}" cy="${63.6}" rx="2.9" ry="${4.4 * narrow}" fill="#1b1522"/>
    <ellipse cx="${cx - 2.7}" cy="58.8" rx="2.8" ry="3.3" fill="#fff" opacity=".95"/>
    <circle cx="${cx + 2.6}" cy="66.3" r="1.5" fill="#fff" opacity=".65"/>
    <path d="M${cx - 8.8} ${58.4} q8.8-7.4 17.6 0 l0 2.2 q-8.8-5.6-17.6 0 z" fill="${lash}"/>
    <path d="M${out} ${57.4} q${side * 3.2}-1.4 ${side * 5}-3.4 q${-side * 0.6} 2.6 ${-side * 3.4} 4.6 z"
      fill="${lash}"/>
    <path d="M${cx - 7} 70.6 q7 3.2 14 0" stroke="${lash}" stroke-width="1.1"
      fill="none" opacity=".45"/>`;
}

function brows(look: Look, mood: Mood): string {
  const c = look.hairDark;
  if (mood === "tense")
    return `<path d="M40 50 q9 1 17 5" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <path d="M80 50 q-9 1-17 5" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (mood === "away")
    return `<path d="M40 50 q9-1 17 1" stroke="${c}" stroke-width="2.1" fill="none"
              stroke-linecap="round" opacity=".75"/>
            <path d="M80 50 q-9-1-17 1" stroke="${c}" stroke-width="2.1" fill="none"
              stroke-linecap="round" opacity=".75"/>`;
  return `<path d="M40 49.5 q9-3 17 .6" stroke="${c}" stroke-width="2.2" fill="none"
            stroke-linecap="round" opacity=".9"/>
          <path d="M80 49.5 q-9-3-17 .6" stroke="${c}" stroke-width="2.2" fill="none"
            stroke-linecap="round" opacity=".9"/>`;
}

function mouth(mood: Mood, look: Look): string {
  const c = look.irisDeep;
  if (mood === "happy")
    return `<path d="M54 78 q6 6 12 0 q-6 3-12 0 z" fill="${c}" opacity=".8"/>`;
  if (mood === "tense")
    return `<path d="M55 79 q5-4 10 0" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (mood === "away")
    return `<path d="M56 79 q4 2 8 0" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"
              opacity=".8"/>`;
  return `<path d="M56 78.5 h8" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".85"/>`;
}

export function portraitSVG(charId: string | null, mood: Mood = "calm"): string {
  const look = (charId && LOOKS[charId]) || NARRATOR;
  const n = rid();
  const bg = `pb${n}`, ir = `pi${n}`, sh = `ps${n}`;
  const real = !!(charId && LOOKS[charId]);

  const face = real ? `
    <!-- คางแหลม โหนกแก้มกว้าง แบบอนิเมะ ไม่ใช่วงรีธรรมดา -->
    <path d="M60 22 C80 22 89 36 89 54 C89 71 81 84 60 95 C39 84 31 71 31 54 C31 36 40 22 60 22 Z"
      fill="${look.skin}"/>
    <ellipse cx="29.5" cy="66" rx="3.6" ry="5.6" fill="${look.skin}"/>
    <ellipse cx="90.5" cy="66" rx="3.6" ry="5.6" fill="${look.skin}"/>
    <!-- เงาใต้ผมบนหน้าผาก ทำให้หน้าไม่แบน -->
    <path d="M31 50 q29-16 58 0 l0 -8 q-29-14-58 0 z" fill="url(#${sh})" opacity=".55"/>
    ${brows(look, mood)}
    ${eye(-1, look, mood, ir)}${eye(1, look, mood, ir)}
    <!-- แก้ม -->
    <ellipse cx="42" cy="73" rx="6.8" ry="3.8" fill="#e8798f" opacity=".32"/>
    <ellipse cx="78" cy="73" rx="6.8" ry="3.8" fill="#e8798f" opacity=".32"/>
    <path d="M59 68 q2 4-1 6" stroke="${look.skinShade}" stroke-width="1.5" fill="none"
      stroke-linecap="round" opacity=".8"/>
    ${mouth(mood, look)}
    <!-- เงาใต้คาง -->
    <path d="M48 93 q12 7 24 0 l0 5 q-12 6-24 0 z" fill="${look.skinShade}" opacity=".5"/>` : "";

  // ผมหลังอยู่ใต้หน้า ผมหน้าอยู่บนหน้าผาก — วางผิดชั้นทีเดียวผมจะทับหน้าทั้งใบ
  const hairBack = real ? `<path d="${look.hairPath}" fill="${look.hair}"/>` : "";
  const hairFront = real ? `
    <path d="${CROWN}" fill="${look.hair}"/>
    <path d="${look.frontPath}" fill="${look.hair}"/>
    <!-- แถบแสงสะท้อนบนผม คือสิ่งที่ทำให้ผมอ่านเป็นอนิเมะมากที่สุด -->
    <path d="M38 33 q22-13 44 0 q-6 6-8 5 q-14-8-28 0 q-2 1-8-5 z" fill="${look.hairLight}" opacity=".5"/>
    ${look.strands ? `<path d="${look.strands}" stroke="${look.hairDark}" stroke-width="1.2"
      fill="none" opacity=".4" stroke-linecap="round"/>` : ""}
    ${look.extra ?? ""}` : "";

  const narrator = real ? "" : `
    <g opacity=".85">
      <path d="M40 98V24" stroke="${look.accent}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="40" cy="21" r="3.6" fill="#e8c98a"/>
      <path d="M42 28h32l-9 10 9 10H42z" fill="${look.accent}" opacity=".85"/>
      <path d="M22 98h60" stroke="${look.accent}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="84" cy="60" r="14" fill="${look.accent}" opacity=".26"/>
      <circle cx="93" cy="72" r="9" fill="${look.accent}" opacity=".2"/>
    </g>`;

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="pt">
    <defs>
      <linearGradient id="${bg}" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="${look.bg[0]}"/><stop offset="1" stop-color="${look.bg[1]}"/>
      </linearGradient>
      <radialGradient id="${ir}" cx="0.4" cy="0.3" r="0.8">
        <stop offset="0" stop-color="${look.iris}"/>
        <stop offset="1" stop-color="${look.irisDeep}"/>
      </radialGradient>
      <linearGradient id="${sh}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${look.skinShade}"/>
        <stop offset="1" stop-color="${look.skinShade}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="22" fill="url(#${bg})"/>
    <circle cx="86" cy="26" r="32" fill="#ffffff" opacity=".18"/>
    ${hairBack}
    ${real ? `
      <path d="M12 120 q2-26 23-32 q13 7 25 7 q12 0 25-7 q21 6 23 32 z" fill="#f5f1fa"/>
      <path d="M45 98 q15 11 30 0 l-7 26 h-16 z" fill="${look.collar}" opacity=".92"/>
      <path d="M51 94 l9 11 l9-11 q-9 5-18 0 z" fill="${look.skinShade}"/>` : ""}
    ${face}
    ${hairFront}
    ${narrator}
  </svg>`;
}

/** ไอคอนเล็กไว้ใช้ในปุ่มและรายการ */
export function avatarChip(charId: string, size = 34): string {
  return `<span class="avatar" style="width:${size}px;height:${size}px">${portraitSVG(charId)}</span>`;
}
