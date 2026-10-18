// =====================================================================
// BoRooJ Way - محرك التحصيل والتقدّم
// ---------------------------------------------------------------------
// يجمع نتائج الطالب من كل مصادر المنصة ويوحّدها في شكل واحد،
// ثم يحسب النقاط والمستوى والأوسمة وتحليل مستويات بلوم.
//
// ⚠️ ملاحظة مهمة عن مقاييس الدرجات (اختلاف قديم في قاعدة البيانات):
//   • academic_results (يلا كويز)  => score = نقاط خام (10 أو 15 للسؤال)
//   • standard/premium/custom      => score = نسبة مئوية من 100
//   • sharia_student_achievements  => score = نسبة مئوية من 100
// لذلك لا نخلط بينهما في المتوسط: المتوسط يُحسب من النسب المئوية فقط،
// أما النقاط (XP) فتجمع الجميع بعد توحيدها.
// =====================================================================

import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-shared.js";
import { lessonTitle, GRADE_LABELS } from "./lesson-map.js";

// ---------------------------------------------------------------------
// تعريف المصادر
// ---------------------------------------------------------------------
export const SOURCES = {
    live:     { key:'live',     label:'يلا كويز المباشر', icon:'⚔️', color:'#e67e22', isPercent:false },
    standard: { key:'standard', label:'تقييم معياري',      icon:'📊', color:'#3498db', isPercent:true  },
    premium:  { key:'premium',  label:'تقييم معتمد (VIP)', icon:'👑', color:'#d35400', isPercent:true  },
    custom:   { key:'custom',   label:'اختبار المعلم',     icon:'📝', color:'#27ae60', isPercent:true  },
    sharia:   { key:'sharia',   label:'العلوم الشرعية',    icon:'🕌', color:'#16a085', isPercent:true  }
};

function toDate(v) {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch (e) { return null; }
}

function clampPercent(n) {
    const x = Number(n);
    if (!isFinite(x)) return null;
    return Math.max(0, Math.min(100, Math.round(x)));
}

// ---------------------------------------------------------------------
// جلب كل نتائج طالب واحد
// ---------------------------------------------------------------------
// كل استعلام داخل try مستقل: تعطّل مصدر واحد لا يمنع عرض البقية.
// ---------------------------------------------------------------------
export async function loadStudentRecords(uid) {
    const records = [];
    const errors  = [];

    async function pull(collName, sourceKey, mapFn) {
        try {
            const snap = await getDocs(query(collection(db, collName), where('studentUid', '==', uid)));
            snap.forEach(d => {
                const rec = mapFn(d.data(), d.id);
                if (rec) records.push(rec);
            });
        } catch (e) {
            errors.push({ source: sourceKey, message: e.message });
            console.warn(`[progress] تعذّر جلب ${collName}:`, e.message);
        }
    }

    await Promise.all([
        // ⚔️ يلا كويز — نقاط خام
        pull('academic_results', 'live', (d) => ({
            source: 'live',
            title: lessonTitle(d.lessonId),
            lessonId: d.lessonId || null,
            percent: null,
            rawScore: Number(d.score) || 0,
            points: Number(d.score) || 0,
            date: toDate(d.timestamp),
            bloomBreakdown: d.bloomBreakdown || null,
            meta: { mode: d.mode || '', teacherId: d.teacherId || '' }
        })),

        // 📊 التقييمات المعيارية — نسبة مئوية
        pull('standard_results', 'standard', (d) => ({
            source: 'standard',
            title: lessonTitle(d.lessonId),
            lessonId: d.lessonId || null,
            percent: clampPercent(d.score),
            rawScore: Number(d.score) || 0,
            points: clampPercent(d.score) || 0,
            date: toDate(d.timestamp),
            bloomBreakdown: d.bloomBreakdown || null,
            meta: { roomId: d.roomId || '', lang: d.interfaceLanguage || '' }
        })),

        // 👑 التقييمات المعتمدة
        pull('premium_results', 'premium', (d) => ({
            source: 'premium',
            title: lessonTitle(d.lessonId),
            lessonId: d.lessonId || null,
            percent: clampPercent(d.score),
            rawScore: Number(d.score) || 0,
            points: clampPercent(d.score) || 0,
            date: toDate(d.timestamp),
            bloomBreakdown: d.bloomBreakdown || null,
            meta: { school: d.school || '', accessCode: d.accessCode || '' }
        })),

        // 📝 اختبارات المعلم المخصّصة
        pull('custom_results', 'custom', (d) => ({
            source: 'custom',
            title: d.quizTitle || lessonTitle(d.lessonId) || 'اختبار مخصّص',
            lessonId: d.lessonId || null,
            percent: clampPercent(d.score),
            rawScore: Number(d.score) || 0,
            points: clampPercent(d.score) || 0,
            date: toDate(d.timestamp),
            bloomBreakdown: d.bloomBreakdown || null,
            meta: { quizId: d.quizId || '' }
        })),

        // 🕌 العلوم الشرعية
        pull('sharia_student_achievements', 'sharia', (d) => ({
            source: 'sharia',
            title: `${d.book || ''}${d.chapter ? ' — ' + d.chapter : ''}` || 'مادة شرعية',
            lessonId: null,
            percent: clampPercent(d.score),
            rawScore: Number(d.score) || 0,
            points: clampPercent(d.score) || 0,
            date: toDate(d.timestamp),
            bloomBreakdown: null,
            meta: { category: d.category || '', level: d.level || '' }
        }))
    ]);

    // الأحدث أولاً
    records.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    return { records, errors };
}

// ---------------------------------------------------------------------
// حساب سلسلة الأيام المتتالية
// ---------------------------------------------------------------------
function computeStreak(dates) {
    if (!dates.length) return 0;

    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const days = [...new Set(dates.filter(Boolean).map(dayKey))];

    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);

    // السلسلة تُحتسب فقط إن كان آخر نشاط اليوم أو أمس
    if (!days.includes(dayKey(today)) && !days.includes(dayKey(yesterday))) return 0;

    let streak = 0;
    const cursor = new Date();
    if (!days.includes(dayKey(today))) cursor.setDate(cursor.getDate() - 1);

    while (days.includes(dayKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

// ---------------------------------------------------------------------
// الإحصاءات العامة
// ---------------------------------------------------------------------
export function computeStats(records) {
    const withPercent = records.filter(r => r.percent !== null && r.percent !== undefined);
    const dates = records.map(r => r.date).filter(Boolean);

    const totalXP = records.reduce((s, r) => s + (r.points || 0), 0);
    const avgPercent = withPercent.length
        ? Math.round(withPercent.reduce((s, r) => s + r.percent, 0) / withPercent.length)
        : null;

    const perSource = {};
    Object.keys(SOURCES).forEach(k => perSource[k] = 0);
    records.forEach(r => { perSource[r.source] = (perSource[r.source] || 0) + 1; });

    // تجميع مستويات بلوم من كل النتائج التي تحتوي تفصيلاً
    const bloom = {};
    records.forEach(r => {
        if (!r.bloomBreakdown) return;
        Object.entries(r.bloomBreakdown).forEach(([lvl, v]) => {
            if (!v || typeof v !== 'object') return;
            if (!bloom[lvl]) bloom[lvl] = { correct: 0, total: 0 };
            bloom[lvl].correct += Number(v.correct) || 0;
            bloom[lvl].total   += Number(v.total)   || 0;
        });
    });
    Object.keys(bloom).forEach(k => {
        bloom[k].percent = bloom[k].total ? Math.round((bloom[k].correct / bloom[k].total) * 100) : 0;
    });

    return {
        total:        records.length,
        totalXP,
        avgPercent,
        bestPercent:  withPercent.length ? Math.max(...withPercent.map(r => r.percent)) : null,
        percentCount: withPercent.length,
        lastActive:   dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null,
        streak:       computeStreak(dates),
        perSource,
        bloom,
        hasBloom:     Object.keys(bloom).length > 0,
        lessonsAttempted: new Set(records.map(r => r.lessonId).filter(Boolean))
    };
}

// ---------------------------------------------------------------------
// نظام المستويات
// ---------------------------------------------------------------------
export const LEVELS = [
    { level: 1,  name: 'مستجد',        min: 0 },
    { level: 2,  name: 'مجتهد',        min: 150 },
    { level: 3,  name: 'متمكّن',       min: 400 },
    { level: 4,  name: 'متميّز',       min: 800 },
    { level: 5,  name: 'بارع',         min: 1400 },
    { level: 6,  name: 'خبير',         min: 2200 },
    { level: 7,  name: 'نابغة',        min: 3200 },
    { level: 8,  name: 'عالِم',        min: 4500 },
    { level: 9,  name: 'إمام المنصة',  min: 6000 },
    { level: 10, name: 'أسطورة بروج',  min: 8000 }
];

export function computeLevel(xp) {
    let cur = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.min) cur = l; }

    const next = LEVELS.find(l => l.level === cur.level + 1) || null;
    const span = next ? (next.min - cur.min) : 1;
    const done = next ? (xp - cur.min) : span;

    return {
        level: cur.level,
        name: cur.name,
        xp,
        currentMin: cur.min,
        nextAt: next ? next.min : null,
        nextName: next ? next.name : null,
        progressPct: next ? Math.max(0, Math.min(100, Math.round((done / span) * 100))) : 100,
        remaining: next ? Math.max(0, next.min - xp) : 0,
        isMax: !next
    };
}

// ---------------------------------------------------------------------
// الأوسمة
// ---------------------------------------------------------------------
export function computeBadges(records, stats) {
    const sourcesUsed = Object.entries(stats.perSource).filter(([, n]) => n > 0).length;
    const perfect = records.some(r => r.percent === 100);

    const defs = [
        { icon:'🌱', name:'أول خطوة',       desc:'أنهيت أول تقييم لك',                earned: stats.total >= 1 },
        { icon:'🔥', name:'خمسة على التوالي', desc:'أنهيت 5 تقييمات',                  earned: stats.total >= 5 },
        { icon:'💪', name:'المثابر',         desc:'أنهيت 10 تقييمات',                 earned: stats.total >= 10 },
        { icon:'🏅', name:'المخضرم',         desc:'أنهيت 25 تقييماً',                 earned: stats.total >= 25 },
        { icon:'👑', name:'سيّد التقييمات',  desc:'أنهيت 50 تقييماً',                 earned: stats.total >= 50 },
        { icon:'💯', name:'الدرجة الكاملة',  desc:'حصلت على 100% في تقييم',            earned: perfect },
        { icon:'⭐', name:'المتميّز',        desc:'متوسطك 90% فأكثر (بعد 5 تقييمات)',  earned: stats.avgPercent !== null && stats.avgPercent >= 90 && stats.percentCount >= 5 },
        { icon:'📈', name:'المتقن',          desc:'متوسطك 75% فأكثر (بعد 5 تقييمات)',  earned: stats.avgPercent !== null && stats.avgPercent >= 75 && stats.percentCount >= 5 },
        { icon:'🧭', name:'المستكشف',        desc:'جرّبت 3 أنواع تقييم مختلفة',        earned: sourcesUsed >= 3 },
        { icon:'🕌', name:'طالب علم',        desc:'أنهيت اختباراً في العلوم الشرعية',   earned: (stats.perSource.sharia || 0) >= 1 },
        { icon:'📚', name:'مجلس العلم',      desc:'أنهيت 5 اختبارات شرعية',            earned: (stats.perSource.sharia || 0) >= 5 },
        { icon:'⚔️', name:'المبارز',         desc:'خضت تحدياً مباشراً في يلا كويز',     earned: (stats.perSource.live || 0) >= 1 },
        { icon:'📅', name:'الملتزم',         desc:'نشاط 3 أيام متتالية',               earned: stats.streak >= 3 },
        { icon:'🗓️', name:'أسبوع كامل',      desc:'نشاط 7 أيام متتالية',               earned: stats.streak >= 7 }
    ];

    return defs;
}

// ---------------------------------------------------------------------
// جلب نتائج طلاب معلم واحد
// ---------------------------------------------------------------------
// ملاحظة عن اختلاف قديم في ربط المعلم بين المحركات:
//   • academic_results (يلا كويز)   => الحقل teacherId ويحمل كود TCH-XXXX
//   • standard/premium/custom       => الحقل teacherUid ويحمل معرّف المعلم (uid)
// لذلك نستعلم بالحقلين معاً حتى لا تضيع أي نتيجة.
// ---------------------------------------------------------------------
export async function loadTeacherRecords({ uid, teacherCode }) {
    const records = [];
    const errors  = [];
    const seen    = new Set(); // منع تكرار نفس المستند عند تطابقه مع أكثر من مفتاح

    // ⚠️ سبب اختفاء نتائج بعض الطلاب سابقاً:
    // محرّكات المنصة لا تتفق على قيمة حقل ربط المعلم. بعضها يحفظ معرّف
    // الحساب (uid) وبعضها يحفظ الكود الأكاديمي (TCH-XXXX) — وصفحة
    // academic-teacher.html تبحث بالكود بينما كان ملف المعلم يبحث
    // بالمعرّف، فتظهر النتائج في مكان وتختفي في الآخر.
    // الحل: البحث بالمفتاحين معاً في كل مجموعة ثم إزالة التكرار.
    async function pull(collName, field, values, sourceKey, mapFn) {
        const keys = (Array.isArray(values) ? values : [values]).filter(Boolean);
        for (const value of keys) {
            try {
                const snap = await getDocs(query(collection(db, collName), where(field, '==', value)));
                snap.forEach(d => {
                    const dedupeKey = collName + '/' + d.id;
                    if (seen.has(dedupeKey)) return;
                    seen.add(dedupeKey);
                    const rec = mapFn(d.data(), d.id);
                    if (rec) records.push(rec);
                });
            } catch (e) {
                errors.push({ source: sourceKey, message: e.message });
                console.warn(`[progress] تعذّر جلب ${collName} بالمفتاح ${value}:`, e.message);
            }
        }
    }

    const base = (d, source, percent, points) => ({
        source,
        studentUid:  d.studentUid || null,
        studentName: d.studentName || 'طالب',
        title:       lessonTitle(d.lessonId),
        lessonId:    d.lessonId || null,
        percent,
        rawScore:    Number(d.score) || 0,
        points,
        date:        toDate(d.timestamp),
        bloomBreakdown: d.bloomBreakdown || null
    });

    // نبحث بالكود الأكاديمي وبمعرّف الحساب معاً في كل مجموعة
    const bothKeys = [teacherCode, uid];

    await Promise.all([
        pull('academic_results', 'teacherId',  bothKeys, 'live',
             d => base(d, 'live', null, Number(d.score) || 0)),

        pull('standard_results', 'teacherUid', bothKeys, 'standard',
             d => base(d, 'standard', clampPercent(d.score), clampPercent(d.score) || 0)),

        pull('premium_results',  'teacherUid', bothKeys, 'premium',
             d => base(d, 'premium', clampPercent(d.score), clampPercent(d.score) || 0)),

        pull('custom_results',   'teacherUid', bothKeys, 'custom',
             d => base(d, 'custom', clampPercent(d.score), clampPercent(d.score) || 0))
    ]);

    records.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    return { records, errors };
}

// ---------------------------------------------------------------------
// بناء كشف طلاب المعلم الكامل
// ---------------------------------------------------------------------
// يدمج مصدرين حتى لا يغيب أي طالب:
//   1. الطلاب المرتبطون بكود المعلم في مجموعة users (ولو لم يرسلوا شيئاً)
//   2. أصحاب النتائج الواردة (ولو لم يربطوا حساباتهم بالكود)
// المطابقة بمعرّف الحساب أولاً، ثم بالاسم للسجلات القديمة التي حُفظت
// بلا معرّف طالب.
// ---------------------------------------------------------------------
export function buildStudentRoster(records, linkedUsers = []) {
    const map = {};

    // 1) الطلاب المسجّلون بكود المعلم
    linkedUsers.forEach(u => {
        if (!u || !u.uid) return;
        map[u.uid] = {
            key: u.uid, uid: u.uid,
            name: u.name || 'طالب',
            grade: u.grade || null,
            school: u.school || null,
            linked: true,
            records: [], percents: [], xp: 0, last: null
        };
    });

    // فهرس بالاسم لمطابقة النتائج القديمة بلا معرّف
    const byName = {};
    Object.values(map).forEach(s => { if (s.name) byName[s.name.trim()] = s.key; });

    // 2) النتائج الواردة
    records.forEach(r => {
        let key = null;

        if (r.studentUid && map[r.studentUid]) key = r.studentUid;
        else if (r.studentName && byName[r.studentName.trim()]) key = byName[r.studentName.trim()];
        else key = r.studentUid || ('name:' + (r.studentName || 'طالب'));

        if (!map[key]) {
            map[key] = {
                key, uid: r.studentUid || null,
                name: r.studentName || 'طالب',
                grade: null, school: null,
                linked: false,
                records: [], percents: [], xp: 0, last: null
            };
            if (map[key].name) byName[map[key].name.trim()] = key;
        }

        const g = map[key];
        g.records.push(r);
        g.xp += r.points || 0;
        if (r.percent !== null && r.percent !== undefined) g.percents.push(r.percent);
        if (r.date && (!g.last || r.date > g.last)) g.last = r.date;
        if ((!g.name || g.name === 'طالب') && r.studentName) g.name = r.studentName;
    });

    return Object.values(map).map(g => ({
        ...g,
        count: g.records.length,
        avg:  g.percents.length ? Math.round(g.percents.reduce((a, b) => a + b, 0) / g.percents.length) : null,
        best: g.percents.length ? Math.max(...g.percents) : null,
        started: g.records.length > 0
    }));
}

// يُبقى للتوافق مع أي استدعاء قديم
export function groupByStudent(records) {
    return buildStudentRoster(records, []).sort(
        (a, b) => (b.avg === null ? -1 : b.avg) - (a.avg === null ? -1 : a.avg)
    );
}

// ---------------------------------------------------------------------
// تقسيم الطلاب حسب الصف الدراسي
// ---------------------------------------------------------------------
// المعلم الواحد قد يدرّس عدة صفوف، وعرضهم في قائمة واحدة يبدو عشوائياً.
// نقسّمهم إلى مجموعات مرتّبة رقمياً، وداخل كل صف نرتّب حسب المتوسط.
// ---------------------------------------------------------------------
export function groupByGrade(students) {
    const buckets = {};

    students.forEach(s => {
        const key = s.grade || '__none__';
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(s);
    });

    const ordered = Object.keys(buckets).sort((a, b) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return (parseInt(a.slice(1)) || 0) - (parseInt(b.slice(1)) || 0);
    });

    return ordered.map(key => {
        const list = buckets[key].sort((a, b) => {
            // من لديه نتائج أولاً، ثم الأعلى متوسطاً، ثم أبجدياً
            if (a.started !== b.started) return a.started ? -1 : 1;
            if (a.avg !== b.avg) return (b.avg === null ? -1 : b.avg) - (a.avg === null ? -1 : a.avg);
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });

        const withAvg = list.filter(s => s.avg !== null);
        return {
            grade: key === '__none__' ? null : key,
            label: key === '__none__' ? 'صف غير محدّد' : (GRADE_LABELS[key] || key),
            students: list,
            total: list.length,
            startedCount: list.filter(s => s.started).length,
            gradeAvg: withAvg.length
                ? Math.round(withAvg.reduce((a, b) => a + b.avg, 0) / withAvg.length)
                : null
        };
    });
}

// ---------------------------------------------------------------------
// أضعف الدروس لدى الصف
// ---------------------------------------------------------------------
export function weakestLessons(records, minAttempts = 2) {
    const map = {};
    records.forEach(r => {
        if (r.percent === null || r.percent === undefined || !r.lessonId) return;
        if (!map[r.lessonId]) map[r.lessonId] = { lessonId: r.lessonId, title: r.title || lessonTitle(r.lessonId), percents: [] };
        map[r.lessonId].percents.push(r.percent);
    });

    return Object.values(map)
        .map(l => ({
            lessonId: l.lessonId,
            title: l.title,
            attempts: l.percents.length,
            avg: Math.round(l.percents.reduce((a,b)=>a+b,0) / l.percents.length)
        }))
        .filter(l => l.attempts >= minAttempts)
        .sort((a, b) => a.avg - b.avg);
}

// ---------------------------------------------------------------------
// خريطة التقدّم في المنهج: أي درس أُنجز وأي درس لم يُبدأ
// ---------------------------------------------------------------------
export function buildLessonProgress(records) {
    const map = {};
    records.forEach(r => {
        if (!r.lessonId) return;
        if (!map[r.lessonId]) map[r.lessonId] = { attempts: 0, best: null, last: null };
        const e = map[r.lessonId];
        e.attempts++;
        if (r.percent !== null && (e.best === null || r.percent > e.best)) e.best = r.percent;
        if (r.date && (!e.last || r.date > e.last)) e.last = r.date;
    });
    return map;
}
