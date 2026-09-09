# Security review — offlinegames.art

Reviewed: `index.html`, `app.js`, `catalog.js`, `site-admin.js`,
`admin-forms.js`, plus the Cloudflare Pages setup.

**Overall:** the site was in better shape than most hobby game portals — the
play iframe was already sandboxed, output was escaped, and there is no server
or database to break into. The problems that existed were about *access* and
*exposure*, not about someone taking over the site.

---

## The one thing worth understanding first

offlinegames.art is a **static site**. There is no server-side code, no
database, no login system. Everything ships to the visitor's browser.

That has a happy consequence and an unhappy one:

- **Happy:** there is nothing to SQL-inject, no admin account to steal, no
  server to pop. The realistic worst case is a visitor messing with their own
  copy of the page. They cannot change what anyone else sees.
- **Unhappy:** anything the browser can read, a person can read. "Hiding" the
  catalog completely is not possible without a backend. See #4.

So "how safe is my site from hacking" has a fairly reassuring answer: the
attack surface is small. The fixes below are about closing the doors that
*were* open.

---

## 1. The admin password was not a password — **fixed**

**Severity: high (for the tooling), low (for the live site)**

Three separate problems in `site-admin.js`:

```js
// v1 — anyone could type this in the console and become "admin"
sessionStorage.setItem('og-admin-session', '1');
```

- The unlock check was a plain string in `sessionStorage`. One line in devtools
  bypassed it entirely.
- Your password was stored in `localStorage` as **readable cleartext**.
- On any browser that had never seen the site, the first-run flow invited the
  visitor to *create* a password and let them straight in. Someone finding
  `#admin06` in your source — it's right there in `app.js` — got the editing
  tools on their first try.

**What changed:**

- The unlocked flag now lives in a closure variable inside `site-admin.js`.
  There is no storage key to forge and nothing on `window` to set.
- The "create a password" flow is gone. A PBKDF2-SHA256 hash (210,000 rounds,
  random 16-byte salt) is baked into the file; only the right password
  produces it, and the file gives away nothing about what that password is.
- Comparison is constant-time-ish, and five wrong guesses trigger a 30-second
  cool-off.

**What it still cannot do:** stop someone determined. With devtools open on
their own machine, a person can call the editing functions directly. But even
then, all they get is a `catalog.js` file downloaded to *their* computer. They
cannot publish it. Your live site changes only when you upload a file.

If you want a real lock, see "Going further" at the bottom.

---

## 2. No security headers — **fixed**

**Severity: medium**

The site sent no `X-Frame-Options`, no CSP, no `Referrer-Policy`, no
`Permissions-Policy`. The practical consequence:

**Any other site could put offlinegames.art in an iframe.** A scraper portal
could wrap your whole vault, run their own ads around it, and take the revenue
while you pay for the bandwidth. This is the most likely thing to actually
happen to a games site, and it was wide open.

The new `_headers` file sets:

| Header | Why |
|---|---|
| `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` | Stops other sites framing yours. **The highest-value fix here.** |
| `Content-Security-Policy` | Restricts where scripts, styles and frames may load from. Tuned so AdSense and Google Fonts keep working. |
| `X-Content-Type-Options: nosniff` | An uploaded `.jpg` can't be re-interpreted as a script |
| `Referrer-Policy: strict-origin-when-cross-origin` | Third-party game files and ad calls stop receiving your full URLs |
| `Permissions-Policy` | An embedded game can no longer ask for camera, mic or location |
| `Strict-Transport-Security` | Locks the site to HTTPS |
| `X-Robots-Tag` on admin files | Keeps `site-admin.js` out of Google |

**Watch AdSense after deploying.** The CSP allowlists Google's ad domains, but
if Google adds a new one your ads could go quiet. If that happens, open the
browser console, look for a `Content-Security-Policy` error naming a blocked
domain, and add it to the `script-src` / `frame-src` list in `_headers`.

---

## 3. Your email address is scrapable

**Severity: low — not fixed, your call**

`jethinproductions@gmail.com` appears in plain text in `index.html`,
`privacy.html` and `terms.html`. Spam bots harvest exactly this pattern.

The new contact panel routes people through a `mailto:` link built by
JavaScript, which helps a little, but the address is still in your page source.

Options, cheapest first: accept it and let Gmail filter; or replace the visible
address with the contact panel only and move the raw address into a
JavaScript-assembled string. Neither is a real defence — determined harvesters
run JavaScript now. I'd accept it.

---

## 4. `catalog.js` is public — and I recommend leaving it that way

**Severity: low as a security issue. Reverted after a real-world problem.**

Anyone can open `offlinegames.art/catalog.js` and read your entire catalog:
every title, description, category, cover and file path.

I originally shipped an obfuscated version — the metadata XOR-encoded, base64'd,
and unpacked by a decoder embedded in the file. It worked: 23 games decoded
byte-identical, and the titles were unreadable in the source.

**Then your browser flagged the download as a virus, and that changed the
calculation.**

It was a false positive — every file was plain text, no binaries, no `eval`,
nothing fetching remote code. But the *reason* it fired is not a fluke. An
obfuscated catalog looks like this:

- a hardcoded key string
- a bit-shifting XOR loop
- a base64 alphabet
- 130 long base64 string literals feeding a decoder

That is structurally indistinguishable from a JavaScript packer — the standard
way real malware hides its payload. Heuristic scanners cannot tell your game
list from a dropper, because at the byte level they look the same.

**The risk was never the ZIP.** It was that the same file would sit on your live
site, served to every visitor. Possible consequences: browser download blocks,
antivirus warnings on your pages, a Google Safe Browsing listing for
offlinegames.art, and AdSense reviewing a flagged domain. For a family games
site, any one of those is far worse than a competitor reading a list of titles
that are printed on your own homepage anyway.

**So the catalog is readable JavaScript again, and the packer code is gone**
from `site-admin.js` entirely — not switched off, removed, so it can't come
back by accident.

What you actually lose: obfuscation stopped lazy copy-paste and kept the raw
file out of Google's cache. It never stopped anyone who opened devtools and
typed `window.SITE_GAMES`, which was always the honest limit.

If you want the catalog genuinely private, the answer is the same as it always
was — serve it from a Cloudflare Worker that checks who is asking. That is real
protection and carries no malware-heuristic risk. Obfuscation was the weak
version, and it turned out to have a sharp edge.

## 5. Smaller notes

**`new Function("window", text)` in `app.js`** — the 15-second catalog poll
fetches `catalog.js` and executes it. It's same-origin so it's fine today, but
it means anyone who can write to your Pages deployment gets code execution on
every visitor. Protect your Cloudflare account with 2FA; that's the real
control here.

**Game iframes use `allow-scripts` + `allow-same-origin` together** — that
combination lets a framed page reach out and remove its own sandbox. Since the
games are yours and same-origin, nothing changes in practice. But if you ever
embed a game you didn't build, drop `allow-same-origin` for that one.

**Directory listing** — check that `offlinegames.art/games/` and `/covers/`
don't return a browsable file list. Cloudflare Pages doesn't do this by
default, but it's worth a look in the browser.

**Output escaping** — `app.js` escapes titles and descriptions before writing
them into HTML, and `admin-forms.js` uses `escapeHtml` on form values. No XSS
found. This was already correct.

---

## Going further: an actual lock

If you want editing to be genuinely protected rather than obfuscated,
**Cloudflare Access** is free for up to 50 users and takes about ten minutes:

1. Move the admin tooling to `/admin/` (its own folder, its own page)
2. Cloudflare dashboard → Zero Trust → Access → Applications
3. Add a self-hosted app for `offlinegames.art/admin/*`
4. Policy: allow → emails → your address

Cloudflare then handles login *before* the request reaches your site. Nobody
without your email ever sees the page. The same trick behind a Worker would
give you a genuinely private catalog.

Until then, remember the shape of the risk: your live site can only change when
you upload a file. That is a real protection, and it is doing most of the work.
