// جلب عناصر الواجهة من ملف index.html
const emailField = document.getElementById('email');
const passwordField = document.getElementById('password');
const errorDisplay = document.getElementById('auth-error');

const signupBtn = document.getElementById('signup-btn');
const signinBtn = document.getElementById('signin-btn');
const signoutBtn = document.getElementById('signout-btn');

const authUI = document.getElementById('auth-ui');
const protectedContent = document.getElementById('protected-content');


// **********************************************
// أ. دالة تسجيل مستخدم جديد (Sign Up)
// **********************************************
function signUp() {
    const email = emailField.value;
    const password = passwordField.value;

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            errorDisplay.textContent = "تم إنشاء المستخدم بنجاح! يمكنك الآن تسجيل الدخول.";
        })
        .catch((error) => {
            errorDisplay.textContent = 'خطأ في التسجيل: ' + error.message;
            console.error("Error signing up:", error);
        });
}


// **********************************************
// ب. دالة تسجيل الدخول (Sign In)
// **********************************************
function signIn() {
    const email = emailField.value;
    const password = passwordField.value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            errorDisplay.textContent = "تم تسجيل الدخول بنجاح!";
        })
        .catch((error) => {
            errorDisplay.textContent = 'خطأ في تسجيل الدخول: ' + error.message;
            console.error("Error signing in:", error);
        });
}


// **********************************************
// ج. دالة تسجيل الخروج (Sign Out)
// **********************************************
function signOutUser() {
    auth.signOut().then(() => {
        errorDisplay.textContent = "تم تسجيل الخروج بنجاح.";
    }).catch((error) => {
        errorDisplay.textContent = 'خطأ في تسجيل الخروج: ' + error.message;
    });
}


// **********************************************
// د. وظيفة تأمين المحتوى ومراقبة الحالة (الأهم)
// **********************************************
auth.onAuthStateChanged((user) => {
    if (user) {
        // المستخدم قام بتسجيل الدخول: إظهار المحتوى المحمي وإخفاء واجهة الدخول
        authUI.style.display = 'none'; 
        protectedContent.style.display = 'block'; 
        errorDisplay.textContent = ''; // مسح أي رسائل خطأ سابقة
        console.log("User logged in:", user.uid);
    } else {
        // المستخدم غير مسجل الدخول: إظهار واجهة الدخول وإخفاء المحتوى
        authUI.style.display = 'block'; 
        protectedContent.style.display = 'none'; 
    }
});


// ربط الدوال بالأزرار باستخدام Event Listeners
signupBtn.addEventListener('click', signUp);
signinBtn.addEventListener('click', signIn);
signoutBtn.addEventListener('click', signOutUser);