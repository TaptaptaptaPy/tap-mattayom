// ประกาศร่วมของทุกบท
// กฎเหล็ก: ไฟล์นี้ห้ามมี knot (===) หรือ function เด็ดขาด
// เพราะเนื้อหาถูกแทรกไว้ "ด้านบน" ของไฟล์บท ถ้ามี knot ทุกอย่างที่ตามมาจะตกเข้าไปอยู่ในนั้น

VAR heart = 0
VAR mind = 0
VAR charm = 0
VAR nerve = 0
VAR kind = 0
VAR affinity = 0
VAR day = 1

// สะพานไปฝั่ง TypeScript — ดู src/story/bridge.ts
EXTERNAL gainStat(id, amount)
EXTERNAL gainAffinity(charId, amount)
EXTERNAL setFlag(name)
