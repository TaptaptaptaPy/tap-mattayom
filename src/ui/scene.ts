import type { Story } from "inkjs/types";

const $ = (id: string) => document.getElementById(id)!;

/** กล่องบทสนทนา: เดินข้อความทีละย่อหน้า แล้วค่อยแสดงตัวเลือก */
export function playScene(story: Story, speaker: string, color: string, onEnd: () => void) {
  const box = $("scene"), lineEl = $("line"), choiceEl = $("choices"), spEl = $("speaker");
  box.classList.remove("hidden");
  spEl.textContent = speaker;
  (spEl as HTMLElement).style.color = color;

  const step = () => {
    choiceEl.innerHTML = "";
    if (story.canContinue) {
      const text = story.Continue()?.trim() ?? "";
      lineEl.textContent = text;
      if (!story.canContinue && story.currentChoices.length === 0) {
        addButton(choiceEl, "จบบทสนทนา", () => { box.classList.add("hidden"); onEnd(); });
        return;
      }
      if (story.currentChoices.length === 0) { addButton(choiceEl, "…", step); return; }
    }
    if (story.currentChoices.length > 0) {
      story.currentChoices.forEach((c, i) =>
        addButton(choiceEl, c.text, () => { story.ChooseChoiceIndex(i); step(); }, true));
    } else {
      addButton(choiceEl, "จบบทสนทนา", () => { box.classList.add("hidden"); onEnd(); });
    }
  };
  step();
}

function addButton(parent: HTMLElement, label: string, fn: () => void, isChoice = false) {
  const b = document.createElement("button");
  b.className = isChoice ? "choice" : "next";
  b.textContent = label;
  b.onclick = fn;
  parent.appendChild(b);
}
