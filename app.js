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
  window.location.href = 'worker.html';
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
    if (staff.photo_url) {
      initialsEl.innerHTML = `<img src="${staff.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      const parts = staff.full_name.split(' ');
      initialsEl.textContent = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    }
  }

  // Назва і іконка на головному екрані — підтягуємо мийку (і її лого, якщо адмін завантажив)
  const { data: location } = await supabase
    .from('locations').select('name, logo_url').eq('id', staff.location_id).maybeSingle();
  setAppIdentity(location?.name, location?.logo_url);

  await onLoggedIn(staff);
}

// Динамічно виставляє назву мийки та іконку (кастомне лого, якщо адмін його завантажив)
// для favicon і "Додати на головний екран"
function setAppIdentity(locationName, logoUrl) {
  const title = locationName || 'One Wash';
  document.title = title;

  const iconHref = logoUrl || 'icon-v2-192.png';

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

  const manifest = {
    name: title,
    short_name: title,
    start_url: 'worker.html',
    display: 'standalone',
    background_color: '#0A1E30',
    theme_color: '#0A1E30',
    icons: [
      { src: iconHref, sizes: '192x192', type: 'image/png' },
      { src: logoUrl || 'icon-v2-512.png', sizes: '512x512', type: 'image/png' }
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

// Повний перелік послуг запису: основна (wash_types) + всі додаткові
// (booking_extras → extra_services.name). Раніше скрізь показувалась лише
// основна послуга — мийник не бачив, що ще треба зробити (хімчистка сидіння,
// видалення плям тощо), доки не відкриє сам запис.
// Очікує booking із select-запиту, що містить wash_types(name) і
// booking_extras(extra_services(name)).
export function formatServicesLabel(booking) {
  const main = booking.wash_types?.name || 'Послугу не вказано';
  const extras = (booking.booking_extras || [])
    .map((be) => be.extra_services?.name)
    .filter(Boolean);
  return extras.length ? `${main} + ${extras.join(', ')}` : main;
}

// Підписка на зміни в таблиці в реальному часі (Supabase Realtime).
// onChange викликається при будь-якій вставці/оновленні/видаленні рядка,
// що відповідає фільтру. Найпростіший підхід — просто перезавантажити дані.
export function subscribeToTable(channelName, table, filter, onChange) {
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange)
    .subscribe();
  return channel;
}

// ============================================================
// PUSH-СПОВІЩЕННЯ
// ============================================================

// Публічний VAPID-ключ (не секретний, безпечно тримати в коді фронтенду)
const VAPID_PUBLIC_KEY = 'BGn0uHVbBekOFhfzogg8ciGvlOZ_LHLe3JsrEAUOqCpXQR4W3evzojpcUF9r1AEslpsP3XNCfbX6PVnvKCAPJp0';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// iOS вимагає, щоб застосунок був доданий на головний екран (standalone),
// інакше push просто не працюватиме, навіть якщо дозвіл надано
export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export async function getPushSubscriptionStatus() {
  if (!isPushSupported()) return 'unsupported';
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return 'not-subscribed';
  const sub = await registration.pushManager.getSubscription();
  return sub ? 'subscribed' : 'not-subscribed';
}

export async function enablePushNotifications(staffId) {
  if (!isPushSupported()) {
    throw new Error('Цей браузер не підтримує push-сповіщення');
  }
  if (isIos() && !isStandaloneApp()) {
    throw new Error('На iPhone спочатку додайте застосунок на головний екран, потім увімкніть сповіщення');
  }

  const registration = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Дозвіл на сповіщення не надано');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const subJson = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    staff_id: staffId,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth: subJson.keys.auth
  }, { onConflict: 'endpoint' });
  if (error) throw error;

  return true;
}

export async function disablePushNotifications(staffId) {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  }
}

// ==== ВНУТРІШНІ КОМЕНТАРІ ДО ЗАПИСУ (бачить лише персонал, не клієнт) ====
// Мийник бачить головний коментар адміна й усі відповіді, і може лише
// додати СВОЮ відповідь — створити чи редагувати головний коментар не може
// (заборонено на рівні БД, тут просто немає такої форми).
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

let commentsCurrentStaff = null;

function ensureCommentsModal() {
  if (document.getElementById('bc-modal')) return;
  const div = document.createElement('div');
  div.id = 'bc-modal';
  div.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(10,30,48,0.45);align-items:center;justify-content:center;z-index:50;padding:20px;';
  div.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:20px;width:min(460px,92vw);max-height:85vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:15px;">Коментарі до запису</h3>
        <span id="bc-close" style="cursor:pointer;font-size:20px;color:#93A2AF;line-height:1;">×</span>
      </div>
      <div id="bc-list"></div>
      <div id="bc-reply-form" style="margin-top:14px;display:none;">
        <textarea id="bc-reply-text" placeholder="Написати відповідь..." style="width:100%;min-height:60px;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;"></textarea>
        <button class="primary" id="bc-reply-submit" style="margin-top:8px;padding:8px 16px;border-radius:8px;border:none;">Відповісти</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById('bc-close').addEventListener('click', () => { div.style.display = 'none'; });
  div.addEventListener('click', (e) => { if (e.target === div) div.style.display = 'none'; });

  document.getElementById('bc-reply-submit').addEventListener('click', async () => {
    const bookingId = div.dataset.bookingId;
    const rootId = div.dataset.rootId;
    const text = document.getElementById('bc-reply-text').value.trim();
    if (!text || !rootId || !commentsCurrentStaff) return;
    const { error } = await supabase.from('booking_comments').insert({
      booking_id: bookingId, parent_id: rootId, author_kind: 'staff',
      author_staff_id: commentsCurrentStaff.id,
      author_name: commentsCurrentStaff.full_name || 'Мийник',
      body: text,
    });
    if (error) { console.error(error); alert('Не вдалося додати відповідь'); return; }
    document.getElementById('bc-reply-text').value = '';
    await openBookingComments(bookingId, commentsCurrentStaff);
  });
}

function renderBookingComments(comments) {
  const modal = document.getElementById('bc-modal');
  const root = comments.find(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  const list = document.getElementById('bc-list');
  const fmtDate = (iso) => new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (!root) {
    list.innerHTML = '<p style="font-size:13px;color:#5B6B7C;">Адмін ще не залишив коментаря до цього запису.</p>';
    document.getElementById('bc-reply-form').style.display = 'none';
    return;
  }

  modal.dataset.rootId = root.id;
  document.getElementById('bc-reply-form').style.display = 'block';

  let html = `
    <div style="background:#FFF8E6;border-left:3px solid #129C90;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:11.5px;color:#5B6B7C;margin-bottom:3px;">${escapeHtml(root.author_name)} (адмін) · ${fmtDate(root.created_at)}</div>
      <div style="font-size:13.5px;white-space:pre-wrap;">${escapeHtml(root.body)}</div>
    </div>
  `;

  if (replies.length === 0) {
    html += '<p style="font-size:12.5px;color:#93A2AF;margin:0 0 8px;">Ще немає відповідей</p>';
  } else {
    html += replies.map(r => `
      <div style="margin:0 0 8px 16px;padding:8px 12px;background:#F5F6F8;border-radius:8px;">
        <div style="font-size:11px;color:#5B6B7C;margin-bottom:2px;">${escapeHtml(r.author_name)}${r.author_kind === 'staff' ? ' (мийник)' : ' (адмін)'} · ${fmtDate(r.created_at)}</div>
        <div style="font-size:13px;white-space:pre-wrap;">${escapeHtml(r.body)}</div>
      </div>
    `).join('');
  }

  list.innerHTML = html;
}

// staff — рядок з getCurrentStaff().
export async function openBookingComments(bookingId, staff) {
  ensureCommentsModal();
  commentsCurrentStaff = staff;
  const modal = document.getElementById('bc-modal');
  modal.dataset.bookingId = bookingId;
  modal.style.display = 'flex';
  document.getElementById('bc-list').innerHTML = '<p style="font-size:13px;color:#5B6B7C;">Завантаження...</p>';

  const { data, error } = await supabase
    .from('booking_comments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById('bc-list').innerHTML = '<p style="font-size:13px;color:#D64545;">Не вдалося завантажити коментарі</p>';
    return;
  }
  renderBookingComments(data || []);
}
