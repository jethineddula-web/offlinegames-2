/* build-pages.js — regenerate the game pages in play/ from catalog.js
   SEO v2: Titles include "Free Online" + "No Download", meta 150-160 chars unique with main keyword
*/
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const PLAY = path.join(ROOT, "play");
const CATALOG = path.join(ROOT, "catalog.js");
const SITE = "https://offlinegames.art";
function loadCatalog() {
  if (!fs.existsSync(CATALOG)) { console.error("catalog.js not found."); process.exit(1); }
  const src = fs.readFileSync(CATALOG, "utf8");
  const sandbox = { window: {} };
  new Function("window", src).call(sandbox, sandbox.window);
  const games = sandbox.window.SITE_GAMES || [];
  if (!games.length) { console.error("no games"); process.exit(1); }
  return games;
}
const esc = (s) => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;");
const slug = (t) => String(t||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
function gamePath(embedUrl){
  let p=String(embedUrl||"");
  if(/^https?:\/\//i.test(p)) return p;
  if(!p.startsWith("games/")) p="games/"+p.replace(/^\//,"");
  if(!/\.[a-z0-9]+$/i.test(p) && !p.endsWith("/")) p+="/";
  return "../"+p;
}
const RATING_NOTE={
  "Everyone":"No violence, no scary imagery and no punishing time pressure. Suitable to hand to a young child unsupervised.",
  "Everyone 10+":"Cartoon peril or a difficulty curve that assumes some reading and persistence. Nothing here would upset a child; some of it would frustrate a very young one.",
  "Teen":"Contains stylised combat. Not intended for young children."
};

const GUIDE={
  "Sudoku":["sudoku-strategy-for-beginners","the four techniques that solve almost every sudoku"],
  "2048":["2048-strategy","how to actually win at 2048"],
  "Chess 3D":["chess-openings-for-beginners","chess openings for beginners"],
  "Tic-Tac-Toe":["how-to-win-tic-tac-toe-every-time","how to win tic-tac-toe every time"],
  "8-Ball Pool":["8-ball-pool-tips-positioning-and-spin","8-ball pool positioning and spin guide"],
  "Math Runner":["browser-games-for-teachers-classroom-ideas","browser games for teachers classroom ideas"],
  "Words Matching":["browser-games-for-teachers-classroom-ideas","classroom ideas for word games"],
  "Numberly":["best-games-for-kids-under-8","best games for kids under 8"],
  "Save The Dog":["best-games-for-kids-under-8","best games for kids under 8"],
  "Bees Escape":["best-games-for-short-sessions","best games for short sessions"],
  "Arrows Puzzle":["best-games-for-short-sessions","best games for short sessions"],
  "Thunder-Circuit":["best-games-for-short-sessions","best games for short sessions"],
  "Helicopter Simulator 3D":["best-games-for-short-sessions","best games for short sessions"],
  "Lodo":["history-of-ludo-and-chess-classic-board-games","history of Ludo and Chess"],
  "Word Magic":["browser-games-for-teachers-classroom-ideas","vocabulary games for classrooms"],
  "Pop-a-Lock":["best-games-for-short-sessions","best games for short sessions"],
  "Balance Ball":["best-games-for-short-sessions","best games for short sessions"],
  "Magic Jars":["best-games-for-kids-under-8","best games for kids under 8"],
  "Crayon Kingdom":["best-games-for-kids-under-8","best games for kids under 8"],
  "Fruit Trio":["best-games-for-kids-under-8","best games for kids under 8"]
};

const CATEGORY_TIPS = {
  "Puzzle": "Puzzle games in the vault reward patience over speed. Look for patterns, not quick clicks. Most puzzles here have no timer, so you can pause, think, and come back. If you get stuck, close the overlay and reopen — the game resets fresh, which often helps you see the solution.",
  "Arcade": "Arcade cabinets are built for short, repeatable runs. Controls are one thumb or one hand on keyboard. Don't chase high score on first try — learn the rhythm of obstacles first, then go for score. Instant restart is intentional.",
  "Chess": "Chess is the only perfect-information game in the vault. No dice, no luck. The AI in our Chess 3D is local minimax — it doesn't call a server, so it works offline. Use it to practice openings from our guides.",
  "Racing": "Racing games use arrow keys or swipe to steer. Keep to the racing line — outside-inside-outside on corners. Our racing builds are procedural, so tracks don't need extra downloads mid-race.",
  "Shooting": "Shooting games are rated Teen for stylised combat. No blood, no gore, but tension. Use headphones — audio cues tell you where enemies spawn before you see them.",
  "Board": "Board games like Ludo and Chess are hot-seat multiplayer — same device, pass and play. Great for kids and parents offline. Rules are traditional, code and art are ours.",
  "Sports": "Sports games are physics-based. 8-Ball Pool uses real angle math — aim, then adjust for spin. No power-ups, no pay-to-win.",
  "Kids": "Kids games have no fail state that punishes. Crayon Kingdom lets you colour without time limit. If a child taps wrong, nothing scary happens.",
  "Strategy": "Strategy games reward planning two moves ahead. Don't rush first move — look at whole board. Most strategy cartridges in the vault have no timer for this reason.",
  "Word": "Word games bundle their dictionary in the page, not fetched from server, so they work offline. Good for flights and classrooms."
};

function defaultHowTo(title, category){
  const tip = CATEGORY_TIPS[category] || CATEGORY_TIPS["Puzzle"];
  return `<p><strong>${esc(title)}</strong> runs in this browser tab. There is nothing to install and no account to create — open the vault, tap the cover, and the game loads in an overlay. Close it with the ✕ and the game unloads, so the next cartridge starts fresh.</p>
        <p>${esc(tip)}</p>
        <ul>
          <li><strong>On a phone or tablet:</strong> tap and swipe. The game is sized for a thumb. We disabled pinch-zoom on the play overlay so a two-finger swipe doesn't zoom the whole page.</li>
          <li><strong>On a laptop:</strong> mouse and keyboard. Arrow keys and Enter also move around the vault itself. Press Esc to close the overlay.</li>
          <li><strong>Offline:</strong> once the tab has loaded, most cartridges keep running if the signal drops, because the logic lives in the page. Open the game once on WiFi, then it works in airplane mode.</li>
          <li><strong>Save data:</strong> high scores and favourites stay in your browser's localStorage, not on our server. Clear browser data and they disappear — we don't have cloud sync, which is better for privacy.</li>
        </ul>`;
}
function defaultAbout(title, category){
  return `<p><strong>${esc(title)}</strong> is filed under <strong style=\"color:var(--fg)\">${esc(category)}</strong> in the vault. It is built and hosted by <strong>Jethin Productions</strong> and served from offlinegames.art — it is not an embed from another game portal. You can verify: its files live under <code>offlinegames.art/games/</code> on this domain.</p>
        <p>Editorial standards here are ordinary: a game has to start without a login, it has to be understandable without a wiki, and it has to be something we would reopen in a spare ten minutes. It also has to be family-transparent: no hidden chat with strangers, no loot boxes, no push notifications. If it needs a tutorial that takes longer than the game, we don't add it.</p>
        <p>Strategy guides are in <a href=\"../guides\">Guides</a>, and rights for every title are on the <a href=\"../credits\">credits page</a>. Something broken? The <a href=\"../contact\">contact page</a> is the fastest way to reach us. Say which cartridge and what your device is, and we fix it rather than argue.</p>`;
}
const HAS_SHOP = new Set(["I Am Not A Robot"]);
function extraSections(title, category, rating){
  const g = { title };
  const related = category === "Puzzle" ? "If you like logic, try <a href=\"../play/sudoku\">Sudoku</a>, <a href=\"../play/2048\">2048</a> and <a href=\"../play/words-matching\">Words Matching</a> — all offline-capable." :
                  category === "Arcade" ? "If you like quick runs, try <a href=\"../play/pop-a-lock\">Pop-a-Lock</a>, <a href=\"../play/balance-ball\">Balance Ball</a> and <a href=\"../play/sky-dodge\">Sky Dodge</a>." :
                  category === "Chess" ? "If you like Chess, read <a href=\"../articles/chess-openings-for-beginners\">openings for beginners</a> — three principles that stop you losing in 15 moves." :
                  "Browse the <a href=\"../\">vault</a> by category to find more like this.";
  return `
      <div class="card">
        <h2>What it is like to play</h2>
        <p>${esc(title)} is designed for the spare 5 minutes, not a 2-hour session.${HAS_SHOP.has(g.title) ? " It does have an optional in-game shop for hints and skips, paid for with what you win rather than with money." : " No daily rewards, no energy system, no shop that sells power."} You open it, play a round, close it. High score saves locally, so you can beat your own best next time without an account.</p>
        <p>${related}</p>
      </div>
      <div class="card">
        <h2>FAQs</h2>
        <p><strong>Does ${esc(title)} work offline?</strong><br>Yes, after first load. Open it once on WiFi, then turn on airplane mode and refresh — it loads from service worker cache. See <a href=\"../articles/what-offline-actually-means\">what offline means</a>.</p>
        <p><strong>Is it free?</strong><br>Yes, free in browser, no download, no account. Ads on this page and occasional ads between rounds pay for hosting. Nothing in the game is locked behind watching an ad.</p>
        <p><strong>Is it safe for kids?</strong><br>It is rated ${esc(rating)}. ${esc(RATING_NOTE[rating]||"")} See our <a href=\"../articles/choosing-games-for-young-children\">parent's guide</a> for age-by-age suggestions.</p>
      </div>`;
}
function paras(text){
  return String(text).split(/\n\s*\n/).map((p)=>`<p>${esc(p.trim()).replace(/\n/g,"<br>")}</p>`).join("\n        ");
}

// SEO: generate unique 150-160 char meta description with main keywords
function makeMetaDescription(title, category, rating, desc){
  const clean = String(desc||"").replace(/\s+/g," ").trim();
  const prefix = `Play ${title} free online in your browser - `;
  const suffix = ` No download, no account needed. ${category} game rated ${rating} on OfflineGames.`;
  const target = 155;
  let middleMax = target - prefix.length - suffix.length;
  if(middleMax < 30) middleMax = 30;
  let middle = clean;
  // Prefer first sentence if it fits better
  const sentences = clean.split(/\. +/);
  if(sentences[0] && sentences[0].length > 25 && sentences[0].length < middleMax + 40){
    middle = sentences[0];
  }
  if(middle.length > middleMax){
    middle = middle.slice(0, middleMax);
    // trim to last full word
    const lastSpace = middle.lastIndexOf(" ");
    if(lastSpace > middleMax * 0.6) middle = middle.slice(0, lastSpace);
  }
  let full = `${prefix}${middle}. ${suffix}`.replace(/\s+/g," ").trim();
  // Ensure 150-160
  if(full.length > 160){
    full = full.slice(0, 157).trim();
    const ls = full.lastIndexOf(" ");
    if(ls > 100) full = full.slice(0, ls);
    if(!full.endsWith(".")) full += "...";
  }
  if(full.length < 150){
    const extra = ` Works offline after first load. Free browser games, no downloads needed.`;
    full = (full + extra).slice(0, 160);
  }
  return full;
}

function page(g){
  const s=slug(g.title);
  const rating=g.rating||"Everyone 10+";
  const category=g.category||"Arcade";
  const desc=String(g.description||"").replace(/\s+/g," ").trim();
  const seoDesc = makeMetaDescription(g.title, category, rating, desc);
  const meta=esc(seoDesc);
  const cover=g.coverUrl?(/^(data:|https?:)/.test(g.coverUrl)?g.coverUrl:"../"+g.coverUrl.replace(/^\//,"")):"";
  const guide=GUIDE[g.title];
  // SEO Title: Play {Game} Free Online – No Download | OfflineGames (en-dash)
  const seoTitle = `Play ${g.title} Free Online – No Download | OfflineGames`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>if(location.protocol===\"http:\"&&location.hostname!==\"localhost\"&&location.hostname!==\"127.0.0.1\"&&location.hostname!==\"[::1]\"){var h=location.hostname;if(!/^192\\.168\\./.test(h)&&!/^10\\./.test(h)&&!/^172\\.(1[6-9]|2\\d|3[01])\\./.test(h)&&h!==\"\"){location.replace(\"https://\"+location.host+location.pathname+location.search+location.hash)}}</script>
  <script src="../privacy-controls.js"></script>
  <script async data-ad-src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4203857211510947" crossorigin="anonymous"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>${esc(seoTitle)}</title>
  <meta name="description" content="${meta}">
  <meta name="author" content="Jethin Productions">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SITE}/play/${s}">
  <meta property="og:site_name" content="OfflineGames">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${SITE}/play/${s}">
  <meta property="og:title" content="${esc(seoTitle)}">
  <meta property="og:description" content="${meta}">
  <meta property="og:image" content="${SITE}/og/${s}.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Play ${esc(g.title)} free online at offlinegames.art">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(seoTitle)}">
  <meta name="twitter:description" content="${meta}">
  <meta name="twitter:image" content="${SITE}/og/${s}.jpg">
  <meta name="theme-color" content="#090A16">
  <link rel="manifest" href="../manifest.webmanifest">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="../ui-fx.css">
  <link rel="stylesheet" href="../console-ui.css">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
   {"@type":"ListItem","position":1,"name":"Games","item":"${SITE}/"},
   {"@type":"ListItem","position":2,"name":"${esc(category)}","item":"${SITE}/?q=${encodeURIComponent(category)}"},
   {"@type":"ListItem","position":3,"name":"${esc(g.title)}","item":"${SITE}/play/${s}"}]}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
   {"@type":"Question","name":"Does ${esc(g.title)} work offline?","acceptedAnswer":{"@type":"Answer","text":"Yes, after the first load. Open it once with a connection, then it keeps working in airplane mode."}},
   {"@type":"Question","name":"Is ${esc(g.title)} free?","acceptedAnswer":{"@type":"Answer","text":"Yes. It plays in the browser with no download and no account. Ads on the page pay for hosting."}},
   {"@type":"Question","name":"Is ${esc(g.title)} safe for kids?","acceptedAnswer":{"@type":"Answer","text":"It is rated ${esc(rating)}. ${esc(RATING_NOTE[rating]||"")}"}}]}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"VideoGame","name":"${esc(g.title)}","description":"${meta}","url":"${SITE}/play/${s}","genre":"${esc(category)}","image":"${SITE}/og/${s}.jpg","playMode":"SinglePlayer","applicationCategory":"Game","operatingSystem":"Any","contentRating":"${esc(rating)}","author":{"@type":"Organization","name":"Jethin Productions"},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
  </script>
</head>
<noscript><style>.fx-reveal{opacity:1!important;transform:none!important}</style></noscript>
<body>
  <header class="top">
    <a class="brand" href="../">OFFLINEGAMES</a>
    <nav class="top-nav" aria-label="Main">
      <a href="../">Vault</a>
      <a href="../news">News</a>
      <a class="extra" href="../about">About</a>
      <a class="extra" href="../guides">Guides</a>
      <a class="extra" href="../contact">Contact</a>
    </nav>
  </header>
  <main class="page">
    <a class="back" href="../">&larr; Back to the vault</a>
    <p class="eyebrow">${esc(category)} &middot; rated ${esc(rating)} &middot; free browser game</p>
    <h1>Play ${esc(g.title)} Free Online</h1>
    <div class="prose">
      <div class="card">
${cover ? `        <img src="${cover}" onerror="this.style.display='none'" alt="${esc(g.title)} cover art - play free online" width="320" height="200" style="width:100%;max-width:320px;height:auto;border-radius:12px;margin-bottom:16px" loading="lazy">\n` : ""}        <p>${esc(desc)}</p>
        <p><a class="btn btn-magenta" href="${gamePath(g.embedUrl)}" style="display:inline-block;text-decoration:none">Play ${esc(g.title)} Free Now – No Download</a></p>
      </div>
      <div class="card">
        <h2>How to play ${esc(g.title)} in your browser</h2>
        ${g.howToPlay ? paras(g.howToPlay) : defaultHowTo(g.title, category)}
      </div>
      <div class="card">
        <h2>About this free browser game</h2>
        ${g.about ? paras(g.about) : defaultAbout(g.title, category)}
      </div>
      <div class="card">
        <h2>Content rating: ${esc(rating)}</h2>
        <p>${RATING_NOTE[rating] || RATING_NOTE["Everyone 10+"]}</p>
        <p>These are our own labels rather than an official rating, and we apply them conservatively &mdash; anything on a boundary goes in the higher tier. How the three tiers work, and which games suit which ages, is set out in <a href=\"../articles/choosing-games-for-young-children\">our guide for parents</a>. If you think this one is in the wrong tier, <a href=\"../contact\">tell us</a>.</p>
      </div>
${guide ? `      <div class="card">
        <h2>Get better at ${esc(g.title)}</h2>
        <p>We wrote a full guide: <a href=\"../articles/${guide[0]}\">${guide[1]}</a>. More strategy in <a href=\"../guides\">all guides</a>.</p>
      </div>
` : ""}${extraSections(g.title, category, rating)}
      <p>More to play: <a href=\"../\">open the vault</a> for free browser games, or read the <a href=\"../guides\">guides</a> for offline tips.</p>
    </div>
  </main>
  <footer class="site-foot">
    <nav>
      <a href=\"../about\">About</a>
      <a href=\"../guides\">Guides</a>
      <a href=\"../contact\">Contact</a>
      <a href=\"../privacy\">Privacy</a>
      <a href=\"../credits\">Credits</a>
      <a href=\"../terms\">Terms</a>
    </nav>
    <p>offlinegames.art &mdash; copyright Jethin Productions</p>
  </footer>
  <script src=\"../contact-panel.js\"></script>
  <script src=\"../ui-fx.js\"></script>
  <script src=\"../no-zoom.js\"></script>
  <script src=\"../pwa.js\"></script>
</body>
</html>
`;
}

/* ---------------------------------------------------------------------------
   games-manifest.json — every file belonging to every game.
   The vault uses it to save a game for offline play in full. Scanning the
   game's HTML for src/href misses anything loaded from JavaScript, which is
   most of the art and audio in the bigger games. */
function buildGamesManifest(games){
  const out = {}; let totalFiles = 0, totalBytes = 0;
  function walk(dir){
    let files = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files = files.concat(walk(p));
      else files.push(p);
    }
    return files;
  }
  games.forEach((g) => {
    let rel = String(g.embedUrl || "").replace(/^\/+/, "");
    if (!rel.startsWith("games/")) rel = "games/" + rel;
    const isFile = /\.[a-z0-9]+$/i.test(rel);
    let dir = path.join(ROOT, isFile ? path.dirname(rel) : rel);
    if (!fs.existsSync(dir)) {
      // Single-file games (games/chess-3d.html) have no folder of their own.
      const single = path.join(ROOT, rel + ".html");
      if (fs.existsSync(single)) {
        out[rel] = { files: [rel + ".html"], bytes: fs.statSync(single).size };
        totalFiles += 1; totalBytes += out[rel].bytes;
      }
      return;
    }
    const files = walk(dir)
      .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
      .filter((f) => !/\.(md|txt|map)$/i.test(f));          // notes are not needed offline
    const bytes = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
    out[rel.replace(/\/$/, "")] = { files: files, bytes: bytes };
    totalFiles += files.length; totalBytes += bytes;
  });
  fs.writeFileSync(path.join(ROOT, "games-manifest.json"), JSON.stringify(out));
  return { games: Object.keys(out).length, files: totalFiles, mb: (totalBytes / 1048576).toFixed(1) };
}

function buildSitemap(games){
  const today=new Date().toISOString().slice(0,10);
  const rows=[];
  const url=(loc,pri,img,title)=>`  <url><loc>${SITE}/${loc}</loc><lastmod>${today}</lastmod><priority>${pri}</priority>`+
    (img?`\n    <image:image><image:loc>${SITE}/${img}</image:loc><image:title>${esc(title)}</image:title></image:image>\n  `:"")+`</url>`;
  rows.push(url("", "1.0","og/site.jpg","Free browser games at offlinegames.art"));
  ["about","guides","library","credits","contact","news","privacy","terms"].forEach((p)=>rows.push(url(p,"0.7")));
  const artDir=path.join(ROOT,"articles");
  if(fs.existsSync(artDir)){
    fs.readdirSync(artDir).filter((f)=>f.endsWith(".html")).sort().forEach((f)=>rows.push(url("articles/"+f.replace(/\.html$/,""),"0.9")));
  }
  games.slice().sort((a,b)=>slug(a.title)<slug(b.title)?-1:1).forEach((g)=>{
    const sl=slug(g.title);
    rows.push(url("play/"+sl,"0.8","og/"+sl+".jpg","Play "+g.title+" free online"));
  });
  fs.writeFileSync(path.join(ROOT,"sitemap.xml"),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'+rows.join("\n")+"\n</urlset>\n");
  return rows.length;
}
const games=loadCatalog();
if(!fs.existsSync(PLAY)) fs.mkdirSync(PLAY);
const wanted=new Set(); let written=0;
games.forEach((g)=>{
  if(!g.title||!g.embedUrl){ console.warn("  skipped",g.title||g.id); return; }
  const file=slug(g.title)+".html";
  wanted.add(file);
  fs.writeFileSync(path.join(PLAY,file),page(g));
  written++;
});
let removed=0;
fs.readdirSync(PLAY).filter((f)=>f.endsWith(".html")).forEach((f)=>{
  if(!wanted.has(f)){ fs.unlinkSync(path.join(PLAY,f)); console.log("  removed play/"+f); removed++; }
});
const urls=buildSitemap(games);
console.log(""); console.log("  "+written+" pages written to play/");
if(removed) console.log("  "+removed+" stale pages removed");
console.log("  sitemap.xml rebuilt with "+urls+" URLs");
const man = buildGamesManifest(games);
console.log("  games-manifest.json: " + man.games + " games, " + man.files + " files, " + man.mb + " MB");
