// =====================================================================
// BoRooJ Way - نظام الأدوار الموحّد (طالب / معلم / أدمن)
// ---------------------------------------------------------------------
// هذا الملف هو المرجع الوحيد لتحديد دور المستخدم في كل صفحات المنصة.
// لا يحذف أي حقل قديم، ويعامل أي حساب قديم بلا دور على أنه "طالب".
//
// ⚠️ تنبيه أمني مهم:
// أي تحقق هنا يجري داخل المتصفح، فهو لتحسين التجربة ومنع الوصول العادي.
// الحماية الفعلية الوحيدة هي قواعد Firestore (ملف firestore.rules).
// =====================================================================

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-shared.js";

// ---------------------------------------------------------------------
// 🔑 حسابات الأدمن (مالك المنصة)
// ---------------------------------------------------------------------
// ⚠️ يجب أن تتأكد من هذا الإيميل: اكتب هنا البريد الذي تسجّل به دخولك
//    أنت شخصياً في الموقع. هذا هو الحساب الوحيد الذي سيملك صلاحية
//    إصدار أكواد PRM ورؤية كل المدارس وإدارة أدوار المستخدمين.
//    يمكنك إضافة أكثر من بريد داخل الأقواس مفصولة بفاصلة.
export const ADMIN_EMAILS = [
    "alictzx@gmail.com"
];

// ---------------------------------------------------------------------
// الأدوار ومراتبها
// ---------------------------------------------------------------------
export const ROLES = {
    STUDENT: 'student',
    PARENT:  'parent',
    TEACHER: 'teacher',
    ADMIN:   'admin'
};

// كل دور يرث صلاحيات ما دونه: الأدمن يستطيع فعل كل ما يفعله المعلم، وهكذا.
// ⚠️ ولي الأمر ليس أعلى ولا أدنى من الطالب — هو دور جانبي لا يرث شيئاً
//    ولا يُورَّث. لذلك أُعطي نفس المرتبة، وتُستخدم data-exact-role
//    في صفحته حتى لا يدخلها طالب ولا يدخل هو صفحات الطلاب.
const ROLE_RANK = {
    [ROLES.STUDENT]: 1,
    [ROLES.PARENT]:  1,
    [ROLES.TEACHER]: 2,
    [ROLES.ADMIN]:   3
};

export const ROLE_LABELS = {
    [ROLES.STUDENT]: 'طالب 🎓',
    [ROLES.PARENT]:  'ولي أمر 👨‍👩‍👧',
    [ROLES.TEACHER]: 'معلم 👨‍🏫',
    [ROLES.ADMIN]:   'مدير المنصة 🛡️'
};

// اسم مجموعة أكواد تفعيل المعلمين في قاعدة البيانات
export const TEACHER_CODES_COLLECTION = 'teacher_activation_codes';

// ---------------------------------------------------------------------
// تطبيع الدور: أي قيمة غير معروفة أو مفقودة => طالب
// ---------------------------------------------------------------------
export function normalizeRole(rawRole) {
    const r = (rawRole || '').toString().trim().toLowerCase();
    if (r === ROLES.ADMIN)   return ROLES.ADMIN;
    if (r === ROLES.TEACHER) return ROLES.TEACHER;
    if (r === ROLES.PARENT)  return ROLES.PARENT;
    return ROLES.STUDENT;
}

// ---------------------------------------------------------------------
// هل الدور الحالي يكفي للدور المطلوب؟
// ---------------------------------------------------------------------
export function hasRole(currentRole, requiredRole) {
    const current  = ROLE_RANK[normalizeRole(currentRole)]  || 1;
    const required = ROLE_RANK[normalizeRole(requiredRole)] || 1;
    return current >= required;
}

// ---------------------------------------------------------------------
// جلب ملف المستخدم مع دوره الفعلي
// ---------------------------------------------------------------------
// ترتيب الأولوية في تحديد الدور:
//   1. إن كان بريده ضمن ADMIN_EMAILS  => أدمن (حساب التأسيس)
//   2. الحقل role المخزّن في users/{uid}
//   3. الافتراضي: طالب
// ---------------------------------------------------------------------
export async function getUserProfile(user) {
    if (!user) return null;

    let data = {};
    let loadError = null;
    try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) data = snap.data() || {};
    } catch (e) {
        loadError = e;
        console.warn('[roles] تعذّر قراءة ملف المستخدم:', e && e.message);
    }

    const isBootstrapAdmin =
        !!user.email && ADMIN_EMAILS.some(m => m.toLowerCase() === user.email.toLowerCase());

    const role = isBootstrapAdmin ? ROLES.ADMIN : normalizeRole(data.role);

    return {
        uid:            user.uid,
        email:          user.email || data.email || '',
        name:           data.name || user.displayName || 'مستخدم',
        role:           role,
        roleLabel:      ROLE_LABELS[role],
        isAdmin:        role === ROLES.ADMIN,
        isTeacher:      role === ROLES.TEACHER || role === ROLES.ADMIN,
        isStudent:      role === ROLES.STUDENT,
        isParent:       role === ROLES.PARENT,
        // أبناء ولي الأمر المرتبطون بحسابه
        childUids:      Array.isArray(data.childUids) ? data.childUids : [],
        isBootstrapAdmin,
        // هل أكمل بياناته الأساسية بعد التسجيل؟
        profileComplete: data.profileComplete === true,
        exists:         Object.keys(data).length > 0,
        // يصبح true إذا فشلت قراءة قاعدة البيانات (شبكة أو قواعد حماية)
        // نستخدمه لتمييز "لا صلاحية" عن "تعذّر التحقق" في شاشة المنع.
        loadError:      loadError,
        raw:            data
    };
}

// ---------------------------------------------------------------------
// إنشاء ملف مستخدم إن لم يكن موجوداً — بدور "طالب" فقط
// ---------------------------------------------------------------------
// ⚠️ لا يعدّل أي حساب قائم إطلاقاً، ولا يغيّر دور أحد. الإنشاء فقط.
// ---------------------------------------------------------------------
export async function ensureUserDoc(user) {
    if (!user) return false;
    try {
        const ref  = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) return false;

        await setDoc(ref, {
            name:            user.displayName || 'مستخدم جديد',
            email:           user.email || '',
            role:            ROLES.STUDENT,
            teacherCode:     null,
            profileComplete: false,
            createdAt:       new Date()
        });
        return true;
    } catch (e) {
        console.warn('[roles] تعذّر إنشاء ملف المستخدم:', e && e.message);
        return false;
    }
}

// ---------------------------------------------------------------------
// الصفحة الشخصية المناسبة لكل دور
// ---------------------------------------------------------------------
export function profilePageFor(role) {
    const r = normalizeRole(role);
    if (r === ROLES.PARENT) return 'parent-portal.html';
    return hasRole(r, ROLES.TEACHER) ? 'profile-teacher.html' : 'profile-student.html';
}

// ---------------------------------------------------------------------
// انتظار جاهزية الحساب بشكل آمن
// ---------------------------------------------------------------------
// المشكلة التي تعالجها هذه الدالة:
//   الصفحات كانت تستمع لحدث 'boroj-auth-ready' فقط. وإذا أطلقه الحارس
//   قبل أن تسجّل الصفحة مستمعها، يضيع الحدث ولا يُنفَّذ شيء أبداً،
//   فتبدو الصفحة "لا تعمل" بلا أي رسالة خطأ.
// الحل: نتحقق أولاً إن كانت البيانات جاهزة فعلاً، وإلا ننتظر الحدث.
// ---------------------------------------------------------------------
export function onAuthReady(callback) {
    if (window.BoRooJUser) {
        callback(window.BoRooJUser);
        return;
    }
    document.addEventListener('boroj-auth-ready', (ev) => callback(ev.detail), { once: true });
}
