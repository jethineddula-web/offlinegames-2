/* make-i18n-template.js
 *
 * Lists every English string from catalog.js that i18n-content.js does not
 * translate yet, already formatted so you can paste it straight in.
 *
 * Run it from the folder holding catalog.js (your upload-to-site folder):
 *
 *     node make-i18n-template.js
 *
 * To write the result to a file instead of the screen:
 *
 *     node make-i18n-template.js > todo.js
 *
 * It only reads. It never changes catalog.js or i18n-content.js.
 */

var fs = require("fs");
var path = require("path");

var LANGS = ["es", "zh-CN", "zh-TW", "hi", "ar", "fr", "de", "pt",
             "ja", "ko", "ru", "it", "tr"];

function read(file) {
  var p = path.join(__dirname, file);
  if (!fs.existsSync(p)) {
    console.error("Could not find " + file + " in " + __dirname);
    process.exit(1);
  }
  return fs.readFileSync(p, "utf8");
}

/* Both files are plain assignments to window.*, so a fake window is enough
   to load them without a browser. */
var sandbox = { window: {} };
sandbox.window.window = sandbox.window;

function load(file) {
  var code = read(file);
  var fn = new Function("window", code);
  fn(sandbox.window);
}

load("catalog.js");
try {
  load("i18n-content.js");
} catch (e) {
  console.error("i18n-content.js could not be read: " + e.message);
  process.exit(1);
}

var games = sandbox.window.SITE_GAMES || [];
var news = sandbox.window.SITE_NEWS || [];
var have = sandbox.window.OG_TEXT || {};

function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }

var known = {};
Object.keys(have).forEach(function (k) {
  if (have[k] && have[k].length === LANGS.length) known[norm(k)] = true;
});

/* Game TITLES are names and stay in English, so they are not collected. */
var wanted = [];
var seen = {};
function want(text, where) {
  if (!text) return;
  var key = norm(text);
  if (!key || known[key] || seen[key]) return;
  seen[key] = true;
  wanted.push({ text: key, where: where });
}

games.forEach(function (g) {
  want(g.description, "game: " + g.title);
  want(g.howToPlay, "game: " + g.title + " (how to play)");
  want(g.about, "game: " + g.title + " (about)");
});
news.forEach(function (n) {
  want(n.title, "news: " + n.title);
  want(n.excerpt, "news: " + n.title + " (excerpt)");
});

if (!wanted.length) {
  console.error("Nothing missing — every catalogue string is translated.");
  process.exit(0);
}

function quote(s) {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

console.error(wanted.length + " string(s) still need translating.\n");

var out = [];
wanted.forEach(function (item) {
  out.push("  /* " + item.where + " */");
  out.push("  " + quote(item.text) + ": [");
  out.push(LANGS.map(function (code) {
    return '    "", /* ' + code + " */";
  }).join("\n"));
  out.push("  ],");
  out.push("");
});

console.log(out.join("\n"));
