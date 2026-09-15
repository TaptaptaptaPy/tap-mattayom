// ประกาศร่วมของทุกบท
// กฎเหล็ก: ไฟล์นี้ห้ามมี knot (===) หรือ function เด็ดขาด
// เพราะเนื้อหาถูกแทรกไว้ "ด้านบน" ของไฟล์บท ถ้ามี knot ทุกอย่างที่ตามมาจะตกเข้าไปอยู่ในนั้น
// อีกข้อ: ชื่อ knot และชื่อตัวแปรต้องเป็นอังกฤษ ภาษาไทยคอมไพล์ไม่ผ่าน (ตัวข้อความไทยได้ปกติ)

VAR heart = 0
VAR mind = 0
VAR charm = 0
VAR kind = 0
VAR nerve = 0
VAR affinity = 0
VAR rank = 0
// ความเชื่อใจของคนที่อยู่ตรงหน้า 0-5 — คนละเรื่องกับความสนิท
// ชอบเราได้โดยไม่กล้าฝากเรื่องสำคัญไว้กับเรา ใช้เปิดทางที่คนไม่ไว้ใจไม่มีวันได้เห็น
VAR trust = 0
VAR day = 1
VAR money = 0
VAR behaviour = 100
VAR caught = 0
VAR club = ""
VAR mindRank = 0
// พรุ่งนี้โรงเรียนเปิดไหม (1/0) — ใช้กั้นทางเลือกที่ชวนเจอกันที่โรงเรียน
VAR tomorrowSchool = 1
// ทั้งโรงเรียนมองเรายังไง 0=เสียหาย 4=ทั้งโรงเรียนรู้จัก
VAR standingRank = 2
// ไม่ได้ส่งการบ้านไปกี่ชิ้นแล้วทั้งเทอม
VAR homeworkMissed = 0
// ช่วงของเทอม 1=ต้นเทอม 2=หลังสอบกลางภาค 3=ปลายเทอม
VAR term = 1

// สะพานไปฝั่ง TypeScript — ดู src/story/bridge.ts
EXTERNAL gainStat(id, amount)
EXTERNAL gainAffinity(charId, amount)
EXTERNAL setFlag(name)
EXTERNAL setHint(text)
EXTERNAL spend(amount)
EXTERNAL hasFlag(name)
// ชวนเจอกันพรุ่งนี้หลังเลิกเรียน — จองช่วงเวลาของวันพรุ่งนี้ไว้จริง ดู src/sim/chat.ts
EXTERNAL inviteTomorrow(charId)
// ชื่อเสียงขยับ พร้อมเหตุผลสั้นๆ ที่จะถูกจดลงสมุดบันทึกของเทอม
EXTERNAL standing(amount, why)
// เลือกยืนข้างใคร — เลือกแล้วอีกฝั่งปิดถาวร ใช้ได้ครั้งเดียวทั้งเทอม
EXTERNAL takeSide(charId)
EXTERNAL sideTaken()
EXTERNAL sidedWith(charId)
// ความเชื่อใจ — ถามระดับของใครก็ได้ ไม่ใช่แค่คนที่อยู่ตรงหน้า
EXTERNAL trustOf(charId)
EXTERNAL gainTrust(charId, amount)
// พรุ่งนี้รับนัดใครไว้แล้วกี่คน — รับซ้อนได้ แต่ไปได้คนเดียว
EXTERNAL plansBooked()
// เขาจำเรื่องที่เราทำกับเขาได้กี่เรื่อง และเรื่องล่าสุดคืออะไร
EXTERNAL recalls(charId)
EXTERNAL memoryOf(charId)
