Crayon Kingdom — HTML / CSS / JavaScript
========================================

A kids color-by-number game. No React, no npm, no build step.
Color pixel by pixel: drag across each matching numbered square.

WHAT TO OPEN
------------
Option A (easiest):  double-click  crayon-kingdom.html
  One file. Everything is inside it. Works offline after the first
  Google Fonts load (or offline if the font is already cached).

Option B (three files together):  open  index.html
  Needs styles.css and game.js sitting in the SAME folder.

HOW TO HOST
-----------
Upload these files to any static host (GitHub Pages, Netlify, itch.io,
a plain Apache/Nginx folder):

  index.html
  styles.css
  game.js

Or upload only crayon-kingdom.html.

HOW TO PLAY
-----------
1. Pick a numbered crayon in the tray.
2. Drag across every matching numbered pixel — each square fills
   on its own. Tapping one box does NOT fill the whole shape.
3. Finish every pixel to complete the picture.
   Zero mistakes = three stars.

Hint fills a small leftover cluster.
Peek flashes the finished picture.
Fill color paints every remaining pixel of the crayon you picked.
Progress is saved in this browser (localStorage).

40 pictures in 7 worlds.
