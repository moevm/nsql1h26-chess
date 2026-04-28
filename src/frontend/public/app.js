// =====================
// Состояния
// =====================
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
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

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Ошибка ${res.status}`);
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
function navigate(page, params = {}) {
  state.currentPage = page;
  state.pageParams = params;

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
    case 'import-export': renderImportExport(); break;
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
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        ${state.user ? `<button class="btn btn-primary" onclick="navigate('game-create')">Новая партия</button>` : ''}
        <button class="btn btn-secondary" onclick="navigate('games')">Смотреть партии</button>
        <button class="btn btn-secondary" onclick="navigate('players')">Игроки</button>
        <button class="btn btn-secondary" onclick="navigate('bots')">Боты</button>
      </div>
      ${statsHtml}
    </div>`;
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
            <label>Режим</label>
            <select id="gf-mode">
              <option value="">Все</option>
              <option value="hotseat">Hotseat</option>
              <option value="bot">Бот</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Статус</label>
            <select id="gf-status">
              <option value="">Все</option>
              <option value="created">Создана</option>
              <option value="in_progress">В процессе</option>
              <option value="completed">Завершена</option>
              <option value="abandoned">Прервана</option>
              <option value="paused">Пауза</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Результат</label>
            <select id="gf-result">
              <option value="">Все</option>
              <option value="checkmate">Мат</option>
              <option value="stalemate">Пат</option>
              <option value="draw">Ничья</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Участник (имя)</label>
            <input type="text" id="gf-player" placeholder="Поиск по имени...">
          </div>
          <div class="filter-group">
            <label>Комментарий</label>
            <input type="text" id="gf-comment" placeholder="Поиск в комментариях...">
          </div>
          <div class="filter-group">
            <label>Дата создания (от)</label>
            <input type="date" id="gf-date-from">
          </div>
          <div class="filter-group">
            <label>Дата создания (до)</label>
            <input type="date" id="gf-date-to">
          </div>
          <div class="filter-group">
            <label>Кол-во ходов</label>
            <div class="filter-range">
              <input type="number" id="gf-moves-min" placeholder="От" min="0">
              <input type="number" id="gf-moves-max" placeholder="До" min="0">
            </div>
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
  gamesFilters = {
    mode: document.getElementById('gf-mode').value,
    status: document.getElementById('gf-status').value,
    result: document.getElementById('gf-result').value,
    player_name: document.getElementById('gf-player').value,
    comment: document.getElementById('gf-comment').value,
    created_from: document.getElementById('gf-date-from').value,
    created_to: document.getElementById('gf-date-to').value,
    moves_min: document.getElementById('gf-moves-min').value,
    moves_max: document.getElementById('gf-moves-max').value
  };
  gamesPage = 1;
  loadGames();
}

function resetGamesFilters() {
  ['gf-mode', 'gf-status', 'gf-result', 'gf-player', 'gf-comment', 'gf-date-from', 'gf-date-to', 'gf-moves-min', 'gf-moves-max']
      .forEach(id => { document.getElementById(id).value = ''; });
  gamesFilters = {};
  gamesPage = 1;
  loadGames();
}

function changeGamesPage(p) {
  gamesPage = p;
  loadGames();
}

function sortGames(field) {
  if (gamesSortBy === field) {
    gamesSortDir = gamesSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    gamesSortBy = field;
    gamesSortDir = 'desc';
  }
  loadGames();
}

async function loadGames() {
  const container = document.getElementById('games-table-container');
  if (!container) return;

  const params = new URLSearchParams();
  params.set('page', gamesPage);
  params.set('limit', 15);
  params.set('sort_by', gamesSortBy);
  params.set('sort_dir', gamesSortDir);

  Object.entries(gamesFilters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });

  try {
    const result = await api(`/games?${params}`);
    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>Партии не найдены</p></div>';
      return;
    }

    const sortIcon = (field) => {
      if (gamesSortBy !== field) return '';
      return `<span class="sort-icon">${gamesSortDir === 'asc' ? '▲' : '▼'}</span>`;
    };

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th onclick="sortGames('mode')">Режим ${sortIcon('mode')}</th>
              <th onclick="sortGames('status')">Статус ${sortIcon('status')}</th>
              <th>Игрок 1</th>
              <th>Игрок 2</th>
              <th>Победитель</th>
              <th onclick="sortGames('result')">Результат ${sortIcon('result')}</th>
              <th>Комментарий</th>
              <th onclick="sortGames('created_at')">Дата ${sortIcon('created_at')}</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(g => {
      html += `
        <tr class="clickable" onclick="navigate('game-detail', {id:'${g._id}'})">
          <td>${badgeHTML(g.mode)}</td>
          <td>${badgeHTML(g.status)}</td>
          <td>${escapeHtml(g.player1_name)}</td>
          <td>${escapeHtml(g.player2_name)}</td>
<td>${g.winner_name ? escapeHtml(g.winner_name) : '—'}</td>
          <td>${g.result ? badgeHTML(g.result) : '—'}</td>
          <td>${escapeHtml(g.comment) || '—'}</td>
          <td>${formatDateShort(g.created_at)}</td>
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
  try {
    const game = await api(`/games/${id}`);

    let movesHtml = '';
    if (game.moves && game.moves.length > 0) {
      movesHtml = `
        <div class="card">
          <h3 class="card-title">Ходы (${game.moves.length})</h3>
          <div class="moves-container">
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Игрок</th>
                  <th>Фигура</th>
                  <th>Откуда</th>
                  <th>Куда</th>
                  <th>Взятие</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                ${game.moves.map(m => `
                  <tr>
                    <td>${m.move_number}</td>
                    <td>${escapeHtml(m.player_name)}</td>
                    <td>${escapeHtml(m.piece)}</td>
                    <td>${escapeHtml(m.from_sq)}</td>
                    <td>${escapeHtml(m.to_sq)}</td>
                    <td>${m.captured ? escapeHtml(m.captured) : '—'}</td>
                    <td>${formatDate(m.timestamp)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }

    main.innerHTML = `
      <div class="page-title">
        <span>
          <a onclick="navigate('games')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Партии</a>
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
        </div>
      </div>

      ${movesHtml}`;
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
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

    const playerOptions = participants
        .filter(p => p.type === 'player')
        .map(p => `<option value="${p._id}">${escapeHtml(p.display_name)}</option>`)
        .join('');

    const allOptions = participants
        .map(p => `<option value="${p._id}">${escapeHtml(p.display_name)}</option>`)
        .join('');

    main.innerHTML = `
      <div class="page-title">
        <span><a onclick="navigate('games')" style="cursor:pointer;color:var(--primary);text-decoration:none;">← Партии</a> / Новая партия</span>
      </div>
      <div class="card" style="max-width:600px;">
        <h3 class="card-title">Создание партии</h3>
        <form onsubmit="handleCreateGame(event)">
          <div class="form-group">
            <label>Режим</label>
            <select class="form-control" id="gc-mode" onchange="updateGameCreatePlayers()" required>
              <option value="hotseat">Игрок vs Игрок (hotseat)</option>
              <option value="bot">Игрок vs Бот</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Игрок 1</label>
              <select class="form-control" id="gc-player1" required>
                ${playerOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Игрок 2</label>
              <select class="form-control" id="gc-player2" required>
                <option value="">— Выберите —</option>
                ${allOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Комментарий</label>
            <input type="text" class="form-control" id="gc-comment" placeholder="Необязательно">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="gc-btn">Создать партию</button>
            <button type="button" class="btn btn-secondary" onclick="navigate('games')">Отмена</button>
          </div>
        </form>
      </div>`;

    // Устанавливаем текущего пользователя как игрока 1
    const p1Select = document.getElementById('gc-player1');
    if (state.user) {
      for (const opt of p1Select.options) {
        if (opt.value === state.user.id) {
          opt.selected = true;
          break;
        }
      }
    }
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
  }
}

function updateGameCreatePlayers() {
  // Можно расширить логику фильтрации при смене режима
}

async function handleCreateGame(e) {
  e.preventDefault();
  const btn = document.getElementById('gc-btn');
  btn.disabled = true;

  try {
    const game = await api('/games', {
      method: 'POST',
      body: JSON.stringify({
        mode: document.getElementById('gc-mode').value,
        player1_id: document.getElementById('gc-player1').value,
        player2_id: document.getElementById('gc-player2').value,
        comment: document.getElementById('gc-comment').value
      })
    });

    showToast('Партия создана!', 'success');
    navigate('game-detail', { id: game._id });
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
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
          <td>${formatDateShort(p.created_at)}</td>
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

  try {
    const player = await api(`/players/${id}`);

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
          <div class="profile-stat">
            <div class="value" style="color:var(--primary)">${player.stats.elo}</div>
            <div class="label">ELO</div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="navigate('status-history',{type:'player',id:'${player._id}'})">История статусов</button>
        ${state.user ? `<button class="btn btn-secondary btn-sm" style="margin-left:8px;" onclick="navigate('player-edit',{id:'${player._id}'})">✏ Редактировать</button>` : ''}
      </div>

      <div class="card">
        <h3 class="card-title">Последние партии</h3>
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

function changePlayerGamesPage(p) {
  playerGamesPage = p;
  const id = state.pageParams?.id || state.user?.id;
  loadPlayerGames(id);
}

async function loadPlayerGames(playerId) {
  const container = document.getElementById('player-games-container');
  if (!container) return;

  try {
    const result = await api(`/players/${playerId}/games?page=${playerGamesPage}&limit=10`);

    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Партий пока нет</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Режим</th>
              <th>Статус</th>
              <th>Соперник</th>
              <th>Результат</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(g => {
      const isP1 = g.player1_id.toString() === playerId;
      const opponent = isP1 ? g.player2_name : g.player1_name;
      let outcome = '—';
      if (g.winner_id) {
        outcome = g.winner_id.toString() === playerId
            ? '<span style="color:var(--success);font-weight:600;">Победа</span>'
            : '<span style="color:var(--danger);font-weight:600;">Поражение</span>';
      } else if (g.result === 'draw' || g.result === 'stalemate') {
        outcome = '<span style="color:var(--warning);font-weight:600;">Ничья</span>';
      }

      html += `
        <tr class="clickable" onclick="navigate('game-detail',{id:'${g._id}'})">
          <td>${badgeHTML(g.mode)}</td>
          <td>${badgeHTML(g.status)}</td>
          <td>${escapeHtml(opponent)}</td>
          <td>${outcome}</td>
          <td>${formatDateShort(g.created_at)}</td>
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
      ${state.user ? '<button class="btn btn-primary" onclick="navigate(\'bot-create\')">+ Создать бота</button>' : ''}
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
            <label>API URL</label>
            <input type="text" id="bf-api-url" placeholder="Поиск по URL...">
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
    api_url: document.getElementById('bf-api-url').value,
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
    created_to: document.getElementById('bf-date-to').value
  };
  botsPage = 1;
  loadBots();
}

function resetBotsFilters() {
  ['bf-name','bf-api-url','bf-status',
    'bf-wins-min','bf-wins-max','bf-losses-min','bf-losses-max',
    'bf-draws-min','bf-draws-max','bf-elo-min','bf-elo-max',
    'bf-date-from','bf-date-to']
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
              <th>API URL</th>
              <th onclick="sortBots('status')">Статус ${sortIcon('status')}</th>
              <th onclick="sortBots('stats.wins')">Победы ${sortIcon('stats.wins')}</th>
              <th onclick="sortBots('stats.losses')">Поражения ${sortIcon('stats.losses')}</th>
              <th onclick="sortBots('stats.draws')">Ничьи ${sortIcon('stats.draws')}</th>
              <th onclick="sortBots('stats.total_games')">Всего ${sortIcon('stats.total_games')}</th>
              <th onclick="sortBots('stats.elo')">ELO ${sortIcon('stats.elo')}</th>
              <th onclick="sortBots('created_at')">Создан ${sortIcon('created_at')}</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(b => {
      html += `
        <tr>
          <td><strong style="cursor:pointer;color:var(--primary);" onclick="navigate('bot-detail',{id:'${b._id}'})">${escapeHtml(b.name)}</strong></td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(b.api_url)}">${escapeHtml(b.api_url)}</td>
          <td>${badgeHTML(b.status)}</td>
          <td>${b.stats.wins}</td>
          <td>${b.stats.losses}</td>
          <td>${b.stats.draws}</td>
          <td>${b.stats.total_games}</td>
          <td>${b.stats.elo ?? 0}</td>
          <td>${formatDateShort(b.created_at)}</td>
          <td>
            ${state.user ? `
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();navigate('bot-edit',{id:'${b._id}'})">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();confirmDeleteBot('${b._id}','${escapeHtml(b.name)}')">🗑️</button>
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
            <button class="btn btn-secondary btn-sm" onclick="navigate('bot-edit',{id:'${bot._id}'})">✏Редактировать</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteBot('${bot._id}','${escapeHtml(bot.name)}')">Удалить</button>
          </div>
        ` : ''}
      </div>

      <div class="card">
        <div class="profile-header">
          <div class="profile-avatar" style="background:var(--warning);"></div>
          <div class="profile-info">
            <h2>${escapeHtml(bot.name)} ${badgeHTML(bot.status)}</h2>
            <p><a href="${escapeHtml(bot.api_url)}" target="_blank" style="color:var(--primary);">${escapeHtml(bot.api_url)}</a></p>
            <p>Создан: ${formatDate(bot.created_at)}</p>
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
          <div class="profile-stat">
            <div class="value" style="color:var(--primary)">${bot.stats.elo}%</div>
            <div class="label">ELO</div>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="navigate('status-history',{type:'bot',id:'${bot._id}'})">История статусов</button>
      </div>

      <div class="card">
        <h3 class="card-title">Последние партии</h3>
        <div id="bot-games-container">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>`;

    loadBotGames(id);
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(err.message)}</p></div>`;
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
    const result = await api(`/players/${botId}/games?page=${botGamesPage}&limit=10`);

    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Партий пока нет</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Режим</th>
              <th>Статус</th>
              <th>Соперник</th>
              <th>Результат</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>`;

    result.data.forEach(g => {
      const isP1 = g.player1_id.toString() === botId;
      const opponent = isP1 ? g.player2_name : g.player1_name;
      let outcome = '—';
      if (g.winner_id) {
        outcome = g.winner_id.toString() === botId
            ? '<span style="color:var(--success);font-weight:600;">Победа</span>'
            : '<span style="color:var(--danger);font-weight:600;">Поражение</span>';
      } else if (g.result === 'draw' || g.result === 'stalemate') {
        outcome = '<span style="color:var(--warning);font-weight:600;">Ничья</span>';
      }

      html += `
        <tr class="clickable" onclick="navigate('game-detail',{id:'${g._id}'})">
          <td>${badgeHTML(g.mode)}</td>
          <td>${badgeHTML(g.status)}</td>
          <td>${escapeHtml(opponent)}</td>
          <td>${outcome}</td>
          <td>${formatDateShort(g.created_at)}</td>
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
          <label>API URL *</label>
          <input type="url" class="form-control" id="bc-api-url" placeholder="https://bot.example.com/api/move" required>
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
        api_url: document.getElementById('bc-api-url').value.trim(),
        comment: document.getElementById('bc-comment').value.trim()
      })
    });

    showToast('Бот создан!', 'success');
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
            <label>API URL *</label>
            <input type="url" class="form-control" id="be-api-url" value="${escapeHtml(bot.api_url)}" required>
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
      api_url: document.getElementById('be-api-url').value.trim(),
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
              ${h.changed_by_name ? `${escapeHtml(h.changed_by_name)}` : ''}
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
          ${h.changed_by_name ? `${escapeHtml(h.changed_by_name)}` : ''}
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
            <input type="text" class="form-control" value="${escapeHtml(player.username)}" disabled>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="text" class="form-control" value="${escapeHtml(player.email)}" disabled>
          </div>
          <div class="form-group">
            <label>Комментарий</label>
            <textarea class="form-control" id="pe-comment" rows="3">${escapeHtml(player.comment || '')}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Статус</label>
              <select class="form-control" id="pe-status">
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
    await api(`/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        comment: document.getElementById('pe-comment').value.trim(),
        status: document.getElementById('pe-status').value,
        reason: document.getElementById('pe-reason')?.value?.trim() || ''
      })
    });
    showToast('Профиль обновлён!', 'success');
    navigate('player-detail', { id });
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

// =====================
// Импорт/Экспорт
// =====================
function renderImportExport() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title"><span>Импорт / Экспорт данных</span></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px;">
      <div class="card">
        <h3 class="card-title">Экспорт</h3>
        <p style="color:var(--text-light);margin-bottom:16px;">Скачать все данные приложения (игроки, боты, партии) в формате JSON.</p>
        <button class="btn btn-primary" onclick="handleExport()">Экспортировать всё</button>
      </div>

      <div class="card">
        <h3 class="card-title">Импорт</h3>
        <p style="color:var(--text-light);margin-bottom:12px;">Загрузить данные из JSON-файла, полученного при экспорте.</p>
        <div class="form-group">
          <label>Стратегия при конфликтах</label>
          <select class="form-control" id="imp-strategy">
            <option value="skip">Пропустить существующие</option>
            <option value="overwrite">Перезаписать</option>
            <option value="add">Добавить как новые</option>
          </select>
        </div>
        <div class="form-group">
          <label>Файл JSON</label>
          <input type="file" class="form-control" id="imp-file" accept=".json">
        </div>
        <button class="btn btn-primary" onclick="handleImport()" ${state.user ? '' : 'disabled title="Требуется авторизация"'}>Импортировать всё</button>
        <div id="imp-result" style="margin-top:12px;"></div>
      </div>
    </div>`;
}

async function handleExport() {
  try {
    const res = await fetch(`${API_BASE}/export`, {
      headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
    });
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
          ${result.results.errors.length > 0 ? `<li style="color:var(--danger)">Ошибок: ${result.results.errors.length}</li>` : ''}
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
  navigate('home');
});