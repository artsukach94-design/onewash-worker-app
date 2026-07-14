// ============================================================
// Ті самі дані Supabase, що й у застосунку мийника
// ============================================================
const SUPABASE_URL = 'https://elrmeekxaxcyxdyzqtzg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscm1lZWt4YXhjeXhkeXpxdHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDA4MTIsImV4cCI6MjA5OTE3NjgxMn0.XfLB_ZPMbnnlK-TJX05vVipk6XxZPZlq95sbIAwDwFs';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Створює новий логін (email+пароль) у Supabase Auth і повертає його User UID.
// Використовує ОКРЕМИЙ тимчасовий клієнт (persistSession:false), щоб не втратити
// сесію адміністратора, який зараз залогінений у цьому вікні браузера.
export async function createAuthUser(email, password) {
  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await tempClient.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Не вдалося створити користувача');
  return data.user.id;
}

export function generatePassword() {
  return Math.random().toString(36).slice(-6) + Math.floor(10 + Math.random() * 90);
}

// Динамічно виставляє назву "{Мийка} Admin", іконку (кастомне лого, якщо є) і favicon
export function setAppIdentity(locationName, logoUrl) {
  const title = locationName ? `${locationName} Admin` : 'Mage Wash Admin';
  document.title = title;

  const iconHref = logoUrl || 'icon-192.png';

  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
  favicon.href = iconHref;

  let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (!appleIcon) { appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; document.head.appendChild(appleIcon); }
  appleIcon.href = iconHref;

  let metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!metaTitle) {
    metaTitle = document.createElement('meta');
    metaTitle.name = 'apple-mobile-web-app-title';
    document.head.appendChild(metaTitle);
  }
  metaTitle.content = title;

  // Динамічний manifest.json (для Android "Встановити застосунок")
  const manifest = {
    name: title,
    short_name: title,
    start_url: 'index.html',
    display: 'standalone',
    background_color: '#0A1E30',
    theme_color: '#0A1E30',
    icons: [
      { src: iconHref, sizes: '192x192', type: 'image/png' },
      { src: logoUrl || 'icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = url;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('washos_location_id');
  window.location.href = 'index.html';
}

export function wireLoginForm() {
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

// Профіль адміністратора, прив'язаний до залогіненого користувача
export async function getCurrentAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();
  if (error) {
    console.error('Профіль адміністратора не знайдено:', error.message);
    return null;
  }
  return data;
}

// Список мийок, доступних цьому адміну (усі — якщо суперадмін)
export async function getAccessibleLocations(admin) {
  if (admin.is_superadmin) {
    const { data, error } = await supabase.from('locations').select('*').order('name');
    if (error) { console.error(error); return []; }
    return data || [];
  }
  const { data, error } = await supabase
    .from('admin_location_access')
    .select('locations(*)')
    .eq('admin_id', admin.id);
  if (error) { console.error(error); return []; }
  return (data || []).map(r => r.locations).filter(Boolean);
}

export function getSelectedLocationId() {
  return localStorage.getItem('washos_location_id');
}
export function setSelectedLocationId(id) {
  localStorage.setItem('washos_location_id', id);
}

// Головна функція ініціалізації сторінки адмінки.
// onReady(admin, locations, selectedLocationId) викликається,
// коли адмін залогінений і мийку для перегляду обрано.
export async function initAdminPage(onReady) {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  const session = await getSession();
  if (!session) {
    loginView.style.display = 'block';
    appView.style.display = 'none';
    return;
  }

  const admin = await getCurrentAdmin();
  if (!admin) {
    loginView.style.display = 'none';
    appView.style.display = 'block';
    document.getElementById('page-content').innerHTML =
      '<div class="empty-state">Цей акаунт не має доступу до адмін-панелі. Зверніться до власника платформи.</div>';
    return;
  }

  const locations = await getAccessibleLocations(admin);
  if (locations.length === 0) {
    loginView.style.display = 'none';
    appView.style.display = 'block';
    document.getElementById('page-content').innerHTML =
      '<div class="empty-state">До цього акаунта ще не підключено жодної мийки.</div>';
    return;
  }

  let selectedId = getSelectedLocationId();
  if (!selectedId || !locations.find(l => l.id === selectedId)) {
    selectedId = locations[0].id;
    setSelectedLocationId(selectedId);
  }

  loginView.style.display = 'none';
  appView.style.display = 'block';

  const currentLocation = locations.find(l => l.id === selectedId);
  setAppIdentity(currentLocation?.name, currentLocation?.logo_url);

  const nameEl = document.getElementById('admin-name');
  if (nameEl) nameEl.textContent = admin.is_superadmin ? 'Суперадмін' : 'Адміністратор мийки';

  renderLocationSwitcher(locations, selectedId);

  await onReady(admin, locations, selectedId);
}

function renderLocationSwitcher(locations, selectedId) {
  const box = document.getElementById('loc-switcher');
  if (!box) return;

  if (locations.length === 1) {
    box.textContent = locations[0].name;
    return;
  }

  box.innerHTML = '';
  const select = document.createElement('select');
  locations.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    if (l.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    setSelectedLocationId(select.value);
    window.location.reload();
  });
  box.appendChild(select);
}

export function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function subscribeToTable(channelName, table, filter, onChange) {
  return supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange)
    .subscribe();
}
