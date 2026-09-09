let currentIndex = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
let slideInterval;

function showSlide(index) {
    if (index >= slides.length) currentIndex = 0;
    if (index < 0) currentIndex = slides.length - 1;

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
}

function nextSlide() {
    currentIndex++;
    showSlide(currentIndex);
}

function changeSlide(direction) {
    currentIndex += direction;
    showSlide(currentIndex);
    resetInterval(); 
}

function setSlide(index) {
    currentIndex = index;
    showSlide(currentIndex);
    resetInterval();
}

function startInterval() {
    slideInterval = setInterval(nextSlide, 2000); 
}

function resetInterval() {
    clearInterval(slideInterval);
    startInterval();
}

startInterval();

// --- VIEW TOGGLING LOGIC (Sign Up <-> Log In) ---
const signupSection = document.getElementById('signup-section');
const loginSection = document.getElementById('login-section');
const showLoginBtn = document.getElementById('show-login');
const showSignupBtn = document.getElementById('show-signup');
const mainLayout = document.getElementById('mainLayout'); 

// WHEN LOG IN IS CLICKED: Photos move to the LEFT, Form moves to the RIGHT
showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    mainLayout.classList.add('reverse-layout');
});

// WHEN SIGN UP IS CLICKED: Form stays on the LEFT, Photos stay on the RIGHT
showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginSection.classList.add('hidden');
    signupSection.classList.remove('hidden');
    mainLayout.classList.remove('reverse-layout');
});

// --- SHOW/HIDE PASSWORD TOGGLE LOGIC ---
const togglePasswordSpans = document.querySelectorAll('.show-password');

togglePasswordSpans.forEach(span => {
    span.addEventListener('click', function() {
        const input = this.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            this.textContent = 'Hide Password';
        } else {
            input.type = 'password';
            this.textContent = 'Show Password';
        }
    });
});

// --- FORM VALIDATION & BACKEND DATABASE INTEGRATION ---
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneRegex = /^(09\d{9}|\+639\d{9})$/;

// 1. Sign Up Submission (Saves to SQLite Database)
const signupForm = document.getElementById('signupForm');
const successScreen = document.getElementById('successScreen');
const errorMessage = document.getElementById('error-message'); 
const emailInput = document.getElementById('email');

emailInput.addEventListener('input', () => errorMessage.classList.add('hidden'));
document.getElementById('password').addEventListener('input', () => errorMessage.classList.add('hidden'));
document.getElementById('confirm-password').addEventListener('input', () => errorMessage.classList.add('hidden'));

signupForm.addEventListener('submit', async function(event) {
    event.preventDefault(); 
    
    const fullname = document.getElementById('fullname').value.trim();
    const emailVal = emailInput.value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!emailRegex.test(emailVal) && !phoneRegex.test(emailVal)) {
        errorMessage.textContent = "Invalid credentials!";
        errorMessage.classList.remove('hidden');
        return;
    }

    if (password !== confirmPassword) {
        errorMessage.textContent = "Passwords do not match!"; 
        errorMessage.classList.remove('hidden'); 
        return; 
    }

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, email: emailVal, password })
        });

        const result = await response.json();

        if (result.success) {
            errorMessage.classList.add('hidden');
            // Hide the main form layout and show your custom success card screen!
            mainLayout.classList.add('hidden');
            successScreen.classList.remove('hidden');
        } else {
            errorMessage.textContent = result.message;
            errorMessage.classList.remove('hidden');
        }
    } catch (err) {
        errorMessage.textContent = "Connection error. Make sure server is running.";
        errorMessage.classList.add('hidden');
    }
});

// 2. Log In Submission (Verifies with Database & Opens Dashboard)
const loginForm = document.getElementById('loginForm');
const loginErrorMessage = document.getElementById('login-error-message');
const loginEmailInput = document.getElementById('login-email');

loginEmailInput.addEventListener('input', () => loginErrorMessage.classList.add('hidden'));
document.getElementById('login-password').addEventListener('input', () => loginErrorMessage.classList.add('hidden'));

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const emailVal = loginEmailInput.value.trim();
    const password = document.getElementById('login-password').value;

    if (!emailRegex.test(emailVal) && !phoneRegex.test(emailVal)) {
        loginErrorMessage.textContent = "Invalid credentials!";
        loginErrorMessage.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal, password })
        });

        const result = await response.json();

        if (result.success) {
            loginErrorMessage.classList.add('hidden');
            // Redirect straight to your group's custom dashboard!
            window.location.href = '/dashboard.html';
        } else {
            loginErrorMessage.textContent = result.message;
            loginErrorMessage.classList.remove('hidden');
        }
    } catch (err) {
        loginErrorMessage.textContent = "Connection error. Make sure server is running.";
        loginErrorMessage.classList.remove('hidden');
    }
});