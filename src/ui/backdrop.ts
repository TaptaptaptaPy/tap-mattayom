import scenes from "../../data/scenes.json";
import { asset } from "../core/asset";
/** ฉากหลังของแต่ละสถานที่และเหตุการณ์ วาดด้วย SVG ในโค้ด ไม่มีไฟล์รูป
 *  ใช้ทั้งเป็นแถบบนการ์ดสถานที่ และเป็นพื้นหลังของกล่องบทสนทนา */

const VB = "0 0 400 150";

/** สีฟ้าหลังฉากเปลี่ยนตามช่วงเวลาผ่านตัวแปร CSS ที่ theme.ts ตั้งไว้ */
const sky = (id: string, from: string, to: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

const SCENES: Record<string, string> = {
  classroom: `
    <defs>${sky("g", "#2e2a42", "#1d1a2c")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="24" y="26" width="104" height="72" rx="3" fill="#3d5878" opacity=".55"/>
    <rect x="150" y="26" width="104" height="72" rx="3" fill="#3d5878" opacity=".55"/>
    <path d="M24 62h104M76 26v72M150 62h104M202 26v72" stroke="#1d1a2c" stroke-width="3"/>
    <rect x="286" y="20" width="92" height="58" rx="4" fill="#24402f"/>
    <path d="M296 36h60M296 48h44M296 60h52" stroke="#dfe8e0" stroke-width="2" opacity=".5"/>
    <rect x="0" y="98" width="400" height="52" fill="#2a2338"/>
    <g fill="#40374f">
      <rect x="30" y="106" width="70" height="8" rx="2"/><rect x="140" y="106" width="70" height="8" rx="2"/>
      <rect x="250" y="106" width="70" height="8" rx="2"/>
      <rect x="40" y="114" width="6" height="22"/><rect x="84" y="114" width="6" height="22"/>
      <rect x="150" y="114" width="6" height="22"/><rect x="194" y="114" width="6" height="22"/>
      <rect x="260" y="114" width="6" height="22"/><rect x="304" y="114" width="6" height="22"/>
    </g>`,
  library: `
    <defs>${sky("g", "#2b2436", "#1a1626")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <g fill="#3a3048">
      <rect x="10" y="18" width="110" height="120" rx="3"/>
      <rect x="132" y="30" width="96" height="108" rx="3"/>
      <rect x="280" y="18" width="110" height="120" rx="3"/>
    </g>
    <g opacity=".85">
      <rect x="18" y="26" width="8" height="30" fill="#c08a72"/><rect x="28" y="24" width="7" height="32" fill="#7f9ec4"/>
      <rect x="37" y="28" width="9" height="28" fill="#c8b06a"/><rect x="48" y="25" width="6" height="31" fill="#8fae8a"/>
      <rect x="58" y="27" width="8" height="29" fill="#a98ad0"/><rect x="70" y="24" width="7" height="32" fill="#c08a72"/>
      <rect x="18" y="66" width="7" height="30" fill="#8fae8a"/><rect x="27" y="68" width="9" height="28" fill="#c8b06a"/>
      <rect x="40" y="65" width="6" height="31" fill="#7f9ec4"/><rect x="50" y="67" width="8" height="29" fill="#c08a72"/>
      <rect x="290" y="26" width="8" height="30" fill="#7f9ec4"/><rect x="301" y="24" width="7" height="32" fill="#c8b06a"/>
      <rect x="311" y="28" width="9" height="28" fill="#a98ad0"/><rect x="323" y="25" width="6" height="31" fill="#c08a72"/>
      <rect x="290" y="66" width="7" height="30" fill="#c8b06a"/><rect x="300" y="68" width="9" height="28" fill="#8fae8a"/>
    </g>
    <rect x="140" y="88" width="80" height="6" rx="2" fill="#5a4a38"/>
    <rect x="150" y="94" width="5" height="40" fill="#4a3c2e"/><rect x="205" y="94" width="5" height="40" fill="#4a3c2e"/>
    <rect x="158" y="76" width="44" height="12" rx="2" fill="#e8e2f0" opacity=".8"/>`,
  backfield: `
    <defs>${sky("g", "#3a4a62", "#232a3c")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <circle cx="330" cy="36" r="18" fill="#e8c98a" opacity=".35"/>
    <rect x="0" y="92" width="400" height="58" fill="#2f4030"/>
    <path d="M0 92q100-14 200 0t200-6v64H0z" fill="#3a5238"/>
    <rect x="30" y="30" width="120" height="66" fill="#241f30"/>
    <g fill="#332c42"><rect x="40" y="40" width="22" height="16"/><rect x="72" y="40" width="22" height="16"/>
      <rect x="104" y="40" width="22" height="16"/><rect x="40" y="64" width="22" height="16"/>
      <rect x="72" y="64" width="22" height="16"/><rect x="104" y="64" width="22" height="16"/></g>
    <g stroke="#6a7a5c" stroke-width="2" fill="none" opacity=".7">
      <path d="M250 96v-24h44v24M250 72h44"/></g>`,
  musicroom: `
    <defs>${sky("g", "#332a48", "#1e1a2e")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="0" width="400" height="150" fill="url(#g)"/>
    <g opacity=".3" fill="#6a5f85">
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 34}" y="10" width="26" height="60" rx="4"/>`).join("")}
    </g>
    <rect x="42" y="74" width="150" height="14" rx="3" fill="#2a2338"/>
    <rect x="52" y="88" width="130" height="46" fill="#3a3048"/>
    <g fill="#efe9f6">${Array.from({ length: 14 }, (_, i) => `<rect x="${56 + i * 9}" y="90" width="7" height="30" rx="1"/>`).join("")}</g>
    <g fill="#1d1a2c">${[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => `<rect x="${61 + i * 9}" y="90" width="4" height="18"/>`).join("")}</g>
    <g stroke="#c8a6e8" stroke-width="2" fill="none" opacity=".75">
      <path d="M250 60v-28l26-6v28"/><circle cx="246" cy="62" r="6"/><circle cx="272" cy="56" r="6"/></g>
    <path d="M300 118h60" stroke="#4a3f5e" stroke-width="3"/>
    <path d="M318 118V78l14-6" stroke="#4a3f5e" stroke-width="3" fill="none"/>`,
  canteen: `
    <defs>${sky("g", "#3c3348", "#221d2e")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <g fill="#4a3f56">${Array.from({ length: 5 }, (_, i) => `<rect x="${12 + i * 78}" y="70" width="62" height="8" rx="3"/>
      <rect x="${20 + i * 78}" y="78" width="5" height="34"/><rect x="${61 + i * 78}" y="78" width="5" height="34"/>`).join("")}</g>
    <g fill="#c8b06a" opacity=".9">${Array.from({ length: 5 }, (_, i) => `<ellipse cx="${43 + i * 78}" cy="66" rx="14" ry="5"/>`).join("")}</g>
    <rect x="0" y="112" width="400" height="38" fill="#2c2438"/>
    <rect x="0" y="16" width="400" height="10" fill="#8a5f5a" opacity=".6"/>
    <path d="M0 26h400" stroke="#6a4642" stroke-width="3"/>`,
  arcade: `
    <defs>${sky("g", "#2a1f3e", "#140f22")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="118" width="400" height="32" fill="#241a33"/>
    <rect x="0" y="115" width="400" height="4" fill="#3a2b4e"/>
    ${Array.from({ length: 5 }, (_, i) => {
      const x = 14 + i * 78, c = ["#e8557a", "#5bc8e8", "#e8b24a", "#8a6ae8", "#4ad98a"][i];
      return `<g>
        <rect x="${x}" y="46" width="58" height="72" rx="4" fill="#332545"/>
        <rect x="${x + 5}" y="52" width="48" height="30" rx="3" fill="${c}" opacity=".85"/>
        <rect x="${x + 5}" y="52" width="48" height="30" rx="3" fill="none" stroke="#1b1329" stroke-width="2"/>
        <circle cx="${x + 16}" cy="94" r="5" fill="${c}"/>
        <circle cx="${x + 30}" cy="94" r="5" fill="#e8e2f2" opacity=".6"/>
        <rect x="${x + 8}" y="104" width="42" height="5" rx="2" fill="#4a3a63"/>
      </g>`;
    }).join("")}
    <g fill="#e8557a" opacity=".22">${Array.from({ length: 5 }, (_, i) =>
      `<ellipse cx="${43 + i * 78}" cy="70" rx="42" ry="30"/>`).join("")}</g>
    <g stroke="#5bc8e8" stroke-width="2" opacity=".4" fill="none">
      <path d="M0 26h400"/><path d="M0 34h400"/></g>`,
  tutorschool: `
    <defs>${sky("g", "#28304a", "#181c2c")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="96" width="400" height="54" fill="#222a3c"/>
    <rect x="40" y="26" width="132" height="70" rx="4" fill="#2d3850"/>
    <path d="M52 42h108M52 56h78M52 70h96" stroke="#dfe6f2" stroke-width="3" opacity=".55"/>
    <g fill="#3a4560">${Array.from({ length: 4 }, (_, i) => `<rect x="${210 + i * 44}" y="${74 - (i % 2) * 6}" width="32" height="26" rx="3"/>`).join("")}</g>
    <g fill="#8fa8cc" opacity=".8">${Array.from({ length: 4 }, (_, i) => `<circle cx="${226 + i * 44}" cy="${64 - (i % 2) * 6}" r="8"/>`).join("")}</g>`,
  temple: `
    <defs>${sky("g", "#3a3048", "#20182c")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <circle cx="70" cy="34" r="20" fill="#e8d9a0" opacity=".28"/>
    <rect x="0" y="108" width="400" height="42" fill="#2a2234"/>
    <g>
      <path d="M200 16l92 46H108z" fill="#b5834a"/>
      <path d="M200 30l70 34H130z" fill="#d8a45e"/>
      <rect x="126" y="62" width="148" height="48" fill="#c8a978"/>
      <g fill="#8a6a44">${Array.from({ length: 5 }, (_, i) => `<rect x="${138 + i * 30}" y="70" width="14" height="40"/>`).join("")}</g>
      <path d="M200 6v12" stroke="#e8c96a" stroke-width="4"/>
    </g>
    <g fill="#4a5a3c"><ellipse cx="44" cy="106" rx="30" ry="16"/><ellipse cx="358" cy="104" rx="34" ry="18"/></g>`,
  home: `
    <defs>${sky("g", "#3a2f4a", "#221a2e")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="116" width="400" height="34" fill="#4a3a52"/>
    <rect x="0" y="113" width="400" height="4" fill="#63506b"/>
    <rect x="22" y="24" width="150" height="90" rx="3" fill="#2e2440"/>
    <rect x="30" y="32" width="134" height="60" rx="2" fill="#5b4a72" opacity=".55"/>
    <g stroke="#221a2e" stroke-width="3" fill="none"><path d="M97 32v60M30 62h134"/></g>
    <g fill="#e8c98a" opacity=".5"><rect x="34" y="36" width="56" height="22" rx="2"/></g>
    <rect x="200" y="62" width="86" height="52" rx="3" fill="#6b5340"/>
    <rect x="206" y="56" width="74" height="8" rx="3" fill="#8a6b52"/>
    <g fill="#4e3d5e">${Array.from({ length: 4 }, (_, i) =>
      `<rect x="${212 + i * 18}" y="70" width="12" height="20" rx="2"/>`).join("")}</g>
    <rect x="304" y="78" width="76" height="36" rx="3" fill="#57466a"/>
    <rect x="310" y="72" width="64" height="8" rx="3" fill="#6d5a82"/>
    <g fill="#e8c98a" opacity=".85"><circle cx="342" cy="40" r="9"/></g>
    <g stroke="#6d5a82" stroke-width="2"><path d="M342 20v12"/></g>
    <g fill="#e8c98a" opacity=".16"><ellipse cx="342" cy="58" rx="46" ry="26"/></g>`,
  assembly: `
    <defs>${sky("g", "#2e4160", "#1b2436")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <circle cx="326" cy="34" r="22" fill="#f0d79a" opacity=".35"/>
    <rect x="0" y="104" width="400" height="46" fill="#2a3142"/>
    <path d="M96 106V24" stroke="#c8ccd8" stroke-width="4"/>
    <circle cx="96" cy="21" r="5" fill="#e8c98a"/>
    <g><rect x="100" y="28" width="62" height="10" fill="#d05a5a"/>
      <rect x="100" y="38" width="62" height="8" fill="#eef0f6"/>
      <rect x="100" y="46" width="62" height="14" fill="#46609f"/>
      <rect x="100" y="60" width="62" height="8" fill="#eef0f6"/>
      <rect x="100" y="68" width="62" height="10" fill="#d05a5a"/></g>
    <g fill="#3c4457">${Array.from({ length: 9 }, (_, i) => `<rect x="${196 + (i % 5) * 34}" y="${80 + Math.floor(i / 5) * 16}" width="12" height="26" rx="5"/>`).join("")}</g>`,
  // ───────── ภาคมหาลัย ─────────
  lecture: `
    <defs>${sky("g", "#2c3348", "#1a1e2e")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="30" y="18" width="150" height="62" rx="3" fill="#1e3a2e"/>
    <path d="M42 34h110M42 46h80M42 58h96" stroke="#cfe0d4" stroke-width="2" opacity=".42"/>
    <g fill="#3a4258">
      <rect x="20" y="96" width="110" height="7" rx="2"/><rect x="150" y="96" width="110" height="7" rx="2"/>
      <rect x="280" y="96" width="100" height="7" rx="2"/>
      <rect x="20" y="118" width="110" height="7" rx="2"/><rect x="150" y="118" width="110" height="7" rx="2"/>
      <rect x="280" y="118" width="100" height="7" rx="2"/>
    </g>
    <g fill="#4a5470" opacity=".8">
      <circle cx="58" cy="88" r="7"/><circle cx="188" cy="88" r="7"/><circle cx="318" cy="88" r="7"/>
      <circle cx="104" cy="110" r="7"/><circle cx="236" cy="110" r="7"/>
    </g>`,

  unilib: `
    <defs>${sky("g", "#2a2c40", "#181a28")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <g fill="#3c4058">
      <rect x="14" y="16" width="86" height="118" rx="3"/><rect x="300" y="16" width="86" height="118" rx="3"/>
    </g>
    <g fill="#5a5f7e">
      <rect x="22" y="26" width="10" height="34" rx="2"/><rect x="36" y="22" width="9" height="38" rx="2"/>
      <rect x="49" y="28" width="11" height="32" rx="2"/><rect x="64" y="24" width="8" height="36" rx="2"/>
      <rect x="308" y="24" width="10" height="36" rx="2"/><rect x="322" y="28" width="9" height="32" rx="2"/>
      <rect x="335" y="22" width="11" height="38" rx="2"/>
    </g>
    <rect x="130" y="96" width="140" height="8" rx="3" fill="#4a4230"/>
    <rect x="140" y="104" width="8" height="30" fill="#3c3628"/><rect x="252" y="104" width="8" height="30" fill="#3c3628"/>
    <rect x="176" y="80" width="48" height="16" rx="3" fill="#6b6f8e" opacity=".7"/>`,

  faccant: `
    <defs>${sky("g", "#33303e", "#1e1c26")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="92" width="400" height="58" fill="#2b2833"/>
    <g fill="#4a4554">
      <rect x="20" y="86" width="96" height="8" rx="3"/><rect x="150" y="86" width="96" height="8" rx="3"/>
      <rect x="280" y="86" width="96" height="8" rx="3"/>
    </g>
    <g fill="#3a3644">
      <rect x="28" y="94" width="7" height="34"/><rect x="101" y="94" width="7" height="34"/>
      <rect x="158" y="94" width="7" height="34"/><rect x="231" y="94" width="7" height="34"/>
    </g>
    <g fill="#6b5f48" opacity=".85">
      <rect x="40" y="18" width="320" height="54" rx="4"/>
    </g>
    <g fill="#d8c9a4" opacity=".55">
      <circle cx="90" cy="45" r="11"/><circle cx="150" cy="45" r="11"/><circle cx="210" cy="45" r="11"/>
      <circle cx="270" cy="45" r="11"/><circle cx="330" cy="45" r="11"/>
    </g>`,

  parttime: `
    <defs>${sky("g", "#dfe8ec", "#a9bcc6")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="0" width="400" height="16" fill="#3f7a5e"/>
    <rect x="0" y="16" width="400" height="4" fill="#2d5a45"/>
    <rect x="0" y="112" width="400" height="38" fill="#c8cfd4"/>
    <rect x="0" y="109" width="400" height="4" fill="#9aa6ae"/>
    <g>${Array.from({ length: 3 }, (_, i) => {
      const x = 16 + i * 124;
      const shelves = [46, 66, 86].map((y) =>
        `<rect x="${x + 4}" y="${y}" width="96" height="3" fill="#b9c6cc"/>` +
        Array.from({ length: 6 }, (_, k) =>
          `<rect x="${x + 8 + k * 15}" y="${y - 11}" width="11" height="11" rx="2"
            fill="${["#d88a6a", "#6aa8d8", "#d8c46a", "#8ad8a0", "#c78ad8", "#d8a06a"][(k + i) % 6]}"
            opacity=".85"/>`).join(""));
      return `<rect x="${x}" y="30" width="104" height="80" rx="3" fill="#eef3f5"/>
              <rect x="${x}" y="30" width="104" height="80" rx="3" fill="none" stroke="#a8b6bd" stroke-width="2"/>
              ${shelves.join("")}`;
    }).join("")}</g>
    <rect x="248" y="86" width="140" height="26" rx="3" fill="#8a949b"/>
    <rect x="248" y="82" width="140" height="6" rx="2" fill="#aab4bb"/>
    <rect x="292" y="58" width="52" height="24" rx="3" fill="#3b4a54"/>
    <rect x="298" y="64" width="40" height="12" rx="2" fill="#7fd0b0" opacity=".8"/>`,

  bar: `
    <defs>${sky("g", "#3b2437", "#1c1220")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="96" width="400" height="54" fill="#2a1a26"/>
    <rect x="0" y="92" width="400" height="6" rx="2" fill="#6d4a3a"/>
    <rect x="0" y="16" width="400" height="52" fill="#241725"/>
    <g fill="#8a5f4a">${Array.from({ length: 4 }, (_, i) =>
      `<rect x="${18 + i * 96}" y="22" width="86" height="6" rx="2"/>
       <rect x="${18 + i * 96}" y="46" width="86" height="6" rx="2"/>`).join("")}</g>
    <g>${Array.from({ length: 14 }, (_, i) => {
      const x = 24 + i * 26, tall = i % 3 === 0;
      return `<rect x="${x}" y="${tall ? 28 : 30}" width="9" height="${tall ? 18 : 16}" rx="2"
               fill="${["#c98a4a", "#7aa86a", "#b05a5a", "#d0b06a"][i % 4]}" opacity=".85"/>`;
    }).join("")}</g>
    ${Array.from({ length: 4 }, (_, i) =>
      `<g><rect x="${52 + i * 92}" y="112" width="30" height="7" rx="3" fill="#5b3e30"/>
       <rect x="${64 + i * 92}" y="119" width="6" height="26" fill="#4a3226"/></g>`).join("")}
    <g fill="#f0c98a" opacity=".55">${[70, 200, 330].map((x) =>
      `<ellipse cx="${x}" cy="14" rx="26" ry="16"/>`).join("")}</g>
    <g stroke="#3a2a33" stroke-width="2" fill="none">${[70, 200, 330].map((x) =>
      `<path d="M${x} 0v6"/>`).join("")}</g>`,

  clubroom: `
    <defs>${sky("g", "#2e2a42", "#1b1828")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="110" width="400" height="40" fill="#292538"/>
    <g fill="#4a4260">
      <rect x="40" y="34" width="120" height="76" rx="4"/><rect x="250" y="44" width="100" height="66" rx="4"/>
    </g>
    <g stroke="#cfc8e8" stroke-width="2.5" fill="none" opacity=".45">
      <path d="M60 60h80M60 74h60M60 88h72"/>
      <circle cx="300" cy="78" r="16"/><path d="M300 62v32M284 78h32"/>
    </g>
    <path d="M180 110V52l48-9v58" stroke="#e8c98a" stroke-width="3" fill="none" opacity=".7"/>
    <circle cx="180" cy="110" r="7" fill="#e8c98a" opacity=".7"/>
    <circle cx="228" cy="101" r="7" fill="#e8c98a" opacity=".7"/>`,

  dorm: `
    <defs>${sky("g", "#33405c", "#1c2436")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="114" width="400" height="36" fill="#3d4256"/>
    <rect x="0" y="111" width="400" height="4" fill="#556078"/>
    <rect x="18" y="40" width="120" height="74" rx="3" fill="#48506b"/>
    <rect x="18" y="34" width="120" height="8" rx="3" fill="#5c6685"/>
    <rect x="26" y="48" width="104" height="26" rx="2" fill="#2c3247"/>
    <g fill="#7d8aab">${Array.from({ length: 4 }, (_, i) =>
      `<rect x="${32 + i * 25}" y="78" width="18" height="28" rx="2"/>`).join("")}</g>
    <rect x="156" y="66" width="106" height="48" rx="3" fill="#5a4a52"/>
    <rect x="152" y="58" width="114" height="10" rx="4" fill="#8a6f76"/>
    <rect x="162" y="44" width="40" height="16" rx="6" fill="#d8ccc4"/>
    <rect x="286" y="26" width="96" height="88" rx="3" fill="#2a3246"/>
    <rect x="294" y="34" width="80" height="60" rx="2" fill="#6f86b5" opacity=".55"/>
    <g stroke="#1c2436" stroke-width="3" fill="none"><path d="M334 34v60M294 64h80"/></g>
    <g fill="#e8d0a0" opacity=".9"><circle cx="240" cy="30" r="7"/></g>
    <g fill="#e8d0a0" opacity=".14"><ellipse cx="240" cy="48" rx="40" ry="22"/></g>`,

  barber: `
    <defs>${sky("g", "#efe4d2", "#bda98c")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="110" width="400" height="40" fill="#5c4a38"/>
    <rect x="0" y="107" width="400" height="4" fill="#7a6248"/>
    <rect x="18" y="26" width="212" height="82" rx="3" fill="#cdb79a"/>
    <rect x="24" y="32" width="200" height="56" rx="2" fill="#e7f0ee" opacity=".7"/>
    <g fill="#8d7458">${Array.from({ length: 3 }, (_, i) =>
      `<rect x="${34 + i * 66}" y="88" width="46" height="8" rx="3"/>
       <rect x="${52 + i * 66}" y="96" width="10" height="12"/>
       <rect x="${40 + i * 66}" y="60" width="34" height="30" rx="12" fill="#6d5742"/>`).join("")}</g>
    <g>
      <rect x="262" y="34" width="16" height="74" rx="8" fill="#f2ece2"/>
      ${Array.from({ length: 6 }, (_, i) =>
        `<path d="M262 ${40 + i * 12} l16 -7 v7 l-16 7z" fill="${i % 2 ? "#4a6fb0" : "#c3474a"}"/>`).join("")}
      <rect x="258" y="28" width="24" height="8" rx="3" fill="#b9a68d"/>
      <rect x="258" y="106" width="24" height="8" rx="3" fill="#b9a68d"/>
    </g>
    <rect x="302" y="44" width="80" height="64" rx="3" fill="#b9a88e"/>
    <g fill="#7d684f">${Array.from({ length: 3 }, (_, i) =>
      `<rect x="${310 + i * 24}" y="${52 + (i % 2) * 18}" width="16" height="22" rx="2"/>`).join("")}</g>`,
};

const EVENT_SCENES: Record<string, string> = {
  /** ฉากจบรายคน — ห้องเรียนเย็นวันสุดท้าย เก้าอี้คว่ำบนโต๊ะแล้วทุกตัว
   *  ภาพนี้ต้องอ่านออกตั้งแต่ความกว้าง 390px ขาเก้าอี้ที่ชี้ขึ้นคือสิ่งที่บอกว่า "เลิกแล้ว" */
  epilogue: `
    <defs>${sky("g", "#f6cd93", "#7b5d80")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="0" width="400" height="104" fill="#6d4f56" opacity=".3"/>
    <g fill="#ffe3b4" opacity=".72">${[18, 118, 288].map((x) =>
      `<rect x="${x}" y="14" width="80" height="62" rx="3"/>`).join("")}</g>
    <g stroke="#59414f" stroke-width="2" opacity=".6" fill="none">${[18, 118, 288].map((x) =>
      `<path d="M${x + 40} 14v62M${x} 45h80"/>`).join("")}</g>
    <rect x="0" y="104" width="400" height="46" fill="#6b4f3c"/>
    <rect x="0" y="101" width="400" height="4" fill="#82624f"/>
    <g opacity=".22" fill="#2c2028">${[22, 98, 174, 250, 326].map((x) =>
      `<path d="M${x} 113h56l26 37h-56z"/>`).join("")}</g>
    ${[22, 98, 174, 250, 326].map((x) => `
      <g>
        <rect x="${x}" y="91" width="56" height="6" rx="2" fill="#8d6b4d"/>
        <rect x="${x + 4}" y="97" width="4" height="16" fill="#6b5240"/>
        <rect x="${x + 48}" y="97" width="4" height="16" fill="#6b5240"/>
        <rect x="${x + 12}" y="84" width="32" height="6" rx="2" fill="#7d6047"/>
        <g fill="#6b5240">
          <rect x="${x + 14}" y="66" width="4" height="18"/>
          <rect x="${x + 38}" y="66" width="4" height="18"/>
          <rect x="${x + 14}" y="66" width="28" height="4" rx="2"/>
        </g>
      </g>`).join("")}
    <radialGradient id="esun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff3d6" stop-opacity=".95"/>
      <stop offset="1" stop-color="#ffd79a" stop-opacity="0"/></radialGradient>
    <circle cx="237" cy="36" r="34" fill="url(#esun)"/>
    <circle cx="237" cy="36" r="13" fill="#fff4dc" opacity=".9"/>`,

  /** ฉากจบปีหนึ่ง — หน้าหอตอนหอปิดเที่ยง กล่องกองรอรถอยู่หน้าประตู */
  epilogue_uni: `
    <defs>${sky("g", "#eabd90", "#463754")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="18" y="20" width="168" height="94" fill="#4f4259"/>
    <rect x="18" y="20" width="168" height="5" fill="#5e5068"/>
    <g fill="#ffd89a" opacity=".8">${Array.from({ length: 8 }, (_, i) =>
      `<rect x="${30 + (i % 4) * 38}" y="${32 + Math.floor(i / 4) * 30}" width="24" height="18" rx="2"/>`).join("")}</g>
    <rect x="86" y="84" width="30" height="30" rx="2" fill="#2b2434"/>
    <rect x="100" y="96" width="3" height="8" rx="1.5" fill="#d8c48a"/>
    <rect x="0" y="112" width="400" height="38" fill="#3b3142"/>
    <rect x="0" y="110" width="400" height="3" fill="#4a3e52"/>
    <g fill="#b98f5f" stroke="#6d5238" stroke-width="1">
      <rect x="210" y="86" width="40" height="26" rx="2"/>
      <rect x="216" y="70" width="30" height="16" rx="2"/>
      <rect x="256" y="92" width="34" height="20" rx="2"/>
    </g>
    <g stroke="#7d5f42" stroke-width="1.5" opacity=".8" fill="none">
      <path d="M210 99h40M216 78h30M256 102h34"/></g>
    <g opacity=".2" fill="#221b2a">
      <path d="M210 112h40l22 26h-40zM256 112h34l20 20h-34z"/></g>
    <g fill="#2f2740" opacity=".55">
      <path d="M318 112c0-14 6-26 14-26s14 12 14 26z"/><rect x="330" y="104" width="4" height="10"/>
      <path d="M356 112c0-10 5-19 11-19s11 9 11 19z"/></g>
    <radialGradient id="usun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff0cf" stop-opacity=".9"/>
      <stop offset="1" stop-color="#ffcf90" stop-opacity="0"/></radialGradient>
    <circle cx="300" cy="44" r="36" fill="url(#usun)"/>
    <circle cx="300" cy="44" r="12" fill="#fff2d6" opacity=".85"/>`,

  ev_wai_kru: `
    <defs>${sky("g", "#3a2f48", "#221b2e")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="112" width="400" height="38" fill="#2a2234"/>
    <g fill="#c8a6e8" opacity=".25">${Array.from({ length: 6 }, (_, i) => `<circle cx="${40 + i * 66}" cy="34" r="14"/>`).join("")}</g>
    <g>
      <path d="M200 112l-34-18h68z" fill="#c8a978"/>
      <path d="M166 94q34-34 68 0z" fill="#e0d2a8"/>
      <g fill="#e8d0e0">${Array.from({ length: 7 }, (_, i) => `<circle cx="${172 + i * 9}" cy="${86 + (i % 2) * 5}" r="5"/>`).join("")}</g>
      <g fill="#f0e8b0">${Array.from({ length: 5 }, (_, i) => `<circle cx="${180 + i * 10}" cy="${76}" r="4"/>`).join("")}</g>
    </g>
    <g fill="#3c3450"><rect x="52" y="86" width="14" height="30" rx="6"/><rect x="88" y="90" width="14" height="26" rx="6"/>
      <rect x="300" y="88" width="14" height="28" rx="6"/><rect x="336" y="92" width="14" height="24" rx="6"/></g>`,
  ev_sports_day: `
    <defs>${sky("g", "#2f4a64", "#1d2a3c")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="96" width="400" height="54" fill="#3a5238"/>
    <g stroke="#e8e2d0" stroke-width="2" opacity=".5">
      <path d="M0 108h400M0 124h400M0 140h400"/></g>
    <g>${["#d05a5a", "#e8c96a", "#6ebe8c", "#7fb2e8"].map((c, i) =>
      `<path d="M${40 + i * 92} 96V34l34 10-34 10" fill="${c}" opacity=".9"/>
       <path d="M${40 + i * 92} 96V34" stroke="#cfc8b8" stroke-width="3"/>`).join("")}</g>
    <g fill="#2a2234">${Array.from({ length: 5 }, (_, i) => `<rect x="${60 + i * 68}" y="${74 + (i % 2) * 6}" width="12" height="24" rx="5"/>`).join("")}</g>`,
  ev_mothers_day: `
    <defs>${sky("g", "#2c2740", "#1a1626")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="110" width="400" height="40" fill="#272034"/>
    <g fill="#4a3f5e">${Array.from({ length: 8 }, (_, i) => `<rect x="${24 + i * 46}" y="84" width="32" height="26" rx="4"/>`).join("")}</g>
    <g>
      <ellipse cx="200" cy="52" rx="30" ry="26" fill="#eef0f6" opacity=".9"/>
      <g fill="#7fb2e8">${Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return `<ellipse cx="${200 + Math.cos(a) * 22}" cy="${52 + Math.sin(a) * 19}" rx="9" ry="7"/>`;
      }).join("")}</g>
      <circle cx="200" cy="52" r="9" fill="#e8c96a"/>
    </g>`,
  ev_field_trip: `
    <defs>${sky("g", "#2a3f5c", "#1a2434")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="104" width="400" height="46" fill="#2c3a2c"/>
    <g fill="#33502f">${Array.from({ length: 7 }, (_, i) => `<path d="M${18 + i * 58} 104l-16-30h32z"/>`).join("")}</g>
    <g>
      <rect x="110" y="52" width="180" height="52" rx="10" fill="#c8a45e"/>
      <g fill="#8fc4e0">${Array.from({ length: 5 }, (_, i) => `<rect x="${122 + i * 32}" y="62" width="24" height="20" rx="3"/>`).join("")}</g>
      <circle cx="146" cy="106" r="11" fill="#2a2234"/><circle cx="254" cy="106" r="11" fill="#2a2234"/>
    </g>`,
  ev_scout_camp: `
    <defs>${sky("g", "#1e2438", "#12151f")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <g fill="#e8e2f0" opacity=".65">${Array.from({ length: 22 }, (_, i) =>
      `<circle cx="${(i * 71) % 390 + 6}" cy="${(i * 37) % 60 + 8}" r="${i % 3 === 0 ? 1.8 : 1.1}"/>`).join("")}</g>
    <rect x="0" y="108" width="400" height="42" fill="#232a22"/>
    <g fill="#3f4a56"><path d="M60 108l34-44 34 44z"/><path d="M262 108l30-38 30 38z"/></g>
    <path d="M94 108V72M292 108V78" stroke="#2a2f38" stroke-width="2"/>
    <g><ellipse cx="200" cy="112" rx="26" ry="8" fill="#3a2f22"/>
      <path d="M186 110q8-26 14-30 6 10 14 30z" fill="#e8913a"/>
      <path d="M192 110q6-16 8-20 4 8 8 20z" fill="#f4d06a"/></g>`,
  ev_farewell: `
    <defs>${sky("g", "#33294a", "#1c1628")}</defs>
    <rect width="400" height="150" fill="url(#g)"/>
    <rect x="0" y="112" width="400" height="38" fill="#282034"/>
    <g fill="#3e3452">${Array.from({ length: 9 }, (_, i) => `<rect x="${16 + i * 42}" y="88" width="28" height="24" rx="4"/>`).join("")}</g>
    <g fill="#c8a6e8" opacity=".8">${Array.from({ length: 9 }, (_, i) =>
      `<circle cx="${30 + i * 42}" cy="${80}" r="7"/>`).join("")}</g>
    <g stroke="#e8c96a" stroke-width="2" opacity=".55" fill="none">
      ${Array.from({ length: 12 }, (_, i) => `<path d="M${20 + i * 34} 20v10"/>`).join("")}</g>`,
};

const PLAIN = new Set(scenes.plain as string[]);
const TIMED = scenes.timed as Record<string, string>;

/** สถานที่ไหนมีภาพวาดจริงแล้วบ้าง — ที่เหลือยังเป็น SVG ที่วาดจากโค้ด */
export const hasPhoto = (id: string) => id in TIMED || PLAIN.has(id);

/** ภาพฉาก — ถ้าสถานที่นั้นมีภาพวาดจริงจะได้ภาพ ถ้าไม่มีก็ได้ SVG เหมือนเดิม
 *
 *  ภาพมาจากสองชุดที่ให้ของมาไม่เหมือนกัน จึงต้องจัดการคนละแบบ
 *  - ชุดที่ให้มาสี่ช่วงเวลาต่อหนึ่งที่ (ห้องเรียน โรงอาหาร) ใช้ภาพคนละใบไปเลย แสงถูกวาดมาจริง
 *  - ชุดที่ให้ภาพเดียวต่อหนึ่งที่ ไล่สีทับตอนรันตามช่วงเวลา
 *  ผลที่ได้คือทุกที่ในเกมรู้สึกถึงเวลาของวัน ไม่ใช่แค่สองที่
 */
export function backdrop(id: string, period?: string): string {
  const t = (scenes.periods as Record<string, string>)[period ?? "noon"] ?? "day";
  const timed = TIMED[id];
  if (timed) return `<img class="bd" src="${asset(`assets/scenes/${timed}-${t}.jpg`)}" alt="" loading="eager">`;
  if (PLAIN.has(id))
    return `<span class="bdt tod-${t}"><img src="${asset(`assets/scenes/${id}.jpg`)}" alt="" loading="eager"></span>`;
  return svgBackdrop(id);
}

function svgBackdrop(id: string): string {
  const body = SCENES[id] ?? EVENT_SCENES[id] ?? SCENES.home;
  // ทุกฉากประกาศ gradient ชื่อ "g" เหมือนกันหมด พอมีหลายการ์ดในหน้าเดียว
  // `url(#g)` จะไปหยิบของการ์ดใบแรกในเอกสารเสมอ ทุกใบเลยได้สีฟ้าเดียวกันหมดโดยไม่มี error
  // ต้องเปลี่ยนชื่อให้ไม่ซ้ำตอนคืนค่าออกไป (บั๊กเดียวกับ gradient ของภาพตัวละคร)
  // เปลี่ยน "ทุก" id ไม่ใช่แค่ "g" เพราะฉากใหม่ที่มี gradient ตัวที่สองจะโดนกับดักเดิมซ้ำ
  const salt = Math.random().toString(36).slice(2, 9);
  const unique = body
    .replace(/id="([a-zA-Z][\w-]*)"/g, (_, n) => `id="${n}-${salt}"`)
    .replace(/url\(#([a-zA-Z][\w-]*)\)/g, (_, n) => `url(#${n}-${salt})`);
  return `<svg class="bd" viewBox="${VB}" preserveAspectRatio="xMaxYMid slice"
    xmlns="http://www.w3.org/2000/svg">${unique}</svg>`;
}

export const hasEventArt = (ink: string) => ink in EVENT_SCENES;

/** เหตุการณ์ไหนเกิดขึ้นที่ไหน — สำหรับเหตุการณ์ที่ยังไม่มีภาพเป็นของตัวเอง
 *
 *  ของเดิม `playInk()` ใส่ฉากหลังให้เฉพาะ ink ที่บังเอิญมีชื่อตรงกับชื่อฉากเท่านั้น
 *  ผลคือ **เหตุการณ์สิบจากสิบแปดอันเล่นบนจอดำเปล่า** รวมถึงฉากแรกสุดที่ผู้เล่นเห็นตอนเปิดเกม
 *  และเหตุการณ์หลักทั้งสี่ของภาคมหาลัย · ไม่มี error ไม่มีอะไรฟ้อง มีแค่พื้นที่ว่างครึ่งจอ
 *  ตราบใดที่ยังไม่มีภาพของตัวเอง ให้ยืมภาพของ *ที่ที่มันเกิดขึ้น* ไปก่อน
 *
 *  บางเหตุการณ์ใช้บทเดียวกันทั้งสองภาค (`ev_club` `ev_group`) ที่เกิดจึงคนละที่กัน
 *  `src/ui/backdrop.test.ts` คุมว่าทุกเหตุการณ์ใน `data/events.json` มีภาพจริงครบทุกภาค */
const EVENT_PLACE: Record<string, string | { school: string; uni: string }> = {
  ev_opening: "classroom",                              // วันเปิดเทอม ห้อง 5/1
  ev_club: { school: "hallway", uni: "clubroom" },      // ลานหน้าห้องกิจการนักเรียน
  ev_group: { school: "classroom", uni: "lecture" },    // ครูอ่านรายชื่อจับคู่หน้าห้อง
  ev_holiday: "home",                                   // โรงเรียนปิด ทั้งซอยเงียบ
  ev_home_ask: "home",                                  // แม่โทรมาตอนสามทุ่ม
  u_open: "lecture",                                    // หอประชุมใหญ่
  u_hazing: "clubroom",                                 // ห้องเชียร์ปิดไฟ
  u_fest: "faccant",                                    // ลานหน้าคณะ
  u_close: "dorm",                                      // กระเป๋าวางอยู่ตรงประตูหอ
  assembly: "assembly",                                 // เข้าแถวหน้าเสาธง
  // เรื่องหลักของเทอม — สมุดปกแดง (ดู src/sim/plot.ts)
  mp_book: "assembly",                                  // ประกาศหน้าเสาธงวันจันทร์
  mp_gone: "hallway",                                   // แถวรอหน้าห้องพักครูตอนเจ็ดโมงครึ่ง
  mp_squeeze: "hallway",                                // ห้องพักครูอีกรอบ คราวนี้ไม่มีคนต่อแถว
  mp_hearing: "classroom",                              // ห้องประชุมชั้นสอง โต๊ะยาวตัวเดียว
  mp_archive: "library",                                // แฟ้มเก่าชั้นล่างสุดของห้องสมุด
};

/** ฉากหลังของบทเหตุการณ์หนึ่งบท — ภาพของตัวเองมาก่อน แล้วค่อยยืมภาพของสถานที่ */
export function eventBackdrop(ink: string, chapter: "school" | "uni"): string | undefined {
  if (ink in EVENT_SCENES) return ink;
  const p = EVENT_PLACE[ink];
  if (!p) return undefined;
  return typeof p === "string" ? p : p[chapter];
}

/** ฉากนี้มีภาพให้วาดจริงไหม (ภาพถ่ายหรือ SVG ก็ได้) — เทสต์ใช้ตรวจว่าไม่มีใครตกหล่น */
export const hasBackdrop = (id: string) =>
  id in SCENES || id in EVENT_SCENES || hasPhoto(id);

/** ชื่อฉากทั้งหมดที่มีอยู่ — ใช้โดยเทสต์ภาพเพื่อวาดทุกฉากลงแผ่นเดียวแล้วเทียบ
 *  ถ้าเพิ่มฉากใหม่แล้วลืมอะไรไป จะเห็นบนแผ่นนั้นทันทีโดยไม่ต้องไล่เปิดทีละที่ */
export const allBackdropIds = (): string[] =>
  [...Object.keys(SCENES), ...Object.keys(EVENT_SCENES)];
