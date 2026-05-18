'use strict';

const cc = require('./circular-chess');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'expected'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

console.log('\n=== Initial position ===');

test('white block: pawns on flanks (s=0, s=3) at all rings', () => {
  const e = new cc.Engine();
  const b = e.getBoard();
  for (let r = 0; r < 4; r++) {
    assertEq(b[r][0].type, 'P', `(${r},0)`);
    assertEq(b[r][0].color, 'w');
    assertEq(b[r][0].dir, -1, `left flank dir`);
    assertEq(b[r][3].type, 'P', `(${r},3)`);
    assertEq(b[r][3].color, 'w');
    assertEq(b[r][3].dir, 1, `right flank dir`);
  }
});

test('white block: back rank by ring (R, N, B, K/Q)', () => {
  const e = new cc.Engine();
  const b = e.getBoard();
  // s=1 is king column: R, N, B, K
  assertEq(b[0][1].type, 'R'); assertEq(b[0][1].color, 'w');
  assertEq(b[1][1].type, 'N');
  assertEq(b[2][1].type, 'B');
  assertEq(b[3][1].type, 'K');
  // s=2 is queen column: R, N, B, Q
  assertEq(b[0][2].type, 'R');
  assertEq(b[1][2].type, 'N');
  assertEq(b[2][2].type, 'B');
  assertEq(b[3][2].type, 'Q');
});

test('black block: mirror (sectors 8..11)', () => {
  const e = new cc.Engine();
  const b = e.getBoard();
  for (let r = 0; r < 4; r++) {
    assertEq(b[r][8].type, 'P'); assertEq(b[r][8].color, 'b'); assertEq(b[r][8].dir, -1);
    assertEq(b[r][11].type, 'P'); assertEq(b[r][11].color, 'b'); assertEq(b[r][11].dir, 1);
  }
  assertEq(b[3][9].type, 'K'); assertEq(b[3][9].color, 'b');
  assertEq(b[3][10].type, 'Q'); assertEq(b[3][10].color, 'b');
});

test('non-block sectors are empty', () => {
  const e = new cc.Engine();
  const b = e.getBoard();
  for (let r = 0; r < 4; r++) {
    for (let s = 0; s < 16; s++) {
      const inWhite = s >= 0 && s <= 3;
      const inBlack = s >= 8 && s <= 11;
      if (!inWhite && !inBlack) {
        assert(b[r][s] === null, `(${r},${s}) should be empty`);
      }
    }
  }
});

test('initial turn white, status active, not in check', () => {
  const e = new cc.Engine();
  assertEq(e.getTurn(), 'w');
  assertEq(e.getStatus(), 'active');
  assertEq(e.inCheck(), false);
});

console.log('\n=== FEN round-trip ===');

test('toFEN/fromFEN preserves state', () => {
  const e1 = new cc.Engine();
  const fen = e1.toFEN();
  const e2 = cc.Engine.fromFEN(fen);
  assertEq(e2.toFEN(), fen);
});

test('initial FEN shape', () => {
  const e = new cc.Engine();
  const fen = e.toFEN();
  const [boardPart, turn, castle, ep, num] = fen.split(' ');
  assertEq(boardPart.split('/').length, 4);
  assertEq(turn, 'w');
  assertEq(castle, 'Kk');
  assertEq(ep, '-');
  assertEq(num, '1');
});

console.log('\n=== Pawn moves ===');

test('white right-flank pawn at (0,3) has 2 forward moves (single + double)', () => {
  const e = new cc.Engine();
  const moves = e.getLegalMoves({ r: 0, s: 3 });
  // dir=+1 from s=3: forward to s=4 and double to s=5. No diagonal captures (no opp pieces nearby).
  const dests = moves.map(m => `${m.to.r}:${m.to.s}`).sort();
  assertEq(dests.length, 2);
  assert(dests.includes('0:4'));
  assert(dests.includes('0:5'));
});

test('white left-flank pawn at (0,0) advances to s=15 then s=14', () => {
  const e = new cc.Engine();
  const moves = e.getLegalMoves({ r: 0, s: 0 });
  const dests = moves.map(m => `${m.to.r}:${m.to.s}`).sort();
  assertEq(dests.length, 2);
  assert(dests.includes('0:15'));
  assert(dests.includes('0:14'));
});

test('after first move, pawn cannot double again', () => {
  const e = new cc.Engine();
  e.move('r0s3-r0s4');
  // Black plays anything
  e.move('r0s11-r0s12');
  // White pawn now at (0,4); only 1-step forward to (0,5) since not at start
  const moves = e.getLegalMoves({ r: 0, s: 4 });
  const dests = moves.map(m => `${m.to.r}:${m.to.s}`).sort();
  assert(dests.includes('0:5'));
  assert(!dests.includes('0:6'));
});

test('pawn diagonal capture', () => {
  // White right-pawn (dir=+1) at (1,3) captures diagonally to (0,4) or (2,4).
  // Black left-pawn at (0,4): dir=-1 (so the pawn is "going backwards" from a black perspective —
  // FEN char 'l' is black pawn dir=-1). Actually direction doesn't matter for capture target.
  const e = cc.Engine.fromFEN(
    '....l...........' +
    '/...P............' +
    '/................' +
    '/.K.......k......' +
    ' w - - 1'
  );
  const moves = e.getLegalMoves({ r: 1, s: 3 });
  const cap = moves.find(m => m.to.r === 0 && m.to.s === 4);
  assert(cap, 'should be able to capture at (0,4)');
  assert(cap.captured, 'should be a capture');
});

test('pawn promotes when entering opponent block', () => {
  // White right-flank pawn near black block: place at (1, 7), 1 step to s=8 (opponent block) → promotion.
  const e = cc.Engine.fromFEN(
    'LRR.....l..p....' +
    '/LNNP...P........' +
    '/LBB......bbp....' +
    '/LKQ......kq.....' +
    ' w Kk - 1'
  );
  const moves = e.getLegalMoves({ r: 1, s: 7 });
  // dest s=8 is in BLACK_BLOCK → promotion options
  const promos = moves.filter(m => m.to.r === 1 && m.to.s === 8);
  assertEq(promos.length, 4);
  const types = promos.map(m => m.promotion).sort();
  assertEq(types.join(','), 'B,N,Q,R');
});

console.log('\n=== Knight ===');

test('knight at (1,1) initial moves', () => {
  const e = new cc.Engine();
  const moves = e.getLegalMoves({ r: 1, s: 1 });
  // Knight at (1,1): jumps to (-1, 0), (-1, 2), (0, -1=15), (0, 3), (2, -1=15), (2, 3), (3, 0), (3, 2)
  // Filter inBoard: (0,15), (0,3), (2,15), (2,3), (3,0), (3,2). All others have own pieces or empty.
  // (0,15): empty (not in block).  jumps OK
  // (0,3): own pawn → blocked
  // (2,15): empty → OK
  // (2,3): own pawn → blocked
  // (3,0): own pawn (left flank ring 3) → blocked
  // (3,2): own queen → blocked
  const dests = moves.map(m => `${m.to.r}:${m.to.s}`).sort();
  assert(dests.includes('0:15'));
  assert(dests.includes('2:15'));
  assert(!dests.includes('0:3'));
  assert(!dests.includes('3:2'));
});

console.log('\n=== Rook ===');

test('rook full circle does not return to start', () => {
  const e = cc.Engine.fromFEN(
    'R..............k' +
    '/................' +
    '/................' +
    '/...K............' +
    ' w - - 1'
  );
  const moves = e.getLegalMoves({ r: 0, s: 0 });
  assert(!moves.find(m => m.to.r === 0 && m.to.s === 0), 'rook must not return to start');
});

console.log('\n=== Castling ===');

test('white can castle radially after clearing path', () => {
  // White king at (3,1), rook at (0,1). Need (1,1) and (2,1) empty.
  // Initial position has knight at (1,1), bishop at (2,1) — clear them.
  const e = cc.Engine.fromFEN(
    'LRR.....lrrp....' +
    '/L..P....l..p....' +
    '/L..P....l..p....' +
    '/LKQP....lkqp....' +
    ' w Kk - 1'
  );
  const moves = e.getLegalMoves({ r: 3, s: 1 });
  const castle = moves.find(m => m.isCastling === 'radial');
  assert(castle, 'radial castling should be available');
  assertEq(castle.to.r, 1);
  assertEq(castle.to.s, 1);
});

test('castling moves king to r=1 and rook to r=2', () => {
  const e = cc.Engine.fromFEN(
    'LRR.....lrrp....' +
    '/L..P....l..p....' +
    '/L..P....l..p....' +
    '/LKQP....lkqp....' +
    ' w Kk - 1'
  );
  e.move('r3s1-r1s1');
  const b = e.getBoard();
  assertEq(b[1][1].type, 'K');
  assertEq(b[2][1].type, 'R');
  assert(b[0][1] === null);
  assert(b[3][1] === null);
});

console.log('\n=== Check ===');

test('isInCheck detects pawn threat', () => {
  // Place white king at (1, 6), put black left-flank pawn at (0, 7) dir=-1.
  // Black pawn at (0,7) with dir=-1 attacks (0+1, 7-1=6) = (1,6) and (0-1, 6) — only (1,6) inBoard.
  const e = cc.Engine.fromFEN(
    '.......l........' +
    '/......K.........' +
    '/................' +
    '/........k.......' +
    ' w - - 1'
  );
  assert(e.inCheck(), 'white king at (1,6) should be in check from black pawn at (0,7)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
