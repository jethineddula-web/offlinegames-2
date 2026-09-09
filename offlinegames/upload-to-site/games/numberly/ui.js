(function (N) {
'use strict';

const paths = {
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  undo: '<path d="M3 10h10a7 7 0 0 1 0 14M3 10l5-5M3 10l5 5" transform="translate(0 -3)"/>',
  restart: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7"/>',
  lightbulb: '<path d="M9 18v-2c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7v2M9 18h6M9 21h6"/>',
  volume: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-6 5H2v6h3l6 5zM17 9l5 6m0-6-5 6"/>',
  music: '<path d="M9 18V5l12-3v14M9 8l12-3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  settings: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2" fill="#f7f8f2"/><circle cx="16" cy="12" r="2" fill="#f7f8f2"/><circle cx="8" cy="19" r="2" fill="#f7f8f2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
  trophy: '<path d="M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 12v6M8 21h8M9 18h6v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  timer: '<circle cx="12" cy="14" r="8"/><path d="M9 2h6M12 2v4M19 5l2 2M12 10v4"/>',
  gem: '<path d="m3 8 4-5h10l4 5-9 13zM3 8h18M7 3l5 18 5-18M9 8l3-5 3 5"/>',
  leaf: '<path d="M20 3C8 1 2 8 5 15c3 7 14 6 15-12ZM3 21 16 8"/>',
  sprout: '<path d="M12 22v-9M12 15C4 16 2 11 3 5c7-1 10 4 9 10ZM12 12C11 4 16 2 22 3c1 7-4 10-10 9Z"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4"/>',
  star: '<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3.2 9.6l6.3-.9z"/>',
  shield: '<path d="M12 2 4 5v7c0 5 8 10 8 10s8-5 8-10V5zM8 12l3 3 5-6"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
  expand: '<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  'wifi-off': '<path d="m2 2 20 20M8 8a14 14 0 0 0-6 4M12 6a16 16 0 0 1 10 6M7 16a8 8 0 0 1 8-2M12 20h.01"/>',
  gamepad: '<path d="M7 5h10c2 0 3 2 4 6l1 5c.5 3-2 4-4 2l-2.5-3h-7L6 18c-2 2-4.5 1-4-2l1-5c1-4 2-6 4-6ZM6 10h5M8.5 7.5v5M16 9h.01M18 12h.01"/>',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function icon(name, size = 20, filled = false) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkles}</svg>`;
}

function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    const template = document.createElement('template');
    template.innerHTML = icon(element.dataset.icon, Number(element.dataset.size) || 20);
    element.replaceWith(template.content);
  });
}

function stars(count, animated = false) {
  return `<div class="stars ${animated ? 'animated-stars' : ''}" aria-label="${count} out of 3 stars">${[1, 2, 3].map((star) => icon('star', animated ? 35 : 13, star <= count).replace('<svg ', `<svg class="${star <= count ? 'earned' : 'unearned'}" style="--star-delay:${star * 120}ms" `)).join('')}</div>`;
}

function primary(label, action, leading = '', value = '', disabled = false) {
  return `<button class="primary-button" data-action="${action}" data-value="${escapeHtml(value)}" ${disabled ? 'disabled' : ''}>${leading ? icon(leading, 16, leading === 'play') : ''}${label}${icon('arrow-right', 17)}</button>`;
}

function connectionMark() {
  return '<svg width="45" height="43" viewBox="0 0 45 43" fill="none" aria-hidden="true"><path d="M10 12H29C37 12 37 30 28 30H17" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="10" cy="12" r="5" fill="currentColor"/><circle cx="17" cy="30" r="5" fill="currentColor"/><circle cx="10" cy="12" r="1.3" fill="#fafbf5"/><circle cx="17" cy="30" r="1.3" fill="#fafbf5"/></svg>';
}

function overlay(state, profile, result, pending) {
  if (state.status === 'playing') return '';
  if (state.status === 'start') return `<div class="overlay-content start-content"><div class="start-symbol">${connectionMark()}</div><h2>Find your flow.</h2><p>Start at 1. Connect in order.<br>Finish on the last number.</p>${primary(Object.keys(profile.records).length ? 'Keep connecting' : "Let's play", 'start', 'play')}<span class="start-note">200 puzzles. Your own pace.</span></div>`;
  if (state.status === 'paused') return `<div class="overlay-content"><div class="overlay-icon">${icon('leaf', 30)}</div><span class="eyebrow overlay-eyebrow">TAKE A BREATHER</span><h2>A little pause.</h2><p>Your next connection can wait.<br>Pick up right where you left off.</p>${primary('Keep going', 'pause', 'play')}<button class="overlay-text-button" data-action="restart">${icon('restart', 14)}Start this level again</button></div>`;
  if (state.status === 'lost') return `<div class="overlay-content"><div class="overlay-icon">${icon('timer', 30)}</div><span class="eyebrow overlay-eyebrow">TIME'S UP, NOT YOUR SPIRIT</span><h2>One more try?</h2><p>Every attempt is a fresh start.<br>You've got the next one.</p>${primary('Try again', 'restart', 'restart')}<button class="overlay-text-button" data-action="mode" data-value="relaxed">Switch to relaxed play</button></div>`;
  if (!result) return '';
  const confetti = Array.from({ length: 24 }, (_, i) => `<i style="--x:${((i * 43) % 310) - 155}px;--y:${-70 - (i * 31) % 200}px;--r:${i * 47}deg;--delay:${i % 6 * 45}ms;--color:${['#8ba479', '#dfb575', '#c4b7d5', '#d99f84'][i % 4]}"></i>`).join('');
  return `<div class="overlay-content win-content"><div class="confetti" aria-hidden="true">${confetti}</div>${stars(result.stars, true)}<span class="eyebrow overlay-eyebrow">${result.newBest ? 'A NEW PERSONAL BEST' : 'ANOTHER LITTLE WIN'}</span><h2>Beautifully connected.</h2><div class="win-results"><div><strong>${result.score.toLocaleString()}</strong><span>POINTS</span></div><span class="win-result-divider"></span><div><strong class="gem-result">${icon('gem', 20)}+${result.gems * (result.doubled ? 2 : 1)}</strong><span>GEMS COLLECTED</span></div></div>${primary(pending ? 'One little moment...' : state.levelId === 200 ? 'Back to level one' : 'Next little challenge', 'next', '', '', pending)}<button class="reward-button ${result.doubled ? 'reward-claimed' : ''}" data-action="reward" ${pending || result.doubled ? 'disabled' : ''}>${icon(result.doubled ? 'check-circle' : 'play', 14)}<span>${result.doubled ? 'Double gems collected' : 'Watch an ad for 2x gems'}</span>${result.doubled ? '' : icon('gem', 14)}</button></div>`;
}

function chapters(profile) {
  return N.CHAPTERS.map((chapter, index) => {
    const completed = Object.keys(profile.records).filter((id) => Math.floor((Number(id) - 1) / 50) === index).length;
    return `<button class="chapter-row" data-action="chapter" data-value="${index}"><span class="chapter-dot ${chapter.color}">${completed === 50 ? icon('check', 12) : '<span></span>'}</span><span class="chapter-copy"><strong>${chapter.name}</strong><span>${chapter.range}<i></i>${chapter.difficulty}</span></span>${icon('chevron-right', 15)}</button>`;
  }).join('');
}

function dialogContent(name, state, profile, chapter) {
  let title = '', subtitle = '', content = '';
  const completed = Object.keys(profile.records).length;
  if (name === 'how') {
    title = 'A few numbers. One lovely line.'; subtitle = 'Easy to learn. Satisfying to figure out.';
    content = `<div class="tutorial-demo" aria-hidden="true"><span class="demo-number">1</span><span class="demo-connector"></span><span class="demo-number">2</span><span class="demo-connector"></span><span class="demo-number demo-last">3${icon('check', 13)}</span></div><div class="tutorial-steps"><p><strong>Start at 1.</strong> Press and drag, or tap one square at a time.</p><p><strong>Go in order.</strong> Reach 2, then 3, and keep going. Move up, down, left, or right. No diagonals.</p><p><strong>Finish the line.</strong> Reaching the final number wins. Empty squares are allowed. Your path cannot cross itself.</p><p><strong>Change your mind.</strong> Drag backward along your line, tap a visited square to rewind, or use Undo. There is no penalty for backtracking.</p></div><div class="keyboard-guide">${icon('keyboard', 20)}<div><strong>A keyboard works beautifully, too.</strong><p><kbd>Arrows</kbd> or <kbd>W A S D</kbd> move <kbd>Space</kbd> pause<br><kbd>Backspace</kbd> undo <kbd>R</kbd> restart <kbd>H</kbd> hint</p></div></div><div class="modal-primary">${primary("Let's make a connection", 'back-to-game')}</div>`;
  } else if (name === 'levels') {
    title = 'Your next little challenge.'; subtitle = 'All 200 levels are open. Follow your curiosity.';
    content = `<div class="level-tabs" role="tablist" aria-label="Difficulty">${N.CHAPTERS.map((item, index) => `<button role="tab" id="chapter-tab-${index}" aria-selected="${chapter === index}" aria-controls="level-panel" tabindex="${chapter === index ? 0 : -1}" data-action="chapter" data-value="${index}" class="${chapter === index ? 'active' : ''}">${item.difficulty}<span>${index * 50 + 1}-${(index + 1) * 50}</span></button>`).join('')}</div><div id="level-panel" class="level-grid" role="tabpanel" aria-labelledby="chapter-tab-${chapter}">${N.LEVELS.slice(chapter * 50, (chapter + 1) * 50).map((level) => `<button class="level-tile ${profile.records[level.id] ? 'completed' : ''} ${level.id === state.levelId ? 'current' : ''}" data-action="level" data-value="${level.id}" aria-label="Play level ${level.id}, ${level.difficulty}${profile.records[level.id] ? ', ' + profile.records[level.id].stars + ' stars' : ''}"><span>${level.id}</span>${profile.records[level.id] ? stars(profile.records[level.id].stars) : '<span class="level-tile-dot"></span>'}</button>`).join('')}</div><div class="level-browser-footer"><span>${icon('check-circle', 14)}${completed} little wins collected</span><span>${N.LEVELS[chapter * 50].size} x ${N.LEVELS[chapter * 50].size} grid</span></div>`;
  } else if (name === 'leaderboard') {
    title = 'Your best little moments.'; subtitle = 'Your top 10 scores, saved on this device.';
    content = profile.highScores.length ? `<div class="score-table"><div class="score-table-head"><span>#</span><span>PLAYER / LEVEL</span><span>TIME</span><span>SCORE</span></div>${profile.highScores.map((entry, index) => `<div class="score-table-row"><span class="${index === 0 ? 'first-place' : ''}">${index === 0 ? icon('trophy', 17) : index + 1}</span><span><strong>${escapeHtml(entry.name)}</strong><small>Level ${N.levelLabel(entry.level)}${entry.mode === 'timed' ? ' / Timed' : ''}</small></span><span>${N.formatTime(entry.time)}</span><strong>${entry.score.toLocaleString()}</strong></div>`).join('')}</div>` : `<div class="empty-state"><div class="empty-state-icon">${icon('trophy', 35)}</div><h3>A fresh page for your best.</h3><p>Finish your first puzzle to put a little<br>win on the board.</p>${primary('Find your first win', 'back-to-game')}</div>`;
    content += `<div class="score-explainer">${icon('sparkles', 16)}<p>Connect faster and use fewer hints for a higher score. Timed mode adds a 20% bonus. No account needed.</p></div>`;
  } else if (name === 'settings') {
    title = 'Make yourself comfortable.'; subtitle = 'A little game, your way.';
    content = profile.muted ? `<div class="muted-notice">${icon('muted', 14)}<span>All audio is currently muted.</span><button data-action="setting" data-value="muted">Unmute</button></div>` : '';
    content += [['sound', 'volume', 'Sound effects', 'The satisfying sound of a connection.'], ['music', 'music', 'Background music', 'A soft, original ambient melody.'], ['haptics', 'phone', 'Gentle vibrations', 'A tiny nudge on supported phones.']].map(([key, symbol, label, description]) => `<div class="setting-row"><div>${icon(symbol, 19)}<span><strong>${label}</strong><small>${description}</small></span></div><button class="switch ${profile[key] ? 'on' : ''}" role="switch" aria-checked="${profile[key]}" aria-label="${label}" data-action="setting" data-value="${key}"><span></span></button></div>`).join('');
    content += `<div class="mode-setting"><label>YOUR PACE</label><div class="mode-selector">${[['relaxed', 'leaf', 'Relaxed', 'No time limit'], ['timed', 'timer', 'Timed', 'A little extra challenge']].map(([key, symbol, label, description]) => `<button class="${profile.mode === key ? 'selected' : ''}" data-action="mode" data-value="${key}">${icon(symbol, 17)}<span><strong>${label}</strong><small>${description}</small></span>${profile.mode === key ? icon('check', 15) : ''}</button>`).join('')}</div></div><label class="name-setting"><span>YOUR LEADERBOARD NAME</span><input id="player-name" maxlength="16" value="${escapeHtml(profile.playerName)}" placeholder="You" autocomplete="nickname"></label><button class="fullscreen-setting" data-action="fullscreen">${icon('expand', 18)}<span>Portrait fullscreen<small>Orientation lock depends on your browser.</small></span>${icon('arrow-up-right', 16)}</button><div class="settings-foot"><span>${icon('shield', 13)}${N.VERIFIED_LEVELS} solvable puzzles verified</span><button data-action="dialog" data-value="reset">Reset progress</button></div>`;
  } else if (name === 'gems') {
    title = 'A little nudge goes a long way.'; subtitle = 'Your gems are here when you need a hand.';
    content = `<div class="gems-display">${icon('gem', 43)}<strong>${profile.gems.toLocaleString()}</strong><span>GEMS IN YOUR POCKET</span></div><div class="gem-explanation"><p>${icon('lightbulb', 19)}<span><strong>Need a fresh direction?</strong>A hint costs 5 gems and reveals the next square of a solution. If needed, it rewinds your path first.</span></p><p>${icon('sparkles', 19)}<span><strong>A little reward for every win.</strong>Earn 10-25 gems for each completed puzzle. Everyone starts with 25.</span></p><p>${icon('play', 19)}<span><strong>Twice as nice.</strong>After a win, choose to watch a rewarded ad for 2x that round's gems. Always optional, always your choice.</span></p></div><div class="modal-primary">${primary('Back to the good stuff', 'back-to-game')}</div>`;
  } else if (name === 'privacy') {
    title = 'A few things worth knowing.'; subtitle = 'How Numberly stays free.';
    content = `<div class="privacy-content"><p><strong>Your progress stays with you.</strong> Scores, gems, and preferences are stored only in this browser. No account or game analytics.</p><p><strong>Ads keep the game free.</strong> The bottom of the screen is reserved for Google AdSense anchor ads. An additional ad is requested between every two completed rounds. Availability, dismissal, and frequency are controlled by the provider; the game never forces banner refreshes. An app wrapper needs a configured Google Mobile Ads SDK to use AdMob.</p><p><strong>Rewards are real, never simulated.</strong> Double gems are granted only after the provider confirms a fully watched reward ad. If no ad is available, your original gems are safe.</p><p>The hosting site's consent settings apply to advertising. <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">Google's advertising policy ${icon('arrow-up-right', 12)}</a></p></div><div class="modal-primary">${primary('Continue', 'close-dialog')}</div>`;
  } else if (name === 'reset') {
    title = 'A completely fresh start?'; subtitle = 'This cannot be undone.';
    content = `<p class="reset-description">This will clear your completed levels, gems, and local high scores on this device. Your settings return to their defaults, with 25 starting gems.</p><button class="primary-button modal-primary reset-confirm" data-action="reset">Yes, reset my progress${icon('restart', 16)}</button><button class="secondary-button privacy-decline" data-action="dialog" data-value="settings">Keep my little wins</button>`;
  }
  return { className: name + '-modal', html: `<header class="modal-heading"><div><h2 id="dialog-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button close-button" data-action="close-dialog" aria-label="Close dialog">${icon('close', 20)}</button></header>${content}` };
}

N.ui = { icon, escapeHtml, paintIcons, stars, chapters, overlay, dialogContent };
})(globalThis.Numberly = globalThis.Numberly || {});