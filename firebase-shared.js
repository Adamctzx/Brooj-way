// =====================================================================
// BoRooJ Way - التهيئة المشتركة لفايربيس
// ---------------------------------------------------------------------
// هذا الملف لا يلغي أي تهيئة قديمة في الصفحات.
// يستخدم getApps() لإعادة استخدام التطبيق إن كان قد تمت تهيئته مسبقاً،
// لذلك يعمل جنباً إلى جنب مع الكود القديم في كل صفحة دون تعارض.
// =====================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ⚠️ مطابق حرفياً للإعدادات المستخدمة في بقية الصفحات (٦ حقول بالضبط)
// أي اختلاف في هذه الحقول يسبب خطأ duplicate-app، لذلك لا تعدّلها منفردة.
export const firebaseConfig = {
    apiKey: "AIzaSyAQLfeZ232YVe6oY1omNOyrA_FzbNu8c_U",
    authDomain: "education-bazaar-ee0a5.firebaseapp.com",
    projectId: "education-bazaar-ee0a5",
    storageBucket: "education-bazaar-ee0a5.firebasestorage.app",
    messagingSenderId: "737041495961",
    appId: "1:737041495961:web:ae22fc0aaff4f1f9ff8508"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// تخزين ملفات التسميع الصوتية والمرئية
export const storage = getStorage(app);
export { app };
