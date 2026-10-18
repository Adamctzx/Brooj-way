/* =====================================================================
   BoRooJ Way - كاشف فتح الصفحة بالنقر المزدوج (file://)
   ---------------------------------------------------------------------
   ⚠️ هذا الملف سكربت عادي وليس module — وهذا مقصود.
   المتصفح يمنع تحميل الـ modules عبر بروتوكول file:// لأسباب أمنية،
   فلا يعمل roles.js ولا auth-guard.js ولا سكربت الصفحة، وتظهر الصفحة
   بشكلها الطبيعي لكن بلا أي وظيفة ولا رسالة خطأ.

   لذلك نكشف الحالة بسكربت عادي (يعمل في كل الأحوال) ونشرح للمستخدم
   سبب المشكلة وطريقة تشغيل الموقع بشكل صحيح.

   الاستخدام: يوضع في <head> قبل أي سكربت module
   <script src="file-protocol-check.js"></script>
   ===================================================================== */
(function () {
    if (window.location.protocol !== 'file:') return;

    function show() {
        document.body.innerHTML =
            '<div style="position:fixed; inset:0; z-index:2147483647; display:flex;' +
            'align-items:center; justify-content:center; padding:20px; direction:rtl;' +
            'background:linear-gradient(135deg,#1a2a6c,#b21f1f,#fdbb2d);' +
            "font-family:'Cairo',sans-serif;\">" +
              '<div style="background:#fff; border-radius:20px; padding:40px 32px; max-width:600px;' +
              'width:100%; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,.35); border-top:6px solid #e67e22;">' +
                '<div style="font-size:4.5rem; margin-bottom:15px;">🚫</div>' +
                '<h2 style="color:#1a2a6c; font-size:1.6rem; font-weight:900; margin:0 0 15px;">' +
                  'لا يمكن فتح هذه الصفحة بالنقر المزدوج</h2>' +
                '<p style="color:#555; font-size:1.05rem; line-height:1.9; margin:0 0 22px;">' +
                  'صفحات المنصة تستخدم <strong>JavaScript Modules</strong>، والمتصفح يمنعها ' +
                  'عند فتح الملف مباشرة من القرص (<code>file://</code>).<br>' +
                  'لذلك تظهر الصفحة بشكلها الطبيعي لكن <strong>بلا أي وظيفة</strong>: ' +
                  'الأزرار لا تعمل والبيانات لا تُحمّل.</p>' +
                '<div style="background:#eafaf1; border:1px solid #a9dfbf; border-radius:12px;' +
                'padding:20px; text-align:right; line-height:2; color:#1e8449;">' +
                  '<strong style="font-size:1.1rem;">✅ الطريقة الصحيحة:</strong><br>' +
                  '<strong>1.</strong> انقر نقراً مزدوجاً على ملف ' +
                  '<code style="background:#fff; padding:2px 8px; border-radius:5px;">تشغيل-الموقع-محلياً.bat</code><br>' +
                  '<strong>2.</strong> افتح في المتصفح: ' +
                  '<code style="background:#fff; padding:2px 8px; border-radius:5px; direction:ltr; display:inline-block;">' +
                  'http://localhost:8765/</code><br>' +
                  '<strong>3.</strong> تصفّح الموقع من هناك — كل شيء سيعمل.' +
                '</div>' +
                '<p style="color:#95a5a6; font-size:.9rem; margin-top:20px; line-height:1.8;">' +
                  'هذا ليس عطلاً في الموقع. بعد الرفع على الاستضافة ' +
                  '(<code>https://</code>) يعمل كل شيء تلقائياً.</p>' +
              '</div>' +
            '</div>';
    }

    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
})();
