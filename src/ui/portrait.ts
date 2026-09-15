/** ภาพตัวละครวาดด้วย SVG ล้วน ไม่มีไฟล์รูป — คมทุกขนาด เปลี่ยนสีได้ และไม่ถ่วงการโหลด
 *  สไตล์: เรียบ แบน ทรงผมเป็นตัวบอกว่าใครเป็นใคร ชุดนักเรียนไทยคอปกขาว */

export type Mood = "calm" | "happy" | "away" | "tense";

interface Look {
  skin: string; hair: string; hairDark: string;
  accent: string; bg: [string, string];
  hairPath: string;        // ผมด้านหลัง/ทรงหลัก
  frontPath: string;       // หน้าม้า/ผมด้านหน้า
  extra?: string;          // ของประจำตัว เช่น แว่น กิ๊บ
  collar: string;          // สีปกและโบว์
}

const LOOKS: Record<string, Look> = {
  ploy: {
    skin: "#f0d3bd", hair: "#3a2a33", hairDark: "#2a1d25",
    accent: "#e4a0b7", bg: ["#3a2735", "#251a26"],
    collar: "#d4809c",
    // ผมบ๊อบตรง เรียบร้อยเป๊ะเหมือนตารางของเธอ
    hairPath: "M32 58 q-3-34 28-36 q31 2 28 36 l2 22 q-6-12-10-14 l0 -8 q-20 8-40 0 l0 8 q-4 2-10 14 z",
    frontPath: "M34 40 q10-13 26-13 q16 0 26 13 q-14-7-26-6 q-12-1-26 6 z",
    extra: `<g stroke="#4a3b44" stroke-width="2" fill="none" opacity=".85">
      <circle cx="49" cy="60" r="9"/><circle cx="71" cy="60" r="9"/><path d="M58 60h4"/>
      <path d="M40 58l-5-2M80 58l5-2"/></g>`,
  },
  kanin: {
    skin: "#e0b493", hair: "#241d1a", hairDark: "#15100e",
    accent: "#7fb2e8", bg: ["#22303f", "#161f2a"],
    collar: "#5a86b8",
    // ผมยาวรุงรัง ไม่เคยตัดตามที่ครูสั่ง
    hairPath: "M30 60 q-5-36 30-38 q35 2 30 38 l3 18 q-8-16-12-16 q-6 6-18 5 q-12 1-18-5 q-4 0-12 16 z",
    frontPath: "M32 44 q6-8 14-10 q-2 8-6 12 q8-6 14-12 q2 8-2 14 q10-6 14-14 q6 5 8 12 q-20 6-42-2 z",
  },
  minta: {
    skin: "#eecdb4", hair: "#4a3350", hairDark: "#33223a",
    accent: "#c8a6e8", bg: ["#332a44", "#1f192c"],
    collar: "#9b7bc4",
    // ผมยาวรวบหลวมๆ แบบคนที่ซ้อมดนตรีจนลืมจัดทรง
    hairPath: "M30 60 q-4-36 30-37 q34 1 30 37 l4 30 q-10-20-14-22 q2 12 0 18 q-20 6-40 0 q-2-6 0-18 q-4 2-14 22 z",
    frontPath: "M34 42 q12-12 26-12 q14 0 26 12 q-16-4-26-3 q-10-1-26 3 z",
    extra: `<path d="M84 74 q10 4 9 16" stroke="#4a3350" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },
};

const NARRATOR: Look = {
  skin: "#dcd4e6", hair: "#6f6285", hairDark: "#544a66",
  accent: "#cfc8e8", bg: ["#2a2438", "#1a1626"],
  collar: "#8a7fb0", hairPath: "", frontPath: "",
};

function eyes(m: Mood, look: Look): string {
  if (m === "happy")
    return `<path d="M45 60 q4-5 8 0M67 60 q4-5 8 0" stroke="${look.hairDark}" stroke-width="2.6"
            fill="none" stroke-linecap="round"/>`;
  if (m === "away")
    return `<path d="M44 61h10M66 61h10" stroke="${look.hairDark}" stroke-width="2.6" stroke-linecap="round"/>`;
  const brow = m === "tense"
    ? `<path d="M43 50l11 3M77 50l-11 3" stroke="${look.hairDark}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<path d="M43 51l11-1M77 51l-11-1" stroke="${look.hairDark}" stroke-width="2.2" stroke-linecap="round"
        opacity=".8"/>`;
  return `${brow}
    <ellipse cx="49" cy="61" rx="3.4" ry="4.2" fill="${look.hairDark}"/>
    <ellipse cx="71" cy="61" rx="3.4" ry="4.2" fill="${look.hairDark}"/>
    <circle cx="50.2" cy="59.5" r="1.2" fill="#fff" opacity=".9"/>
    <circle cx="72.2" cy="59.5" r="1.2" fill="#fff" opacity=".9"/>`;
}

function mouth(m: Mood, look: Look): string {
  if (m === "happy") return `<path d="M53 75 q7 6 14 0" stroke="${look.hairDark}" stroke-width="2.4"
    fill="none" stroke-linecap="round"/>`;
  if (m === "tense") return `<path d="M54 76 q6-4 12 0" stroke="${look.hairDark}" stroke-width="2.4"
    fill="none" stroke-linecap="round"/>`;
  return `<path d="M55 75h10" stroke="${look.hairDark}" stroke-width="2.4" stroke-linecap="round"/>`;
}

export function portraitSVG(charId: string | null, mood: Mood = "calm"): string {
  const look = (charId && LOOKS[charId]) || NARRATOR;
  const id = `pg_${charId ?? "n"}`;
  const body = charId && LOOKS[charId]
    ? `<path d="${look.hairPath}" fill="${look.hair}"/>
       <ellipse cx="60" cy="62" rx="25" ry="28" fill="${look.skin}"/>
       <ellipse cx="34" cy="66" rx="4" ry="6" fill="${look.skin}"/>
       <ellipse cx="86" cy="66" rx="4" ry="6" fill="${look.skin}"/>
       <path d="${look.frontPath}" fill="${look.hair}"/>
       ${eyes(mood, look)}${mouth(mood, look)}
       ${look.extra ?? ""}`
    : `<g opacity=".8">
         <path d="M40 96V26" stroke="${look.accent}" stroke-width="3" stroke-linecap="round"/>
         <circle cx="40" cy="23" r="3.4" fill="#e8c98a"/>
         <path d="M42 30h30l-8 9 8 9H42z" fill="${look.accent}" opacity=".85"/>
         <path d="M24 96h56" stroke="${look.accent}" stroke-width="2.5" stroke-linecap="round"/>
         <circle cx="82" cy="62" r="13" fill="${look.accent}" opacity=".3"/>
         <circle cx="90" cy="72" r="9" fill="${look.accent}" opacity=".24"/>
       </g>`;

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="pt">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${look.bg[0]}"/><stop offset="1" stop-color="${look.bg[1]}"/>
    </linearGradient></defs>
    <rect width="120" height="120" rx="22" fill="url(#${id})"/>
    ${charId && LOOKS[charId] ? `
      <path d="M14 120 q2-24 22-30 q12 6 24 6 q12 0 24-6 q20 6 22 30 z" fill="#f3eff8"/>
      <path d="M46 96 q14 10 28 0 l-6 24 h-16 z" fill="${look.collar}" opacity=".9"/>
      <path d="M52 92 l8 10 l8-10 q-8 4-16 0 z" fill="${look.skin}"/>` : ""}
    ${body}
  </svg>`;
}

/** ไอคอนเล็กไว้ใช้ในปุ่มและรายการ */
export function avatarChip(charId: string, size = 34): string {
  return `<span class="avatar" style="width:${size}px;height:${size}px">${portraitSVG(charId)}</span>`;
}
