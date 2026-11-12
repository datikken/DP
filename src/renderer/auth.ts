import type { AuthResult } from '../types';

type Mode = 'login' | 'register';

let mode: Mode = 'login';

const tabLogin = document.getElementById('tab-login') as HTMLButtonElement;
const tabRegister = document.getElementById('tab-register') as HTMLButtonElement;
const form = document.getElementById('auth-form') as HTMLFormElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const message = document.getElementById('message') as HTMLParagraphElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const togglePasswordBtn = document.getElementById('toggle-password') as HTMLButtonElement;
const eyeOpen = document.getElementById('eye-open') as HTMLElement;
const eyeClosed = document.getElementById('eye-closed') as HTMLElement;

const ACTIVE_TAB = [
  'flex-1', 'rounded-lg', 'bg-brand', 'px-3', 'py-2', 'text-sm',
  'font-semibold', 'text-white', 'transition',
];
const INACTIVE_TAB = [
  'flex-1', 'rounded-lg', 'px-3', 'py-2', 'text-sm',
  'font-semibold', 'text-slate-400', 'transition', 'hover:text-slate-200',
];

function applyTabClasses(isLogin: boolean): void {
  tabLogin.className = (isLogin ? ACTIVE_TAB : INACTIVE_TAB).join(' ');
  tabRegister.className = (!isLogin ? ACTIVE_TAB : INACTIVE_TAB).join(' ');
}

function setMessage(text: string, type: 'error' | 'success' | '' = ''): void {
  message.textContent = text;
  const base = 'mt-3.5 min-h-[20px] text-center text-sm';
  const color =
    type === 'error'
      ? 'text-red-400'
      : type === 'success'
      ? 'text-green-400'
      : 'text-slate-200';
  message.className = `${base} ${color}`;
}

function setMode(next: Mode): void {
  mode = next;
  const isLogin = mode === 'login';
  applyTabClasses(isLogin);
  submitBtn.textContent = isLogin ? 'Login' : 'Create Account';
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  setMessage('');
}

function goToMain(username: string): void {
  window.location.href = 'links.html?user=' + encodeURIComponent(username);
}

// If a session is already remembered (the app was reopened while sitting in the
// tray), skip the sign-in page and go straight to the app.
async function redirectIfSignedIn(): Promise<void> {
  try {
    const session = await window.auth.session();
    if (session) {
      goToMain(session.username);
    }
  } catch (err) {
    // Not fatal: fall through to the sign-in form.
    console.error(err);
  }
}

tabLogin.addEventListener('click', () => setMode('login'));
tabRegister.addEventListener('click', () => setMode('register'));

// Show / hide password toggle
togglePasswordBtn.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  eyeOpen.classList.toggle('hidden', show);
  eyeClosed.classList.toggle('hidden', !show);
  togglePasswordBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setMessage('Please fill in both fields.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setMessage('');

  try {
    const res: AuthResult =
      mode === 'login'
        ? await window.auth.login(username, password)
        : await window.auth.register(username, password);

    if (res.ok) {
      if (mode === 'register') {
        setMessage('Account created! Logging you in...', 'success');
      }
      goToMain(res.user.username);
    } else {
      setMessage(res.error || 'Something went wrong.', 'error');
    }
  } catch (err) {
    setMessage('Something went wrong. Please try again.', 'error');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});

// Initialise tab styling
applyTabClasses(true);

// Auto-resume a remembered session (see redirectIfSignedIn).
void redirectIfSignedIn();
