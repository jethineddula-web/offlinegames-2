(function (N) {
'use strict';
if (typeof document === 'undefined' || !document.getElementById('puzzle-board')) return;

const $ = (id) => document.getElementById(id);
const { icon } = N.ui;
let profile = N.loadProfile();
let state = { status: 'start', levelId: profile.currentLevel, path: [], hintsUsed: 0, mistakes: 0 };
let clock = new N.GameClock();
let result = null;
let dialog = null;
let chapter = Math.floor((state.levelId - 1) / 50);
let hint = null;
let pulse = null;
let adPending = false;
let adPlaying = false;
let storageAvailable = true;
let previousFocus = null;
let previousOverflow = '';
let overlaySignature = '';
let lastError = -1000;
let hintTimer, pulseTimer, shakeTimer, toastTimer;
let renderFrame = null;
let bannerReady = false;
let bannerSetup = null;
const board = new N.GameBoard($('puzzle-board'), visitCell);

function setText(id, value) {
  const element = $(id);
  if (element.textContent !== String(value)) element.textContent = value;
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').innerHTML = `${icon('check-circle', 17)}<span>${N.ui.escapeHtml(message)}</span>`;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function syncActivity() {
  const active = state.status === 'playing' && !dialog && !adPending && !document.hidden;
  if (active) clock.resume(); else clock.pause();
  N.audio.configure(profile.sound, profile.music);
  N.audio.setMuted(profile.muted || adPlaying || !!dialog || document.hidden || state.status === 'paused');
  N.updateAdSound(!profile.muted && (profile.sound || profile.music));
}

function saveProfile() {
  storageAvailable = N.saveProfile(profile);
  syncActivity();
  renderProfile();
}

function vibrate(pattern) {
  if (!profile.haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* Haptics are optional. */ }
}

function clearHint() {
  clearTimeout(hintTimer);
  hintTimer = null;
  hint = null;
}

function clearEffects() {
  clearHint();
  clearTimeout(pulseTimer);
  clearTimeout(shakeTimer);
  pulse = null;
  $('game-box').classList.remove('shake');
}

function shake() {
  clearTimeout(shakeTimer);
  $('game-box').classList.remove('shake');
  void $('game-box').offsetWidth;
  $('game-box').classList.add('shake');
  shakeTimer = setTimeout(() => $('game-box').classList.remove('shake'), 360);
}

function renderProfile() {
  const completed = Object.keys(profile.records).length;
  const audioOn = !profile.muted && (profile.sound || profile.music);
  $('sound-button').innerHTML = icon(audioOn ? 'volume' : 'muted', 20);
  $('sound-button').classList.toggle('is-muted', !audioOn);
  $('sound-button').setAttribute('aria-label', audioOn ? 'Mute all audio' : 'Enable audio');
  $('sound-button').title = audioOn ? 'Sound on' : 'Sound off';
  setText('gem-value', profile.gems.toLocaleString());
  $('gem-button').setAttribute('aria-label', `${profile.gems} gems. Learn about gems.`);
  setText('completed-value', completed);
  setText('mobile-completed', `${completed} complete`);
  $('journey-progress').setAttribute('aria-valuenow', completed);
  $('journey-fill').style.width = `${completed / 2}%`;
  $('chapter-list').innerHTML = N.ui.chapters(profile);
}

function renderTime() {
  const level = N.LEVELS[state.levelId - 1];
  const remaining = profile.mode === 'timed' ? Math.ceil(Math.max(0, level.timeLimit - clock.seconds())) : clock.seconds();
  setText('time-value', N.formatTime(remaining));
  $('time-display').classList.toggle('time-low', profile.mode === 'timed' && remaining < 20 && state.status === 'playing');
}

function render() {
  renderFrame = null;
  const level = N.LEVELS[state.levelId - 1];
  const playing = state.status === 'playing';
  const active = playing && !dialog && !adPending;
  const lastNumber = state.path.reduce((max, cell) => Math.max(max, level.checkpoints[cell] || 0), 0);
  setText('level-label', `LEVEL ${N.levelLabel(state.levelId)}`);
  $('level-button').setAttribute('aria-label', `Choose a level. Current level ${state.levelId}.`);
  $('difficulty').textContent = level.difficulty;
  $('difficulty').className = `difficulty difficulty-${level.difficulty.toLowerCase()}`;
  $('time-icon').innerHTML = icon(profile.mode === 'timed' ? 'timer' : 'clock', 15);
  $('time-display').setAttribute('aria-label', profile.mode === 'timed' ? 'Time remaining' : 'Time played');
  renderTime();
  $('undo-button').disabled = !active || !state.path.length;
  $('hint-button').disabled = !active || hint !== null;
  $('restart-button').disabled = state.status === 'start' || adPending;
  $('pause-button').disabled = (!playing && state.status !== 'paused') || adPending;
  $('pause-button').innerHTML = `${icon(state.status === 'paused' ? 'play' : 'pause', 19)}<span>${state.status === 'paused' ? 'Resume' : 'Pause'}</span>`;
  $('game-box').classList.toggle('game-won', state.status === 'won');
  $('board-wrap').classList.toggle('board-preview', state.status === 'start');
  board.update({ level, path: state.path, active, preview: state.status === 'start', hint, pulse });
  const signature = [state.status, state.levelId, result?.id, result?.doubled, adPending].join(':');
  if (overlaySignature !== signature) {
    overlaySignature = signature;
    $('board-overlay').hidden = playing;
    $('board-overlay').className = `board-overlay overlay-${state.status}`;
    $('board-overlay').innerHTML = N.ui.overlay(state, profile, result, adPending);
  }
  $('under-board').innerHTML = playing
    ? `<span class="live-dot"></span><span>${state.path.length ? `${state.path.length} ${state.path.length === 1 ? 'square' : 'squares'} visited` : 'Start at 1. See where it takes you.'}</span><span class="connection-progress">${lastNumber}/${level.count} connected</span>`
    : `${icon('shield', 13)}<span>${storageAvailable ? 'Your progress, always saved.' : 'Storage unavailable. Progress stays in this tab.'}</span>`;
}

function requestRender() {
  if (renderFrame === null) renderFrame = requestAnimationFrame(render);
}

function refreshDialog(focusAction, focusValue) {
  if (!dialog) return;
  const view = N.ui.dialogContent(dialog, state, profile, chapter);
  $('modal').className = `modal ${view.className}`;
  $('modal').innerHTML = view.html;
  let target;
  if (focusAction) target = [...$('modal').querySelectorAll('[data-action]')].find((button) => button.dataset.action === focusAction && button.dataset.value === focusValue);
  (target || $('modal').querySelector('button') || $('modal')).focus({ preventScroll: true });
}

function openDialog(name) {
  if (adPending || !['how', 'levels', 'leaderboard', 'settings', 'gems', 'privacy', 'reset'].includes(name)) return;
  if (!dialog) {
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
  }
  dialog = name;
  board.cancelPointer();
  $('modal-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  N.audio.play('click');
  syncActivity();
  refreshDialog();
  requestRender();
}

function closeDialog(restoreFocus = true) {
  if (!dialog) return;
  dialog = null;
  $('modal-backdrop').hidden = true;
  $('modal').replaceChildren();
  document.body.style.overflow = previousOverflow;
  syncActivity();
  requestRender();
  if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
}

function startLevel(id = state.levelId, withFullscreen = false) {
  if (adPending) return;
  const levelId = Math.min(200, Math.max(1, Math.floor(Number(id)) || 1));
  closeDialog(false);
  board.cancelPointer();
  clearEffects();
  clearTimeout(toastTimer);
  $('toast').hidden = true;
  clock = new N.GameClock();
  state = { status: 'playing', levelId, path: [], hintsUsed: 0, mistakes: 0 };
  result = null;
  lastError = -1000;
  profile.currentLevel = levelId;
  saveProfile();
  N.audio.unlock();
  N.audio.play('click');
  if (withFullscreen && matchMedia('(pointer: coarse)').matches) void N.enterFullscreen(notify, true);
  $('live-announcement').textContent = `Level ${levelId}. Connect 1 through ${N.LEVELS[levelId - 1].count}.`;
  requestRender();
  requestAnimationFrame(() => board.element.focus({ preventScroll: true }));
}

function failLevel() {
  if (state.status !== 'playing') return;
  state.status = 'lost';
  clock.pause();
  board.cancelPointer();
  clearHint();
  N.audio.play('lose');
  shake();
  $('live-announcement').textContent = 'Time is up. Press Enter to restart.';
  syncActivity();
  requestRender();
}

function timeExpired() {
  if (profile.mode !== 'timed' || clock.seconds() < N.LEVELS[state.levelId - 1].timeLimit) return false;
  failLevel();
  return true;
}

function finishLevel() {
  if (state.status !== 'playing' || timeExpired()) return;
  clock.pause();
  state.status = 'won';
  board.active = false;
  board.cancelPointer();
  clearHint();
  const level = N.LEVELS[state.levelId - 1];
  const time = Math.round(clock.seconds() * 10) / 10;
  const starCount = state.hintsUsed === 0 ? (state.mistakes <= 2 ? 3 : 2) : state.hintsUsed <= 2 ? 2 : 1;
  const timeBonus = Math.max(0, Math.floor(level.timeLimit - time)) * 5;
  const multiplier = profile.mode === 'timed' ? 1.2 : 1;
  const score = Math.max(100, Math.round((1000 + level.id * 25 + level.size * 80 + timeBonus + (state.hintsUsed === 0 ? 500 : 0) - state.hintsUsed * 150 - state.mistakes * 25) * multiplier));
  const gems = 10 + Math.floor((level.id - 1) / 50) * 5;
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const old = profile.records[level.id];
  result = { id, score, stars: starCount, gems, time, doubled: false, newBest: !old || score > old.score };
  profile.gems += gems;
  profile.rounds++;
  profile.currentLevel = Math.min(200, level.id + 1);
  profile.records[level.id] = { score: Math.max(old?.score || 0, score), stars: Math.max(old?.stars || 0, starCount), time: Math.min(old?.time ?? Infinity, time) };
  profile.highScores = [...profile.highScores, { id, name: profile.playerName.trim() || 'You', level: level.id, score, time, mode: profile.mode, date: new Date().toISOString() }].sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 10);
  saveProfile();
  N.audio.play('win');
  vibrate([12, 35, 20]);
  $('live-announcement').textContent = `Level complete. ${score} points. ${gems} gems earned.`;
  requestRender();
}

function visitCell(cell) {
  if (state.status !== 'playing' || dialog || adPending || timeExpired()) return;
  const move = N.advancePath(N.LEVELS[state.levelId - 1], state.path, cell);
  if (move.kind === 'same') return;
  if (move.kind === 'invalid') {
    if (move.reason === 'adjacent' || performance.now() - lastError < 850) return;
    lastError = performance.now();
    notify(move.reason === 'start' ? 'Every good connection starts at 1.' : 'One at a time. Connect the numbers in order.');
    if (move.reason !== 'start') state.mistakes++;
    N.audio.play('error');
    vibrate(10);
    shake();
    return;
  }
  state.path = move.path;
  clearHint();
  clearTimeout(pulseTimer);
  pulse = null;
  if (move.kind === 'complete') { finishLevel(); return; }
  if (move.kind === 'backtrack') N.audio.play('undo');
  else if (move.checkpoint) {
    N.audio.play('checkpoint', move.checkpoint);
    pulse = cell;
    pulseTimer = setTimeout(() => { pulse = null; requestRender(); }, 650);
    vibrate(7);
  } else N.audio.play('step', state.path.length);
  requestRender();
}

function undo() {
  if (state.status !== 'playing' || dialog || !state.path.length || adPending || timeExpired()) return;
  state.path = state.path.slice(0, -1);
  clearHint();
  N.audio.play('undo');
  requestRender();
}

function useHint() {
  if (state.status !== 'playing' || dialog || adPending || timeExpired()) return;
  if (hint !== null) { notify('Your hint is already glowing. Try that square next.'); return; }
  if (profile.gems < 5) { notify('A hint costs 5 gems. Finish a puzzle to collect more.'); return; }
  const level = N.LEVELS[state.levelId - 1];
  let prefix = 0;
  while (prefix < state.path.length && state.path[prefix] === level.solution[prefix]) prefix++;
  const nextCell = level.solution[Math.max(prefix, 1)];
  if (nextCell === undefined) return;
  const rewound = prefix < state.path.length;
  state.path = level.solution.slice(0, Math.max(prefix, 1));
  state.hintsUsed++;
  profile.gems -= 5;
  hint = nextCell;
  hintTimer = setTimeout(() => { hint = null; hintTimer = null; requestRender(); }, 5500);
  saveProfile();
  N.audio.play('checkpoint', 2);
  notify(rewound ? 'A fresh direction. Rewound your path; follow the glowing square.' : 'A little nudge. Follow the glowing square.');
  requestRender();
}

function togglePause() {
  if (adPending || dialog || !['playing', 'paused'].includes(state.status)) return;
  if (state.status === 'playing' && timeExpired()) return;
  state.status = state.status === 'playing' ? 'paused' : 'playing';
  board.cancelPointer();
  N.audio.unlock();
  syncActivity();
  $('live-announcement').textContent = state.status === 'paused' ? 'Game paused. Press Space to resume.' : 'Game resumed.';
  requestRender();
}

function adActivity(active) {
  adPlaying = active;
  syncActivity();
}

async function nextLevel() {
  if (adPending || state.status !== 'won') return;
  const next = state.levelId === 200 ? 1 : state.levelId + 1;
  adPending = true;
  syncActivity();
  requestRender();
  try {
    if (profile.rounds % 2 === 0) await N.requestAd('next', adActivity);
  } finally {
    adPending = false;
    adPlaying = false;
    startLevel(next);
  }
}

async function doubleGems() {
  if (adPending || state.status !== 'won' || !result || result.doubled) return;
  const roundId = result.id;
  adPending = true;
  syncActivity();
  requestRender();
  let outcome = 'unavailable';
  try {
    outcome = await N.requestAd('reward', adActivity, () => {
      if (!result || result.id !== roundId || result.doubled) return;
      result.doubled = true;
      profile.gems += result.gems;
      saveProfile();
    });
  } finally {
    adPending = false;
    adPlaying = false;
    syncActivity();
    requestRender();
    notify(outcome === 'viewed' ? 'Twice as nice. Your bonus gems are saved!' : outcome === 'dismissed' ? 'Ad closed. Your original gems are safe.' : 'No ad available right now. Your gems are safe; keep playing!');
  }
}

function setBannerState(status, message) {
  $('advertisement').dataset.bannerState = status;
  // Only our non-interactive fallback changes. Google's creative and dismissal controls are untouched.
  setText('banner-message', message);
}

async function setupAds() {
  if (!navigator.onLine) {
    setBannerState('offline', 'Advertisement space / connect to the internet for live ads');
    return;
  }
  if (N.testMode || !N.isProductionAdHost()) {
    setBannerState('preview', 'AdSense placeholder / live ads serve on offlinegames.art');
    return;
  }
  if (bannerReady) {
    setBannerState('ready', 'Advertisement space / live ads are subject to availability');
    return;
  }
  if (bannerSetup) return bannerSetup;
  setBannerState('loading', 'Advertisement space / connecting to Google AdSense');
  bannerSetup = (async () => {
    try {
      bannerReady = await N.initializeAds();
      if (!navigator.onLine) {
        setBannerState('offline', 'Advertisement space / connect to the internet for live ads');
      } else if (bannerReady) {
        setBannerState('ready', 'Advertisement space / live ads are subject to availability');
      } else {
        setBannerState('unavailable', 'Advertisement space / no ad available right now');
      }
    } catch {
      setBannerState('unavailable', 'Advertisement space / ads could not be loaded');
    } finally {
      bannerSetup = null;
    }
  })();
  return bannerSetup;
}

function resetProgress() {
  if (adPending) return;
  closeDialog(false);
  clearEffects();
  board.cancelPointer();
  profile = { ...N.DEFAULT_PROFILE, records: {}, highScores: [] };
  state = { status: 'start', levelId: 1, path: [], hintsUsed: 0, mistakes: 0 };
  clock = new N.GameClock();
  result = null;
  saveProfile();
  requestRender();
  notify('A fresh page. Your next little win is waiting.');
}

function perform(action, value) {
  if (adPending) return;
  if (action === 'dialog') { openDialog(value); return; }
  if (action === 'close-dialog') { if (dialog === 'reset') openDialog('settings'); else closeDialog(); return; }
  if (action === 'levels') { chapter = Math.floor((state.levelId - 1) / 50); openDialog('levels'); return; }
  if (action === 'chapter') {
    chapter = Math.min(3, Math.max(0, Number(value) || 0));
    if (dialog === 'levels') refreshDialog('chapter', String(chapter)); else openDialog('levels');
    return;
  }
  if (action === 'level') { startLevel(Number(value)); return; }
  if (action === 'start') { startLevel(state.levelId, true); return; }
  if (action === 'restart') { startLevel(); return; }
  if (action === 'next') { void nextLevel(); return; }
  if (action === 'pause') { togglePause(); return; }
  if (action === 'undo') { undo(); return; }
  if (action === 'hint') { useHint(); return; }
  if (action === 'reward') { void doubleGems(); return; }
  if (action === 'fullscreen') { void N.enterFullscreen(notify); return; }
  if (action === 'reset') { resetProgress(); return; }
  if (action === 'back-to-game') { closeDialog(); if (state.status === 'start') startLevel(state.levelId, true); return; }
  if (action === 'mute') {
    const audible = !profile.muted && (profile.sound || profile.music);
    profile.muted = audible;
    if (!audible && !profile.sound && !profile.music) profile.sound = true;
    N.audio.unlock();
    saveProfile();
    return;
  }
  if (action === 'setting' && ['sound', 'music', 'haptics', 'muted'].includes(value)) {
    profile[value] = !profile[value];
    N.audio.unlock();
    saveProfile();
    refreshDialog('setting', value);
    return;
  }
  if (action === 'mode' && ['timed', 'relaxed'].includes(value) && profile.mode !== value) {
    profile.mode = value;
    startLevel();
    notify(value === 'relaxed' ? 'Relaxed mode. Take all the time you need.' : 'Timed challenge. Beat the clock for a 20% score bonus.');
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || (dialog && !$('modal').contains(button))) return;
  perform(button.dataset.action, button.dataset.value);
});

$('modal-backdrop').addEventListener('pointerdown', (event) => {
  if (event.target === $('modal-backdrop')) perform('close-dialog');
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'player-name') return;
  profile.playerName = event.target.value.slice(0, 16);
  storageAvailable = N.saveProfile(profile);
});

document.addEventListener('focusout', (event) => {
  if (event.target.id === 'player-name' && !profile.playerName.trim()) {
    profile.playerName = 'You';
    event.target.value = 'You';
    storageAvailable = N.saveProfile(profile);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || adPending) return;
  const key = event.key.toLowerCase();
  if (dialog) {
    if (key === 'escape') { event.preventDefault(); perform('close-dialog'); return; }
    if (key === 'tab') {
      const items = [...$('modal').querySelectorAll('button:not(:disabled), input, a[href], [tabindex="0"]')].filter((element) => element.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('modal'))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.target.getAttribute('role') === 'tab' && ['arrowleft', 'arrowright', 'home', 'end'].includes(key)) {
      event.preventDefault();
      perform('chapter', key === 'home' ? 0 : key === 'end' ? 3 : (chapter + (key === 'arrowright' ? 1 : 3)) % 4);
    }
    return;
  }
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.repeat && !/^(arrow(up|down|left|right)|[wasdz]|backspace)$/.test(key)) { if ([' ', 'enter', 'r', 'h', 'p', 'escape'].includes(key)) event.preventDefault(); return; }
  if ([' ', 'enter'].includes(key) && event.target.closest('button, a')) return;
  if (['enter', ' '].includes(key) && state.status === 'start') { event.preventDefault(); startLevel(state.levelId, true); return; }
  if (key === 'enter' && state.status === 'won') { event.preventDefault(); void nextLevel(); return; }
  if (key === 'enter' && state.status === 'lost') { event.preventDefault(); startLevel(); return; }
  if (['p', 'escape', ' '].includes(key)) { event.preventDefault(); togglePause(); return; }
  if (key === 'r') { event.preventDefault(); startLevel(); return; }
  if (state.status !== 'playing') return;
  if (['backspace', 'z'].includes(key)) { event.preventDefault(); undo(); return; }
  if (key === 'h') { event.preventDefault(); useHint(); return; }
  const directions = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
  if (!directions[key]) return;
  event.preventDefault();
  N.audio.unlock();
  const level = N.LEVELS[state.levelId - 1];
  if (!state.path.length) visitCell(level.solution[0]);
  const head = state.path[state.path.length - 1];
  if (head === undefined) return;
  const [dx, dy] = directions[key];
  const x = head % level.size + dx, y = Math.floor(head / level.size) + dy;
  if (x >= 0 && y >= 0 && x < level.size && y < level.size) visitCell(y * level.size + x);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'playing') {
    state.status = 'paused';
    board.cancelPointer();
    requestRender();
  }
  syncActivity();
});

function connectivity() {
  $('offline-indicator').hidden = navigator.onLine;
  setText('footer-status', navigator.onLine ? 'Made for a moment offline.' : 'You are offline. Keep connecting.');
  void setupAds();
}
window.addEventListener('online', connectivity);
window.addEventListener('offline', connectivity);
window.addEventListener('pagehide', () => { clock.pause(); N.audio.setMuted(true); N.saveProfile(profile); });
window.addEventListener('pageshow', () => syncActivity());

setInterval(() => {
  if (state.status !== 'playing' || dialog || adPending || document.hidden) return;
  if (!timeExpired()) renderTime();
}, 200);

N.ui.paintIcons();
renderProfile();
syncActivity();
render();
connectivity();
N.setupPlatform();
N.game = Object.freeze({
  start: startLevel,
  visit: visitCell,
  snapshot: () => ({ ...state, path: [...state.path], result: result ? { ...result } : null, gems: profile.gems, completed: Object.keys(profile.records).length }),
});
document.documentElement.dataset.gameReady = 'true';
})(globalThis.Numberly = globalThis.Numberly || {});