// =====================
// Состояния
// =====================
function safeParseUser() {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch {
    localStorage.removeItem('user');
    return null;
  }
}

const state = {
  token: localStorage.getItem('token') || null,
  user: safeParseUser(),
  currentPage: 'home'
};

// =====================
// API
// =====================
const API_BASE = '/api';

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch {
        throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Ответ начинается с: ${text.slice(0, 60)}`);
      }
    }

    if (!res.ok) {
      throw new Error((data && data.error) || `Ошибка ${res.status}`);
    }

    return data;
  } catch (err) {
    if (err.message === 'Требуется авторизация' || err.message === 'Недействительный токен') {
      logout();
    }
    throw err;
  }
}

// =====================
// Аунтефикация
// =====================
function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  updateHeader();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateHeader();
  navigate('home');
  showToast('Вы вышли из системы', 'success');
}

function updateHeader() {
  const authBtns = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const userDisplay = document.getElementById('user-display');

  if (state.user) {
    authBtns.classList.add('hidden');
    userMenu.classList.remove('hidden');
    userDisplay.textContent = state.user.username;
  } else {
    authBtns.classList.remove('hidden');
    userMenu.classList.add('hidden');
  }
}

// =====================
// Навигация
// =====================
const PAGE_TITLES = {
  home: 'Круговые шахматы',
  login: 'Вход',
  register: 'Регистрация',
  games: 'Партии',
  'game-detail': 'Партия',
  'game-create': 'Новая партия',
  'game-edit': 'Редактирование партии',
  players: 'Игроки',
  'player-detail': 'Профиль игрока',
  'player-edit': 'Редактирование игрока',
  profile: 'Мой профиль',
  bots: 'Боты',
  'bot-detail': 'Бот',
  'bot-create': 'Новый бот',
  'bot-edit': 'Редактирование бота',
  'status-history': 'История статусов',
  stats: 'Статистика',
  'import-export': 'Импорт/Экспорт'
};

function buildHash(page, params = {}) {
  switch (page) {
    case 'game-detail': return `game/${params.id}`;
    case 'game-edit': return `game-edit/${params.id}`;
    case 'player-detail': return `player/${params.id}`;
    case 'player-edit': return `player-edit/${params.id}`;
    case 'bot-detail': return `bot/${params.id}`;
    case 'bot-edit': return `bot-edit/${params.id}`;
    case 'status-history': return `status-history/${params.type}/${params.id}`;
    default: return page;
  }
}

function parseHash(hash) {
  const path = (hash || '').replace(/^#/, '');
  const [base, queryString] = path.split('?');
  const parts = base.split('/');
  switch (parts[0]) {
    case 'game': return { page: 'game-detail', params: { id: parts[1] } };
    case 'game-edit': return { page: 'game-edit', params: { id: parts[1] } };
    case 'player': return { page: 'player-detail', params: { id: parts[1] } };
    case 'player-edit': return { page: 'player-edit', params: { id: parts[1] } };
    case 'bot': return { page: 'bot-detail', params: { id: parts[1] } };
    case 'bot-edit': return { page: 'bot-edit', params: { id: parts[1] } };
    case 'status-history': return { page: 'status-history', params: { type: parts[1], id: parts[2] } };
    case 'game-create': return { page: 'game-create', params: {} };
    case 'bot-create': return { page: 'bot-create', params: {} };
    case 'login': return { page: 'login', params: {} };
    case 'register': return { page: 'register', params: {} };
    case 'profile': return { page: 'profile', params: {} };
    case 'import-export': return { page: 'import-export', params: {} };
    case 'stats': return { page: 'stats', params: {} };
    case 'games': return { page: 'games', params: { query: queryString || '' } };
    case 'players': return { page: 'players', params: { query: queryString || '' } };
    case 'bots': return { page: 'bots', params: { query: queryString || '' } };
    default: return { page: 'home', params: {} };
  }
}

function navigate(page, params = {}, updateHash = true) {
  state.currentPage = page;
  state.pageParams = params;

  if (updateHash) {
    const hash = '#' + buildHash(page, params);
    if (hash !== window.location.hash) {
      window.history.pushState(null, '', hash);
    }
  }

  const title = PAGE_TITLES[page] || 'Круговые шахматы';
  document.title = title + (title !== 'Круговые шахматы' ? ' — Круговые шахматы' : '');

  // Обновляем активную кнопку навигации
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';

  switch (page) {
    case 'home': renderHome(); break;
    case 'login': renderLogin(); break;
    case 'register': renderRegister(); break;
    case 'games': renderGames(); break;
    case 'game-detail': renderGameDetail(params.id); break;
    case 'game-create': renderGameCreate(); break;
    case 'players': renderPlayers(); break;
    case 'player-detail': renderPlayerDetail(params.id); break;
    case 'profile': renderPlayerDetail(state.user?.id); break;
    case 'bots': renderBots(); break;
    case 'bot-detail': renderBotDetail(params.id); break;
    case 'bot-create': renderBotCreate(); break;
    case 'bot-edit': renderBotEdit(params.id); break;
    case 'status-history': renderStatusHistory(params.type, params.id); break;
    case 'player-edit': renderPlayerEdit(params.id); break;
    case 'game-edit': renderGameEdit(params.id); break;
    case 'import-export': renderImportExport(); break;
    case 'stats': renderStats(); break;
    default: renderHome();
  }
}

// =====================
// Тост уведомление
// =====================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// =====================
// Helpers
// =====================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function badgeHTML(value, prefix = '') {
  if (!value) return '—';
  const cls = prefix ? `badge-${value}` : `badge-${value}`;
  const labels = {
    active: 'Активен', banned: 'Заблокирован', deleted: 'Удалён',
    draft: 'Черновик', testing: 'Тестирование', disabled: 'Отключён',
    created: 'Создана', in_progress: 'В процессе', completed: 'Завершена',
    abandoned: 'Прервана', paused: 'Пауза',
    hotseat: 'Hotseat', bot: 'Бот',
    checkmate: 'Мат', stalemate: 'Пат', draw: 'Ничья',
    player: 'Игрок'
  };
  return `<span class="badge ${cls}">${labels[value] || value}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =====================
// ELO (шахматная формула)
// =====================
function eloTitleFromValue(elo) {
  if (elo >= 2500) return 'Гроссмейстер';
  if (elo >= 2400) return 'Международный мастер';
  if (elo >= 2200) return 'Мастер ФИДЕ';
  if (elo >= 2000) return 'Кандидат в мастера';
  if (elo >= 1800) return 'Эксперт';
  if (elo >= 1600) return 'Опытный игрок';
  if (elo >= 1400) return 'Уверенный любитель';
  if (elo >= 1200) return 'Любитель';
  return 'Новичок';
}

function formatEloCell(entry) {
  if (!entry) return '—';
  const delta = entry.elo_delta;
  const color = delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted, #888)';
  const sign = delta > 0 ? '+' : '';
  return `<span title="Было ${entry.elo_before}, стало ${entry.elo_after}. Ожидаемый результат по формуле ELO: ${entry.expected_score.toFixed(2)}">
    <strong>${entry.elo_after}</strong>
    <small style="color:${color};font-weight:600;margin-left:4px;">(${sign}${delta})</small>
  </span>`;
}

function paginationHTML(pagination, onPageChange) {
  const { page, pages, total } = pagination;
  if (pages <= 1) return `<div class="pagination"><span class="pagination-info">Всего: ${total}</span></div>`;

  let html = '<div class="pagination">';
  html += `<button onclick="${onPageChange}(1)" ${page === 1 ? 'disabled' : ''}>«</button>`;
  html += `<button onclick="${onPageChange}(${page - 1})" ${page === 1 ? 'disabled' : ''}>‹</button>`;

  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);

  for (let i = start; i <= end; i++) {
    html += `<button onclick="${onPageChange}(${i})" class="${i === page ? 'active' : ''}">${i}</button>`;
  }

  html += `<button onclick="${onPageChange}(${page + 1})" ${page === pages ? 'disabled' : ''}>›</button>`;
  html += `<button onclick="${onPageChange}(${pages})" ${page === pages ? 'disabled' : ''}>»</button>`;
  html += `<span class="pagination-info">Стр. ${page} из ${pages} (${total} записей)</span>`;
  html += '</div>';
  return html;
}

// =====================
// Главная
// =====================
async function renderHome() {
  const main = document.getElementById('main-content');
  let statsHtml = '';

  try {
    const stats = await api('/stats/overview');
    statsHtml = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stats.players}</div><div class="stat-label">Игроков</div></div>
        <div class="stat-card"><div class="stat-value">${stats.bots}</div><div class="stat-label">Ботов</div></div>
        <div class="stat-card"><div class="stat-value">${stats.games}</div><div class="stat-label">Всего партий</div></div>
        <div class="stat-card"><div class="stat-value">${stats.completed_games}</div><div class="stat-label">Завершённых</div></div>
      </div>`;
  } catch { statsHtml = ''; }

  main.innerHTML = `
    <div class="home-hero">
      ${statsHtml}
    </div>

    <div class="home-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px;margin-top:24px;">
      <div class="card">
        <h3 class="card-title">Топ-5 игроков по ELO</h3>
        <div id="home-top-players"><div class="empty-state"><p>Загрузка…</p></div></div>
      </div>
      <div class="card">
        <h3 class="card-title">Последние партии</h3>
        <div id="home-recent-games"><div class="empty-state"><p>Загрузка…</p></div></div>
      </div>
    </div>`;

  loadHomeTopPlayers();
  loadHomeRecentGames();
}

async function loadHomeTopPlayers() {
  const host = document.getElementById('home-top-players');
  if (!host) return;
  try {
    const res = await api('/players?sort_by=stats.elo&sort_dir=desc&limit=5');
    const rows = (res.data || []).map((p, i) => {
      const elo = (p.stats && p.stats.elo) || 0;
      const w = (p.stats && p.stats.wins) || 0;
      const l = (p.stats && p.stats.losses) || 0;
      const d = (p.stats && p.stats.draws) || 0;
      return `
        <tr class="clickable" onclick="navigate('player-detail',{id:'${p._id}'})">
          <td style="width:32px;color:var(--text-light);">${i + 1}</td>
          <td>${escapeHtml(p.username)}</td>
          <td style="font-weight:600;color:var(--primary);">${elo}</td>
          <td><small style="color:var(--text-light);">${w}/${l}/${d}</small></td>
        </tr>`;
    }).join('');
    if (!rows) {
      host.innerHTML = '<div class="empty-state"><p>Игроков пока нет</p></div>';
      return;
    }
    host.innerHTML = `
      <div class="table-container">
        <table>
          <thead><tr><th>#</th><th>Игрок</th><th>ELO</th><th title="Победы / Поражения / Ничьи">В/П/Н</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    host.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadHomeRecentGames() {
  const host = document.getElementById('home-recent-games');
  if (!host) return;
  try {
    const res = await api('/cc/games?limit=5');
    const rows = (res.data || []).map(g => {
      let outcome = '—';
      if (g.winner_id) {
        const winnerName = String(g.winner_id) === String(g.white_id) ? g.white_name : g.black_name;
        outcome = `<span style="color:var(--success);font-weight:600;">${escapeHtml(winnerName || '—')}</span>`;
      } else if (g.result) {
        outcome = `<span style="color:var(--warning);font-weight:600;">${CC_RESULT_LABELS[g.result] || g.result}</span>`;
      }
      return `
        <tr class="clickable" onclick="openCcGame('${g._id}')">
          <td>${ccStatusBadge(g.status)}</td>
          <td>${escapeHtml(g.white_name || '—')} <span style="color:var(--text-light);">vs</span> ${escapeHtml(g.black_name || '—')}</td>
          <td>${outcome}</td>
          <td><small style="color:var(--text-light);">${formatDateShort(g.updated_at)}</small></td>
        </tr>`;
    }).join('');
    if (!rows) {
      host.innerHTML = '<div class="empty-state"><p>Партий пока нет</p></div>';
      return;
    }
    host.innerHTML = `
      <div class="table-container">
        <table>
          <thead><tr><th>Статус</th><th>Участники</th><th>Победитель</th><th>Обновлена</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    host.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

// =====================
// Вход
// =====================
function renderLogin() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2 class="card-title">Вход в систему</h2>
        <form onsubmit="handleLogin(event)">
          <div class="form-group">
            <label>Логин или Email</label>
            <input type="text" class="form-control" id="login-input" placeholder="Введите логин или email" required autofocus>
          </div>
          <div class="form-group">
            <label>Пароль</label>
            <input type="password" class="form-control" id="password-input" placeholder="Введите пароль" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="login-btn">Войти</button>
          </div>
        </form>
        <div class="auth-link">
          Нет аккаунта? <a onclick="navigate('register')">Зарегистрироваться</a>
        </div>
      </div>
    </div>`;
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Вход...';

  try {
    const login = document.getElementById('login-input').value.trim();
    const password = document.getElementById('password-input').value;

    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });

    setAuth(data.token, data.user);
    showToast(`Добро пожаловать, ${data.user.username}!`, 'success');
    navigate('home');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Войти';
  }
}

// =====================
// Регистрация
// =====================
function renderRegister() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="auth-container">
      <div class="card">
        <h2 class="card-title">Регистрация</h2>
        <form onsubmit="handleRegister(event)">
          <div class="form-group">
            <label>Логин</label>
            <input type="text" class="form-control" id="reg-username" placeholder="Минимум 3 символа" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" class="form-control" id="reg-email" placeholder="your@email.com" required>
          </div>
          <div class="form-group">
            <label>Пароль</label>
            <input type="password" class="form-control" id="reg-password" placeholder="Минимум 6 символов" required>
          </div>
          <div class="form-group">
            <label>Подтверждение пароля</label>
            <input type="password" class="form-control" id="reg-password-confirm" placeholder="Повторите пароль" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="reg-btn">Зарегистрироваться</button>
          </div>
        </form>
        <div class="auth-link">
          Уже есть аккаунт? <a onclick="navigate('login')">Войти</a>
        </div>
      </div>
    </div>`;
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  btn.disabled = true;
  btn.textContent = 'Регистрация...';

  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('reg-username').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
        password_confirm: document.getElementById('reg-password-confirm').value
      })
    });

    setAuth(data.token, data.user);
    showToast('Регистрация успешна!', 'success');
    navigate('home');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Зарегистрироваться';
  }
}

// =====================
// Список сессий
// =====================
let gamesFilters = {};
let gamesPage = 1;
let gamesSortBy = 'created_at';
let gamesSortDir = 'desc';

function renderGames() {
  const main = document.getElementById('main-content');
  const f = gamesFilters || {};
  const opt = (v, label) =>
    `<option value="${v}"${f.status === v ? ' selected' : ''}>${label}</option>`;
  const val = (v) => v == null ? '' : escapeHtml(v);
  main.innerHTML = `
    <div class="page-title">
      <span>Партии</span>
      ${state.user ? '<button class="btn btn-primary" onclick="navigate(\'game-create\')">+ Новая партия</button>' : ''}
    </div>

    <div class="filters-panel">
      <div class="filters-toggle" onclick="toggleFilters('games-filters')">
        <h3>Фильтры</h3>
        <span id="games-filters-arrow">▼</span>
      </div>
      <div class="filters-body" id="games-filters" style="display:none;">
        <div class="filters-grid">
          <div class="filter-group">
            <label>Статус</label>
            <select id="gf-status">
              ${opt('', 'Все')}
              ${opt('active', 'Идёт')}
              ${opt('check', 'Шах')}
              ${opt('checkmate', 'Мат')}
              ${opt('stalemate', 'Пат')}
              ${opt('resigned', 'Сдача')}
              ${opt('draw', 'Ничья')}
              ${opt('abandoned', 'Прервана')}
            </select>
          </div>
          <div class="filter-group">
            <label>Участник (имя)</label>
            <input type="text" id="gf-player" placeholder="Поиск по имени..." value="${val(f.player_name)}">
          </div>
          <div class="filter-group">
            <label>Комментарий</label>
            <input type="text" id="gf-comment" placeholder="Поиск в комментариях..." value="${val(f.comment)}">
          </div>
          <div class="filter-group">
            <label>Кол-во ходов</label>
            <div class="filter-range">
              <input type="number" id="gf-moves-min" placeholder="От" min="0" value="${val(f.moves_min)}">
              <input type="number" id="gf-moves-max" placeholder="До" min="0" value="${val(f.moves_max)}">
            </div>
          </div>
          <div class="filter-group">
            <label>Дата создания (от)</label>
            <input type="date" id="gf-date-from" value="${val(f.created_from)}">
          </div>
          <div class="filter-group">
            <label>Дата создания (до)</label>
            <input type="date" id="gf-date-to" value="${val(f.created_to)}">
          </div>
          <div class="filter-group">
            <label>Дата обновления (от)</label>
            <input type="date" id="gf-updated-from" value="${val(f.updated_from)}">
          </div>
          <div class="filter-group">
            <label>Дата обновления (до)</label>
            <input type="date" id="gf-updated-to" value="${val(f.updated_to)}">
          </div>
        </div>
        <div class="filters-actions">
          <button class="btn btn-primary btn-sm" onclick="applyGamesFilters()">Применить</button>
          <button class="btn btn-secondary btn-sm" onclick="resetGamesFilters()">Сбросить</button>
        </div>
      </div>
    </div>

    <div id="games-table-container">
      <div class="loading"><div class="spinner"></div></div>
    </div>`;

  if (Object.values(f).some(v => v)) toggleFilters('games-filters');
  loadGames();
}

function toggleFilters(id) {
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (arrow) arrow.textContent = '▲';
  } else {
    el.style.display = 'none';
    if (arrow) arrow.textContent = '▼';
  }
}

function applyGamesFilters() {
  const v = (id) => (document.getElementById(id)?.value || '').trim();
  gamesFilters = {
    status: v('gf-status'),
    player_name: v('gf-player'),
    comment: v('gf-comment'),
    moves_min: v('gf-moves-min'),
    moves_max: v('gf-moves-max'),
    created_from: v('gf-date-from'),
    created_to: v('gf-date-to'),
    updated_from: v('gf-updated-from'),
    updated_to: v('gf-updated-to')
  };
  gamesPage = 1;
  loadGames();
}

function resetGamesFilters() {
  gamesFilters = {};
  gamesPage = 1;
  renderGames();
}

function changeGamesPage(p) {
  gamesPage = p;
  loadGames();
}

const CC_STATUS_LABELS = {
  active: 'Идёт', check: 'Шах', checkmate: 'Мат', stalemate: 'Пат',
  resigned: 'Сдача', draw: 'Ничья', abandoned: 'Прервана'
};
const CC_RESULT_LABELS = {
  checkmate: 'Мат', stalemate: 'Пат',
  resignation: 'Сдача', draw: 'Ничья', abandoned: 'Прервана'
};
const CC_TERMINAL = ['checkmate', 'stalemate', 'resigned', 'draw', 'abandoned'];

function ccStatusBadge(status) {
  return `<span class="badge badge-${status}">${CC_STATUS_LABELS[status] || status}</span>`;
}

function openCcGame(id) {
  window.location.href = '/chess.html?game=' + id;
}

async function loadGames() {
  const container = document.getElementById('games-table-container');
  if (!container) return;

  const params = new URLSearchParams();
  params.set('page', gamesPage);
  params.set('limit', 15);
  Object.entries(gamesFilters || {}).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });

  try {
    const result = await api(`/cc/games?${params}`);
    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>Партии не найдены</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>Белые</th>
              <th>Чёрные</th>
              <th>Ходов</th>
              <th>Результат</th>
              <th>Очередь</th>
              <th>Создана</th>
              <th>Обновлена</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(g => {
      const terminal = CC_TERMINAL.indexOf(g.status) !== -1;
      let winnerName = '';
      if (g.winner_id) {
        if (String(g.winner_id) === String(g.white_id)) winnerName = g.white_name;
        else if (String(g.winner_id) === String(g.black_id)) winnerName = g.black_name;
      }
      const resultText = g.result
        ? `${CC_RESULT_LABELS[g.result] || g.result}${winnerName ? ' — ' + escapeHtml(winnerName) : ''}`
        : '—';
      const turnText = terminal ? '—' : (g.turn === 'w' ? 'Белые' : 'Чёрные');
      html += `
        <tr class="clickable" onclick="openCcGame('${g._id}')">
          <td>${ccStatusBadge(g.status)}</td>
          <td>${escapeHtml(g.white_name || '—')}</td>
          <td>${escapeHtml(g.black_name || '—')}</td>
          <td>${g.move_number}</td>
          <td>${resultText}</td>
          <td>${turnText}</td>
          <td>${formatDate(g.created_at)}</td>
          <td>${formatDate(g.updated_at)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    html += paginationHTML(result.pagination, 'changeGamesPage');
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Ошибка загрузки: ${escapeHtml(err.message)}</p></div>`;
  }
}

// =====================
// Информация о сессиях
// =====================
async function renderGameDetail(id) {
  const main = document.getElementById('main-content');
  const fromPlayerId = state.pageParams?.fromPlayerId;
  const fromBotId = state.pageParams?.fromBotId;
  try {
    const game = await api(`/games/${id}`);

    const hasMoves = !!(game.moves && game.moves.length > 0);
    const replayHtml = hasMoves ? `
        <div class="card">
          <h3 class="card-title">Просмотр партии</h3>
          <div class="replay-layout">
            <div class="replay-board-wrap">
              <div id="replay-board-host"></div>
              <div class="replay-controls">
                <button class="btn btn-secondary btn-sm" id="replay-first" title="В начало">⏮</button>
                <button class="btn btn-secondary btn-sm" id="replay-prev" title="Шаг назад">‹</button>
                <span class="replay-step-label">
                  Ход
                  <input type="number" id="replay-step-input" min="0" max="${game.moves.length}" value="0" style="width:64px;">
                  / ${game.moves.length}
                </span>
                <button class="btn btn-secondary btn-sm" id="replay-next" title="Шаг вперёд">›</button>
                <button class="btn btn-secondary btn-sm" id="replay-last" title="В конец">⏭</button>
              </div>
              <div class="replay-move-info" id="replay-move-info">Начальная позиция</div>
            </div>
          </div>
        </div>` : '';

    let movesHtml = '';
    if (hasMoves) {
      movesHtml = `
        <div class="card">
          <h3 class="card-title">Ходы (${game.moves.length})</h3>
          <div class="filters-panel" style="margin-bottom:12px;">
            <div class="filters-toggle" onclick="toggleFilters('moves-filters')">
              <span style="font-size:0.9rem;font-weight:500;">Фильтр ходов</span>
              <span id="moves-filters-arrow">▼</span>
            </div>
            <div class="filters-body" id="moves-filters" style="display:none;">
              <div class="filters-grid">
                <div class="filter-group">
                  <label>Игрок</label>
                  <input type="text" id="mf-player" placeholder="Имя игрока...">
                </div>
                <div class="filter-group">
                  <label>Фигура</label>
                  <input type="text" id="mf-piece" placeholder="pawn, rook...">
                </div>
                <div class="filter-group">
                  <label>Ход №</label>
                  <div class="filter-range">
                    <input type="number" id="mf-move-min" placeholder="От" min="1">
                    <input type="number" id="mf-move-max" placeholder="До" min="1">
                  </div>
                </div>
                <div class="filter-group">
                  <label>Только взятия</label>
                  <select id="mf-captured">
                    <option value="">Все</option>
                    <option value="yes">Только взятия</option>
                    <option value="no">Без взятий</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label>Шах</label>
                  <select id="mf-check">
                    <option value="">Все</option>
                    <option value="yes">Только шахи</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label>Рокировка</label>
                  <select id="mf-castling">
                    <option value="">Все</option>
                    <option value="yes">Только рокировки</option>
                  </select>
                </div>
              </div>
              <div class="filters-actions">
                <button class="btn btn-primary btn-sm" onclick="applyMovesFilter()">Применить</button>
                <button class="btn btn-secondary btn-sm" onclick="resetMovesFilter()">Сбросить</button>
              </div>
            </div>
          </div>
          <div id="moves-table-container">
            ${renderMovesTable(game.moves)}
          </div>
        </div>`;
    }

    const backLink = fromPlayerId
        ? `<a onclick="navigate('player-detail',{id:'${fromPlayerId}'})" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Игрок</a>`
        : fromBotId
            ? `<a onclick="navigate('bot-detail',{id:'${fromBotId}'})" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Бот</a>`
            : `<a onclick="navigate('games')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Партии</a>`;

    main.innerHTML = `
      <div class="page-title">
        <span>
          ${backLink}
          &nbsp;/ Партия
        </span>
      </div>

      <div class="card">
        <h3 class="card-title">Информация о партии</h3>
        <div class="detail-grid">
          <div class="detail-row"><span class="detail-label">Режим</span><span class="detail-value">${badgeHTML(game.mode)}</span></div>
          <div class="detail-row"><span class="detail-label">Статус</span><span class="detail-value">${badgeHTML(game.status)}</span></div>
          <div class="detail-row"><span class="detail-label">Игрок 1</span><span class="detail-value">
            <a onclick="navigate('player-detail',{id:'${game.player1_id}'})" style="cursor:pointer;color:var(--primary);">${escapeHtml(game.player1_name)}</a>
          </span></div>
          <div class="detail-row"><span class="detail-label">Игрок 2</span><span class="detail-value">
            <a onclick="navigate('player-detail',{id:'${game.player2_id}'})" style="cursor:pointer;color:var(--primary);">${escapeHtml(game.player2_name)}</a>
          </span></div>
          <div class="detail-row"><span class="detail-label">Победитель</span><span class="detail-value">${game.winner_name ? escapeHtml(game.winner_name) : '—'}</span></div>
          <div class="detail-row"><span class="detail-label">Результат</span><span class="detail-value">${game.result ? badgeHTML(game.result) : '—'}</span></div>
          <div class="detail-row"><span class="detail-label">Комментарий</span><span class="detail-value">${escapeHtml(game.comment) || '—'}</span></div>
          <div class="detail-row"><span class="detail-label">Создана</span><span class="detail-value">${formatDate(game.created_at)}</span></div>
          <div class="detail-row"><span class="detail-label">Обновлена</span><span class="detail-value">${formatDate(game.updated_at)}</span></div>
          <div class="detail-row"><span class="detail-label">Ходов</span><span class="detail-value">${game.moves ? game.moves.length : 0}</span></div>
        </div>
        <div style="margin-top:16px;">
          <button class="btn btn-secondary btn-sm" onclick="navigate('status-history',{type:'game',id:'${game._id}'})">История статусов</button>
          ${(state.user && (state.user.role === 'admin' || state.user.id === game.player1_id.toString() || state.user.id === game.player2_id.toString())) ? `<button class="btn btn-secondary btn-sm" onclick="navigate('game-edit',{id:'${id}'})">Редактировать</button>` : ''}
        </div>
      </div>

      ${replayHtml}
      ${movesHtml}`;

    window._gameMoves = game.moves || [];
    if (hasMoves) initGameReplay(game.moves);
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderMovesTable(moves) {
  if (!moves || moves.length === 0) return '<div class="empty-state"><p>Ходов нет</p></div>';
  const sq = (v) => {
    if (v == null) return '—';
    if (typeof v === 'object' && 'r' in v && 's' in v) return `r${v.r}s${v.s}`;
    return escapeHtml(String(v));
  };
  return `
    <div class="table-container">
      <table class="moves-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Игрок</th>
            <th>Фигура</th>
            <th>Откуда</th>
            <th>Куда</th>
            <th>Взятие</th>
            <th>Шах</th>
            <th>Рокировка</th>
            <th>Время</th>
          </tr>
        </thead>
        <tbody>
          ${moves.map((m, i) => {
            const num = m.move_number != null ? m.move_number : m.number;
            const piece = m.piece || m.piece_type || '—';
            const from = m.from_sq != null ? m.from_sq : m.from;
            const to = m.to_sq != null ? m.to_sq : m.to;
            const isCheck = m.check || m.is_check || m.is_checkmate;
            const isCastle = m.castling || m.is_castling;
            const captured = m.captured;
            const capturedLabel = captured ? (typeof captured === 'object' ? (captured.piece_type || 'фигура') : escapeHtml(String(captured))) : '—';
            return `
            <tr class="move-row" data-move-index="${i}" onclick="jumpReplayTo(${i + 1})" style="cursor:pointer;">
              <td>${num != null ? num : (i + 1)}</td>
              <td>${escapeHtml(m.player_name || (m.color === 'w' ? 'Белые' : m.color === 'b' ? 'Чёрные' : '—'))}</td>
              <td>${escapeHtml(piece)}</td>
              <td>${sq(from)}</td>
              <td>${sq(to)}</td>
              <td>${capturedLabel}</td>
              <td>${isCheck ? '<span class="badge badge-checkmate">Шах</span>' : '—'}</td>
              <td>${isCastle ? '<span class="badge badge-hotseat">Рокировка</span>' : '—'}</td>
              <td>${(m.played_at || m.timestamp) ? formatDate(m.played_at || m.timestamp) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function applyMovesFilter() {
  const playerFilter = document.getElementById('mf-player')?.value?.toLowerCase() || '';
  const pieceFilter = document.getElementById('mf-piece')?.value?.toLowerCase() || '';
  const moveMin = parseInt(document.getElementById('mf-move-min')?.value) || null;
  const moveMax = parseInt(document.getElementById('mf-move-max')?.value) || null;
  const capturedFilter = document.getElementById('mf-captured')?.value || '';
  const checkFilter = document.getElementById('mf-check')?.value || '';
  const castlingFilter = document.getElementById('mf-castling')?.value || '';

  let filtered = [...(window._gameMoves || [])];
  if (playerFilter) filtered = filtered.filter(m => m.player_name?.toLowerCase().includes(playerFilter));
  if (pieceFilter) filtered = filtered.filter(m => m.piece?.toLowerCase().includes(pieceFilter));
  if (moveMin !== null) filtered = filtered.filter(m => m.move_number >= moveMin);
  if (moveMax !== null) filtered = filtered.filter(m => m.move_number <= moveMax);
  if (capturedFilter === 'yes') filtered = filtered.filter(m => m.captured);
  if (capturedFilter === 'no') filtered = filtered.filter(m => !m.captured);
  if (checkFilter === 'yes') filtered = filtered.filter(m => m.check);
  if (castlingFilter === 'yes') filtered = filtered.filter(m => m.castling);

  const container = document.getElementById('moves-table-container');
  if (container) container.innerHTML = renderMovesTable(filtered);
}

function resetMovesFilter() {
  ['mf-player', 'mf-piece', 'mf-move-min', 'mf-move-max', 'mf-captured', 'mf-check', 'mf-castling']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const container = document.getElementById('moves-table-container');
  if (container) container.innerHTML = renderMovesTable(window._gameMoves || []);
  if (window._replay) highlightReplayRow(window._replay.step);
}

// =====================
// Перемотка партии по шагам
// =====================
const REPLAY_SVG_NS = 'http://www.w3.org/2000/svg';
const REPLAY_FILLED = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const REPLAY_RINGS = 4;
const REPLAY_SECTORS = 16;
const REPLAY_R_OUTER = 90;
const REPLAY_R_INNER = 20;
const REPLAY_RING_THICK = (REPLAY_R_OUTER - REPLAY_R_INNER) / REPLAY_RINGS;

function replayCellGeometry(r, s) {
  const rOuter = REPLAY_R_OUTER - r * REPLAY_RING_THICK;
  const rInner = rOuter - REPLAY_RING_THICK;
  const step = (2 * Math.PI) / REPLAY_SECTORS;
  const a1 = -Math.PI / 2 + s * step;
  const a2 = a1 + step;
  return { rOuter, rInner, a1, a2 };
}
function replayCellPath(r, s) {
  const g = replayCellGeometry(r, s);
  const x1o = g.rOuter * Math.cos(g.a1), y1o = g.rOuter * Math.sin(g.a1);
  const x2o = g.rOuter * Math.cos(g.a2), y2o = g.rOuter * Math.sin(g.a2);
  const x1i = g.rInner * Math.cos(g.a1), y1i = g.rInner * Math.sin(g.a1);
  const x2i = g.rInner * Math.cos(g.a2), y2i = g.rInner * Math.sin(g.a2);
  return `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${g.rOuter} ${g.rOuter} 0 0 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${g.rInner} ${g.rInner} 0 0 0 ${x1i} ${y1i} Z`;
}
function replayCellCenter(r, s) {
  const g = replayCellGeometry(r, s);
  const midR = (g.rOuter + g.rInner) / 2;
  const midA = (g.a1 + g.a2) / 2;
  return { x: midR * Math.cos(midA), y: midR * Math.sin(midA), midR };
}

function renderReplayBoard(host, board, lastMove) {
  while (host.firstChild) host.removeChild(host.firstChild);
  const svg = document.createElementNS(REPLAY_SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200');
  host.appendChild(svg);
  for (let r = 0; r < REPLAY_RINGS; r++) {
    for (let s = 0; s < REPLAY_SECTORS; s++) {
      const path = document.createElementNS(REPLAY_SVG_NS, 'path');
      path.setAttribute('d', replayCellPath(r, s));
      let cls = 'cc-cell' + (((r + s) % 2 === 0) ? ' dark' : '');
      if (lastMove && (
        (lastMove.from && lastMove.from.r === r && lastMove.from.s === s) ||
        (lastMove.to && lastMove.to.r === r && lastMove.to.s === s)
      )) cls += ' last-move';
      path.setAttribute('class', cls);
      svg.appendChild(path);
    }
  }
  for (let r = 0; r < REPLAY_RINGS; r++) {
    for (let s = 0; s < REPLAY_SECTORS; s++) {
      const p = board[r][s];
      if (!p) continue;
      const c = replayCellCenter(r, s);
      const text = document.createElementNS(REPLAY_SVG_NS, 'text');
      text.setAttribute('x', c.x);
      text.setAttribute('y', c.y);
      const fontSize = Math.max(11, Math.min(15, c.midR * 0.2));
      text.setAttribute('font-size', fontSize);
      text.setAttribute('class', 'cc-piece ' + (p.color === 'w' ? 'white' : 'black'));
      text.textContent = REPLAY_FILLED[p.type] || '?';
      svg.appendChild(text);
    }
  }
}

function initGameReplay(moves) {
  const cc = window.CircularChess;
  if (!cc || typeof cc.Engine !== 'function') {
    const host = document.getElementById('replay-board-host');
    if (host) host.innerHTML = '<div class="empty-state" style="padding:16px;"><p>Библиотека шахмат не загружена</p></div>';
    return;
  }

  const snapshots = [];
  try {
    const engine = new cc.Engine();
    snapshots.push(engine.getBoard());
    for (const m of moves) {
      const from = m.from && typeof m.from === 'object' ? m.from : null;
      const to = m.to && typeof m.to === 'object' ? m.to : null;
      if (!from || !to) throw new Error('Ход без координат');
      engine.move({ from: { r: from.r, s: from.s }, to: { r: to.r, s: to.s }, promotion: m.promotion || null });
      snapshots.push(engine.getBoard());
    }
  } catch (err) {
    const host = document.getElementById('replay-board-host');
    if (host) host.innerHTML = `<div class="empty-state" style="padding:16px;"><p>Не удалось проиграть ходы: ${escapeHtml(err.message)}</p></div>`;
    return;
  }

  window._replay = { moves, snapshots, step: 0 };
  setReplayStep(moves.length);

  const bind = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  bind('replay-first', 'click', () => setReplayStep(0));
  bind('replay-prev',  'click', () => setReplayStep(window._replay.step - 1));
  bind('replay-next',  'click', () => setReplayStep(window._replay.step + 1));
  bind('replay-last',  'click', () => setReplayStep(window._replay.moves.length));
  bind('replay-step-input', 'change', (e) => setReplayStep(parseInt(e.target.value, 10) || 0));
  document.addEventListener('keydown', replayKeyHandler);
}

function replayKeyHandler(e) {
  if (!window._replay) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'ArrowLeft')  { setReplayStep(window._replay.step - 1); e.preventDefault(); }
  if (e.key === 'ArrowRight') { setReplayStep(window._replay.step + 1); e.preventDefault(); }
  if (e.key === 'Home')       { setReplayStep(0); e.preventDefault(); }
  if (e.key === 'End')        { setReplayStep(window._replay.moves.length); e.preventDefault(); }
}

function setReplayStep(step) {
  const r = window._replay;
  if (!r) return;
  step = Math.max(0, Math.min(step, r.moves.length));
  r.step = step;
  const host = document.getElementById('replay-board-host');
  if (host) {
    const lastMove = step > 0 ? r.moves[step - 1] : null;
    renderReplayBoard(host, r.snapshots[step], lastMove);
  }
  const input = document.getElementById('replay-step-input');
  if (input) input.value = step;
  const info = document.getElementById('replay-move-info');
  if (info) {
    if (step === 0) {
      info.textContent = 'Начальная позиция';
    } else {
      const m = r.moves[step - 1];
      const side = m.color === 'w' ? 'белые' : m.color === 'b' ? 'чёрные' : '—';
      const notation = m.notation || `${m.from ? `r${m.from.r}s${m.from.s}` : '?'} → ${m.to ? `r${m.to.r}s${m.to.s}` : '?'}`;
      info.textContent = `Ход ${step}: ${side} — ${notation}`;
    }
  }
  const setDis = (id, v) => { const el = document.getElementById(id); if (el) el.disabled = v; };
  setDis('replay-first', step === 0);
  setDis('replay-prev',  step === 0);
  setDis('replay-next',  step === r.moves.length);
  setDis('replay-last',  step === r.moves.length);
  highlightReplayRow(step);
}

function highlightReplayRow(step) {
  document.querySelectorAll('.move-row').forEach(tr => {
    const i = parseInt(tr.dataset.moveIndex, 10);
    tr.classList.toggle('is-current-move', i === step - 1);
  });
  if (step > 0) {
    const cur = document.querySelector(`.move-row[data-move-index="${step - 1}"]`);
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
}

function jumpReplayTo(step) {
  if (!window._replay) return;
  setReplayStep(step);
}

// =====================
// Создание сессии
// =====================
async function renderGameCreate() {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    navigate('login');
    return;
  }

  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const participants = await api('/participants');
    const players = participants.filter(p => p.type === 'player');
    const bots = participants.filter(p => p.type === 'bot');
    const me = players.find(p => p._id === state.user.id);

    if (!me) {
      main.innerHTML = `
        <div class="page-title">
          <span><a onclick="navigate('games')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Партии</a> / Новая партия</span>
        </div>
        <div class="empty-state"><p>Для вашего аккаунта не найден профиль игрока — создать партию нельзя.</p></div>`;
      return;
    }

    const playerOpts = players
        .filter(p => p._id !== state.user.id)
        .map(p => `<option value="${p._id}" data-type="player">${escapeHtml(p.display_name)}</option>`)
        .join('');
    const botOpts = bots
        .map(p => `<option value="${p._id}" data-type="bot">${escapeHtml(p.display_name)}</option>`)
        .join('');
    const opponentOptions =
        (playerOpts ? `<optgroup label="Игроки">${playerOpts}</optgroup>` : '') +
        (botOpts ? `<optgroup label="Боты">${botOpts}</optgroup>` : '');

    main.innerHTML = `
      <div class="page-title">
        <span><a onclick="navigate('games')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Партии</a> / Новая партия</span>
      </div>
      <div class="card" style="max-width:600px;">
        <h3 class="card-title">Создание партии</h3>
        <form onsubmit="handleCreateGame(event)">
          <div class="form-group">
            <label>Вы играете</label>
            <input type="text" class="form-control" value="${escapeHtml(me.display_name)}" disabled>
            <small style="color:var(--muted);">Партия создаётся от вашего имени — вы обязательно один из игроков.</small>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Ваш цвет</label>
              <select class="form-control" id="gc-color">
                <option value="w">Белые</option>
                <option value="b">Чёрные</option>
              </select>
            </div>
            <div class="form-group">
              <label>Соперник</label>
              <select class="form-control" id="gc-opponent" required>
                <option value="">— Выберите —</option>
                ${opponentOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Комментарий</label>
            <input type="text" class="form-control" id="gc-comment" placeholder="Необязательно">
          </div>
          <small style="color:var(--muted);display:block;margin-bottom:12px;">С игроком — партия hotseat: ходы за обе стороны делаете вы на одном устройстве. С ботом — бот ходит сам через свой API.</small>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="gc-btn">Создать и играть</button>
            <button type="button" class="btn btn-secondary" onclick="navigate('games')">Отмена</button>
          </div>
        </form>
      </div>`;
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function handleCreateGame(e) {
  e.preventDefault();
  const btn = document.getElementById('gc-btn');

  const color = document.getElementById('gc-color').value;
  const opponentSelect = document.getElementById('gc-opponent');
  const opponent = opponentSelect.value;
  const comment = document.getElementById('gc-comment').value;

  if (!opponent) {
    showToast('Выберите соперника', 'error');
    return;
  }

  const selectedOpt = opponentSelect.selectedOptions[0];
  const opponentIsBot = !!selectedOpt && selectedOpt.dataset.type === 'bot';
  const hotseat = !opponentIsBot;

  const white_id = color === 'w' ? state.user.id : opponent;
  const black_id = color === 'w' ? opponent : state.user.id;

  btn.disabled = true;
  try {
    const cc = await api('/cc/games', {
      method: 'POST',
      body: JSON.stringify({ white_id, black_id, hotseat, comment })
    });
    showToast('Партия создана!', 'success');
    window.location.href = '/chess.html?game=' + cc._id;
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

let statsSchema = null;

function statsCurrentDataset() {
  const key = document.getElementById('stats-dataset').value;
  return statsSchema.datasets.find(d => d.key === key);
}

function statsDefaultAxes(axes) {
  const num = axes.find(a => a.type === 'num');
  const cat = axes.find(a => a.type === 'cat');
  const x = (num || axes[0]).key;
  const y = ((cat && cat.key !== x) ? cat : (axes.find(a => a.key !== x) || axes[0])).key;
  return { x, y };
}

function statsAxisOptions(axes, selected) {
  return axes.map(a =>
    `<option value="${a.key}" ${a.key === selected ? 'selected' : ''}>${escapeHtml(a.label)}</option>`
  ).join('');
}

function statsFilterFieldHTML(f) {
  if (f.type === 'cat') {
    const opts = (f.options || []).map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    return `<div class="filter-group">
        <label>${escapeHtml(f.label)}</label>
        <select id="flt-${f.key}"><option value="">Все</option>${opts}</select>
      </div>`;
  }
  if (f.type === 'text') {
    return `<div class="filter-group">
        <label>${escapeHtml(f.label)}</label>
        <input type="text" id="flt-${f.key}" placeholder="Подстрока...">
      </div>`;
  }
  if (f.type === 'num') {
    return `<div class="filter-group">
        <label>${escapeHtml(f.label)}</label>
        <div class="filter-range">
          <input type="number" id="flt-${f.key}-min" placeholder="От">
          <input type="number" id="flt-${f.key}-max" placeholder="До">
        </div>
      </div>`;
  }
  return `<div class="filter-group">
      <label>${escapeHtml(f.label)}</label>
      <div class="filter-range">
        <input type="date" id="flt-${f.key}-from">
        <input type="date" id="flt-${f.key}-to">
      </div>
    </div>`;
}

async function renderStats() {
  const main = document.getElementById('main-content');

  if (!statsSchema) {
    try {
      statsSchema = await api('/stats/schema');
    } catch (err) {
      main.innerHTML = `<div class="empty-state"><p>Не удалось загрузить параметры статистики: ${escapeHtml(err.message)}</p></div>`;
      return;
    }
  }

  const dsOptions = statsSchema.datasets.map(d =>
    `<option value="${d.key}">${escapeHtml(d.label)}</option>`
  ).join('');

  main.innerHTML = `
    <div class="page-title">
      <span>Статистика</span>
    </div>

    <div class="filters-panel">
      <div class="filter-group" style="max-width:280px;margin-bottom:16px;">
        <label>Подмножество данных</label>
        <select id="stats-dataset" onchange="onStatsDatasetChange()">${dsOptions}</select>
      </div>
      <div id="stats-controls"></div>
    </div>

    <div id="stats-result"></div>`;

  renderStatsControls(statsSchema.datasets[0].key);
}

function onStatsDatasetChange() {
  renderStatsControls(document.getElementById('stats-dataset').value);
}

function renderStatsControls(dsKey) {
  const ds = statsSchema.datasets.find(d => d.key === dsKey);
  const { x, y } = statsDefaultAxes(ds.axes);

  const controls = document.getElementById('stats-controls');
  controls.innerHTML = `
    <h3 style="margin:0 0 8px;font-size:0.95rem;">Фильтр выборки</h3>
    <div class="filters-grid">
      ${ds.filters.map(statsFilterFieldHTML).join('')}
    </div>

    <h3 style="margin:18px 0 8px;font-size:0.95rem;">Оси диаграммы</h3>
    <div class="filters-grid">
      <div class="filter-group">
        <label>Ось X</label>
        <select id="stats-x">${statsAxisOptions(ds.axes, x)}</select>
      </div>
      <div class="filter-group">
        <label>Размер интервала X <small>(для числовых)</small></label>
        <input type="number" id="stats-x-bucket" placeholder="авто" min="1">
      </div>
      <div class="filter-group">
        <label>Ось Y</label>
        <select id="stats-y">${statsAxisOptions(ds.axes, y)}</select>
      </div>
      <div class="filter-group">
        <label>Размер интервала Y <small>(для числовых)</small></label>
        <input type="number" id="stats-y-bucket" placeholder="авто" min="1">
      </div>
    </div>

    <div class="filters-actions">
      <button class="btn btn-primary btn-sm" onclick="buildDistribution()">Построить</button>
      <button class="btn btn-secondary btn-sm" onclick="renderStatsControls(statsCurrentDataset().key)">Сбросить</button>
    </div>`;

  buildDistribution();
}

async function buildDistribution() {
  const container = document.getElementById('stats-result');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const ds = statsCurrentDataset();
  const params = new URLSearchParams();
  params.set('dataset', ds.key);
  params.set('x', document.getElementById('stats-x').value);
  params.set('y', document.getElementById('stats-y').value);

  const setIf = (param, id) => {
    const el = document.getElementById(id);
    if (el && el.value !== '') params.set(param, el.value);
  };
  setIf('x_bucket', 'stats-x-bucket');
  setIf('y_bucket', 'stats-y-bucket');

  ds.filters.forEach(f => {
    if (f.type === 'cat' || f.type === 'text') {
      setIf(`flt_${f.key}`, `flt-${f.key}`);
    } else if (f.type === 'num') {
      setIf(`flt_${f.key}_min`, `flt-${f.key}-min`);
      setIf(`flt_${f.key}_max`, `flt-${f.key}-max`);
    } else if (f.type === 'date') {
      setIf(`flt_${f.key}_from`, `flt-${f.key}-from`);
      setIf(`flt_${f.key}_to`, `flt-${f.key}-to`);
    }
  });

  try {
    const dist = await api(`/stats/distribution?${params}`);
    container.innerHTML = renderBarChart(dist) + renderHeatmap(dist);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

const STATS_PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'
];

function statsNiceMax(m) {
  if (m <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  const n = m / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function renderBarChart(dist) {
  if (!dist.total) return '';

  const xs = dist.x.values;
  const ys = dist.y.values;
  const valueAt = (xk, yk) => dist.cells[`${xk}||${yk}`] || 0;

  let max = 0;
  xs.forEach(xv => ys.forEach(yv => { const c = valueAt(xv.key, yv.key); if (c > max) max = c; }));
  const scaleMax = statsNiceMax(max);

  const mL = 48, mR = 16, mT = 16, mB = 78;
  const plotH = 280;
  const barW = ys.length > 6 ? 12 : 18;
  const groupInner = Math.max(barW, ys.length * barW);
  const groupGap = 28;
  const plotW = xs.length * (groupInner + groupGap) + groupGap;
  const W = mL + plotW + mR;
  const H = mT + plotH + mB;
  const yToPx = (v) => mT + plotH - (v / scaleMax) * plotH;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="stats-chart" role="img">`;

  const TICKS = 5;
  for (let i = 0; i <= TICKS; i++) {
    const v = (scaleMax / TICKS) * i;
    const y = yToPx(v);
    svg += `<line x1="${mL}" y1="${y.toFixed(1)}" x2="${(mL + plotW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<text x="${mL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--text-light)">${Math.round(v)}</text>`;
  }

  xs.forEach((xv, gi) => {
    const gx = mL + groupGap + gi * (groupInner + groupGap);
    ys.forEach((yv, si) => {
      const c = valueAt(xv.key, yv.key);
      const bx = gx + si * barW;
      const by = yToPx(c);
      const bh = mT + plotH - by;
      const color = STATS_PALETTE[si % STATS_PALETTE.length];
      if (c > 0) {
        svg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW - 2}" height="${bh.toFixed(1)}" fill="${color}"><title>${escapeHtml(xv.label)} / ${escapeHtml(yv.label)}: ${c}</title></rect>`;
      }
    });
    const cx = gx + groupInner / 2;
    const ty = mT + plotH + 14;
    svg += `<text x="${cx.toFixed(1)}" y="${ty}" text-anchor="end" font-size="11" fill="var(--text)" transform="rotate(-35 ${cx.toFixed(1)} ${ty})">${escapeHtml(xv.label)}</text>`;
  });

  svg += `<line x1="${mL}" y1="${mT + plotH}" x2="${(mL + plotW).toFixed(1)}" y2="${mT + plotH}" stroke="var(--text-light)" stroke-width="1"/>`;
  svg += '</svg>';

  const legend = ys.map((yv, si) => `
    <span class="chart-legend-item">
      <span class="chart-swatch" style="background:${STATS_PALETTE[si % STATS_PALETTE.length]}"></span>
      ${escapeHtml(yv.label)}
    </span>`).join('');

  return `
    <div class="stats-summary">
      ${escapeHtml(dist.dataset.label)} в выборке: <strong>${dist.total}</strong> &middot;
      ось X — <strong>${escapeHtml(dist.x.label)}</strong>${dist.x.type === 'num' ? ` (интервал ${dist.x.bucket})` : ''},
      цвет (серии) — <strong>${escapeHtml(dist.y.label)}</strong>${dist.y.type === 'num' ? ` (интервал ${dist.y.bucket})` : ''},
      высота столбика — количество.
    </div>
    <div class="chart-card">
      <div class="chart-scroll">${svg}</div>
      <div class="chart-legend">${legend}</div>
    </div>`;
}

function renderHeatmap(dist) {
  if (!dist.total) {
    return '<div class="empty-state"><p>Под заданный фильтр не попала ни одна запись.</p></div>';
  }

  const xs = dist.x.values;
  const ys = dist.y.values;

  const colTotals = xs.map(() => 0);
  const rowTotals = ys.map(() => 0);
  let max = 0;
  ys.forEach((yv, ri) => {
    xs.forEach((xv, ci) => {
      const c = dist.cells[`${xv.key}||${yv.key}`] || 0;
      rowTotals[ri] += c;
      colTotals[ci] += c;
      if (c > max) max = c;
    });
  });

  const cellColor = (c) => {
    if (!c) return '';
    const alpha = 0.12 + 0.78 * (c / max);
    const color = alpha > 0.55 ? '#fff' : 'var(--text)';
    return `background: rgba(37, 99, 235, ${alpha.toFixed(3)}); color: ${color};`;
  };

  let html = `
    <h3 class="stats-table-title">Таблица значений</h3>
    <div class="table-container heatmap-wrap">
      <table class="heatmap">
        <thead>
          <tr>
            <th class="hm-corner">${escapeHtml(dist.y.label)} \\ ${escapeHtml(dist.x.label)}</th>`;
  xs.forEach(xv => { html += `<th>${escapeHtml(xv.label)}</th>`; });
  html += '<th class="hm-total">Итого</th></tr></thead><tbody>';

  ys.forEach((yv, ri) => {
    html += `<tr><th class="hm-row">${escapeHtml(yv.label)}</th>`;
    xs.forEach((xv) => {
      const c = dist.cells[`${xv.key}||${yv.key}`] || 0;
      html += `<td style="${cellColor(c)}">${c || ''}</td>`;
    });
    html += `<td class="hm-total">${rowTotals[ri]}</td></tr>`;
  });

  html += '<tr class="hm-foot"><th class="hm-row">Итого</th>';
  colTotals.forEach(t => { html += `<td>${t}</td>`; });
  html += `<td class="hm-total">${dist.total}</td></tr>`;
  html += '</tbody></table></div>';
  return html;
}

// =====================
// Список игроков
// =====================
let playersFilters = {};
let playersPage = 1;
let playersSortBy = 'created_at';
let playersSortDir = 'desc';

function renderPlayers() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">
      <span>Игроки</span>
    </div>

    <div class="filters-panel">
      <div class="filters-toggle" onclick="toggleFilters('players-filters')">
        <h3>Фильтры</h3>
        <span id="players-filters-arrow">▼</span>
      </div>
      <div class="filters-body" id="players-filters" style="display:none;">
        <div class="filters-grid">
          <div class="filter-group">
            <label>Логин</label>
            <input type="text" id="pf-username" placeholder="Поиск по логину...">
          </div>
          <div class="filter-group">
            <label>Email</label>
            <input type="text" id="pf-email" placeholder="Поиск по email...">
          </div>
          <div class="filter-group">
            <label>Статус</label>
            <select id="pf-status">
              <option value="">Все</option>
              <option value="active">Активен</option>
              <option value="banned">Заблокирован</option>
              <option value="deleted">Удалён</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Комментарий</label>
            <input type="text" id="pf-comment" placeholder="Поиск в комментариях...">
          </div>
          <div class="filter-group">
            <label>Победы</label>
            <div class="filter-range">
              <input type="number" id="pf-wins-min" placeholder="От" min="0">
              <input type="number" id="pf-wins-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Поражения</label>
            <div class="filter-range">
              <input type="number" id="pf-losses-min" placeholder="От" min="0">
              <input type="number" id="pf-losses-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Ничьи</label>
            <div class="filter-range">
              <input type="number" id="pf-draws-min" placeholder="От" min="0">
              <input type="number" id="pf-draws-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Всего партий</label>
            <div class="filter-range">
              <input type="number" id="pf-total-min" placeholder="От" min="0">
              <input type="number" id="pf-total-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>ELO</label>
            <div class="filter-range">
              <input type="number" id="pf-elo-min" placeholder="От" min="0">
              <input type="number" id="pf-elo-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Дата регистрации (от)</label>
            <input type="date" id="pf-date-from">
          </div>
          <div class="filter-group">
            <label>Дата регистрации (до)</label>
            <input type="date" id="pf-date-to">
          </div>
        </div>
        <div class="filters-actions">
          <button class="btn btn-primary btn-sm" onclick="applyPlayersFilters()">Применить</button>
          <button class="btn btn-secondary btn-sm" onclick="resetPlayersFilters()">Сбросить</button>
        </div>
      </div>
    </div>

    <div id="players-table-container">
      <div class="loading"><div class="spinner"></div></div>
    </div>`;

  loadPlayers();
}

function applyPlayersFilters() {
  playersFilters = {
    username: document.getElementById('pf-username').value,
    email: document.getElementById('pf-email').value,
    status: document.getElementById('pf-status').value,
    comment: document.getElementById('pf-comment').value,
    wins_min: document.getElementById('pf-wins-min').value,
    wins_max: document.getElementById('pf-wins-max').value,
    losses_min: document.getElementById('pf-losses-min').value,
    losses_max: document.getElementById('pf-losses-max').value,
    draws_min: document.getElementById('pf-draws-min').value,
    draws_max: document.getElementById('pf-draws-max').value,
    total_min: document.getElementById('pf-total-min').value,
    total_max: document.getElementById('pf-total-max').value,
    elo_min: document.getElementById('pf-elo-min').value,
    elo_max: document.getElementById('pf-elo-max').value,
    created_from: document.getElementById('pf-date-from').value,
    created_to: document.getElementById('pf-date-to').value
  };
  playersPage = 1;
  loadPlayers();
}

function resetPlayersFilters() {
  ['pf-username','pf-email','pf-status','pf-comment',
    'pf-wins-min','pf-wins-max','pf-losses-min','pf-losses-max',
    'pf-draws-min','pf-draws-max','pf-total-min','pf-total-max',
    'pf-elo-min','pf-elo-max',
    'pf-date-from','pf-date-to']
      .forEach(id => { document.getElementById(id).value = ''; });
  playersFilters = {};
  playersPage = 1;
  loadPlayers();
}

function changePlayersPage(p) {
  playersPage = p;
  loadPlayers();
}

function sortPlayers(field) {
  if (playersSortBy === field) {
    playersSortDir = playersSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    playersSortBy = field;
    playersSortDir = 'desc';
  }
  loadPlayers();
}

async function loadPlayers() {
  const container = document.getElementById('players-table-container');
  if (!container) return;

  const params = new URLSearchParams();
  params.set('page', playersPage);
  params.set('limit', 15);
  params.set('sort_by', playersSortBy);
  params.set('sort_dir', playersSortDir);

  Object.entries(playersFilters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  try {
    const result = await api(`/players?${params}`);
    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>Игроки не найдены</p></div>';
      return;
    }

    const sortIcon = (field) => {
      if (playersSortBy !== field) return '';
      return `<span class="sort-icon">${playersSortDir === 'asc' ? '▲' : '▼'}</span>`;
    };

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th onclick="sortPlayers('username')">Логин ${sortIcon('username')}</th>
              <th>Email</th>
              <th onclick="sortPlayers('status')">Статус ${sortIcon('status')}</th>
              <th onclick="sortPlayers('stats.wins')">Победы ${sortIcon('stats.wins')}</th>
              <th onclick="sortPlayers('stats.losses')">Поражения ${sortIcon('stats.losses')}</th>
              <th onclick="sortPlayers('stats.draws')">Ничьи ${sortIcon('stats.draws')}</th>
              <th onclick="sortPlayers('stats.total_games')">Всего ${sortIcon('stats.total_games')}</th>
              <th onclick="sortPlayers('stats.elo')">ELO ${sortIcon('stats.elo')}</th>
              <th onclick="sortPlayers('created_at')">Регистрация ${sortIcon('created_at')}</th>
              <th onclick="sortPlayers('updated_at')">Обновлён ${sortIcon('updated_at')}</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(p => {
      html += `
        <tr class="clickable" onclick="navigate('player-detail', {id:'${p._id}'})">
          <td><strong>${escapeHtml(p.username)}</strong></td>
          <td>${escapeHtml(p.email)}</td>
          <td>${badgeHTML(p.status)}</td>
          <td>${p.stats.wins}</td>
          <td>${p.stats.losses}</td>
          <td>${p.stats.draws}</td>
          <td>${p.stats.total_games}</td>
          <td>${p.stats.elo ?? 0}</td>
          <td>${formatDate(p.created_at)}</td>
          <td>${formatDate(p.updated_at)}</td>
          <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p.comment)}">${escapeHtml(p.comment) || '—'}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    html += paginationHTML(result.pagination, 'changePlayersPage');
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Ошибка загрузки: ${escapeHtml(err.message)}</p></div>`;
  }
}

// =====================
// Информация об игроках
// =====================
async function renderPlayerDetail(id) {
  const main = document.getElementById('main-content');
  if (!id) {
    main.innerHTML = '<div class="empty-state"><p>Игрок не найден</p></div>';
    return;
  }
  playerGamesPage = 1;
  playerGamesFilters = {};

  try {
    const player = await api(`/players/${id}`);
    let eloData = null;
    try { eloData = await api(`/players/${id}/elo-history?limit=500`); }
    catch {}
    playerEloByGame = {};
    if (eloData && Array.isArray(eloData.history)) {
      for (const h of eloData.history) playerEloByGame[String(h.game_id)] = h;
    }

    const currentElo = (eloData && eloData.current_elo) || player.stats.elo || 0;
    const eloTitle = (eloData && eloData.title) || eloTitleFromValue(currentElo);

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('players')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Игроки</a>
          &nbsp;/ ${escapeHtml(player.username)}
        </span>
      </div>

      <div class="card">
        <div class="profile-header">
          <div class="profile-avatar">${player.username.charAt(0).toUpperCase()}</div>
          <div class="profile-info">
            <h2>${escapeHtml(player.username)} ${badgeHTML(player.status)}</h2>
            <p>${escapeHtml(player.email)}</p>
            <p>Зарегистрирован: ${formatDate(player.created_at)}</p>
            ${player.updated_at ? `<p>Обновлён: ${formatDate(player.updated_at)}</p>` : ''}
            ${player.comment ? `<p>${escapeHtml(player.comment)}</p>` : ''}
          </div>
        </div>

        <div class="profile-stats">
          <div class="profile-stat">
            <div class="value" style="color:var(--success)">${player.stats.wins}</div>
            <div class="label">Победы</div>
          </div>
          <div class="profile-stat">
            <div class="value" style="color:var(--danger)">${player.stats.losses}</div>
            <div class="label">Поражения</div>
          </div>
          <div class="profile-stat">
            <div class="value" style="color:var(--warning)">${player.stats.draws}</div>
            <div class="label">Ничьи</div>
          </div>
          <div class="profile-stat">
            <div class="value">${player.stats.total_games}</div>
            <div class="label">Всего партий</div>
          </div>
          <div class="profile-stat" title="Рейтинг ELO: 1 / (1 + 10^((R_opp − R_self) / 400)). K=32, мастера — K=16, гроссы — K=10.">
            <div class="value" style="color:var(--primary)">${currentElo}</div>
            <div class="label">ELO <small style="opacity:.7">(${escapeHtml(eloTitle)})</small></div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="navigate('status-history',{type:'player',id:'${player._id}'})">История статусов</button>
        ${(state.user && (state.user.id === player._id.toString() || (state.user.role === 'admin' && player.role !== 'admin'))) ? `<button class="btn btn-secondary btn-sm" style="margin-left:8px;" onclick="navigate('player-edit',{id:'${player._id}'})">✏ Редактировать</button>` : ''}
      </div>

      <div class="card">
        <h3 class="card-title">Партии игрока</h3>
        <div class="filters-panel" style="margin-bottom:12px;">
          <div class="filters-toggle" onclick="toggleFilters('pgames-filters')">
            <h3>Фильтры</h3>
            <span id="pgames-filters-arrow">▼</span>
          </div>
          <div class="filters-body" id="pgames-filters" style="display:none;">
            <div class="filters-grid">
              <div class="filter-group">
                <label>Исход</label>
                <select id="pgf-outcome">
                  <option value="">Все</option>
                  <option value="active">Идёт</option>
                  <option value="win">Победы</option>
                  <option value="loss">Поражения</option>
                  <option value="draw">Ничьи</option>
                  <option value="abandoned">Прервана</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Соперник (имя)</label>
                <input type="text" id="pgf-player" placeholder="Поиск по имени...">
              </div>
              <div class="filter-group">

                <label>Комментарий</label>
                <input type="text" id="pgf-comment" placeholder="Поиск в комментариях...">
              </div>
              <div class="filter-group">
                <label>Кол-во ходов</label>
                <div class="filter-range">
                  <input type="number" id="pgf-moves-min" placeholder="От" min="0">
                  <input type="number" id="pgf-moves-max" placeholder="До" min="0">
                </div>
              </div>
              <div class="filter-group">
                <label>Дата создания (от)</label>
                <input type="date" id="pgf-date-from">
              </div>
              <div class="filter-group">
                <label>Дата создания (до)</label>
                <input type="date" id="pgf-date-to">
              </div>
              <div class="filter-group">
                <label>Дата обновления (от)</label>
                <input type="date" id="pgf-updated-from">
              </div>
              <div class="filter-group">
                <label>Дата обновления (до)</label>
                <input type="date" id="pgf-updated-to">
              </div>
            </div>
            <div class="filters-actions">
              <button class="btn btn-primary btn-sm" onclick="applyPlayerGamesFilters('${player._id}')">Применить</button>
              <button class="btn btn-secondary btn-sm" onclick="resetPlayerGamesFilters('${player._id}')">Сбросить</button>
            </div>
          </div>
        </div>
        <div id="player-games-container">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>`;

    loadPlayerGames(id);
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

let playerGamesPage = 1;
let playerGamesFilters = {};
let playerEloByGame = {};

function applyPlayerGamesFilters(playerId) {
  const v = (id) => (document.getElementById(id)?.value || '').trim();
  const outcome = v('pgf-outcome');
  const filters = {
    player_name: v('pgf-player'),
    comment: v('pgf-comment'),
    moves_min: v('pgf-moves-min'),
    moves_max: v('pgf-moves-max'),
    created_from: v('pgf-date-from'),
    created_to: v('pgf-date-to'),
    updated_from: v('pgf-updated-from'),
    updated_to: v('pgf-updated-to')
  };
  if (outcome === 'abandoned') filters.status = 'abandoned';
  else if (outcome) filters.outcome = outcome;
  playerGamesFilters = filters;
  playerGamesPage = 1;
  loadPlayerGames(playerId);
}

function resetPlayerGamesFilters(playerId) {
  ['pgf-outcome', 'pgf-player', 'pgf-comment', 'pgf-moves-min', 'pgf-moves-max', 'pgf-date-from', 'pgf-date-to', 'pgf-updated-from', 'pgf-updated-to']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  playerGamesFilters = {};
  playerGamesPage = 1;
  loadPlayerGames(playerId);
}

function changePlayerGamesPage(p) {
  playerGamesPage = p;
  const id = state.pageParams?.id || state.user?.id;
  loadPlayerGames(id);
}

async function loadPlayerGames(playerId) {
  const container = document.getElementById('player-games-container');
  if (!container) return;

  const params = new URLSearchParams();
  params.set('player_id', playerId);
  params.set('page', playerGamesPage);
  params.set('limit', 10);
  Object.entries(playerGamesFilters || {}).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });

  try {
    const result = await api(`/cc/games?${params}`);

    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Партий пока нет</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>Цвет</th>
              <th>Соперник</th>
              <th>Результат</th>
              <th title="Изменение рейтинга ELO за партию по шахматной формуле">ELO</th>
              <th>Ходов</th>
              <th>Обновлена</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(g => {
      const isWhite = String(g.white_id) === String(playerId);
      const opponent = isWhite ? (g.black_name || '—') : (g.white_name || '—');
      let outcome = '—';
      if (g.winner_id) {
        outcome = String(g.winner_id) === String(playerId)
            ? '<span style="color:var(--success);font-weight:600;">Победа</span>'
            : '<span style="color:var(--danger);font-weight:600;">Поражение</span>';
      } else if (g.result) {
        outcome = `<span style="color:var(--warning);font-weight:600;">${CC_RESULT_LABELS[g.result] || g.result}</span>`;
      }
      const eloEntry = playerEloByGame[String(g._id)];
      const eloCell = eloEntry ? formatEloCell(eloEntry) : '—';

      html += `
        <tr class="clickable" onclick="openCcGame('${g._id}')">
          <td>${ccStatusBadge(g.status)}</td>
          <td>${isWhite ? 'Белые' : 'Чёрные'}</td>
          <td>${escapeHtml(opponent)}</td>
          <td>${outcome}</td>
          <td>${eloCell}</td>
          <td>${g.move_number}</td>
          <td>${formatDate(g.updated_at)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    html += paginationHTML(result.pagination, 'changePlayerGamesPage');
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

// =====================
// Список ботов
// =====================
let botsFilters = {};
let botsPage = 1;
let botsSortBy = 'created_at';
let botsSortDir = 'desc';

function renderBots() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">
      <span>Боты</span>
      ${state.user && state.user.role === 'admin' ? '<button class="btn btn-primary" onclick="navigate(\'bot-create\')">+ Создать бота</button>' : ''}
    </div>

    <div class="filters-panel">
      <div class="filters-toggle" onclick="toggleFilters('bots-filters')">
        <h3>Фильтры</h3>
        <span id="bots-filters-arrow">▼</span>
      </div>
      <div class="filters-body" id="bots-filters" style="display:none;">
        <div class="filters-grid">
          <div class="filter-group">
            <label>Название</label>
            <input type="text" id="bf-name" placeholder="Поиск по названию...">
          </div>
          <div class="filter-group">
            <label>Статус</label>
            <select id="bf-status">
              <option value="">Все</option>
              <option value="draft">Черновик</option>
              <option value="testing">Тестирование</option>
              <option value="active">Активен</option>
              <option value="disabled">Отключён</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Победы</label>
            <div class="filter-range">
              <input type="number" id="bf-wins-min" placeholder="От" min="0">
              <input type="number" id="bf-wins-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Поражения</label>
            <div class="filter-range">
              <input type="number" id="bf-losses-min" placeholder="От" min="0">
              <input type="number" id="bf-losses-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Ничьи</label>
            <div class="filter-range">
              <input type="number" id="bf-draws-min" placeholder="От" min="0">
              <input type="number" id="bf-draws-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>ELO</label>
            <div class="filter-range">
              <input type="number" id="bf-elo-min" placeholder="От" min="0">
              <input type="number" id="bf-elo-max" placeholder="До" min="0">
            </div>
          </div>
          <div class="filter-group">
            <label>Дата создания (от)</label>
            <input type="date" id="bf-date-from">
          </div>
          <div class="filter-group">
            <label>Дата создания (до)</label>
            <input type="date" id="bf-date-to">
          </div>
          <div class="filter-group">
            <label>Дата обновления (от)</label>
            <input type="date" id="bf-updated-from">
          </div>
          <div class="filter-group">
            <label>Дата обновления (до)</label>
            <input type="date" id="bf-updated-to">
          </div>
        </div>
        <div class="filters-actions">
          <button class="btn btn-primary btn-sm" onclick="applyBotsFilters()">Применить</button>
          <button class="btn btn-secondary btn-sm" onclick="resetBotsFilters()">Сбросить</button>
        </div>
      </div>
    </div>

    <div id="bots-table-container">
      <div class="loading"><div class="spinner"></div></div>
    </div>`;

  loadBots();
}

function applyBotsFilters() {
  botsFilters = {
    name: document.getElementById('bf-name').value,
    status: document.getElementById('bf-status').value,
    wins_min: document.getElementById('bf-wins-min').value,
    wins_max: document.getElementById('bf-wins-max').value,
    losses_min: document.getElementById('bf-losses-min').value,
    losses_max: document.getElementById('bf-losses-max').value,
    draws_min: document.getElementById('bf-draws-min').value,
    draws_max: document.getElementById('bf-draws-max').value,
    elo_min: document.getElementById('bf-elo-min').value,
    elo_max: document.getElementById('bf-elo-max').value,
    created_from: document.getElementById('bf-date-from').value,
    created_to: document.getElementById('bf-date-to').value,
    updated_from: document.getElementById('bf-updated-from').value,
    updated_to: document.getElementById('bf-updated-to').value
  };
  botsPage = 1;
  loadBots();
}

function resetBotsFilters() {
  ['bf-name','bf-status',
    'bf-wins-min','bf-wins-max','bf-losses-min','bf-losses-max',
    'bf-draws-min','bf-draws-max','bf-elo-min','bf-elo-max',
    'bf-date-from','bf-date-to','bf-updated-from','bf-updated-to']
      .forEach(id => { document.getElementById(id).value = ''; });
  botsFilters = {};
  botsPage = 1;
  loadBots();
}

function changeBotsPage(p) {
  botsPage = p;
  loadBots();
}

function sortBots(field) {
  if (botsSortBy === field) {
    botsSortDir = botsSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    botsSortBy = field;
    botsSortDir = 'desc';
  }
  loadBots();
}

async function loadBots() {
  const container = document.getElementById('bots-table-container');
  if (!container) return;

  const params = new URLSearchParams();
  params.set('page', botsPage);
  params.set('limit', 15);
  params.set('sort_by', botsSortBy);
  params.set('sort_dir', botsSortDir);

  Object.entries(botsFilters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  try {
    const result = await api(`/bots?${params}`);
    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>Боты не найдены</p></div>';
      return;
    }

    const sortIcon = (field) => {
      if (botsSortBy !== field) return '';
      return `<span class="sort-icon">${botsSortDir === 'asc' ? '▲' : '▼'}</span>`;
    };

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th onclick="sortBots('name')">Название ${sortIcon('name')}</th>
              <th onclick="sortBots('status')">Статус ${sortIcon('status')}</th>
              <th onclick="sortBots('stats.wins')">Победы ${sortIcon('stats.wins')}</th>
              <th onclick="sortBots('stats.losses')">Поражения ${sortIcon('stats.losses')}</th>
              <th onclick="sortBots('stats.draws')">Ничьи ${sortIcon('stats.draws')}</th>
              <th onclick="sortBots('stats.total_games')">Всего ${sortIcon('stats.total_games')}</th>
              <th onclick="sortBots('stats.elo')">ELO ${sortIcon('stats.elo')}</th>
              <th onclick="sortBots('created_at')">Создан ${sortIcon('created_at')}</th>
              <th onclick="sortBots('updated_at')">Обновлён ${sortIcon('updated_at')}</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(b => {
      html += `
        <tr>
          <td><strong style="cursor:pointer;color:var(--primary);" onclick="navigate('bot-detail',{id:'${b._id}'})">${escapeHtml(b.name)}</strong></td>
          <td>${badgeHTML(b.status)}</td>
          <td>${b.stats.wins}</td>
          <td>${b.stats.losses}</td>
          <td>${b.stats.draws}</td>
          <td>${b.stats.total_games}</td>
          <td>${b.stats.elo ?? 0}</td>
          <td>${formatDate(b.created_at)}</td>
          <td>${formatDate(b.updated_at)}</td>
          <td style="white-space:nowrap;">
            ${state.user ? `
              <div style="display:flex;gap:6px;flex-wrap:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();navigate('bot-edit',{id:'${b._id}'})">Редактировать</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();confirmDeleteBot('${b._id}','${escapeHtml(b.name)}')">Удалить</button>
              </div>
            ` : ''}
          </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    html += paginationHTML(result.pagination, 'changeBotsPage');
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Ошибка загрузки: ${escapeHtml(err.message)}</p></div>`;
  }
}

// =====================
// Информация о ботах
// =====================
async function renderBotDetail(id) {
  const main = document.getElementById('main-content');
  try {
    const bot = await api(`/bots/${id}`);

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('bots')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Боты</a>
          &nbsp;/ ${escapeHtml(bot.name)}
        </span>
        ${state.user ? `
          <div>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteBot('${bot._id}','${escapeHtml(bot.name)}')">Удалить</button>
          </div>
        ` : ''}
      </div>

      <div class="card">
        <div class="profile-header">
          <div class="profile-avatar" style="background:var(--warning);"></div>
          <div class="profile-info">
            <h2>${escapeHtml(bot.name)} ${badgeHTML(bot.status)}</h2>
            <p>Создан: ${formatDate(bot.created_at)}</p>
            ${bot.updated_at ? `<p>Обновлён: ${formatDate(bot.updated_at)}</p>` : ''}
            ${bot.comment ? `<p>${escapeHtml(bot.comment)}</p>` : ''}
          </div>
        </div>

        <div class="profile-stats">
          <div class="profile-stat">
            <div class="value" style="color:var(--success)">${bot.stats.wins}</div>
            <div class="label">Победы</div>
          </div>
          <div class="profile-stat">
            <div class="value" style="color:var(--danger)">${bot.stats.losses}</div>
            <div class="label">Поражения</div>
          </div>
          <div class="profile-stat">
            <div class="value" style="color:var(--warning)">${bot.stats.draws}</div>
            <div class="label">Ничьи</div>
          </div>
          <div class="profile-stat">
            <div class="value">${bot.stats.total_games}</div>
            <div class="label">Всего партий</div>
          </div>
          <div class="profile-stat" title="Рейтинг ELO считается по шахматной формуле: E = 1 / (1 + 10^((R_opp − R_self) / 400)).">
            <div class="value" style="color:var(--primary)">${bot.stats.elo ?? 0}</div>
            <div class="label">ELO <small style="opacity:.7">(${escapeHtml(eloTitleFromValue(bot.stats.elo ?? 0))})</small></div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="navigate('status-history',{type:'bot',id:'${bot._id}'})">История статусов</button>
        ${state.user ? `<button class="btn btn-secondary btn-sm" style="margin-left:8px;" onclick="navigate('bot-edit',{id:'${bot._id}'})">✏ Редактировать</button>` : ''}
      </div>

      ${state.user ? `
      <div class="card">
        <h3 class="card-title">API-ключ</h3>
        <div id="bot-key-card"></div>
      </div>` : ''}

      <div class="card">
        <h3 class="card-title">Последние партии</h3>
        <div id="bot-games-container">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>`;

    loadBotGames(id);
    if (state.user) {
      const fresh = (freshBotKey && freshBotKey.id === String(id)) ? freshBotKey.key : null;
      freshBotKey = null;
      renderBotKeyCard(String(id), bot.name, fresh);
    }
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

let freshBotKey = null;

function renderBotKeyCard(id, name, key) {
  const card = document.getElementById('bot-key-card');
  if (!card) return;
  if (key) {
    card.innerHTML = `
      <p style="color:var(--danger);font-weight:600;">Сохраните ключ сейчас — он показывается только один раз.</p>
      <div class="form-group">
        <input type="text" class="form-control" id="bot-key-value" readonly value="${escapeHtml(key)}"
               style="font-family:monospace;" onclick="this.select()">
      </div>
      <p style="color:var(--text-light);font-size:0.9rem;">Передайте его контейнеру бота как переменную окружения <code>BOT_KEY</code>.</p>
      <div class="form-actions">
        <button class="btn btn-secondary btn-sm" onclick="copyBotKey()">Скопировать</button>
        <button class="btn btn-danger btn-sm" onclick="executeRegenerateKey('${id}','${escapeHtml(name)}')">Перевыпустить ключ</button>
      </div>`;
  } else {
    card.innerHTML = `
      <p style="color:var(--text-light);">Ключ хранится в зашифрованном виде и повторно не показывается. Перевыпустите, чтобы получить новый (старый сразу перестанет работать).</p>
      <button class="btn btn-danger btn-sm" onclick="executeRegenerateKey('${id}','${escapeHtml(name)}')">Перевыпустить ключ</button>`;
  }
}

function copyBotKey() {
  const input = document.getElementById('bot-key-value');
  if (!input) return;
  input.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(input.value)
      .then(() => showToast('Ключ скопирован', 'success'))
      .catch(() => showToast('Скопируйте вручную (Ctrl+C)', 'error'));
  } else {
    document.execCommand('copy');
    showToast('Ключ скопирован', 'success');
  }
}

async function executeRegenerateKey(id, name) {
  try {
    const res = await api(`/bots/${id}/regenerate-key`, { method: 'POST' });
    renderBotKeyCard(id, name, res.api_key || res.api_key_plain);
    showToast('Ключ перевыпущен', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let botGamesPage = 1;

function changeBotGamesPage(p) {
  botGamesPage = p;
  const id = state.pageParams?.id;
  loadBotGames(id);
}

async function loadBotGames(botId) {
  const container = document.getElementById('bot-games-container');
  if (!container) return;

  try {
    const params = new URLSearchParams();
    params.set('player_id', botId);
    params.set('page', botGamesPage);
    params.set('limit', 10);
    const result = await api(`/cc/games?${params}`);

    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Партий пока нет</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>Цвет</th>
              <th>Соперник</th>
              <th>Результат</th>
              <th>Ходов</th>
              <th>Обновлена</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(g => {
      const isWhite = String(g.white_id) === String(botId);
      const opponent = isWhite ? (g.black_name || '—') : (g.white_name || '—');
      let outcome = '—';
      if (g.winner_id) {
        outcome = String(g.winner_id) === String(botId)
            ? '<span style="color:var(--success);font-weight:600;">Победа</span>'
            : '<span style="color:var(--danger);font-weight:600;">Поражение</span>';
      } else if (g.result) {
        outcome = `<span style="color:var(--warning);font-weight:600;">${CC_RESULT_LABELS[g.result] || g.result}</span>`;
      }

      html += `
        <tr class="clickable" onclick="openCcGame('${g._id}')">
          <td>${ccStatusBadge(g.status)}</td>
          <td>${isWhite ? 'Белые' : 'Чёрные'}</td>
          <td>${escapeHtml(opponent)}</td>
          <td>${outcome}</td>
          <td>${g.move_number}</td>
          <td>${formatDateShort(g.updated_at)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    html += paginationHTML(result.pagination, 'changeBotGamesPage');
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

// =====================
// Создание бота
// =====================
function renderBotCreate() {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    navigate('login');
    return;
  }
  if (state.user.role !== 'admin') {
    showToast('Создавать ботов могут только администраторы', 'error');
    navigate('bots');
    return;
  }

  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">
      <span>
        <a onclick="navigate('bots')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Боты</a>
        &nbsp;/ Создание бота
      </span>
    </div>
    <div class="card" style="max-width:600px;">
      <h3 class="card-title">Новый бот</h3>
      <form onsubmit="handleCreateBot(event)">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" class="form-control" id="bc-name" placeholder="Название бота" required>
        </div>
        <div class="form-group">
          <label>Описание</label>
          <textarea class="form-control" id="bc-comment" rows="3" placeholder="Описание бота, стратегия..."></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="bc-btn">Создать бота</button>
          <button type="button" class="btn btn-secondary" onclick="navigate('bots')">Отмена</button>
        </div>
      </form>
    </div>`;
}

async function handleCreateBot(e) {
  e.preventDefault();
  const btn = document.getElementById('bc-btn');
  btn.disabled = true;

  try {
    const bot = await api('/bots', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('bc-name').value.trim(),
        comment: document.getElementById('bc-comment').value.trim()
      })
    });

    freshBotKey = { id: String(bot._id), key: bot.api_key_plain };
    showToast('Бот создан! Сохраните API-ключ на странице бота.', 'success');
    navigate('bot-detail', { id: bot._id });
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

// =====================
// Редактирование бота
// =====================
async function renderBotEdit(id) {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    navigate('login');
    return;
  }

  const main = document.getElementById('main-content');
  try {
    const bot = await api(`/bots/${id}`);

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('bots')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Боты</a>
          &nbsp;/ Редактирование: ${escapeHtml(bot.name)}
        </span>
      </div>
      <div class="card" style="max-width:600px;">
        <h3 class="card-title">Редактирование бота</h3>
        <form onsubmit="handleUpdateBot(event, '${bot._id}')">
          <div class="form-group">
            <label>Название *</label>
            <input type="text" class="form-control" id="be-name" value="${escapeHtml(bot.name)}" required>
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea class="form-control" id="be-comment" rows="3">${escapeHtml(bot.comment)}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Статус</label>
              <select class="form-control" id="be-status">
                <option value="draft" ${bot.status === 'draft' ? 'selected' : ''}>Черновик</option>
                <option value="testing" ${bot.status === 'testing' ? 'selected' : ''}>Тестирование</option>
                <option value="active" ${bot.status === 'active' ? 'selected' : ''}>Активен</option>
                <option value="disabled" ${bot.status === 'disabled' ? 'selected' : ''}>Отключён</option>
              </select>
            </div>
<div class="form-group" id="be-reason-group" style="display:none;">
              <label>Причина изменения статуса</label>
              <input type="text" class="form-control" id="be-reason" placeholder="Укажите причину...">
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="be-btn">Сохранить</button>
            <button type="button" class="btn btn-secondary" onclick="navigate('bot-detail',{id:'${bot._id}'})">Отмена</button>
          </div>
        </form>
      </div>`;

    // Показываем поле причины при смене статуса
    const statusSelect = document.getElementById('be-status');
    const originalStatus = bot.status;
    statusSelect.addEventListener('change', () => {
      const reasonGroup = document.getElementById('be-reason-group');
      if (statusSelect.value !== originalStatus) {
        reasonGroup.style.display = 'block';
      } else {
        reasonGroup.style.display = 'none';
      }
    });
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function handleUpdateBot(e, id) {
  e.preventDefault();
  const btn = document.getElementById('be-btn');
  btn.disabled = true;

  try {
    const body = {
      name: document.getElementById('be-name').value.trim(),
      comment: document.getElementById('be-comment').value.trim(),
      status: document.getElementById('be-status').value,
      reason: document.getElementById('be-reason').value.trim()
    };

    await api(`/bots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    showToast('Бот обновлён!', 'success');
    navigate('bot-detail', { id });
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

// =====================
// Удаление бота
// =====================
function confirmDeleteBot(id, name) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3 class="modal-title">Удаление бота</h3>
      <p>Вы уверены, что хотите удалить бота <strong>${escapeHtml(name)}</strong>?</p>
      <p style="color:var(--text-light);font-size:0.9rem;margin-top:8px;">Это действие нельзя отменить. Бот не может быть удалён, если участвует в активных партиях.</p>
      <div class="form-actions" style="margin-top:20px;">
        <button class="btn btn-danger" onclick="executeDeleteBot('${id}')">Удалить</button>
        <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

async function executeDeleteBot(id) {
  try {
    await api(`/bots/${id}`, { method: 'DELETE' });
    closeModal();
    showToast('Бот удалён', 'success');
    navigate('bots');
  } catch (err) {
    closeModal();
    showToast(err.message, 'error');
  }
}

// =====================
// История статусов
// =====================
async function renderStatusHistory(type, id) {
  const main = document.getElementById('main-content');

  let backPage, backLabel;
  if (type === 'player') {
    backPage = 'player-detail';
    backLabel = 'Игрок';
  } else if (type === 'bot') {
    backPage = 'bot-detail';
    backLabel = 'Бот';
  } else {
    backPage = 'game-detail';
    backLabel = 'Партия';
  }

  try {
    let result;
    if (type === 'game') {
      result = await api(`/games/${id}/status-history`);
    } else {
      result = await api(`/players/${id}/status-history`);
    }

    const history = result.history || [];
    const entityName = result.entity_name || '';

    let timelineHtml = '';
    if (history.length === 0) {
      timelineHtml = '<div class="empty-state"><p>История статусов пуста</p></div>';
    } else {
      timelineHtml = '<div class="history-timeline">';
      // Сортируем от новых к старым
      const sorted = [...history].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
      sorted.forEach(h => {
        timelineHtml += `
          <div class="history-item">
            <div class="history-date">${formatDate(h.changed_at)}</div>
            <div class="history-change">
              ${h.old_status ? badgeHTML(h.old_status) : '<span class="badge" style="background:#f1f5f9;color:#475569;">—</span>'}
              &nbsp;→&nbsp;
              ${badgeHTML(h.new_status)}
            </div>
            <div class="history-meta">
              ${h.changed_by_name ? `Изменил: <strong>${escapeHtml(h.changed_by_name)}</strong>` : ''}
              ${h.reason ? ` · ${escapeHtml(h.reason)}` : ''}
            </div>
          </div>`;
      });
      timelineHtml += '</div>';
    }

    // Фильтры для истории
    let filterHtml = '';
    if (history.length > 3) {
      const allStatuses = [...new Set(history.flatMap(h => [h.old_status, h.new_status]).filter(Boolean))];
      filterHtml = `
        <div class="filters-panel" style="margin-bottom:16px;">
          <div class="filters-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
            <div class="filter-group">
              <label>Статус</label>
              <select id="sh-filter-status" onchange="filterStatusHistory()">
                <option value="">Все</option>
                ${allStatuses.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group">
              <label>Дата (от)</label>
              <input type="date" id="sh-filter-from" onchange="filterStatusHistory()">
            </div>
            <div class="filter-group">
              <label>Дата (до)</label>
              <input type="date" id="sh-filter-to" onchange="filterStatusHistory()">
            </div>
          </div>
        </div>`;
    }

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('${backPage}',{id:'${id}'})" style="cursor:pointer;color:var(--primary);text-decoration:none;">← ${backLabel}${entityName ? ': ' + escapeHtml(entityName) : ''}</a>
          &nbsp;/ История статусов
        </span>
      </div>

      ${filterHtml}

      <div class="card">
        <h3 class="card-title">История изменений статуса ${entityName ? '(' + escapeHtml(entityName) + ')' : ''}</h3>
        <div id="status-history-content">
          ${timelineHtml}
        </div>
      </div>`;

    // Сохраняем историю для фильтрации
    window._statusHistory = history;
    window._statusHistoryEntityName = entityName;
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

function filterStatusHistory() {
  const statusFilter = document.getElementById('sh-filter-status')?.value || '';
  const dateFrom = document.getElementById('sh-filter-from')?.value || '';
  const dateTo = document.getElementById('sh-filter-to')?.value || '';

  const history = window._statusHistory || [];
  const container = document.getElementById('status-history-content');
  if (!container) return;

  let filtered = [...history];

  if (statusFilter) {
    filtered = filtered.filter(h => h.old_status === statusFilter || h.new_status === statusFilter);
  }
  if (dateFrom) {
    const from = new Date(dateFrom);
    filtered = filtered.filter(h => new Date(h.changed_at) >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo + 'T23:59:59Z');
    filtered = filtered.filter(h => new Date(h.changed_at) <= to);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Записи не найдены</p></div>';
    return;
  }

  const sorted = filtered.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
  let html = '<div class="history-timeline">';
  sorted.forEach(h => {
    html += `
      <div class="history-item">
        <div class="history-date">${formatDate(h.changed_at)}</div>
        <div class="history-change">
          ${h.old_status ? badgeHTML(h.old_status) : '<span class="badge" style="background:#f1f5f9;color:#475569;">—</span>'}
          &nbsp;→&nbsp;
          ${badgeHTML(h.new_status)}
        </div>
        <div class="history-meta">
          ${h.changed_by_name ? `Изменил: <strong>${escapeHtml(h.changed_by_name)}</strong>` : ''}
          ${h.reason ? ` · ${escapeHtml(h.reason)}` : ''}
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// =====================
// Редактирование игрока
// =====================
async function renderPlayerEdit(id) {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    navigate('login');
    return;
  }

  const main = document.getElementById('main-content');
  try {
    const player = await api(`/players/${id}`);

    const isSelf = state.user && state.user.id === player._id.toString();
    const isAdmin = state.user && state.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      showToast('Нет прав для редактирования', 'error');
      navigate('player-detail', { id });
      return;
    }
    if (isAdmin && !isSelf && player.role === 'admin') {
      showToast('Нельзя редактировать другого администратора', 'error');
      navigate('player-detail', { id });
      return;
    }

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('player-detail',{id:'${player._id}'})" style="cursor:pointer;color:var(--primary);text-decoration:none;">← ${escapeHtml(player.username)}</a>
          &nbsp;/ Редактирование
        </span>
      </div>
      <div class="card" style="max-width:600px;">
        <h3 class="card-title">Редактирование игрока</h3>
        <form onsubmit="handleUpdatePlayer(event,'${player._id}')">
          <div class="form-group">
            <label>Логин</label>
            <input type="text" class="form-control" id="pe-username" value="${escapeHtml(player.username)}" ${(isSelf || isAdmin) ? '' : 'disabled'}>
            ${isSelf ? '<small style="color:var(--text-light)">Изменение логина потребует повторного входа</small>' : ''}
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" class="form-control" id="pe-email" value="${escapeHtml(player.email)}" ${(isSelf || isAdmin) ? '' : 'disabled'}>
          </div>
          <div class="form-group">
            <label>Комментарий</label>
            <textarea class="form-control" id="pe-comment" rows="3">${escapeHtml(player.comment || '')}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Статус</label>
              <select class="form-control" id="pe-status" ${isAdmin ? '' : 'disabled'}>
                <option value="active" ${player.status === 'active' ? 'selected' : ''}>Активен</option>
                <option value="banned" ${player.status === 'banned' ? 'selected' : ''}>Заблокирован</option>
                <option value="deleted" ${player.status === 'deleted' ? 'selected' : ''}>Удалён</option>
              </select>
            </div>
            <div class="form-group" id="pe-reason-group" style="display:none;">
              <label>Причина изменения статуса</label>
              <input type="text" class="form-control" id="pe-reason" placeholder="Укажите причину...">
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="pe-btn">Сохранить</button>
            <button type="button" class="btn btn-secondary" onclick="navigate('player-detail',{id:'${player._id}'})">Отмена</button>
          </div>
        </form>
      </div>`;

    const statusSelect = document.getElementById('pe-status');
    const originalStatus = player.status;
    statusSelect.addEventListener('change', () => {
      const rg = document.getElementById('pe-reason-group');
      rg.style.display = statusSelect.value !== originalStatus ? 'block' : 'none';
    });
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function handleUpdatePlayer(e, id) {
  e.preventDefault();
  const btn = document.getElementById('pe-btn');
  btn.disabled = true;

  try {
    const usernameEl = document.getElementById('pe-username');
    const emailEl = document.getElementById('pe-email');
    const body = {
      comment: document.getElementById('pe-comment').value.trim(),
      status: document.getElementById('pe-status').value,
      reason: document.getElementById('pe-reason')?.value?.trim() || ''
    };
    // Только если поля редактируемые (своя страница)
    if (usernameEl && !usernameEl.disabled) body.username = usernameEl.value.trim();
    if (emailEl && !emailEl.disabled) body.email = emailEl.value.trim();

    const updated = await api(`/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    // Обновляем localStorage если редактируем свой профиль
    if (state.user && state.user.id === id) {
      if (updated.username) state.user.username = updated.username;
      if (updated.email) state.user.email = updated.email;
      localStorage.setItem('user', JSON.stringify(state.user));
      updateHeader();
    }

    showToast('Профиль обновлён!', 'success');
    navigate('player-detail', { id });
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

// =====================
// Редактирование игры
// =====================
async function renderGameEdit(id) {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    navigate('login');
    return;
  }

  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="empty-state"><p>Загрузка...</p></div>';

  try {
    const { game, players } = await api(`/games/${id}/edit`);

    const playerOptions = players.map(p => {
      const label = p.type === 'player'
          ? `${p.username}`
          : `${p.name}`;
      return `<option value="${p._id}">${escapeHtml(label)} (${p.status})</option>`;
    }).join('');

    const winnerOptions = `<option value="null">Нет (ничья)</option>` + playerOptions;

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('game-detail',{id:'${id}'})" style="cursor:pointer;color:var(--primary);text-decoration:none;">
            ← Партия
          </a>
          &nbsp;/ Редактирование
        </span>
      </div>

      <div class="card">
        <h3 class="card-title">Редактирование партии</h3>
        <form onsubmit="handleUpdateGame(event, '${id}')">
          <div class="form-grid">
            <div class="form-group">
              <label>Режим</label>
              <select id="ge-mode" class="form-control">
                <option value="hotseat" ${game.mode === 'hotseat' ? 'selected' : ''}>Hotseat</option>
                <option value="bot" ${game.mode === 'bot' ? 'selected' : ''}>Бот</option>
              </select>
            </div>

            <div class="form-group">
              <label>Статус</label>
              <select id="ge-status" class="form-control">
                <option value="created" ${game.status === 'created' ? 'selected' : ''}>Создана</option>
                <option value="in_progress" ${game.status === 'in_progress' ? 'selected' : ''}>В процессе</option>
                <option value="completed" ${game.status === 'completed' ? 'selected' : ''}>Завершена</option>
                <option value="paused" ${game.status === 'paused' ? 'selected' : ''}>Пауза</option>
                <option value="abandoned" ${game.status === 'abandoned' ? 'selected' : ''}>Прервана</option>
              </select>
            </div>

            <div class="form-group">
              <label>Игрок 1</label>
              <select id="ge-player1" class="form-control">
                ${playerOptions}
              </select>
            </div>

            <div class="form-group">
              <label>Игрок 2</label>
              <select id="ge-player2" class="form-control">
                ${playerOptions}
              </select>
            </div>

            <div class="form-group">
              <label>Победитель</label>
              <select id="ge-winner" class="form-control">
                ${winnerOptions}
              </select>
            </div>

            <div class="form-group" id="ge-result-group" style="display:${(game.status === 'completed' || game.status === 'abandoned') ? 'block' : 'none'};">
              <label>Результат</label>
              <select id="ge-result" class="form-control">
                <option value="" ${!game.result ? 'selected' : ''}>Не определён</option>
                <option value="checkmate" ${game.result === 'checkmate' ? 'selected' : ''}>Мат</option>
                <option value="stalemate" ${game.result === 'stalemate' ? 'selected' : ''}>Пат</option>
                <option value="draw" ${game.result === 'draw' ? 'selected' : ''}>Ничья</option>
                <option value="resignation" ${game.result === 'resignation' ? 'selected' : ''}>Сдача</option>
                <option value="timeout" ${game.result === 'timeout' ? 'selected' : ''}>Время вышло</option>
              </select>
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label>Комментарий</label>
              <textarea id="ge-comment" class="form-control" rows="3">${escapeHtml(game.comment || '')}</textarea>
            </div>

            <div class="form-group" id="ge-reason-group" style="display:none;grid-column:1/-1;">
              <label>Причина изменения статуса</label>
              <input type="text" class="form-control" id="ge-reason" placeholder="Укажите причину...">
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="ge-btn">Сохранить</button>
            <button type="button" class="btn btn-secondary" onclick="navigate('game-detail',{id:'${id}'})">Отмена</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteGame('${id}')" style="margin-left:auto;">Удалить партию</button>
          </div>
        </form>
      </div>`;

    // Устанавливаем текущие значения select
    document.getElementById('ge-player1').value = game.player1_id;
    document.getElementById('ge-player2').value = game.player2_id;
    document.getElementById('ge-winner').value = game.winner_id || 'null';

    // Показываем поле причины при смене статуса
    const statusSelect = document.getElementById('ge-status');
    const originalStatus = game.status;
    const resultGroup = document.getElementById('ge-result-group');
    const resultSelect = document.getElementById('ge-result');
    statusSelect.addEventListener('change', () => {
      const reasonGroup = document.getElementById('ge-reason-group');
      reasonGroup.style.display = statusSelect.value !== originalStatus ? 'block' : 'none';

      const showResult = statusSelect.value === 'completed' || statusSelect.value === 'abandoned';
      resultGroup.style.display = showResult ? 'block' : 'none';
      if (!showResult) resultSelect.value = '';
    });

    // Устанавливаем игрока для нового хода
    if (game.moves && game.moves.length > 0) {
      const lastMove = game.moves[game.moves.length - 1];
      const lastPlayerId = lastMove.player_id.toString();
      // Следующий ход — другой игрок
      const nextPlayerId = lastPlayerId === game.player1_id.toString()
          ? game.player2_id
          : game.player1_id;
      const mvPlayer = document.getElementById('mv-player');
      if (mvPlayer) mvPlayer.value = nextPlayerId;
    }

  } catch (err) {
    console.error('Load game edit error:', err);
    main.innerHTML = `<div class="empty-state"><p>Ошибка загрузки: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function handleUpdateGame(event, gameId) {
  event.preventDefault();

  const btn = document.getElementById('ge-btn');
  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    const data = {
      mode: document.getElementById('ge-mode').value,
      status: document.getElementById('ge-status').value,
      player1_id: document.getElementById('ge-player1').value,
      player2_id: document.getElementById('ge-player2').value,
      winner_id: document.getElementById('ge-winner').value,
      result: document.getElementById('ge-result').value,
      comment: document.getElementById('ge-comment').value,
      reason: document.getElementById('ge-reason').value || ''
    };

    // Валидация на клиенте
    if (data.player1_id === data.player2_id) {
      showToast('Игрок 1 и Игрок 2 не могут совпадать', 'error');
      btn.disabled = false;
      btn.textContent = 'Сохранить';
      return;
    }

    if (data.status === 'completed' && !data.result) {
      showToast('Укажите результат для завершённой партии', 'error');
      btn.disabled = false;
      btn.textContent = 'Сохранить';
      return;
    }

    if (data.result === 'checkmate' && data.winner_id === 'null') {
      showToast('При мате должен быть указан победитель', 'error');
      btn.disabled = false;
      btn.textContent = 'Сохранить';
      return;
    }

    await api(`/games/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    showToast('Партия обновлена', 'success');
    navigate('game-detail', { id: gameId });
  } catch (err) {
    showToast(err.message || 'Ошибка обновления', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

async function confirmDeleteGame(gameId) {
  if (!confirm('Вы уверены, что хотите удалить эту партию? Это действие необратимо.')) {
    return;
  }

  try {
    await api(`/games/${gameId}`, { method: 'DELETE' });
    showToast('Партия удалена', 'success');
    navigate('games');
  } catch (err) {
    showToast(err.message || 'Ошибка удаления', 'error');
  }
}

// =====================
// Импорт/Экспорт
// =====================
function renderImportExport() {
  const main = document.getElementById('main-content');
  const isAdmin = !!state.user && state.user.role === 'admin';
  const gateAttr = isAdmin
    ? ''
    : (state.user
        ? 'disabled title="Доступно только администраторам"'
        : 'disabled title="Требуется авторизация"');

  main.innerHTML = `
    <div class="page-title"><span>Импорт / Экспорт данных</span></div>

    ${!isAdmin ? `
      <div class="card" style="max-width:900px;margin-bottom:16px;background:#fef3c7;color:#92400e;">
        ${state.user ? 'Импорт и экспорт доступны только администраторам.' : 'Импорт и экспорт доступны только авторизованным администраторам.'}
      </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px;">
      <div class="card">
        <h3 class="card-title">Экспорт</h3>
        <p style="color:var(--text-light);margin-bottom:16px;">Скачать все данные приложения (игроки, боты, партии) в формате JSON.</p>
        <button class="btn btn-primary" onclick="handleExport()" ${gateAttr}>Экспортировать всё</button>
      </div>

      <div class="card">
        <h3 class="card-title">Импорт</h3>
        <p style="color:var(--text-light);margin-bottom:12px;">Загрузить данные из JSON-файла, полученного при экспорте.</p>
        <div class="form-group">
          <label>Стратегия при конфликтах</label>
          <select class="form-control" id="imp-strategy" ${isAdmin ? '' : 'disabled'}>
            <option value="skip">Пропустить существующие</option>
            <option value="overwrite">Перезаписать</option>
            <option value="add">Добавить как новые</option>
          </select>
        </div>
        <div class="form-group">
          <label>Файл JSON</label>
          <input type="file" class="form-control" id="imp-file" accept=".json" ${isAdmin ? '' : 'disabled'}>
        </div>
        <button class="btn btn-primary" onclick="handleImport()" ${gateAttr}>Импортировать всё</button>
        <div id="imp-result" style="margin-top:12px;"></div>
      </div>
    </div>`;
}

async function handleExport() {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    return;
  }
  if (state.user.role !== 'admin') {
    showToast('Экспорт доступен только администраторам', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/export`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.status === 401) {
      logout();
      throw new Error('Сессия истекла, войдите заново');
    }
    if (res.status === 403) throw new Error('Экспорт доступен только администраторам');
    if (!res.ok) throw new Error('Ошибка экспорта');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспорт успешен!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleImport() {
  if (!state.user) {
    showToast('Необходимо авторизоваться', 'error');
    return;
  }
  if (state.user.role !== 'admin') {
    showToast('Импорт доступен только администраторам', 'error');
    return;
  }
  const fileInput = document.getElementById('imp-file');
  const strategy = document.getElementById('imp-strategy').value;
  const resultDiv = document.getElementById('imp-result');

  if (!fileInput.files[0]) {
    showToast('Выберите файл', 'error');
    return;
  }

  try {
    const text = await fileInput.files[0].text();
    const data = JSON.parse(text);

    const result = await api('/import', {
      method: 'POST',
      body: JSON.stringify({ ...data, strategy })
    });

    resultDiv.innerHTML = `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;">
        <strong>Импорт завершён:</strong>
        <ul style="margin-top:8px;padding-left:16px;">
          <li>Игроков: ${result.results.players}</li>
          <li>Ботов: ${result.results.bots}</li>
          <li>Партий: ${result.results.games}</li>
          ${result.results.errors.length > 0 ? `<li style="color:var(--danger)">Ошибок: ${result.results.errors.length}<ul style="margin-top:4px;">${result.results.errors.map(e => `<li style="font-size:0.85rem;">${escapeHtml(e)}</li>`).join('')}</ul></li>` : ''}
        </ul>
      </div>`;
    showToast('Импорт завершён!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    resultDiv.innerHTML = `<div style="color:var(--danger)">Ошибка: ${escapeHtml(err.message)}</div>`;
  }
}

// =====================
// Инициализация
// =====================
document.addEventListener('DOMContentLoaded', () => {
  updateHeader();

  // Enter в фильтрах применяет фильтр
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const filtersBody = e.target.closest('.filters-body');
    if (!filtersBody) return;
    const applyBtn = filtersBody.querySelector('.filters-actions .btn-primary');
    if (applyBtn) applyBtn.click();
  });

  // Навигация по hash
  window.addEventListener('popstate', () => {
    const { page, params } = parseHash(window.location.hash);
    navigate(page, params, false);
  });

  const hash = window.location.hash;
  if (hash && hash !== '#' && hash !== '#home') {
    const { page, params } = parseHash(hash);
    navigate(page, params, false);
  } else {
    navigate('home');
  }
});