# 4 new games for offlinegames.art

Snake · Minesweeper · Block Drop · Memory Match

Each game is one self-contained `index.html` file. They need no internet, have no
external scripts or ads code, save best scores on the player's device, and work
with keyboard, mouse, and touch. They're built to run inside your site's play frame.

## What's in here

```
upload-to-site/
  games/snake/index.html
  games/minesweeper/index.html
  games/block-drop/index.html
  games/memory-match/index.html
  covers/snake.jpg            (640×336, same size as your other covers)
  covers/minesweeper.jpg
  covers/block-drop.jpg
  covers/memory-match.jpg
catalog-additions.js          (the 4 catalog entries)
```

## Add them to the site

1. Copy `upload-to-site/games/*` into your site's `games/` folder, and
   `upload-to-site/covers/*` into `covers/`. Don't replace anything else.
2. Add the games to the catalog, whichever way you prefer:
   - **Admin panel:** go to `offlinegames.art/#admin06`, sign in, click **+ Add Game**
     for each one, and copy the title, description, category, cover, and embed
     path from `catalog-additions.js`. Then **Save & exit → Download catalog.js**.
   - **By hand:** open your current `catalog.js` and paste the 4 entries from
     `catalog-additions.js` right after the last game, before the `];`.
3. Upload to Cloudflare Pages the same way you always do.

## Check after deploying

- [ ] All 4 games show up in the vault with their covers
- [ ] Each one opens and plays, on a phone too
- [ ] Refresh the page: best scores are still there

Tic-Tac-Toe, 2048, and Sudoku were left out because the site already has them.
