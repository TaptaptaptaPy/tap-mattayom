import "./style.css";
import game from "../data/game.json";
import chars from "../data/characters.json";
import { newState, statRank, affinityRank, type GameState, type StatId } from "./sim/state";
import { dateLabel, advance, isLocked, isTermOver } from "./sim/calendar";
import { availableLocations, doAction } from "./sim/actions";
import { openScene } from "./story/bridge";
import { playScene } from "./ui/scene";
import { save, load } from "./core/save";

let s: GameState = load<GameState>() ?? newState();
const $ = (id: string) => document.getElementById(id)!;

function renderTop() {
  $("date").textContent = dateLabel(s) + (isLocked(s) ? " · คาบเรียน" : "");
  $("stats").innerHTML = game.stats.map((st) => {
    const v = s.stats[st.id as StatId];
    return `<span class="chip" title="${st.desc}">${st.name}
      <b>${game.statRankNames[statRank(v)]}</b></span>`;
  }).join("") + `<span class="chip energy">แรง <b>${s.energy}</b></span>`;
}

function renderBoard() {
  const board = $("board");
  board.innerHTML = "";
  if (isTermOver(s)) {
    board.innerHTML = '<div class="end">จบเทอมแล้ว — TODO: เขียนฉากปิดเทอม</div>';
    return;
  }
  for (const loc of availableLocations(s)) {
    const card = document.createElement("div");
    card.className = "loc";
    card.innerHTML = `<div class="ico">${loc.icon}</div><div class="nm">${loc.name}</div>`;

    const acts = document.createElement("div");
    acts.className = "acts";
    for (const p of loc.present) {
      const b = document.createElement("button");
      b.className = "who";
      b.style.borderColor = p.color;
      const rank = affinityRank(s.affinity[p.id] ?? 0);
      b.innerHTML = `<span style="color:${p.color}">${p.name}</span><em>ระดับ ${rank}</em>`;
      b.onclick = () => talkTo(p.id);
      acts.appendChild(b);
    }
    if (loc.action) {
      const b = document.createElement("button");
      b.className = "act";
      b.textContent = loc.action.label;
      b.onclick = () => { flash(doAction(s, loc) ?? ""); next(); };
      acts.appendChild(b);
    }
    card.appendChild(acts);
    board.appendChild(card);
  }
}

function talkTo(charId: string) {
  const c = chars.find((x) => x.id === charId)!;
  const story = openScene(c.story, s, charId, {
    onStat: (id, n) => { s.stats[id] += n; },
    onAffinity: (cid, n) => { s.affinity[cid] = (s.affinity[cid] ?? 0) + n; },
    onFlag: (name) => { s.flags[name] = true; },
  });
  s.metToday[charId] = true;
  playScene(story, c.name, c.color, () => { next(); });
}

function next() {
  advance(s);
  save(s);
  renderTop(); renderBoard(); renderBottom();
}

function renderBottom() {
  $("bottom").innerHTML = "";
  const skip = document.createElement("button");
  skip.className = "wide";
  skip.textContent = isLocked(s) ? "ตั้งใจเรียน (ผ่านคาบไป)" : "ไม่ทำอะไร";
  skip.onclick = () => { if (isLocked(s)) s.stats.mind += 1; next(); };
  $("bottom").appendChild(skip);
}

function flash(msg: string) {
  if (!msg) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

renderTop(); renderBoard(); renderBottom();
