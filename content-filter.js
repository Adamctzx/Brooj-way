// =====================================================================
// BoRooJ Way — مرشّح الألفاظ غير اللائقة
// ---------------------------------------------------------------------
// الفلتر القديم كان يبحث عن الكلمة كما هي فقط، فيسهل تجاوزه بأبسط حيلة:
//   "ك ل ب" · "كلـــب" · "كَلْب" · "ك.ل.ب" · "كlب" · "كلبببب"
// هذا الملف يعالج ذلك بتطبيع النص أولاً ثم المطابقة على نسختين منه.
//
// ⚠️ ملاحظة صريحة على حدود الحماية:
// هذا فحص يجري داخل المتصفح، فيستطيع من يفتح أدوات المطوّر تجاوزه.
// لذلك يبقى زر الحذف السريع بيد المعلم هو خط الدفاع الحقيقي.
// =====================================================================

// ---------------------------------------------------------------------
// 1) التطبيع: توحيد شكل النص قبل المقارنة
// ---------------------------------------------------------------------
export function normalizeText(text) {
    let s = String(text == null ? '' : text);

    // محارف خفية تُستخدم للتحايل (Zero-width + اتجاه النص)
    s = s.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '');

    // التشكيل والتطويل: كَلْــب => كلب
    s = s.replace(/[ً-ٰٕـ]/g, '');

    // توحيد صور الحروف العربية
    s = s.replace(/[أإآٱ]/g, 'ا')
         .replace(/ة/g, 'ه')
         .replace(/ى/g, 'ي')
         .replace(/ؤ/g, 'و')
         .replace(/ئ/g, 'ي')
         .replace(/گ/g, 'ك')
         .replace(/چ/g, 'ج')
         .replace(/پ/g, 'ب')
         .replace(/ڤ/g, 'ف');

    s = s.toLowerCase();

    // أرقام الدردشة العربية (Arabizi): 3=ع  7=ح  5=خ  9=ص  8=ق  6=ط  4=ش  2=ا
    s = s.replace(/3/g, 'ع').replace(/7/g, 'ح').replace(/5/g, 'خ')
         .replace(/9/g, 'ص').replace(/8/g, 'ق').replace(/6/g, 'ط')
         .replace(/4/g, 'ش').replace(/2/g, 'ا');

    // الأرقام العربية الهندية => لاتينية (قبل تقليص التكرار)
    s = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

    // تقليص الحروف المكرّرة: كلبببب => كلب
    s = s.replace(/(.)\1+/g, '$1');

    return s.trim();
}

// النسخة "المضغوطة": حروف فقط بلا فراغات أو رموز — تكشف "ك ل ب" و "ك.ل.ب"
export function squeezeText(text) {
    return normalizeText(text).replace(/[^a-zء-ي]/g, '');
}

// ---------------------------------------------------------------------
// تطبيع خاص بالإنجليزية (Leetspeak)
// ---------------------------------------------------------------------
// لا يمكن دمجه مع التطبيع العربي لأن الأرقام تتعارض:
// الرقم 4 يعني "ش" في الدردشة العربية، ويعني "a" في الإنجليزية.
// لذلك نبني نسخة ثانية ونفحص الكلمات الإنجليزية عليها.
// ---------------------------------------------------------------------
export function normalizeLatin(text) {
    let s = String(text == null ? '' : text).toLowerCase();
    s = s.replace(/[​-‏﻿]/g, '');
    s = s.replace(/1/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e')
         .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
         .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');
    s = s.replace(/(.)\1+/g, '$1');
    return s.trim();
}

export function squeezeLatin(text) {
    return normalizeLatin(text).replace(/[^a-z]/g, '');
}

// ---------------------------------------------------------------------
// 2) قوائم الكلمات
// ---------------------------------------------------------------------
// المستوى الأول: ألفاظ فاحشة تُمنع في أي سياق.
// ⚠️ هذه القائمة موجودة لغرض الحجب فقط.
export const SEVERE_WORDS = [
    // عربي فصيح ودارج
    'زب', 'زبي', 'كس', 'كسم', 'كسمك', 'كسمين', 'طيز', 'طياز', 'خول', 'خوال',
    'شرموط', 'شراميط', 'قحبه', 'قحاب', 'عاهره', 'عواهر', 'منيوك', 'متناك',
    'نيك', 'ينيك', 'انيك', 'زانيه', 'لوطي', 'سحاق', 'دياثه', 'ديوث',
    'خرا', 'خره', 'زفت', 'معرص', 'قواد', 'مخنث', 'شاذ جنسي',
    'يلعن دينك', 'يلعن ابوك', 'يلعن امك', 'العن دينك', 'كافر يا',
    'امك', 'اختك', 'يخرب بيتك', 'ابن الكلب', 'ابن الحرام', 'ولد الحرام',
    // إنجليزي
    'fuck', 'fck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'pussy',
    'cunt', 'whore', 'slut', 'nigga', 'nigger', 'porn', 'sex', 'xxx'
];

// المستوى الثاني: ألفاظ تُهين حين تُوجَّه لشخص، لكنها قد ترد في سياق علمي
// سليم (كذكر الكلب في حديث الصيد، أو الحمار في قصص القرآن).
// لذلك تُمنع فقط حين تكون موجّهة أو وحدها، لا كلما وردت.
export const INSULT_WORDS = [
    'كلب', 'كلاب', 'حمار', 'حمير', 'بهيمه', 'حيوان', 'خنزير',
    'غبي', 'غبيه', 'اغبياء', 'بليد', 'احمق', 'حمقاء', 'مغفل',
    'تافه', 'تفه', 'حقير', 'سافل', 'وسخ', 'قذر', 'نجس',
    'خرع', 'جبان', 'فاشل', 'زباله', 'قرد', 'بغل', 'ثور',
    'idiot', 'stupid', 'fool', 'loser', 'ugly', 'dumb'
];

// كلمات تدل على أن اللفظ موجَّه لشخص (يا كلب / انت غبي)
const ADDRESS_MARKERS = ['يا', 'انت', 'انتي', 'انته', 'انتم', 'يابن', 'يبن', 'you', 'ur'];

// ---------------------------------------------------------------------
// 3) الفحص
// ---------------------------------------------------------------------
// يُرجع: { clean, reason, matched }
//   reason: 'severe' | 'insult' | null
// ---------------------------------------------------------------------
export function checkContent(text) {
    const spaced     = normalizeText(text);
    const squeezed   = squeezeText(text);
    const latin      = normalizeLatin(text);
    const latinSqz   = squeezeLatin(text);

    // (أ) الألفاظ الفاحشة: تُمنع أينما وردت، وتُفحص على النسخ الأربع
    for (const w of SEVERE_WORDS) {
        const nw = normalizeText(w);
        const sw = squeezeText(w);
        const lw = normalizeLatin(w);
        const lsw = squeezeLatin(w);

        if (sw && (squeezed.includes(sw) || spaced.includes(nw))) {
            return { clean: false, reason: 'severe', matched: w };
        }
        // الكلمات الإنجليزية تُفحص أيضاً بعد تطبيع Leetspeak (sh1t / f@ck)
        if (lsw && lsw.length >= 3 && /^[a-z]+$/.test(lsw) &&
            (latinSqz.includes(lsw) || latin.includes(lw))) {
            return { clean: false, reason: 'severe', matched: w };
        }
    }

    // (ب) ألفاظ الإهانة: تُمنع إن كانت موجّهة لشخص أو وحدها
    const words = spaced.split(/\s+/).filter(Boolean);
    const markerIdx = words
        .map((w, i) => ADDRESS_MARKERS.includes(w.replace(/^(و|ف)/, '')) ? i : -1)
        .filter(i => i >= 0);

    for (const w of INSULT_WORDS) {
        const nw = normalizeText(w);
        if (!nw) continue;

        // الرسالة كلها كلمة الإهانة
        if (spaced === nw) return { clean: false, reason: 'insult', matched: w };

        // صيغة ملتصقة بعد تفكيك الحروف: "يا ك ل ب" => "ياكلب"
        for (const m of ADDRESS_MARKERS) {
            const glued = squeezeText(m) + squeezeText(w);
            if (glued.length > 3 && squeezed.includes(glued)) {
                return { clean: false, reason: 'insult', matched: w };
            }
        }

        for (let i = 0; i < words.length; i++) {
            // نطابق الكلمة مع تجاهل أدوات التعريف واللواصق البسيطة
            const bare = words[i].replace(/^(ال|و|ف|ب|ل|ك)+/, '');
            if (bare !== nw && words[i] !== nw) continue;

            // أداة نداء أو ضمير مخاطب على مسافة كلمتين كحدّ أقصى.
            // المسافة القصيرة مقصودة: تلتقط "انت غبي" و "you are stupid"
            // وتترك "يا أستاذ ما حكم الكلب؟" تمرّ لأن السؤال علمي لا إهانة.
            if (markerIdx.some(mi => mi < i && (i - mi) <= 2)) {
                return { clean: false, reason: 'insult', matched: w };
            }

            // صيغة "يا+كلمة" ملتصقة
            if (/^يا/.test(words[i]) && words[i].slice(2) === nw) {
                return { clean: false, reason: 'insult', matched: w };
            }
        }
    }

    return { clean: true, reason: null, matched: null };
}

// ---------------------------------------------------------------------
// 4) رسالة تربوية مناسبة لكل حالة
// ---------------------------------------------------------------------
export function filterMessage(result) {
    if (!result || result.clean) return '';
    if (result.reason === 'severe') {
        return '🚫 لا يمكن نشر هذه المشاركة.\n\n' +
               'تحتوي على لفظ غير لائق. المنصة أكاديمية ويقرؤها معلمك وزملاؤك، ' +
               'فاختر كلمات تليق بطالب علم.';
    }
    return '⚠️ لا يمكن نشر هذه المشاركة.\n\n' +
           'يبدو أنها تحتوي على إهانة موجّهة لشخص. ' +
           'عبّر عن رأيك بأدب دون التعرّض لأحد.';
}
