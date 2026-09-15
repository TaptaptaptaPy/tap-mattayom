import game from "../../data/game.json";
import chars from "../../data/characters.json";
import { remember, type GameState } from "./state";
import { changeTrust, recall } from "./bonds";
import type { Rnd } from "../core/rng";

/** คำพูดที่ไม่ตรงกัน
 *
 *  กราฟ `bonds` ใน characters.json มีอยู่แล้ว แต่เดิมใช้แค่กระเพื่อมตัวเลขความสัมพันธ์
 *  ทั้งที่มันคือแผนที่ว่า *ใครคุยกับใคร* ซึ่งเป็นสิ่งเดียวที่ทำให้การโกหกมีราคา
 *
 *  บอกพลอยว่าติดอ่านหนังสือ บอกกนินว่าไปกับอีกคน — สองคนนั้นอยู่ห้องเดียวกัน
 *  วันหนึ่งเรื่องมันจะไปเจอกัน และเราจะไม่ได้เป็นคนเลือกว่าวันไหน
 *
 *  กติกา: ต้องมีทางให้ผู้เล่นรู้ว่าโป๊ะแล้ว ไม่งั้นมันเป็นแค่ตัวเลขที่หายไปเฉยๆ
 */

const C = game.claims;
const VERSIONS = C.versions as Record<string, string>;

type BondMap = Record<string, number>;
const bondsOf = (id: string): BondMap =>
  ((chars.find((c) => c.id === id) as { bonds?: BondMap } | undefined)?.bonds) ?? {};
const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id;

/** คำพูดถูกผูกกับ *วัน* ที่พูด ไม่ใช่แค่หัวข้อ
 *  "เมื่อวานหายไปไหน" ที่ถามคืนนี้ กับที่ถามอีกสองสัปดาห์ถัดไป คนละเมื่อวานกัน
 *  ถ้าเก็บรวมกันใต้หัวข้อเดียว การตอบคนละอย่างคนละเดือนจะถูกนับเป็นโกหก ซึ่งไม่จริง
 *  โป๊ะได้ก็ต่อเมื่อบอกสองคนไม่ตรงกัน *ในคืนเดียวกัน* แล้วเขาสองคนคุยกันวันรุ่งขึ้น */
const key = (s: GameState, topic: string) => `${topic}@${s.dayIndex}`;

/** บอกใครไปว่าอะไร — เรียกจากบทผ่าน `tellThem()` */
export function claim(s: GameState, topic: string, version: string, charId: string): void {
  const t = (s.claims[key(s, topic)] ??= {});
  t[charId] = version;
}

/** วันใหม่: คนที่สนิทกันเอาเรื่องมาเทียบกันบ้าง
 *  อยู่ในทางเดินของ `advance()` เพื่อให้เทสต์สมดุลเดินผ่านเองโดยไม่ต้องจำไปเรียก */
export function checkClaims(s: GameState, rnd: Rnd = Math.random): void {
  for (const [topic, told] of Object.entries(s.claims)) {
    // เรื่องเก่าเกินไม่มีใครเอามาคุยกันแล้ว และปล่อยไว้ state จะบวมขึ้นทุกวัน
    const day = Number(topic.split("@")[1]);
    if (Number.isFinite(day) && s.dayIndex - day > C.keepDays) { delete s.claims[topic]; continue; }
    const ids = Object.keys(told);
    if (ids.length < 2) continue;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        if (told[a] === told[b]) continue;                 // พูดตรงกัน ไม่มีอะไรให้จับ
        if ((bondsOf(a)[b] ?? 0) < C.minBond) continue;    // ไม่สนิทกันพอจะคุยเรื่องนี้
        if (rnd() > C.checkChance) continue;

        for (const who of [a, b]) {
          changeTrust(s, who, C.trustHit);
          recall(s, who, `วันที่รู้ว่านายพูดกับฉันไม่ตรงกับที่พูดกับคนอื่น`);
        }
        s.standing = Math.max(0, s.standing + C.standingHit);
        s.flags["caught_lying"] = true;
        const line = `${nameOf(a)}กับ${nameOf(b)}คุยกันแล้วรู้ว่าเราพูดไม่ตรงกัน` +
                     ` (${VERSIONS[told[a]] ?? told[a]} กับ ${VERSIONS[told[b]] ?? told[b]})`;
        remember(s, line);
        s.offscreenNews.push(line);
        delete s.claims[topic];                            // โป๊ะแล้วจบเรื่องนั้นไป
        return;                                            // วันละเรื่องพอ
      }
    }
  }
}

/** เคยพูดเรื่องนี้กับคนนี้ไว้ว่ายังไง — บทใช้เช็กก่อนจะให้พูดซ้ำ */
export const toldThem = (s: GameState, topic: string, charId: string): string =>
  s.claims[key(s, topic)]?.[charId] ?? "";

/** พูดเรื่องนี้ไปแล้วกี่คน */
export const toldCount = (s: GameState, topic: string): number =>
  Object.keys(s.claims[key(s, topic)] ?? {}).length;
