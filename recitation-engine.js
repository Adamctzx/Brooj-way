// =====================================================================
// BoRooJ Way — محرك التسميع
// ---------------------------------------------------------------------
// يجمع ما تحتاجه صفحتا التسميع (الطالب والمعلم): أسماء السور،
// أنواع التسميع، مستويات التقييم، ودوال الجلب المشتركة.
// =====================================================================

import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-shared.js";

// ---------------------------------------------------------------------
// أنواع التسميع
// ---------------------------------------------------------------------
export const RECITATION_TYPES = {
    quran:  { key:'quran',  label:'القرآن الكريم',   icon:'📖', color:'#16a085' },
    hadith: { key:'hadith', label:'الحديث الشريف',   icon:'📜', color:'#2980b9' },
    matn:   { key:'matn',   label:'متن علمي',        icon:'📚', color:'#8e44ad' },
    dua:    { key:'dua',    label:'دعاء أو ذِكر',    icon:'🤲', color:'#d35400' },
    other:  { key:'other',  label:'أخرى',            icon:'🎙️', color:'#7f8c8d' }
};

// ---------------------------------------------------------------------
// مستويات التقييم — تُحسب تلقائياً من الدرجة
// ---------------------------------------------------------------------
export function levelFromScore(score) {
    const s = Number(score);
    if (!isFinite(s)) return '—';
    if (s >= 95) return 'متقن تماماً 🌟';
    if (s >= 85) return 'ممتاز ✨';
    if (s >= 75) return 'جيد جداً 📈';
    if (s >= 60) return 'جيد ✅';
    if (s >= 50) return 'مقبول';
    return 'يحتاج إعادة 🔄';
}

export function scoreColor(score) {
    const s = Number(score);
    if (!isFinite(s)) return '#95a5a6';
    return s >= 85 ? '#27ae60' : s >= 60 ? '#f39c12' : '#e74c3c';
}

// ---------------------------------------------------------------------
// سور القرآن الكريم (١١٤ سورة بالترتيب)
// ---------------------------------------------------------------------
export const SURAHS = [
    'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس',
    'هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه',
    'الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم',
    'لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر',
    'فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق',
    'الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة',
    'الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج',
    'نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس',
    'التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد',
    'الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات',
    'القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر',
    'المسد','الإخلاص','الفلق','الناس'
];

// ---------------------------------------------------------------------
// تحويل مستند Firestore إلى شكل موحّد
// ---------------------------------------------------------------------
function toDate(v) {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch (e) { return null; }
}

function normalize(d, id) {
    return {
        id,
        studentUid:   d.studentUid || null,
        studentName:  d.studentName || 'طالب',
        studentGrade: d.studentGrade || null,
        teacherCode:  d.teacherCode || null,
        teacherUid:   d.teacherUid || null,
        type:         d.type || 'other',
        title:        d.title || '',
        reference:    d.reference || '',
        mediaType:    d.mediaType || 'audio',
        storagePath:  d.storagePath || '',
        downloadURL:  d.downloadURL || '',
        durationSec:  Number(d.durationSec) || 0,
        status:       d.status || 'pending',
        score:        (d.score === undefined || d.score === null) ? null : Number(d.score),
        level:        d.level || '',
        feedback:     d.feedback || '',
        createdAt:    toDate(d.createdAt),
        reviewedAt:   toDate(d.reviewedAt)
    };
}

// ---------------------------------------------------------------------
// تسميعات طالب واحد
// ---------------------------------------------------------------------
export async function loadStudentRecitations(uid) {
    const out = [];
    try {
        const snap = await getDocs(query(collection(db, 'recitations'), where('studentUid', '==', uid)));
        snap.forEach(d => out.push(normalize(d.data(), d.id)));
    } catch (e) {
        console.warn('[recitation] تعذّر جلب تسميعات الطالب:', e.message);
        throw e;
    }
    out.sort((a, b) => (b.createdAt ? b.createdAt.getTime() : 0) - (a.createdAt ? a.createdAt.getTime() : 0));
    return out;
}

// ---------------------------------------------------------------------
// تسميعات طلاب معلم واحد
// ---------------------------------------------------------------------
// نبحث بالكود الأكاديمي وبمعرّف الحساب معاً — لنفس سبب اختلاف
// مفاتيح الربط بين محرّكات المنصة.
// ---------------------------------------------------------------------
export async function loadTeacherRecitations({ uid, teacherCode }) {
    const out  = [];
    const seen = new Set();

    async function pull(field, value) {
        if (!value) return;
        try {
            const snap = await getDocs(query(collection(db, 'recitations'), where(field, '==', value)));
            snap.forEach(d => {
                if (seen.has(d.id)) return;
                seen.add(d.id);
                out.push(normalize(d.data(), d.id));
            });
        } catch (e) {
            console.warn(`[recitation] تعذّر الجلب بـ ${field}:`, e.message);
        }
    }

    await pull('teacherCode', teacherCode);
    await pull('teacherUid',  uid);

    out.sort((a, b) => (b.createdAt ? b.createdAt.getTime() : 0) - (a.createdAt ? a.createdAt.getTime() : 0));
    return out;
}

// ---------------------------------------------------------------------
// إحصاءات مختصرة
// ---------------------------------------------------------------------
export function recitationStats(list) {
    const reviewed = list.filter(r => r.status === 'reviewed' && r.score !== null);
    return {
        total:     list.length,
        pending:   list.filter(r => r.status !== 'reviewed').length,
        reviewed:  reviewed.length,
        avgScore:  reviewed.length
            ? Math.round(reviewed.reduce((a, b) => a + b.score, 0) / reviewed.length)
            : null,
        bestScore: reviewed.length ? Math.max(...reviewed.map(r => r.score)) : null
    };
}

// ---------------------------------------------------------------------
// تنسيق المدة (ثوانٍ ← 02:35)
// ---------------------------------------------------------------------
export function fmtDuration(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
