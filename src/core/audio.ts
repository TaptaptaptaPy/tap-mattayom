/** เสียงทั้งเกม สังเคราะห์สดด้วย Web Audio ไม่มีไฟล์เสียงสักไฟล์
 *
 *  เหตุผลที่ไม่ใช้ไฟล์: เกมนี้เปิดจาก dev server บน Wi-Fi บ้านแล้วเล่นบน iPad
 *  ไฟล์เสียงหมายถึง bundle ใหญ่ขึ้นและต้องโหลดก่อนเล่น ส่วนการสังเคราะห์เองใช้โค้ดไม่กี่สิบบรรทัด
 *
 *  กติกา: เบราว์เซอร์ไม่ยอมให้เล่นเสียงจนกว่าผู้ใช้จะแตะจอครั้งแรก
 *  `unlock()` จึงต้องถูกเรียกจาก event ของผู้ใช้จริงเท่านั้น
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function unlock() {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 0.5, ctx.currentTime, 0.05);
}
export const isMuted = () => muted;

/** โทนเดียว รูปคลื่นเลือกได้ พร้อมซองเสียงแบบ attack/decay ง่ายๆ */
function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

/** เสียงซ่า ใช้ทำฝน ไฟ และแผ่นดินไหว */
function noise(dur: number, vol: number, hz: number, q = 1) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = hz; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

/** เสียงของเกมนี้ — ไม่ใช่เสียงจริงของโรงเรียน แต่เป็นสัญญาณว่าเกิดอะไรขึ้น
 *  สังเคราะห์ทั้งหมดเพื่อให้ bundle ไม่โต และแก้เสียงได้โดยไม่ต้องหาไฟล์ใหม่ */
export const sfx = {
  /** ทำกิจกรรมสำเร็จ ค่าสถานะขึ้น */
  gain:   () => { tone(660, 0.14, "sine", 0.08); setTimeout(() => tone(880, 0.18, "sine", 0.07), 60); },
  /** ทำซ้ำในวันเดียวกัน ได้น้อยลง */
  dull:   () => { tone(440, 0.16, "triangle", 0.05, 380); },
  /** แรงหมด เงินไม่พอ หรือเข้าที่นั้นไม่ได้ */
  deny:   () => { tone(220, 0.16, "square", 0.05, 170); },
  /** ขึ้นวันใหม่ */
  day:    () => { [392, 523].forEach((f, i) => setTimeout(() => tone(f, 0.5, "sine", 0.06), i * 120)); },
  /** ครูปกครองจับได้ */
  caught: () => { noise(0.45, 0.2, 900, 0.7); tone(150, 0.4, "sawtooth", 0.1, 90); },
  /** หลบรอด */
  escape: () => { tone(523, 0.14, "sine", 0.08, 784); },
  /** ไลน์เข้า */
  chat:   () => { tone(880, 0.1, "sine", 0.07); setTimeout(() => tone(1175, 0.14, "sine", 0.06), 80); },
  /** รับนัด */
  plan:   () => { [659, 784, 988].forEach((f, i) => setTimeout(() => tone(f, 0.4, "sine", 0.08), i * 90)); },
  /** ผลสอบออก */
  exam:   () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.7, "triangle", 0.09), i * 140)); },
  /** ฉากจบของเทอม */
  ending: () => { [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 1.2, "sine", 0.1), i * 170)); },
  /** ส่งการบ้าน */
  homework: () => { tone(494, 0.16, "triangle", 0.07); setTimeout(() => tone(587, 0.2, "sine", 0.06), 70); },
};
