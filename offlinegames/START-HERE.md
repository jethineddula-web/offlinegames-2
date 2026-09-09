# OfflineGames — everything is already wired up

Your files came in, I made the changes inside them, and tested the result in a
real browser. You don't have to edit any HTML — that's done.

```
upload-to-site/     ← drag ALL of this into Cloudflare Pages
keep-private/       ← one local tool, never upload it
```

---

## About the virus warning on the last download

It was a false positive — every file is plain text, no binaries, no `eval`,
nothing that fetches or runs remote code. **But the reason it fired was not a
fluke, and I've acted on it.**

The obfuscated `catalog.js` I built was a hardcoded key, an XOR loop, a base64
alphabet, and 130 long base64 literals feeding a decoder. That is precisely how
real malware packs a payload. A heuristic scanner cannot tell your game list
from a dropper, because at the byte level they look identical.

**The ZIP was never the real risk.** That same file would have sat on your live
site, served to every visitor — inviting browser warnings, a possible Google
Safe Browsing listing for offlinegames.art, and AdSense scrutiny of a flagged
domain. Any one of those costs far more than a competitor reading game titles
that are printed on your own homepage anyway.

So `catalog.js` is readable JavaScript again, and the packer code is **removed**
from `site-admin.js` — not switched off, deleted, so it can't creep back. The
codec files are gone from the package too.

If you ever want the catalog genuinely private, the real answer is a Cloudflare
Worker that checks who's asking. That's actual protection with no
malware-heuristic risk. Obfuscation was the weak version, and it had a sharp
edge.

---

## Do these two things

### 1. Set your admin password

Right now the editing tools are **switched off entirely** — safer than the old
behaviour, where a stranger's browser was invited to create its own password
and walk straight in.

1. Open `keep-private/admin-hash-tool.html` on your computer
   (if the browser blocks it on `file://`, run `npx serve .` in that folder and
   open `http://localhost:3000/admin-hash-tool.html`)
2. Type the password you want — **10+ characters**
3. Copy the `var ADMIN = { … };` block it gives you
4. Paste it over the placeholder block near the top of
   `upload-to-site/site-admin.js`
5. Save the password in a password manager — the hash can't be reversed

**Never upload `admin-hash-tool.html`.**

### 2. Upload `upload-to-site/`

Drop the whole folder into Cloudflare Pages. Keep your existing `games/`,
`covers/`, `screenshots/`, icons and `favicon.svg` — I didn't touch those and
they aren't in here.

---

## What changed in your files

| File | What I did |
|---|---|
| `index.html` | Added the two stylesheets; reordered scripts (order matters — below) |
| `about / contact / guides / library / news / privacy .html` | Same additions; removed your email from the visible text |
| `terms.html` | **Rebuilt** — wasn't in your upload. Content copied verbatim from the Terms section already inside `index.html` |
| `sw.js` | **New** — yours wasn't in the upload either. Network-first on `catalog.js`, fixing the stale-catalog-on-phones problem your guides page describes |
| `site-admin.js` | Rewritten — PBKDF2 password hash, no one-line bypass, no packer code |
| `catalog.js` | **Left readable** — see above |
| `robots.txt` | `Disallow` lines for the admin tooling |
| `app.js` | **One bug fixed** in `showPanel()` — see below. Nothing else changed |
| `admin-forms.js`, `styles.css` | **Untouched** |

**New files:** `_headers`, `ui-fx.css`, `ui-fx.js`, `console-ui.css`,
`console-ui.js`, `contact-panel.js`, `admin-export.js`.

### The "Nothing matches." bug

`showPanel()` treated `#empty` and `#cat-heading` as vault furniture — things to
show whenever you're on the vault. But those two are **state**-dependent, not
panel-dependent: only `renderGrid()` and `renderCats()` know whether they belong
on screen.

The result: leave the vault, come back, and both were forced visible. You got
the "Nothing matches." placeholder that ships inside `index.html`, plus an empty
category heading with a stray "✕ Show all" button — sitting directly above a
full grid of 23 games.

This is also what your very first screenshot showed. At the time we put it down
to the missing games folder; it wasn't, it was this.

The fix hides both in `showPanel()` and re-runs `renderCats()` / `renderGrid()`
when returning to the vault, so those two decide. Verified: the placeholder now
stays hidden across navigation, still appears for a search that genuinely
matches nothing, and disappears again when the search is cleared. Category
headings survive navigation with the right label and count.

### Script order in index.html

Two rules, both already applied — just don't shuffle them later:

- `contact-panel.js` loads **before** `app.js` — it intercepts the Contact links
  and has to beat app.js's page router to them
- `ui-fx.js` and `console-ui.js` load **after** `app.js` — they watch the
  rendered grid

---

## The console-dashboard theme

`console-ui.css` + `console-ui.js` are a pure override layer. **Delete the one
`console-ui.css` `<link>` and the site looks exactly as it did before.**

- **Focus, not scan.** Hover or arrow onto a tile and it lifts, scales and rings
  in cyan while every other tile dims and desaturates.
- **Detail on demand.** Descriptions stay collapsed until a tile is focused.
- **Arrow keys actually work.** Your hint line always promised this; nothing
  implemented it. Column count is read from the live grid, so it stays correct
  at every breakpoint. The hint line is redrawn as key caps.
- **The room reacts.** Background glow is sampled from the focused game's cover
  art — hue kept, saturation forced up so it never turns to grey mud.
- Soft rectangles instead of clipped cartridges; NEW ribbon becomes a status
  pill; the cyan rule becomes an accent bar that fills on focus; a ▶ appears
  over the art; scanlines off (arcade cue, not console).

All of it switches off under `prefers-reduced-motion`, and on touch nothing
dims or hides — there's no hover to reveal it with.

---

## The contact form

No backend, so a message still leaves through the visitor's own email. But a
bare `mailto:` goes to whatever the OS registered as default — on Windows very
often Outlook, even for people who only use Gmail, and a web page cannot detect
or override that. So the form **asks**: Gmail, Outlook, your own mail app, or
copy the message to paste anywhere.

**Gmail redirect loop, fixed.** The first version used Google's legacy
`?view=cm` compose link, which returns `ERR_TOO_MANY_REDIRECTS` whenever the
browser isn't already on account index 0 — signed out, or signed into more than
one Google account. It now uses `mail.google.com/mail/u/0/?tf=cm`, which names
the account explicitly.

Because the compose window opens in a new cross-origin tab, this page **cannot
tell whether it actually loaded** — a redirect loop or a popup block fails
silently from here. So after you pick Gmail or Outlook, a panel appears offering
"Copy the message instead". Copying always works, whatever the device does.

**Your address is no longer printed anywhere on the site.** It used to sit in
plain text on four pages — exactly what harvesting bots scrape. Those now show a
button that opens the form. In the JavaScript it's assembled at runtime, so a
bot regexing for `name@domain` finds nothing. A bot that runs JavaScript could
still read it; that isn't fixable on a static site, but you're off the easy list.

---

## Adding games from now on

1. Drop the game into `games/`
2. Go to `offlinegames.art/#admin06`, sign in
3. **+ Add Game**, fill it in
4. **Save & exit → Download catalog.js**
5. Upload that file

One file, readable, same as it always was.

---

## After you deploy — check these

- [ ] Games load and play
- [ ] Hovering a tile lifts it and dims the others
- [ ] Arrow keys move between tiles, Enter starts one
- [ ] **Contact** in the nav opens the slide-over panel, not the old page
- [ ] The subject dropdown is readable (it was white-on-white before)
- [ ] Sending offers Gmail / Outlook / mail app / copy
- [ ] `#admin06` asks for a password and rejects a wrong one
- [ ] Headers live: check at <https://securityheaders.com>
- [ ] **AdSense still paying** — see below

### The one thing that could bite you

The Content-Security-Policy in `_headers` allowlists Google's ad domains. If
Google starts serving from one I didn't list, **your ads go quiet with no error
on screen.** If revenue drops after deploying:

1. Open the site, press F12, look at the Console
2. Find a red `Content-Security-Policy` line naming a blocked domain
3. Add it to the `script-src` / `frame-src` lists in `_headers`
4. Re-upload

Don't want the risk at all? Delete the single `Content-Security-Policy:` line.
You keep the anti-framing protection (`X-Frame-Options`, a separate line) and
lose only the script-origin restriction.

---

`SECURITY.md` has the full review, including the revised catalog section.
