// =====================================================================
// BoRooJ Way — أكواد دخول الطلاب
// ---------------------------------------------------------------------
// قبل هذا النظام: أي طالب ينشئ حساباً يصل إلى كل الكويزات مجاناً.
// الآن: لا يدخل الطالب الكويزات إلا بكود فعّال تُصدره أنت.
//
// كيف يعمل:
//   1. تُصدر الكود من لوحة إدارة المستخدمين (STD-XXXXXX)
//   2. الطالب يدخله مرة واحدة في صفحة student-access.html
//   3. يُربط الكود بحسابه، ويُفتح له الوصول
//   4. إيقاف الكود من اللوحة يقطع وصوله فوراً — لأننا نتحقق من حالة
//      الكود في كل مرة، لا من الحقل المحفوظ في حسابه فقط.
// =====================================================================

import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-shared.js";

export const ACCESS_CODES_COLLECTION = 'student_access_codes';

// ---------------------------------------------------------------------
// توليد كود جديد
// ---------------------------------------------------------------------
export function generateAccessCode() {
    return 'STD-' + Math.floor(100000 + Math.random() * 900000);
}

function toDate(v) {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch (e) { return null; }
}

// ---------------------------------------------------------------------
// فحص كود بذاته: هل هو صالح للاستخدام الآن؟
// ---------------------------------------------------------------------
// يُرجع: { valid, reason, data }
// reason: 'not_found' | 'inactive' | 'expired' | 'exhausted' | null
// ---------------------------------------------------------------------
export async function inspectCode(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return { valid: false, reason: 'not_found', data: null };

    let snap;
    try {
        snap = await getDoc(doc(db, ACCESS_CODES_COLLECTION, clean));
    } catch (e) {
        // خطأ شبكة أو صلاحيات — لا نعتبره كوداً باطلاً
        return { valid: false, reason: 'error', data: null, error: e };
    }

    if (!snap.exists()) return { valid: false, reason: 'not_found', data: null };

    const d = snap.data();
    if (d.isActive !== true) return { valid: false, reason: 'inactive', data: d };

    const exp = toDate(d.expiresAt);
    if (exp && exp.getTime() < Date.now()) return { valid: false, reason: 'expired', data: d };

    const max = Number(d.maxUses) || 0;   // 0 = بلا حد (كود صف كامل)
    const used = Number(d.useCount) || 0;
    if (max > 0 && used >= max) return { valid: false, reason: 'exhausted', data: d };

    return { valid: true, reason: null, data: d };
}

// ---------------------------------------------------------------------
// هل يملك هذا المستخدم وصولاً صالحاً الآن؟
// ---------------------------------------------------------------------
// المعلم والمدير معفيان دائماً.
// الطالب المعتمد (Premium) معفى أيضاً لأنه دخل أصلاً بكود PRM.
// ---------------------------------------------------------------------
export async function checkAccess(profile) {
    if (!profile) return { allowed: false, reason: 'no_user' };

    // المعلمون والمديرون لا يحتاجون كود دخول
    if (profile.isTeacher) return { allowed: true, reason: 'staff' };

    // طالب البوابة المعتمدة دخل بكود PRM مسبقاً
    try {
        if (sessionStorage.getItem('premium_access_code')) {
            return { allowed: true, reason: 'premium' };
        }
    } catch (e) { /* بعض المتصفحات تمنع sessionStorage */ }

    const code = profile.raw && profile.raw.accessCode;
    if (!code) return { allowed: false, reason: 'no_code' };

    // ⚠️ نتحقق من حالة الكود نفسه في كل مرة، لا من الحقل المحفوظ فقط،
    // حتى يقطع إيقافُ الكود وصولَ الطالب فوراً.
    const res = await inspectCode(code);
    if (res.reason === 'error') {
        // تعذّر التحقق (شبكة) — لا نحرم الطالب بسبب عطل مؤقت
        return { allowed: true, reason: 'check_failed' };
    }
    if (!res.valid) return { allowed: false, reason: res.reason, code };

    return { allowed: true, reason: 'code', code, data: res.data };
}

// ---------------------------------------------------------------------
// ربط الكود بحساب الطالب
// ---------------------------------------------------------------------
export async function redeemCode(uid, code) {
    const clean = String(code || '').trim().toUpperCase();
    const res = await inspectCode(clean);
    if (!res.valid) return res;

    const payload = {
        accessCode: clean,
        accessGrantedAt: new Date()
    };
    if (res.data.expiresAt) payload.accessExpiresAt = res.data.expiresAt;

    await setDoc(doc(db, 'users', uid), payload, { merge: true });

    // تسجيل الاستخدام (لا يمنع الدخول إن فشل)
    try {
        await updateDoc(doc(db, ACCESS_CODES_COLLECTION, clean), {
            useCount: increment(1),
            lastUsedAt: new Date()
        });
    } catch (e) { /* للإحصاء فقط */ }

    return { valid: true, reason: null, data: res.data };
}

// ---------------------------------------------------------------------
// رسالة مفهومة لكل سبب رفض
// ---------------------------------------------------------------------
export function accessMessage(reason) {
    switch (reason) {
        case 'not_found': return '❌ هذا الكود غير موجود. تأكد من كتابته بشكل صحيح.';
        case 'inactive':  return '⛔ هذا الكود موقوف من إدارة المنصة.';
        case 'expired':   return '⏳ انتهت صلاحية هذا الكود. تواصل مع معلمك لتجديده.';
        case 'exhausted': return '🚫 استُهلك هذا الكود بالكامل ولم يعد يقبل طلاباً جدداً.';
        case 'no_code':   return '🔑 تحتاج كود دخول لفتح الكويزات.';
        case 'error':     return '⚠️ تعذّر التحقق من الكود. تأكد من اتصالك بالإنترنت.';
        default:          return '🔒 لا تملك صلاحية الدخول حالياً.';
    }
}
