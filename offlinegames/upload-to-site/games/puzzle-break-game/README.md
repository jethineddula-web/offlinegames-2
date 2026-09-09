# 🧩 Puzzle Break — 50 Jigsaw Adventures

A complete browser puzzle game as **plain files** — no build step. Open `index.html`
directly (double-click it, or serve the folder) and it loads `style.css`, `game.js`,
`images.js` and the pictures in `img/` like any normal website.

## 📂 Files
```
index.html   — page structure, links the css/js below
style.css    — all styling
game.js      — all game logic
images.js    — list of puzzle pictures (title + file path)
img/         — the 10 puzzle photos (01-forest.jpg … 10-castle.jpg)
```
To swap or add artwork: drop a `.jpg` in `img/` and add a `{ t: 'Title', s: 'img/yourfile.jpg' }`
line to `images.js`. Nothing needs compiling.

## ▶ How to play
1. **Start screen** → hit **Play** (continues where you left off).
2. The picture is shown for **2 seconds** — 👀 memorize it!
3. It **shatters** with a flash, crack-jitter and whoosh — pieces fly into the tray.
4. Drag pieces onto the glowing slots. Correct = snap + sparkle; wrong = buzz + shake.
5. Complete the puzzle → **sparkle explosion + confetti + fanfare** → next level!

## ✨ Features
- **50 levels** on 10 unique artworks — grids grow 2×2 → 3×3 → 4×4 → 5×5 → 6×6 → 7×7 (49 pieces!)
- **Sound effects** synthesized live (Web Audio): click, pickup, snap, buzz, shatter, sparkle,
  fanfare + a gentle background melody. **Mute button** on every screen.
- **Memorize → break-apart animation** at the start of every level.
- **Sparkling/confetti celebration** on every correct piece *and* on level completion.
- Difficulty ramp: pieces get tilted (6°→12°) and, from level 23, rotated 90°/180°/270°.
- ⭐ **1–3 stars per level** based on move efficiency — progress + best stars saved
  (localStorage; gracefully falls back to in-memory if storage is blocked).
- 💡 Hint button (1 per level), level select with locks, replay, timer & move counter.
- Works with mouse, touch and pen (including proper multi-touch handling); responsive
  from phones to desktops.

## 💾 Saving
Progress and star ratings are written to the browser's `localStorage`, keyed to wherever
you're opening the file from. Play again later from the *same file/folder location* in
the *same browser* and it picks up where you left off. If a browser blocks storage
(e.g. some private-browsing modes) it falls back to remembering progress for just that
session instead of failing.

## 🛠 Dev
- `node test.js` — headless logic/UI test (needs `npm i jsdom`).
- `node layoutcheck.js` — layout sanity across viewports (needs `npm i jsdom`).

## 🗺 Level design
| Levels | Grid | Tilt |
|---|---|---|
| 1 | 2×2 | none |
| 2–4 | 3×3 | none |
| 5–10 | 4×4 | ±6° |
| 11–18 | 5×5 | ±12° |
| 19–40 | 6×6 | ±12° → 90° rotations (23+) |
| 41–50 | 7×7 | 90° rotations |
