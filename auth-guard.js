// =====================================================================
// BoRooJ Way - حارس الصفحات حسب الدور
// ---------------------------------------------------------------------
// طريقة الاستخدام: يوضع هذا السطر داخل <head> في الصفحة المحمية
//
//   <script type="module" src="auth-guard.js" data-require-role="teacher"></script>
//
// القيم المتاحة لـ data-require-role:  student | teacher | admin
// ولمن أراد اشتراط تسجيل الدخول فقط بلا دور معيّن: data-require-role="student"
//
// خيارات إضافية:
//   data-skip-profile-check="true"  => لا يوجّه لصفحة استكمال البيانات
//
// ⚠️ هذا الحارس لتحسين التجربة ومنع الوصول العادي فقط.
//    الحماية الفعلية هي قواعد Firestore (firestore.rules).
// =====================================================================

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-shared.js";
import { getUserProfile, hasRole, ROLE_LABELS, ROLES, profilePageFor } from "./roles.js";

// ملاحظة: إن فُتحت الصفحة عبر file:// فلن يصل التنفيذ إلى هنا أصلاً،
// لأن المتصفح يمنع تحميل الـ modules. الكاشف الموجود في وسم <script>
// العادي داخل كل صفحة هو المسؤول عن تنبيه المستخدم في تلك الحالة.

// ---------------------------------------------------------------------
// 1) إخفاء الصفحة فوراً حتى ينتهي التحقق (منع ظهور المحتوى للحظة)
// ---------------------------------------------------------------------
const hideStyle = document.createElement('style');
hideStyle.id = 'boroj-guard-hide';
hideStyle.textContent = 'body{visibility:hidden !important;}';
(document.head || document.documentElement).appendChild(hideStyle);

function revealPage() {
    const el = document.getElementById('boroj-guard-hide');
    if (el) el.remove();
}

// ---------------------------------------------------------------------
// 2) قراءة الدور المطلوب من وسم السكربت نفسه
// ---------------------------------------------------------------------
const guardTag     = document.querySelector('script[data-require-role]');
const requiredRole = (guardTag && guardTag.dataset.requireRole) || ROLES.STUDENT;
const skipProfile  = !!(guardTag && guardTag.dataset.skipProfileCheck === 'true');
// 🔑 هل تشترط هذه الصفحة كود دخول للطالب؟ (المعلم والمدير معفيان)
const requireAccess = !!(guardTag && guardTag.dataset.requireAccess === 'true');

// 🎯 دور محدد بالضبط، بلا وراثة.
// يُستخدم للأدوار الجانبية مثل "ولي أمر": ليس أعلى ولا أدنى من الطالب،
// فلا يصح أن يدخل الطالب صفحته ولا أن يدخل هو صفحات الطلاب.
// الأدمن يبقى مستثنى دائماً حتى يستطيع المراجعة.
const exactRole = (guardTag && guardTag.dataset.exactRole) || null;

// ---------------------------------------------------------------------
// 3) شاشة المنع
// ---------------------------------------------------------------------
function showBlockScreen(opts) {
    revealPage();
    document.body.innerHTML = `
        <div id="boroj-guard-screen" style="
            position:fixed; inset:0; z-index:2147483647;
            display:flex; align-items:center; justify-content:center; padding:20px;
            background:linear-gradient(135deg,#1a2a6c,#b21f1f,#fdbb2d);
            background-size:300% 300%; animation:borojGuardBG 12s ease infinite;
            font-family:'Cairo',sans-serif; direction:rtl;">
            <div style="
                background:#fff; border-radius:20px; padding:40px 30px; max-width:520px; width:100%;
                text-align:center; box-shadow:0 20px 50px rgba(0,0,0,.35); border-top:6px solid ${opts.color};">
                <div style="font-size:4.5rem; line-height:1; margin-bottom:15px;">${opts.icon}</div>
                <h2 style="color:#1a2a6c; font-size:1.7rem; font-weight:900; margin:0 0 15px;">${opts.title}</h2>
                <p style="color:#555; font-size:1.08rem; line-height:1.8; margin:0 0 25px;">${opts.message}</p>
                ${opts.detail ? `<div style="
                    background:#f8f9fa; border:1px solid #e1e8ed; border-radius:10px;
                    padding:12px 15px; color:#7f8c8d; font-size:.95rem; margin-bottom:25px;">${opts.detail}</div>` : ''}
                <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                    ${opts.buttons}
                </div>
            </div>
        </div>
        <style>
            @keyframes borojGuardBG {
                0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}
            }
            #boroj-guard-screen a, #boroj-guard-screen button {
                display:inline-block; padding:12px 26px; border-radius:10px; border:none;
                font-family:'Cairo',sans-serif; font-weight:bold; font-size:1.05rem;
                cursor:pointer; text-decoration:none; transition:.25s;
            }
            #boroj-guard-screen a:hover, #boroj-guard-screen button:hover { transform:translateY(-2px); }
        </style>
    `;
    const logoutBtn = document.getElementById('boroj-guard-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => { window.location.href = 'login.html'; });
        });
    }
}

const BTN_HOME    = `<a href="index.html" style="background:#1a2a6c; color:#fff;">العودة للرئيسية 🏠</a>`;
const BTN_LOGOUT  = `<button id="boroj-guard-logout" style="background:#ecf0f1; color:#2c3e50;">تسجيل الخروج والدخول بحساب آخر</button>`;

// ---------------------------------------------------------------------
// 4) التحقق
// ---------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {

    // (أ) غير مسجّل دخول => توجيه لصفحة الدخول مع حفظ الوجهة
    if (!user) {
        const page = window.location.pathname.split('/').pop() + window.location.search;
        // نحفظها في الجلسة أيضاً، لأن بعض الصفحات القديمة فيها تحويل خاص بها
        // قد يسبق تحويلنا ويُفقد الوجهة من الرابط.
        try { sessionStorage.setItem('boroj_return_url', page); } catch (e) {}
        window.location.href = `login.html?returnUrl=${encodeURIComponent(page)}`;
        return;
    }

    const profile = await getUserProfile(user);

    // (ب) تعذّر التحقق (شبكة أو قواعد حماية) => رسالة مختلفة عن "لا صلاحية"
    if (profile.loadError) {
        showBlockScreen({
            icon: '📡',
            color: '#e67e22',
            title: 'تعذّر التحقق من صلاحيتك',
            message: 'لم نتمكن من قراءة بيانات حسابك من الخادم. قد يكون السبب انقطاع الاتصال بالإنترنت.',
            detail: 'إن تكرر الأمر بعد تحديث الصفحة، تواصل مع إدارة المنصة.',
            buttons: `<a href="javascript:location.reload()" style="background:#e67e22;color:#fff;">إعادة المحاولة 🔄</a>${BTN_HOME}`
        });
        return;
    }

    // (ج) لم يستكمل بياناته بعد (حسابات Google الجديدة مثلاً)
    if (!skipProfile && !profile.profileComplete && !profile.isBootstrapAdmin) {
        const back = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
        window.location.href = `complete-profile.html?returnUrl=${back}`;
        return;
    }

    // (د1) دور محدد بالضبط (الأدوار الجانبية مثل ولي الأمر)
    if (exactRole && profile.role !== exactRole && !profile.isAdmin) {
        const wantedLabel = ROLE_LABELS[exactRole] || exactRole;
        showBlockScreen({
            icon: '🚻',
            color: '#8e44ad',
            title: 'هذه الصفحة لدور مختلف',
            message: `هذه الصفحة مخصّصة لحسابات <strong>${wantedLabel}</strong> فقط، وحسابك مسجّل كـ <strong>${profile.roleLabel}</strong>.`,
            detail: `الحساب الحالي: ${profile.email || profile.name}`,
            buttons:
                `<a href="${profilePageFor(profile.role)}" style="background:#27ae60;color:#fff;">ملفي الشخصي 👤</a>` +
                BTN_HOME + BTN_LOGOUT
        });
        return;
    }

    // (د) الدور غير كافٍ
    if (!hasRole(profile.role, requiredRole)) {
        const requiredLabel = ROLE_LABELS[requiredRole] || requiredRole;

        showBlockScreen({
            icon: '🔒',
            color: '#e74c3c',
            title: 'هذه الصفحة ليست ضمن صلاحياتك',
            message: `هذه الصفحة مخصّصة لحسابات <strong>${requiredLabel}</strong> فقط، وحسابك الحالي مسجّل كـ <strong>${profile.roleLabel}</strong>.`,
            detail: `الحساب الحالي: ${profile.email || profile.name}`,
            buttons:
                `<a href="${profilePageFor(profile.role)}" style="background:#27ae60;color:#fff;">ملفي الشخصي 👤</a>` +
                BTN_HOME + BTN_LOGOUT
        });
        return;
    }

    // (و) 🔑 كود الدخول: الكويزات مقفلة على أصحاب الأكواد فقط.
    // المعلم والمدير وطالب البوابة المعتمدة معفَون (تتكفّل checkAccess بذلك).
    if (requireAccess) {
        const { checkAccess } = await import('./access-codes.js');
        const access = await checkAccess(profile);

        if (!access.allowed) {
            const page = window.location.pathname.split('/').pop() + window.location.search;
            window.location.href = `student-access.html?returnUrl=${encodeURIComponent(page)}`;
            return;
        }
        profile.accessReason = access.reason;
    }

    // (هـ) مسموح => إظهار الصفحة وتمرير البيانات للصفحة
    window.BoRooJUser = profile;
    revealPage();
    document.dispatchEvent(new CustomEvent('boroj-auth-ready', { detail: profile }));
});
