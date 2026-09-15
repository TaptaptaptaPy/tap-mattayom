INCLUDE _shared.ink

// ไลน์ของปาล์ม — พิมพ์สุภาพเกินไป ลงท้ายครับทุกประโยค และมักลบข้อความก่อนส่ง

{
    - rank < 3:  -> rank_0
    - else:      -> rank_1
}

=== rank_0 ===
สวัสดีครับพี่
(พิมพ์อยู่...)
เปล่าครับ ไม่มีอะไร

+ ["มีอะไรก็บอกได้นะ"]
    ~ gainAffinity("palm", 3)
    ~ gainStat("kind", 1)
    ครับ
    ...
    พรุ่งนี้พี่ไปโรงอาหารกี่โมงครับ
    -> DONE

+ {tomorrowSchool} ["พรุ่งนี้เที่ยงเจอกันที่โรงอาหารนะ"]
    ~ gainAffinity("palm", 4)
    ~ inviteTomorrow("palm")
    ครับ!
    ผมจะไปนั่งรอที่โต๊ะเดิมนะครับ
    -> DONE

+ ["โอเค"]
    ~ gainAffinity("palm", -1)
    ครับ
    (อ่านแล้ว 21:03)
    -> DONE

=== rank_1 ===
พี่ครับ
ถ้าคนเราย้ายโรงเรียนสองรอบ มันแปลว่าเป็นที่เราใช่ไหมครับ

+ ["ไม่ใช่"]
    ~ gainAffinity("palm", 5)
    ~ gainStat("kind", 2)
    ~ setFlag("palm_asked")
    ครับ
    แม่ก็พูดแบบนี้
    แต่แม่ต้องพูดแบบนี้อยู่แล้วนี่ครับ
    -> DONE

+ {kind >= 16} ["ที่โรงเรียนเก่าน้องเคยถามคำนี้กับใครไหม"]
    ~ gainAffinity("palm", 6)
    ~ gainStat("mind", 2)
    ~ setFlag("palm_asked")
    ...
    ไม่เคยครับ
    ไม่มีใครให้ถาม
    -> DONE

+ {tomorrowSchool} ["พรุ่งนี้คุยกันดีกว่า ไม่ใช่เรื่องที่ควรพิมพ์"]
    ~ gainAffinity("palm", 4)
    ~ inviteTomorrow("palm")
    ครับ
    ขอบคุณครับพี่
    -> DONE
