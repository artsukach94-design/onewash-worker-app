// ============================================================
// НАЛАШТУВАННЯ SUPABASE — ОБОВ'ЯЗКОВО ЗАМІНІТЬ ЦІ ДВА РЯДКИ
// Знайти значення: Supabase → ваш проєкт → Settings → API
//   SUPABASE_URL     = "Project URL"
//   SUPABASE_ANON_KEY = "anon public" ключ
// ============================================================
const SUPABASE_URL = 'https://elrmeekxaxcyxdyzqtzg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscm1lZWt4YXhjeXhkeXpxdHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDA4MTIsImV4cCI6MjA5OTE3NjgxMn0.XfLB_ZPMbnnlK-TJX05vVipk6XxZPZlq95sbIAwDwFs';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Повертає сесію користувача (null, якщо не залогінений)
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Логін email + пароль
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// Повертає рядок з таблиці staff, прив'язаний до залогіненого користувача
export async function getCurrentStaff() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();
  if (error) {
    console.error('Не вдалося знайти профіль мийника:', error.message);
    return null;
  }
  return data;
}

// Перевіряє сесію; якщо немає — показує форму логіну, якщо є — ховає її
// і викликає onLoggedIn(staff). Викликається на кожній сторінці.
export async function initPage(onLoggedIn) {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  const session = await getSession();
  if (!session) {
    loginView.style.display = 'block';
    appView.style.display = 'none';
    return;
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    appView.innerHTML = '<p class="empty-state">Цей акаунт не прив\'язаний до жодного профілю мийника. Зверніться до адміністратора.</p>';
    loginView.style.display = 'none';
    appView.style.display = 'block';
    return;
  }

  loginView.style.display = 'none';
  appView.style.display = 'block';

  const nameEl = document.getElementById('staff-name');
  if (nameEl) nameEl.textContent = staff.full_name;
  const initialsEl = document.getElementById('staff-initials');
  if (initialsEl) {
    const parts = staff.full_name.split(' ');
    initialsEl.textContent = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }

  await onLoggedIn(staff);
}

// Підключає обробник форми логіну (форма з id="login-form" має бути на сторінці)
export function wireLoginForm(onSuccess) {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error');
    errorBox.textContent = '';
    try {
      await login(email, password);
      window.location.reload();
    } catch (err) {
      errorBox.textContent = 'Невірний email або пароль';
    }
  });
}

export function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayShort(date) {
  return date.toLocaleDateString('uk-UA', { weekday: 'short' }).replace('.', '');
}
