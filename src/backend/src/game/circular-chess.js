'use strict';

(function (root) {

  const RINGS = 4;
  const SECTORS = 16;
  const WHITE = 'w';
  const BLACK = 'b';

  const PIECE = {
    PAWN: 'P', KNIGHT: 'N', BISHOP: 'B',
    ROOK: 'R', QUEEN: 'Q', KING: 'K'
  };

  const WHITE_BLOCK = [14, 15, 0, 1];
  const BLACK_BLOCK = [6, 7, 8, 9];

  const KING_SECTOR = { [WHITE]: 15, [BLACK]: 7 };
  const QUEEN_SECTOR = { [WHITE]: 0, [BLACK]: 8 };
  const LEFT_PAWN_SECTOR = { [WHITE]: 14, [BLACK]: 6 };
  const RIGHT_PAWN_SECTOR = { [WHITE]: 1, [BLACK]: 9 };

  function modSector(s) {
    return ((s % SECTORS) + SECTORS) % SECTORS;
  }

  function inBoard(r) {
    return r >= 0 && r < RINGS;
  }

  function opponent(color) {
    return color === WHITE ? BLACK : WHITE;
  }

  function isOpponentBlock(color, s) {
    const block = color === WHITE ? BLACK_BLOCK : WHITE_BLOCK;
    return block.indexOf(s) !== -1;
  }

  function pieceFromChar(ch) {
    if (!ch || ch === '.') return null;
    if (ch === 'P') return { type: 'P', color: WHITE, dir: 1 };
    if (ch === 'p') return { type: 'P', color: BLACK, dir: 1 };
    if (ch === 'L') return { type: 'P', color: WHITE, dir: -1 };
    if (ch === 'l') return { type: 'P', color: BLACK, dir: -1 };
    const isUpper = ch === ch.toUpperCase();
    return { type: ch.toUpperCase(), color: isUpper ? WHITE : BLACK };
  }

  function pieceToChar(p) {
    if (!p) return '.';
    if (p.type === 'P') {
      if (p.dir === -1) return p.color === WHITE ? 'L' : 'l';
      return p.color === WHITE ? 'P' : 'p';
    }
    return p.color === WHITE ? p.type : p.type.toLowerCase();
  }

  function clonePiece(p) {
    if (!p) return null;
    const out = { type: p.type, color: p.color };
    if (p.type === 'P') out.dir = p.dir;
    return out;
  }

  function emptyBoard() {
    const b = new Array(RINGS);
    for (let r = 0; r < RINGS; r++) {
      b[r] = new Array(SECTORS).fill(null);
    }
    return b;
  }

  function cloneBoard(board) {
    const b = new Array(RINGS);
    for (let r = 0; r < RINGS; r++) {
      b[r] = new Array(SECTORS);
      for (let s = 0; s < SECTORS; s++) {
        b[r][s] = clonePiece(board[r][s]);
      }
    }
    return b;
  }

  function findKing(board, color) {
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const p = board[r][s];
        if (p && p.type === 'K' && p.color === color) return { r, s };
      }
    }
    return null;
  }

  const BACK_RANK_BY_RING = ['R', 'N', 'B', null];

  function placeBlock(board, color) {
    const ls = LEFT_PAWN_SECTOR[color];
    const rs = RIGHT_PAWN_SECTOR[color];
    const ks = KING_SECTOR[color];
    const qs = QUEEN_SECTOR[color];
    for (let r = 0; r < RINGS; r++) {
      board[r][ls] = { type: 'P', color, dir: -1 };
      board[r][rs] = { type: 'P', color, dir: 1 };
      let backType;
      if (r < RINGS - 1) backType = BACK_RANK_BY_RING[r];
      board[r][ks] = r === RINGS - 1 ? { type: 'K', color } : { type: backType, color };
      board[r][qs] = r === RINGS - 1 ? { type: 'Q', color } : { type: backType, color };
    }
  }

  function initialBoard() {
    const b = emptyBoard();
    placeBlock(b, WHITE);
    placeBlock(b, BLACK);
    return b;
  }

  function initialState() {
    const state = {
      board: initialBoard(),
      turn: WHITE,
      castling: { w: true, b: true },
      enPassant: null,
      moveNumber: 1,
      history: [],
      positionCounts: {}
    };
    state.positionCounts[positionFingerprint(state)] = 1;
    return state;
  }

  // fen - стандратная шахматная нотация дл яописания позиций
  function toFEN(state) {
    const ringStrings = state.board.map(row =>
      row.map(p => pieceToChar(p)).join('')
    );
    const c = state.castling;
    const castling = (c.w ? 'K' : '') + (c.b ? 'k' : '') || '-';
    const ep = state.enPassant ? `r${state.enPassant.r}s${state.enPassant.s}` : '-';
    return `${ringStrings.join('/')} ${state.turn} ${castling} ${ep} ${state.moveNumber}`;
  }

  function fromFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 5) throw new Error('Некорректный FEN');
    const [boardPart, turn, castlingPart, epPart, moveNum] = parts;
    const ringStrings = boardPart.split('/');
    if (ringStrings.length !== RINGS) throw new Error('FEN: должно быть 4 кольца');
    const board = emptyBoard();
    for (let r = 0; r < RINGS; r++) {
      if (ringStrings[r].length !== SECTORS) {
        throw new Error(`FEN: кольцо ${r} должно содержать ${SECTORS} клеток`);
      }
      for (let s = 0; s < SECTORS; s++) {
        board[r][s] = pieceFromChar(ringStrings[r][s]);
      }
    }
    if (turn !== WHITE && turn !== BLACK) throw new Error('FEN: ход должен быть w или b');
    const castling = {
      w: castlingPart.includes('K'),
      b: castlingPart.includes('k')
    };
    let enPassant = null;
    if (epPart && epPart !== '-') {
      const m = epPart.match(/^r(\d+)s(\d+)$/);
      if (!m) throw new Error('FEN: некорректное поле en passant');
      enPassant = { r: parseInt(m[1], 10), s: parseInt(m[2], 10) };
    }
    const state = {
      board, turn, castling, enPassant,
      moveNumber: parseInt(moveNum, 10) || 1,
      history: [],
      positionCounts: {}
    };
    state.positionCounts[positionFingerprint(state)] = 1;
    return state;
  }

  function positionFingerprint(state) {
    const ringStrings = state.board.map(row => row.map(p => pieceToChar(p)).join(''));
    const c = state.castling;
    const cast = (c.w ? 'K' : '') + (c.b ? 'k' : '');
    const ep = state.enPassant ? `r${state.enPassant.r}s${state.enPassant.s}` : '-';
    return `${ringStrings.join('/')}|${state.turn}|${cast || '-'}|${ep}`;
  }

  function pawnAtStart(piece, s) {
    const startSector = piece.dir === -1
      ? LEFT_PAWN_SECTOR[piece.color]
      : RIGHT_PAWN_SECTOR[piece.color];
    return s === startSector;
  }

  function generatePawnMoves(board, ep, r, s, piece) {
    const moves = [];
    const d = piece.dir;

    const s1 = modSector(s + d);
    if (!board[r][s1]) {
      pushPawn(moves, r, s, r, s1, piece, null, false, false);
      if (pawnAtStart(piece, s)) {
        const s2 = modSector(s + 2 * d);
        if (!board[r][s2]) {
          pushPawn(moves, r, s, r, s2, piece, null, false, true);
        }
      }
    }

    for (const dr of [-1, 1]) {
      const tr = r + dr;
      if (!inBoard(tr)) continue;
      const ts = modSector(s + d);
      const target = board[tr][ts];
      if (target && target.color !== piece.color) {
        pushPawn(moves, r, s, tr, ts, piece, target, false, false);
      } else if (ep && ep.r === tr && ep.s === ts) {
        const capR = tr;
        const capS = modSector(ts + d);
        const cap = board[capR][capS];
        if (cap && cap.type === 'P' && cap.color !== piece.color) {
          moves.push({
            from: { r, s }, to: { r: tr, s: ts },
            piece: clonePiece(piece),
            captured: clonePiece(cap),
            isEnPassant: true,
            capturedAt: { r: capR, s: capS }
          });
        }
      }
    }
    return moves;
  }

  function pushPawn(moves, fr, fs, tr, ts, piece, captured, isEP, isDouble) {
    const isPromo = isOpponentBlock(piece.color, ts);
    if (isPromo) {
      for (const promo of ['Q', 'R', 'B', 'N']) {
        moves.push({
          from: { r: fr, s: fs }, to: { r: tr, s: ts },
          piece: clonePiece(piece),
          captured: captured ? clonePiece(captured) : null,
          promotion: promo
        });
      }
    } else {
      moves.push({
        from: { r: fr, s: fs }, to: { r: tr, s: ts },
        piece: clonePiece(piece),
        captured: captured ? clonePiece(captured) : null,
        isPawnDouble: isDouble || false
      });
    }
  }

  const KNIGHT_OFFSETS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  function generateKnightMoves(board, r, s, piece) {
    const moves = [];
    for (const [dr, ds] of KNIGHT_OFFSETS) {
      const tr = r + dr;
      if (!inBoard(tr)) continue;
      const ts = modSector(s + ds);
      const target = board[tr][ts];
      if (!target || target.color !== piece.color) {
        moves.push({
          from: { r, s }, to: { r: tr, s: ts },
          piece: clonePiece(piece),
          captured: target ? clonePiece(target) : null
        });
      }
    }
    return moves;
  }

  function slideMoves(board, r, s, dr, ds, color, maxSteps) {
    const moves = [];
    const piece = board[r][s];
    let tr = r;
    let ts = s;
    for (let i = 0; i < maxSteps; i++) {
      tr += dr;
      ts = modSector(ts + ds);
      if (!inBoard(tr)) break;
      if (tr === r && ts === s) break;
      const target = board[tr][ts];
      if (!target) {
        moves.push({
          from: { r, s }, to: { r: tr, s: ts },
          piece: clonePiece(piece), captured: null
        });
      } else {
        if (target.color !== color) {
          moves.push({
            from: { r, s }, to: { r: tr, s: ts },
            piece: clonePiece(piece), captured: clonePiece(target)
          });
        }
        break;
      }
    }
    return moves;
  }

  function generateRookMoves(board, r, s, piece) {
    return [
      ...slideMoves(board, r, s, 0, 1, piece.color, SECTORS - 1),
      ...slideMoves(board, r, s, 0, -1, piece.color, SECTORS - 1),
      ...slideMoves(board, r, s, 1, 0, piece.color, RINGS - 1),
      ...slideMoves(board, r, s, -1, 0, piece.color, RINGS - 1)
    ];
  }

  function generateBishopMoves(board, r, s, piece) {
    return [
      ...slideMoves(board, r, s, 1, 1, piece.color, RINGS - 1),
      ...slideMoves(board, r, s, 1, -1, piece.color, RINGS - 1),
      ...slideMoves(board, r, s, -1, 1, piece.color, RINGS - 1),
      ...slideMoves(board, r, s, -1, -1, piece.color, RINGS - 1)
    ];
  }

  function generateQueenMoves(board, r, s, piece) {
    return [
      ...generateRookMoves(board, r, s, piece),
      ...generateBishopMoves(board, r, s, piece)
    ];
  }

  function generateKingMoves(state, r, s, piece) {
    const moves = [];
    const board = state.board;
    for (let dr = -1; dr <= 1; dr++) {
      for (let ds = -1; ds <= 1; ds++) {
        if (dr === 0 && ds === 0) continue;
        const tr = r + dr;
        if (!inBoard(tr)) continue;
        const ts = modSector(s + ds);
        const target = board[tr][ts];
        if (!target || target.color !== piece.color) {
          moves.push({
            from: { r, s }, to: { r: tr, s: ts },
            piece: clonePiece(piece),
            captured: target ? clonePiece(target) : null
          });
        }
      }
    }
    addCastlingMoves(state, r, s, piece, moves);
    return moves;
  }

  function addCastlingMoves(state, r, s, piece, moves) {
    const ks = KING_SECTOR[piece.color];
    if (r !== RINGS - 1 || s !== ks) return;
    if (!state.castling[piece.color]) return;
    const enemy = opponent(piece.color);
    if (isAttacked(state.board, r, s, enemy)) return;

    const transit = RINGS - 2;     
    const dest = RINGS - 3;        
    const rookR = 0;
    const rook = state.board[rookR][ks];
    if (!rook || rook.type !== 'R' || rook.color !== piece.color) return;
    if (state.board[transit][ks] || state.board[dest][ks]) return;
    if (isAttacked(state.board, transit, ks, enemy)) return;
    if (isAttacked(state.board, dest, ks, enemy)) return;

    moves.push({
      from: { r, s },
      to: { r: dest, s: ks },
      piece: clonePiece(piece),
      captured: null,
      isCastling: 'radial'
    });
  }

  function generatePieceMoves(state, r, s) {
    const piece = state.board[r][s];
    if (!piece) return [];
    switch (piece.type) {
      case 'P': return generatePawnMoves(state.board, state.enPassant, r, s, piece);
      case 'N': return generateKnightMoves(state.board, r, s, piece);
      case 'B': return generateBishopMoves(state.board, r, s, piece);
      case 'R': return generateRookMoves(state.board, r, s, piece);
      case 'Q': return generateQueenMoves(state.board, r, s, piece);
      case 'K': return generateKingMoves(state, r, s, piece);
    }
    return [];
  }

  function generateAllPseudoMoves(state, color) {
    const all = [];
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const p = state.board[r][s];
        if (p && p.color === color) all.push(...generatePieceMoves(state, r, s));
      }
    }
    return all;
  }

  function isAttacked(board, tr, ts, byColor) {
    for (const dr of [-1, 1]) {
      const pr = tr + dr;
      if (!inBoard(pr)) continue;
      for (const d of [-1, 1]) {
        const ps = modSector(ts - d);
        const p = board[pr][ps];
        if (p && p.type === 'P' && p.color === byColor && p.dir === d) return true;
      }
    }
    for (const [dr, ds] of KNIGHT_OFFSETS) {
      const r = tr + dr;
      if (!inBoard(r)) continue;
      const s = modSector(ts + ds);
      const p = board[r][s];
      if (p && p.type === 'N' && p.color === byColor) return true;
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let ds = -1; ds <= 1; ds++) {
        if (dr === 0 && ds === 0) continue;
        const r = tr + dr;
        if (!inBoard(r)) continue;
        const s = modSector(ts + ds);
        const p = board[r][s];
        if (p && p.type === 'K' && p.color === byColor) return true;
      }
    }
    if (raySees(board, tr, ts, 0, 1, byColor, ['R', 'Q'], SECTORS - 1)) return true;
    if (raySees(board, tr, ts, 0, -1, byColor, ['R', 'Q'], SECTORS - 1)) return true;
    if (raySees(board, tr, ts, 1, 0, byColor, ['R', 'Q'], RINGS - 1)) return true;
    if (raySees(board, tr, ts, -1, 0, byColor, ['R', 'Q'], RINGS - 1)) return true;
    if (raySees(board, tr, ts, 1, 1, byColor, ['B', 'Q'], RINGS - 1)) return true;
    if (raySees(board, tr, ts, 1, -1, byColor, ['B', 'Q'], RINGS - 1)) return true;
    if (raySees(board, tr, ts, -1, 1, byColor, ['B', 'Q'], RINGS - 1)) return true;
    if (raySees(board, tr, ts, -1, -1, byColor, ['B', 'Q'], RINGS - 1)) return true;
    return false;
  }

  function raySees(board, tr, ts, dr, ds, byColor, types, maxSteps) {
    let r = tr;
    let s = ts;
    for (let i = 0; i < maxSteps; i++) {
      r += dr;
      s = modSector(s + ds);
      if (!inBoard(r)) return false;
      if (r === tr && s === ts) return false;
      const p = board[r][s];
      if (p) {
        return p.color === byColor && types.indexOf(p.type) !== -1;
      }
    }
    return false;
  }

  function isInCheck(state, color) {
    const king = findKing(state.board, color);
    if (!king) return false;
    return isAttacked(state.board, king.r, king.s, opponent(color));
  }

  function applyMove(state, move) {
    const board = cloneBoard(state.board);
    const piece = clonePiece(board[move.from.r][move.from.s]);
    board[move.from.r][move.from.s] = null;

    if (move.isEnPassant && move.capturedAt) {
      board[move.capturedAt.r][move.capturedAt.s] = null;
    }

    if (move.isCastling) {
      const ks = KING_SECTOR[piece.color];
      const rook = board[0][ks];
      board[0][ks] = null;
      board[RINGS - 2][ks] = rook; 
    }

    if (move.promotion) {
      piece.type = move.promotion;
      delete piece.dir;
    }
    board[move.to.r][move.to.s] = piece;

    const castling = { ...state.castling };
    if (piece.type === 'K') castling[piece.color] = false;
    for (const color of [WHITE, BLACK]) {
      if (!castling[color]) continue;
      const ks = KING_SECTOR[color];
      const sq = board[0][ks];
      if (!sq || sq.type !== 'R' || sq.color !== color) {
        castling[color] = false;
      }
    }

    let enPassant = null;
    if (move.isPawnDouble) {
      const between = modSector(move.from.s + piece.dir);
      enPassant = { r: move.to.r, s: between };
    }

    const next = {
      board,
      turn: opponent(state.turn),
      castling,
      enPassant,
      moveNumber: state.turn === BLACK ? state.moveNumber + 1 : state.moveNumber,
      history: state.history.concat([move]),
      positionCounts: { ...state.positionCounts }
    };
    const fp = positionFingerprint(next);
    next.positionCounts[fp] = (next.positionCounts[fp] || 0) + 1;
    return next;
  }

  function isMoveLegal(state, move) {
    const next = applyMove(state, move);
    return !isInCheck(next, state.turn);
  }

  function generateLegalMoves(state, r, s) {
    const piece = state.board[r] && state.board[r][s];
    if (!piece || piece.color !== state.turn) return [];
    return generatePieceMoves(state, r, s).filter(m => isMoveLegal(state, m));
  }

  function generateAllLegalMoves(state) {
    return generateAllPseudoMoves(state, state.turn).filter(m => isMoveLegal(state, m));
  }

  function getStatus(state) {
    const moves = generateAllLegalMoves(state);
    const inCheck = isInCheck(state, state.turn);
    if (moves.length === 0) {
      return inCheck ? 'checkmate' : 'stalemate';
    }
    return inCheck ? 'check' : 'active';
  }

  function parseMove(notation) {
    const m = notation.trim().match(/^r(\d+)s(\d+)-r(\d+)s(\d+)(?:=([QRBN]))?$/);
    if (!m) throw new Error('Некорректная запись хода: ' + notation);
    const fromR = parseInt(m[1], 10);
    const fromS = parseInt(m[2], 10);
    const toR = parseInt(m[3], 10);
    const toS = parseInt(m[4], 10);
    if (!inBoard(fromR) || !inBoard(toR) || fromS < 0 || fromS >= SECTORS || toS < 0 || toS >= SECTORS) {
      throw new Error('Координаты хода вне доски: ' + notation);
    }
    return {
      from: { r: fromR, s: fromS },
      to: { r: toR, s: toS },
      promotion: m[5] || null
    };
  }

  function formatMove(move) {
    const promo = move.promotion ? `=${move.promotion}` : '';
    return `r${move.from.r}s${move.from.s}-r${move.to.r}s${move.to.s}${promo}`;
  }

  function publicMove(m) {
    return {
      from: { r: m.from.r, s: m.from.s },
      to: { r: m.to.r, s: m.to.s },
      piece: m.piece ? { type: m.piece.type, color: m.piece.color } : null,
      captured: m.captured ? { type: m.captured.type, color: m.captured.color } : null,
      promotion: m.promotion || null,
      isCastling: m.isCastling || null,
      isEnPassant: !!m.isEnPassant,
      notation: formatMove(m)
    };
  }

  // ===== Engine =====
  class Engine {
    constructor(state) {
      this.state = state || initialState();
    }

    static fromFEN(fen) {
      return new Engine(fromFEN(fen));
    }

    static fromSnapshot({ fen, positionCounts }) {
      const state = fromFEN(fen);
      if (positionCounts && typeof positionCounts === 'object') {
        state.positionCounts = { ...positionCounts };
        const fp = positionFingerprint(state);
        if (!state.positionCounts[fp]) state.positionCounts[fp] = 1;
      }
      return new Engine(state);
    }

    getPositionCounts() { return { ...this.state.positionCounts }; }

    toFEN() { return toFEN(this.state); }

    getBoard() { return cloneBoard(this.state.board); }

    getTurn() { return this.state.turn; }

    getEnPassant() { return this.state.enPassant ? { ...this.state.enPassant } : null; }

    getCastling() { return { ...this.state.castling }; }

    getMoveNumber() { return this.state.moveNumber; }

    getStatus() { return getStatus(this.state); }

    inCheck() { return isInCheck(this.state, this.state.turn); }

    getLegalMoves(from) {
      if (from) {
        return generateLegalMoves(this.state, from.r, from.s).map(publicMove);
      }
      return generateAllLegalMoves(this.state).map(publicMove);
    }

    move(input) {
      const parsed = typeof input === 'string' ? parseMove(input) : input;
      const candidates = generateAllLegalMoves(this.state);
      const match = candidates.find(c =>
        c.from.r === parsed.from.r && c.from.s === parsed.from.s &&
        c.to.r === parsed.to.r && c.to.s === parsed.to.s &&
        (parsed.promotion ? c.promotion === parsed.promotion : !c.promotion)
      );
      if (!match) {
        const note = typeof input === 'string' ? input : formatMove(parsed);
        throw new Error('Нелегальный ход: ' + note);
      }
      this.state = applyMove(this.state, match);
      return publicMove(match);
    }

    history() { return this.state.history.map(publicMove); }

    snapshot() {
      return {
        fen: toFEN(this.state),
        turn: this.state.turn,
        moveNumber: this.state.moveNumber,
        status: getStatus(this.state),
        inCheck: isInCheck(this.state, this.state.turn),
        history: this.state.history.map(publicMove)
      };
    }
  }

  const api = {
    RINGS, SECTORS, WHITE, BLACK, PIECE,
    WHITE_BLOCK, BLACK_BLOCK,
    KING_SECTOR, QUEEN_SECTOR, LEFT_PAWN_SECTOR, RIGHT_PAWN_SECTOR,
    Engine,
    initialState, initialBoard,
    fromFEN, toFEN,
    parseMove, formatMove,
    pieceFromChar, pieceToChar,
    isInCheck, getStatus,
    modSector, opponent
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.CircularChess = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
