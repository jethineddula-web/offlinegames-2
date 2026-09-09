(function (N) {
'use strict';

const CHAPTERS = [
  { name: 'First connections', difficulty: 'Easy', range: '001 - 050', color: 'sage' },
  { name: 'Find your rhythm', difficulty: 'Medium', range: '051 - 100', color: 'sand' },
  { name: 'Think a little deeper', difficulty: 'Hard', range: '101 - 150', color: 'lavender' },
  { name: 'Master the flow', difficulty: 'Expert', range: '151 - 200', color: 'peach' },
];

function randomSource(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function adjacent(a, b, size) {
  return Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size)) === 1;
}

function boustrophedon(size) {
  return Array.from({ length: size * size }, (_, i) => {
    const row = Math.floor(i / size);
    return row * size + (row % 2 ? size - 1 - i % size : i % size);
  });
}

function spiral(size) {
  const total = size * size;
  const visited = new Array(total).fill(false);
  const path = [];
  let x = 0, y = 0, dx = 1, dy = 0;
  for (let i = 0; i < total; i++) {
    const cell = y * size + x;
    visited[cell] = true;
    path.push(cell);
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= size || ny < 0 || ny >= size || visited[ny * size + nx]) {
      const turn = [-dy, dx];
      dx = turn[0];
      dy = turn[1];
      x += dx;
      y += dy;
    } else {
      x = nx;
      y = ny;
    }
  }
  return path.length === total ? path : null;
}

// Warnsdorff's heuristic builds a random-looking Hamiltonian path on a grid.
function warnsdorff(size, random) {
  const total = size * size;
  const visited = new Array(total).fill(false);
  const neighborsOf = (cell) => {
    const x = cell % size, y = Math.floor(cell / size);
    const out = [];
    if (x > 0) out.push(cell - 1);
    if (x < size - 1) out.push(cell + 1);
    if (y > 0) out.push(cell - size);
    if (y < size - 1) out.push(cell + size);
    return out;
  };
  let current = Math.floor(random() * total);
  visited[current] = true;
  const path = [current];
  for (let i = 1; i < total; i++) {
    const options = neighborsOf(current).filter((cell) => !visited[cell]);
    if (!options.length) return null;
    options.sort((a, b) => {
      const da = neighborsOf(a).filter((n) => !visited[n]).length;
      const db = neighborsOf(b).filter((n) => !visited[n]).length;
      return da - db || random() - 0.5;
    });
    current = options[0];
    visited[current] = true;
    path.push(current);
  }
  return path;
}

function makeLevel(id, attempt) {
  const chapter = Math.floor((id - 1) / 50);
  const size = 5 + chapter;
  const random = randomSource(id * 7907 + attempt * 104729);
  const baseChoice = ((id * 2654435761) >>> 0) % 3;
  let solution = null;
  if (id === 1) solution = boustrophedon(size);
  else if (baseChoice === 1) solution = spiral(size);
  else if (baseChoice === 2) {
    for (let seed = 0; seed < 6 && !solution; seed++) {
      solution = warnsdorff(size, randomSource(id * 31 + attempt * 977 + seed * 131));
    }
  }
  const sequence = solution ?? boustrophedon(size);

  // Backbite moves reshape a Hamiltonian path without ever breaking solvability.
  // Harder chapters scramble far more deeply so layouts stop looking alike.
  if (id !== 1) {
    for (let step = 0; step < size * size * (18 + chapter * 18); step++) {
      const fromStart = random() < 0.5;
      const end = sequence[fromStart ? 0 : sequence.length - 1];
      const neighbors = sequence.filter((cell, index) =>
        adjacent(end, cell, size) && (fromStart ? index > 1 : index < sequence.length - 2),
      );
      if (!neighbors.length) continue;
      const pivot = sequence.indexOf(neighbors[Math.floor(random() * neighbors.length)]);
      if (fromStart) sequence.splice(0, pivot, ...sequence.slice(0, pivot).reverse());
      else sequence.splice(pivot + 1, sequence.length, ...sequence.slice(pivot + 1).reverse());
    }
  }

  // Fewer visible numbers means less guidance: difficulty ramps inside each chapter too.
  const within = (id - 1) % 50;
  const count = id === 1 ? 6 : Math.max(4, [10, 9, 8, 7][chapter] - Math.floor(within / 10));
  const checkpoints = {};
  const rawPositions = id === 1
    ? [0, 4, 10, 14, 20, 24]
    : Array.from({ length: count }, (_, i) => {
      if (i === 0) return 0;
      if (i === count - 1) return sequence.length - 1;
      const spacing = (sequence.length - 1) / (count - 1);
      return Math.round(i * spacing + (random() - 0.5) * 2 * Math.min(1 + chapter, spacing - 2));
    });
  const positions = [...new Set(rawPositions)].sort((a, b) => a - b);
  if (positions.length !== count) throw new Error('checkpoint collision');
  positions.forEach((position, index) => { checkpoints[sequence[position]] = index + 1; });

  return {
    id, size, solution: sequence, checkpoints, count,
    difficulty: CHAPTERS[chapter].difficulty,
    timeLimit: 75 + chapter * 40 + Math.floor(((id - 1) % 50) / 10) * 8,
  };
}

const signatures = new Set();
const LEVELS = Array.from({ length: 200 }, (_, index) => {
  let attempt = 0;
  let level = null;
  let signature = '';
  do {
    try {
      level = makeLevel(index + 1, attempt);
      signature = `${level.size}:${JSON.stringify(level.checkpoints)}`;
    } catch {
      level = null;
    }
    attempt++;
    if (attempt > 200) throw new Error('Unable to generate a distinct puzzle.');
  } while (!level || signatures.has(signature));
  signatures.add(signature);
  return level;
});

function advancePath(level, path, cell) {
  if (cell < 0 || cell >= level.size * level.size || !Number.isInteger(cell)) {
    return { kind: 'invalid', reason: 'adjacent' };
  }
  if (path[path.length - 1] === cell) return { kind: 'same' };
  if (!path.length) {
    return level.checkpoints[cell] === 1
      ? { kind: 'move', path: [cell], checkpoint: 1 }
      : { kind: 'invalid', reason: 'start' };
  }
  const existing = path.indexOf(cell);
  if (existing !== -1) return { kind: 'backtrack', path: path.slice(0, existing + 1), checkpoint: 0 };
  if (!adjacent(path[path.length - 1], cell, level.size)) return { kind: 'invalid', reason: 'adjacent' };
  const currentNumber = path.reduce((max, point) => Math.max(max, level.checkpoints[point] || 0), 0);
  const checkpoint = level.checkpoints[cell] || 0;
  if (checkpoint && checkpoint !== currentNumber + 1) return { kind: 'invalid', reason: 'order' };
  const nextPath = [...path, cell];
  // Reaching the last number always finishes the puzzle. There is no hidden "fill every square" rule.
  const complete = checkpoint === level.count;
  return { kind: complete ? 'complete' : 'move', path: nextPath, checkpoint };
}

// Check all 200 layouts through the same move validator used by touch and keyboard.
function verifyPuzzles() {
  const layouts = new Set(LEVELS.map((level) => `${level.size}:${JSON.stringify(level.checkpoints)}`));
  if (layouts.size !== 200) throw new Error('Puzzle distinctness check failed');
  for (const level of LEVELS) {
    if (new Set(level.solution).size !== level.size * level.size) throw new Error(`Invalid level ${level.id}`);
    if (Object.keys(level.checkpoints).length !== level.count) throw new Error(`Invalid checkpoints ${level.id}`);
    let path = [];
    level.solution.forEach((cell, index) => {
      const result = advancePath(level, path, cell);
      if (result.kind === 'invalid' || result.kind === 'same') throw new Error(`Unsolvable level ${level.id}`);
      if (index > 0 && !adjacent(path[path.length - 1], cell, level.size)) throw new Error(`Broken path ${level.id}`);
      if (index === level.solution.length - 1 && result.kind !== 'complete') throw new Error(`Incomplete level ${level.id}`);
      path = result.path;
    });
  }
  const first = LEVELS[0];
  if (advancePath(first, [], 1).kind !== 'invalid') throw new Error('Start validation failed');
  if (advancePath(first, [0], 5).kind !== 'move') throw new Error('Adjacent move validation failed');
  const backtrack = advancePath(first, [0, 1, 2], 0);
  if (backtrack.kind !== 'backtrack' || backtrack.path.join(',') !== '0') throw new Error('Undo validation failed');
  if (advancePath(first, [0, 5], 10).kind !== 'invalid') throw new Error('Checkpoint order check failed');
  if (advancePath(first, [0], 6).kind !== 'invalid') throw new Error('Diagonal move check failed');
  if (advancePath(first, [0, 1, 2, 3, 4], 5).kind !== 'invalid') throw new Error('Row-wrap check failed');
  if (advancePath(first, [0], 0).kind !== 'same') throw new Error('Repeated pointer check failed');
  const shortPuzzle = { size: 3, count: 3, checkpoints: { 0: 1, 1: 2, 2: 3 } };
  if (advancePath(shortPuzzle, [0, 1], 2).kind !== 'complete') throw new Error('Final number must win with empty squares remaining');
  for (const cell of [-1, 25, NaN, Infinity, 0.5]) {
    if (advancePath(first, [], cell).kind !== 'invalid') throw new Error('Board boundary check failed');
  }
  return LEVELS.length;
}

Object.assign(N, { CHAPTERS, LEVELS, adjacent, advancePath, verifyPuzzles });
N.VERIFIED_LEVELS = verifyPuzzles();
})(globalThis.Numberly = globalThis.Numberly || {});