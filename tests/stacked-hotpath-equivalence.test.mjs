import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactCompletedRows, cellsFor, collides } from '../apps/portal/src/stacked-sim.mjs';
import { BOARD_ROWS, BOARD_WIDTH } from '../apps/portal/src/stacked-contracts.mjs';
function reference(board) {
  const rows = Array.from({ length: BOARD_ROWS }, (_, row) => Array.from(board.slice(row * BOARD_WIDTH, (row + 1) * BOARD_WIDTH)));
  const clearedRows = rows.map((cells, row) => cells.every(cell => cell !== 0) ? row : -1).filter(row => row >= 0);
  const retained = rows.filter((cells, row) => !clearedRows.includes(row));
  const expected = Uint8Array.from([...retained.flat(), ...Array(clearedRows.length * BOARD_WIDTH).fill(0)]);
  return { expected, result: { lines: clearedRows.length, garbageRowsCleared: clearedRows.filter(row => rows[row].includes(8)).length, fullRows: clearedRows } };
}
test('row compaction preserves every row, clear index and garbage count across structured boards', () => {
  for (let variant = 0; variant < 80; variant += 1) {
    const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
    for (let row = 0; row < BOARD_ROWS; row += 1) for (let x = 0; x < BOARD_WIDTH; x += 1) {
      board[row * BOARD_WIDTH + x] = (variant + row) % 5 === 0 ? (variant + row + x) % 8 + 1 : (variant * 17 + row * 5 + x) % 9;
    }
    const before = board.slice(); const expected = reference(board); const result = compactCompletedRows(board);
    assert.deepEqual(board, before, `input ${variant}`); assert.notEqual(result.board, board);
    assert.deepEqual(result, { board: expected.expected, ...expected.result }, `result ${variant}`);
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.fullRows));
  }
});
test('row compaction validates the whole board before any mutation', () => {
  const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS).fill(1); board[board.length - 1] = 9;
  const before = board.slice(); assert.throws(() => compactCompletedRows(board)); assert.deepEqual(board, before);
});
test('movement collision agrees with projected cells throughout board boundaries', () => {
  for (const kind of ['I','J','L','O','S','T','Z']) for (let rotation = 0; rotation < 4; rotation += 1) {
    for (let x = -4; x <= BOARD_WIDTH + 1; x += 1) for (let y = -4; y <= BOARD_ROWS + 1; y += 1) {
      const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS); board[BOARD_WIDTH + 3] = 8;
      const cells = cellsFor(kind, rotation, x, y);
      const expected = cells.some(([cx, cy]) => cx < 0 || cx >= BOARD_WIDTH || cy < 0 || cy >= BOARD_ROWS || board[cy * BOARD_WIDTH + cx] !== 0);
      assert.equal(collides(board, cells), expected);
    }
  }
});
