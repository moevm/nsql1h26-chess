'use strict';

(function () {
  // Используем «закрашенные» глифы (U+265A..F) для обоих цветов:
  // у «контурных» (U+2654..9) центр прозрачный и на тёмных клетках просвечивает.
  // Цвет фигуры задаётся через CSS fill (см. .cc-piece.white / .black в chess.css).
  const FILLED = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  const PIECE_GLYPH = { w: FILLED, b: FILLED };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RINGS = 4;
  const SECTORS = 16;
  const CX = 0, CY = 0;
  const R_OUTER = 90;
  const R_INNER_HOLE = 20;
  const RING_THICKNESS = (R_OUTER - R_INNER_HOLE) / RINGS;

  const TERMINAL_STATUSES = ['checkmate', 'stalemate', 'threefold', 'resigned', 'draw', 'abandoned'];
  const isTerminal = (status) => TERMINAL_STATUSES.indexOf(status) !== -1;

  // Cell (ring r, sector s) maps to:
  //   radii [R_OUTER - (r+1)*RING_THICKNESS, R_OUTER - r*RING_THICKNESS]
  //   angle [-π/2 + s*step, -π/2 + (s+1)*step]
  function cellGeometry(r, s) {
    const rOuter = R_OUTER - r * RING_THICKNESS;
    const rInner = rOuter - RING_THICKNESS;
    const step = (2 * Math.PI) / SECTORS;
    const a1 = -Math.PI / 2 + s * step;
    const a2 = a1 + step;
    return { rOuter, rInner, a1, a2 };
  }

  function cellPath(r, s) {
    const g = cellGeometry(r, s);
    const x1o = CX + g.rOuter * Math.cos(g.a1);
    const y1o = CY + g.rOuter * Math.sin(g.a1);
    const x2o = CX + g.rOuter * Math.cos(g.a2);
    const y2o = CY + g.rOuter * Math.sin(g.a2);
    const x1i = CX + g.rInner * Math.cos(g.a1);
    const y1i = CY + g.rInner * Math.sin(g.a1);
    const x2i = CX + g.rInner * Math.cos(g.a2);
    const y2i = CY + g.rInner * Math.sin(g.a2);
    return [
      `M ${x1i} ${y1i}`,
      `L ${x1o} ${y1o}`,
      `A ${g.rOuter} ${g.rOuter} 0 0 1 ${x2o} ${y2o}`,
      `L ${x2i} ${y2i}`,
      `A ${g.rInner} ${g.rInner} 0 0 0 ${x1i} ${y1i}`,
      'Z'
    ].join(' ');
  }

  function cellCenter(r, s) {
    const g = cellGeometry(r, s);
    const midR = (g.rOuter + g.rInner) / 2;
    const midA = (g.a1 + g.a2) / 2;
    return { x: CX + midR * Math.cos(midA), y: CY + midR * Math.sin(midA), midR };
  }

  function isDarkCell(r, s) {
    return (r + s) % 2 === 0;
  }

  // ===== API =====
  function authHeaders(extra) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  async function api(path, opts) {
    const res = await fetch('/api' + path, Object.assign({
      headers: authHeaders((opts && opts.headers) || {}),
      method: 'GET'
    }, opts || {}));
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    if (!res.ok) {
      const msg = (body && body.error) || res.statusText || 'Ошибка запроса';
      throw new Error(msg);
    }
    return body;
  }

  // ===== Toast =====
  function toast(msg, kind) {
    const c = document.getElementById('toast-container');
    if (!c) { alert(msg); return; }
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Защищённое чтение пользователя из localStorage. Если там оказался
  // мусор (например, `[object Object]` от старой сборки или ручная правка),
  // обычный JSON.parse падал с «unexpected character at line 1 column 1» и
  // ронял весь скрипт — больница: чистим хранилище и возвращаем null.
  function safeUser() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch {
      console.warn('chess.js: повреждённый localStorage.user, очищаем');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  }

  // ===== Board rendering =====
  function renderBoard(host, boardState, opts) {
    opts = opts || {};
    const selected = opts.selected || null;
    const legalDests = opts.legalDests || [];
    const lastMove = opts.lastMove || null;

    while (host.firstChild) host.removeChild(host.firstChild);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-100 -100 200 200');
    host.appendChild(svg);

    // Cells
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', cellPath(r, s));
        let cls = 'cc-cell' + (isDarkCell(r, s) ? ' dark' : '');
        if (selected && selected.r === r && selected.s === s) cls += ' selected';
        const matchingDest = legalDests.find(d => d.to.r === r && d.to.s === s);
        if (matchingDest) {
          cls += matchingDest.captured ? ' legal-capture' : ' legal';
        }
        if (lastMove && (
          (lastMove.from && lastMove.from.r === r && lastMove.from.s === s) ||
          (lastMove.to && lastMove.to.r === r && lastMove.to.s === s)
        )) cls += ' last-move';
        path.setAttribute('class', cls);
        path.dataset.r = r;
        path.dataset.s = s;
        svg.appendChild(path);
      }
    }

    // Pieces
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const p = boardState[r][s];
        if (!p) continue;
        const c = cellCenter(r, s);
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', c.x);
        text.setAttribute('y', c.y);
        const fontSize = Math.max(11, Math.min(15, c.midR * 0.2));
        text.setAttribute('font-size', fontSize);
        text.setAttribute('class', 'cc-piece ' + (p.color === 'w' ? 'white' : 'black'));
        text.textContent = PIECE_GLYPH[p.color][p.type] || '?';
        svg.appendChild(text);
      }
    }
    return svg;
  }

  // ===== Game view =====
  let currentGame = null;
  let pollTimer = null;
  let selected = null;
  let legalMovesFromSelected = [];
  let paused = false;

  function navigateGame(id) {
    history.pushState({ gameId: id }, '', '?game=' + id);
    openGame(id);
  }

  async function openGame(id) {
    selected = null;
    legalMovesFromSelected = [];
    paused = false;
    updatePauseUI();
    await loadGame(id);
  }

  async function loadGame(id) {
    try {
      const game = await api('/cc/games/' + id);
      currentGame = game;
      renderGameView(game);
      schedulePoll();
    } catch (e) {
      toast('Ошибка загрузки партии: ' + e.message, 'error');
    }
  }

  function renderGameView(game) {
    document.getElementById('white-name').textContent = game.white_name || '—';
    document.getElementById('black-name').textContent = game.black_name || '—';

    const cmt = document.getElementById('game-comment');
    const cmtText = document.getElementById('game-comment-text');
    if (cmt && cmtText) {
      if (game.comment && game.comment.trim()) {
        cmtText.textContent = game.comment;
        cmt.classList.remove('hidden');
      } else {
        cmtText.textContent = '';
        cmt.classList.add('hidden');
      }
    }

    const status = document.getElementById('status-bar');
    const sidePrefix = game.hotseat ? 'Hotseat — ход ' : 'Идёт партия — ход ';
    const labels = {
      active: sidePrefix + (game.turn === 'w' ? 'белых' : 'чёрных'),
      check: 'Шах! Ход ' + (game.turn === 'w' ? 'белых' : 'чёрных'),
      checkmate: 'Мат. Победили ' + (game.turn === 'w' ? 'чёрные' : 'белые'),
      stalemate: 'Пат. Ничья.',
      threefold: 'Троекратное повторение. Ничья.',
      resigned: 'Игрок сдался.',
      draw: 'Ничья по соглашению.',
      abandoned: 'Партия прервана.'
    };
    status.textContent = labels[game.status] || game.status;
    status.className = 'status-bar';
    if (game.status === 'check') status.classList.add('in-check');
    if (isTerminal(game.status)) status.classList.add('terminal');

    const terminal = isTerminal(game.status);
    ['btn-pause', 'btn-draw', 'btn-resign', 'btn-leave'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = terminal;
    });

    const cc = window.CircularChess;
    const board = cc.fromFEN(game.fen).board;

    const moves = game.moves || [];
    const lastMove = moves.length ? moves[moves.length - 1] : null;

    renderBoard(document.getElementById('board-host'), board, {
      selected,
      legalDests: legalMovesFromSelected,
      lastMove
    });

    // Wire click handlers
    document.querySelectorAll('#board-host path.cc-cell').forEach(el => {
      el.addEventListener('click', onCellClick);
    });

    renderMoveList(moves);
  }

  // Move list: plies grouped into full moves, with a piece icon next to each.
  function renderMoveList(moves) {
    const host = document.getElementById('move-list');
    host.innerHTML = '';
    if (!moves.length) {
      host.innerHTML = '<div class="move-empty">Ходов пока нет</div>';
      return;
    }
    const rows = new Map();
    moves.forEach(m => {
      const no = Math.max(1, Math.ceil(m.number / 2));
      if (!rows.has(no)) rows.set(no, { no, w: null, b: null });
      rows.get(no)[m.color === 'w' ? 'w' : 'b'] = m;
    });

    const table = document.createElement('table');
    table.className = 'move-table';
    for (const row of rows.values()) {
      const tr = document.createElement('tr');
      const noCell = document.createElement('td');
      noCell.className = 'move-no';
      noCell.textContent = row.no + '.';
      tr.appendChild(noCell);
      tr.appendChild(moveCell(row.w));
      tr.appendChild(moveCell(row.b));
      table.appendChild(tr);
    }
    host.appendChild(table);
    host.scrollTop = host.scrollHeight;
  }

  function moveCell(m) {
    const td = document.createElement('td');
    td.className = 'move-cell';
    if (!m) return td;
    if (m.is_castling) td.classList.add('is-castling');
    if (m.is_checkmate) td.classList.add('is-mate');
    else if (m.is_check) td.classList.add('is-check');

    const glyph = (PIECE_GLYPH[m.color] || {})[m.piece_type];
    if (glyph) {
      const icon = document.createElement('span');
      icon.className = 'move-piece ' + (m.color === 'w' ? 'white' : 'black');
      icon.textContent = glyph;
      td.appendChild(icon);
    }
    const not = document.createElement('span');
    not.className = 'move-not';
    not.textContent = m.notation;
    if (m.captured) not.classList.add('is-capture');
    td.appendChild(not);

    // Маркеры в стиле обычной шахматной нотации: + шах, # мат, ⟳ рокировка.
    if (m.is_castling) {
      const mk = document.createElement('span');
      mk.className = 'move-marker castle';
      mk.textContent = '⟳';
      mk.title = 'Рокировка';
      td.appendChild(mk);
    }
    if (m.is_checkmate) {
      const mk = document.createElement('span');
      mk.className = 'move-marker mate';
      mk.textContent = '#';
      mk.title = 'Мат';
      td.appendChild(mk);
    } else if (m.is_check) {
      const mk = document.createElement('span');
      mk.className = 'move-marker check';
      mk.textContent = '+';
      mk.title = 'Шах';
      td.appendChild(mk);
    }
    return td;
  }

  async function onCellClick(ev) {
    if (!currentGame || paused) return;
    const r = parseInt(ev.currentTarget.dataset.r, 10);
    const s = parseInt(ev.currentTarget.dataset.s, 10);

    const cc = window.CircularChess;
    const board = cc.fromFEN(currentGame.fen).board;
    const piece = board[r][s];

    // If we already have a selection, try to make a move
    if (selected) {
      const dest = legalMovesFromSelected.find(m => m.to.r === r && m.to.s === s);
      if (dest) {
        await tryMove(selected, dest);
        return;
      }
    }

    // Else, select if it's our piece and our turn
    if (piece && piece.color === currentGame.turn && isOurTurn(currentGame)) {
      try {
        const res = await api('/cc/games/' + currentGame._id + '/legal-moves?from=r' + r + 's' + s);
        selected = { r, s };
        legalMovesFromSelected = res.moves || [];
        renderGameView(currentGame);
      } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
      }
    } else {
      selected = null;
      legalMovesFromSelected = [];
      renderGameView(currentGame);
    }
  }

  function isOurTurn(game) {
    const u = safeUser();
    if (!u) return false;
    if (game.hotseat) {
      // In hotseat the local user controls both sides, but only if they're a participant.
      const uid = String(u._id || u.id);
      return uid === String(game.white_id) || uid === String(game.black_id);
    }
    const sideId = game.turn === 'w' ? game.white_id : game.black_id;
    return String(sideId) === String(u._id || u.id);
  }

  async function tryMove(from, candidate) {
    let promo = null;
    const promoMatches = legalMovesFromSelected.filter(m =>
      m.to.r === candidate.to.r && m.to.s === candidate.to.s && m.promotion
    );
    if (promoMatches.length > 0) {
      promo = await pickPromotion();
      if (!promo) return;
    }
    try {
      const body = {
        from: { r: from.r, s: from.s },
        to: { r: candidate.to.r, s: candidate.to.s },
        promotion: promo
      };
      const res = await api('/cc/games/' + currentGame._id + '/moves', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      currentGame = res.game;
      selected = null;
      legalMovesFromSelected = [];
      renderGameView(currentGame);
      schedulePoll();
    } catch (e) {
      toast('Ход отклонён: ' + e.message, 'error');
    }
  }

  function pickPromotion() {
    return new Promise(resolve => {
      const dlg = document.getElementById('dlg-promo');
      const onClick = (ev) => {
        const promo = ev.target.dataset.promo;
        if (!promo) return;
        cleanup();
        resolve(promo);
      };
      const onCancel = () => { cleanup(); resolve(null); };
      function cleanup() {
        dlg.querySelectorAll('button[data-promo]').forEach(b =>
          b.removeEventListener('click', onClick));
        dlg.removeEventListener('cancel', onCancel);
        dlg.close();
      }
      dlg.querySelectorAll('button[data-promo]').forEach(b =>
        b.addEventListener('click', onClick));
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
    });
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!currentGame) return;
    if (paused) return;
    if (currentGame.hotseat) return; // No remote opponent to wait for
    if (isTerminal(currentGame.status)) return;
    if (isOurTurn(currentGame)) return;
    pollTimer = setTimeout(async () => {
      try {
        const game = await api('/cc/games/' + currentGame._id);
        if (game.move_number !== currentGame.move_number || game.status !== currentGame.status) {
          currentGame = game;
          renderGameView(currentGame);
        }
      } catch {}
      schedulePoll();
    }, 2500);
  }

  // ===== Pause (local only — lets a player step away from the board) =====
  function updatePauseUI() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.toggle('hidden', !paused);
    // Текст кнопки не меняем (иначе строка прыгает по ширине);
    // активное состояние показываем рамкой через CSS-класс.
    const btn = document.getElementById('btn-pause');
    if (btn) btn.classList.toggle('is-active', paused);
  }

  function setPaused(value) {
    paused = value;
    updatePauseUI();
    if (paused) {
      clearTimeout(pollTimer);
    } else if (currentGame) {
      renderGameView(currentGame);
      schedulePoll();
    }
  }

  // Привязка обработчика с защитой от устаревшего/кешированного HTML:
  // если элемента нет в DOM, просто пропускаем, а не роняем весь скрипт.
  function bind(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const u = safeUser();
    const userDisplay = document.getElementById('user-display');
    if (u && userDisplay) {
      userDisplay.textContent = u.username || u.name || '';
    }

    bind('btn-pause', 'click', () => {
      if (!currentGame || isTerminal(currentGame.status)) return;
      setPaused(!paused);
    });
    bind('btn-resume', 'click', () => setPaused(false));

    bind('btn-resign', 'click', async () => {
      if (!currentGame || !confirm('Сдаться в этой партии?')) return;
      try {
        const game = await api('/cc/games/' + currentGame._id + '/resign', { method: 'POST' });
        currentGame = game;
        renderGameView(currentGame);
      } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
      }
    });

    bind('btn-draw', 'click', async () => {
      if (!currentGame || !confirm('Завершить партию вничью по соглашению?')) return;
      try {
        const game = await api('/cc/games/' + currentGame._id + '/draw', { method: 'POST' });
        currentGame = game;
        renderGameView(currentGame);
        toast('Партия завершена вничью', 'success');
      } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
      }
    });

    bind('btn-edit', 'click', async () => {
      if (!currentGame) return;
      const next = prompt('Комментарий к партии:', currentGame.comment || '');
      if (next == null) return; // отмена
      try {
        const game = await api('/cc/games/' + currentGame._id, {
          method: 'PATCH',
          body: JSON.stringify({ comment: next })
        });
        currentGame = game;
        renderGameView(currentGame);
        toast('Сохранено', 'success');
      } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
      }
    });

    bind('btn-leave', 'click', async () => {
      if (!currentGame) return;
      if (!confirm('Покинуть партию? Она будет помечена как прерванная.')) return;
      try {
        await api('/cc/games/' + currentGame._id + '/abandon', { method: 'POST' });
        clearTimeout(pollTimer);
        window.location.href = '/#games';
      } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
      }
    });

    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(location.search);
      const id = params.get('game');
      if (id) {
        openGame(id);
      } else {
        window.location.href = '/#games';
      }
    });

    const params = new URLSearchParams(location.search);
    const id = params.get('game');
    if (id) {
      openGame(id);
    } else {
      // The board page only shows a single game; the list lives on the main site.
      window.location.href = '/#games';
    }
  });
})();
