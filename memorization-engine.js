// =====================================================================
// BoRooJ Way — مسار الحفظ
// ---------------------------------------------------------------------
// سجل تراكمي لما حفظه الطالب من القرآن الكريم.
// يختلف عن ركن التسميع: التسميع تسجيل لحظي يُصحَّح مرة، أما هذا فسجل
// دائم يكبر مع الطالب طوال العام.
//
// نموذج البيانات: مستند واحد لكل طالب (أرخص وأسرع من مستند لكل سورة)
//   memorization/{studentUid} = {
//     studentUid, studentName, teacherCode, grade,
//     surahs: { "78": { status, confirmed, confirmedBy, updatedAt, note } },
//     updatedAt
//   }
// =====================================================================

import { doc, getDoc, setDoc, collection, query, where, getDocs }
    from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-shared.js";
import { SURAH_LIST, trackSurahs, TRACKS } from "./quran-data.js";

export const MEMORIZATION_COLLECTION = 'memorization';

// ---------------------------------------------------------------------
// حالات الحفظ
// ---------------------------------------------------------------------
export const STATUS = {
    none:       { key:'none',       label:'لم يبدأ',        icon:'○',  color:'#bdc3c7', weight:0 },
    in_progress:{ key:'in_progress',label:'قيد الحفظ',      icon:'◐',  color:'#f39c12', weight:0.5 },
    memorized:  { key:'memorized',  label:'حفظها',          icon:'●',  color:'#3498db', weight:1 },
    confirmed:  { key:'confirmed',  label:'معتمدة من المعلم',icon:'✓', color:'#27ae60', weight:1 }
};

// الحالة المعروضة = معتمدة إن أقرّها المعلم، وإلا الحالة التي سجّلها الطالب
export function effectiveStatus(entry) {
    if (!entry) return STATUS.none;
    if (entry.confirmed === true) return STATUS.confirmed;
    return STATUS[entry.status] || STATUS.none;
}

function toDate(v) {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch (e) { return null; }
}

// ---------------------------------------------------------------------
// جلب سجل حفظ طالب واحد
// ---------------------------------------------------------------------
export async function loadMemorization(uid) {
    try {
        const snap = await getDoc(doc(db, MEMORIZATION_COLLECTION, uid));
        if (!snap.exists()) return { studentUid: uid, surahs: {}, exists: false };
        const d = snap.data();
        return {
            studentUid: uid,
            studentName: d.studentName || '',
            teacherCode: d.teacherCode || null,
            grade: d.grade || null,
            surahs: d.surahs || {},
            updatedAt: toDate(d.updatedAt),
            exists: true
        };
    } catch (e) {
        console.warn('[memorization] تعذّر الجلب:', e.message);
        throw e;
    }
}

// ---------------------------------------------------------------------
// تحديث حالة سورة واحدة
// ---------------------------------------------------------------------
// الطالب يسجّل تقدّمه بنفسه، والمعلم هو من يعتمده.
// ⚠️ عند تغيير الطالب لحالة سورة يسقط اعتماد المعلم السابق تلقائياً،
// حتى لا يبقى اعتماد قديم على حالة تغيّرت.
// ---------------------------------------------------------------------
export async function setSurahStatus({ uid, profile, surahNum, status, byTeacher = false, teacherUid = null, note = null }) {
    const key = String(surahNum);
    const now = new Date();

    const entry = {
        status: status,
        updatedAt: now
    };

    if (byTeacher) {
        entry.confirmed  = (status === 'memorized' || status === 'confirmed');
        entry.confirmedBy = teacherUid;
        entry.confirmedAt = now;
        if (entry.confirmed) entry.status = 'memorized';
    } else {
        entry.confirmed = false;   // تعديل الطالب يُسقط الاعتماد
    }

    if (note !== null) entry.note = note;

    // ⚠️ خطأ سابق مهم: كان المفتاح مكتوباً بصيغة النقطة `surahs.${key}`.
    // صيغة النقطة لا تعمل إلا مع updateDoc — أما setDoc فيعتبرها اسم حقل
    // حرفياً فيه نقطة، فيُنشئ حقلاً باسم "surahs.78" في جذر المستند بدل
    // أن يضع السورة داخل خريطة surahs. النتيجة أن القراءة كانت تجد
    // surahs فارغة دائماً، فيضيع تقدّم الطالب ولا يصل لمعلمه شيء.
    // الحل: خريطة متداخلة حقيقية — و merge يدمجها دون مسح بقية السور.
    const payload = {
        studentUid: uid,
        surahs: { [key]: entry },
        updatedAt: now
    };

    // بيانات تعريفية تساعد المعلم على تصفية طلابه
    if (profile) {
        payload.studentName = profile.name || '';
        payload.teacherCode = (profile.raw && profile.raw.teacherCode) || null;
        payload.grade       = (profile.raw && profile.raw.grade) || null;
    }

    // setDoc مع merge ينشئ المستند إن لم يوجد، ويحدّث السورة وحدها إن وُجد
    await setDoc(doc(db, MEMORIZATION_COLLECTION, uid), payload, { merge: true });
    return entry;
}

// ---------------------------------------------------------------------
// إحصاءات مسار معيّن
// ---------------------------------------------------------------------
export function trackStats(surahsMap, trackKey) {
    const list = trackSurahs(trackKey);
    let memorized = 0, confirmed = 0, inProgress = 0;
    let ayahsDone = 0, ayahsTotal = 0;

    list.forEach(s => {
        ayahsTotal += s.ayahs;
        const st = effectiveStatus(surahsMap[String(s.num)]);
        if (st.key === 'confirmed')        { confirmed++; memorized++; ayahsDone += s.ayahs; }
        else if (st.key === 'memorized')   { memorized++;              ayahsDone += s.ayahs; }
        else if (st.key === 'in_progress') { inProgress++;             ayahsDone += Math.round(s.ayahs / 2); }
    });

    return {
        total: list.length,
        memorized, confirmed, inProgress,
        remaining: list.length - memorized - inProgress,
        percent: list.length ? Math.round((memorized / list.length) * 100) : 0,
        ayahsDone, ayahsTotal,
        ayahPercent: ayahsTotal ? Math.round((ayahsDone / ayahsTotal) * 100) : 0
    };
}

// ---------------------------------------------------------------------
// ملخّص عام عبر كل المسارات
// ---------------------------------------------------------------------
export function overallStats(surahsMap) {
    let memorized = 0, confirmed = 0, inProgress = 0, ayahsDone = 0;
    const totalAyahs = SURAH_LIST.reduce((a, s) => a + s.ayahs, 0);

    SURAH_LIST.forEach(s => {
        const st = effectiveStatus(surahsMap[String(s.num)]);
        if (st.key === 'confirmed')        { confirmed++; memorized++; ayahsDone += s.ayahs; }
        else if (st.key === 'memorized')   { memorized++;              ayahsDone += s.ayahs; }
        else if (st.key === 'in_progress') { inProgress++;             ayahsDone += Math.round(s.ayahs / 2); }
    });

    return {
        memorized, confirmed, inProgress,
        totalSurahs: SURAH_LIST.length,
        ayahsDone, totalAyahs,
        percent: Math.round((memorized / SURAH_LIST.length) * 100),
        // المسار الأنسب للعرض: أول مسار لم يكتمل بعد
        suggestedTrack: (TRACKS.find(t => trackStats(surahsMap, t.key).percent < 100) || TRACKS[0]).key
    };
}

// ---------------------------------------------------------------------
// سجلات حفظ طلاب معلم واحد
// ---------------------------------------------------------------------
export async function loadTeacherMemorization({ uid, teacherCode }) {
    const out  = [];
    const seen = new Set();

    async function pull(field, value) {
        if (!value) return;
        try {
            const snap = await getDocs(query(collection(db, MEMORIZATION_COLLECTION), where(field, '==', value)));
            snap.forEach(d => {
                if (seen.has(d.id)) return;
                seen.add(d.id);
                const x = d.data();
                out.push({
                    studentUid: d.id,
                    studentName: x.studentName || 'طالب',
                    grade: x.grade || null,
                    surahs: x.surahs || {},
                    updatedAt: toDate(x.updatedAt)
                });
            });
        } catch (e) {
            console.warn('[memorization] تعذّر جلب سجلات المعلم:', e.message);
        }
    }

    await pull('teacherCode', teacherCode);

    out.sort((a, b) => (b.updatedAt ? b.updatedAt.getTime() : 0) - (a.updatedAt ? a.updatedAt.getTime() : 0));
    return out;
}
