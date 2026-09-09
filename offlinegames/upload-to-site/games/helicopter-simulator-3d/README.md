# Helicopter Simulator 3D

A self-contained WebGL2 helicopter flight simulator built for **offlinegames.art**.
No frameworks, no CDN, no asset downloads — every texture, sound and piece of
geometry is generated in the browser at runtime, so the whole game is roughly
250 KB of plain files and works offline once cached.

---

## 1. Upload

Copy the whole folder to your site, e.g.:

```
offlinegames.art/helicopter-simulator-3d/
├── index.html
├── manifest.webmanifest
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── .htaccess          <- cache policy: never cache the HTML
├── css/style.css
└── js/  math.js  gl.js  geometry.js  textures.js  audio.js
      world.js  helicopter.js  levels.js  shop.js  ads.js  ui.js  game.js
```

Upload **`.htaccess` too** — it is what keeps caches honest. It tells servers
and app WebViews never to cache `index.html`, while caching the versioned
`js/*.js?v=…` and `css/style.css?v=…` assets for a year. Because the HTML names
which build of the scripts to load, a fresh HTML file is all it takes for an
update to reach everyone immediately. Without it, an app WebView on its default
cache mode can keep replaying a build from weeks ago — the single most common
reason "the change works on the web but not in the app".

When you upload a new build, bump the version in two places so caches let go:
the `?v=` on the asset URLs in `index.html`, and `BUILD` at the top of
`js/game.js` (the start screen prints it, which makes "is this device on the
new build?" a two-second question).

Nothing needs building. Open `index.html` and it runs.
Script order in `index.html` matters — keep it as is.

**Requirements:** any WebGL2 browser (Chrome/Edge/Firefox/Safari 15+, Android
Chrome, iOS Safari 15+). A friendly message is shown if WebGL2 is missing.

---

## 2. What is in the game

**Flight model.** A real helicopter control set: a *collective* lever that stays
where you put it, a *cyclic* that tilts the rotor disc (the machine leans to
move), and *anti-torque pedals* on the tail rotor. Thrust follows the rotor
disc, so pitch and roll are what actually make you travel. There is ground
effect near surfaces, quadratic drag, wind gusts, fuel burn tied to collective
position, rotor spool-up, and separate collision spheres for the hull and the
rotor disc — clipping a tower with the blades hurts far more than a skid bump.
An optional *hover assist* (Settings) trims the collective to hold altitude for
new players.

**The city.** Procedurally generated each mission from the level's seed:
skyscrapers with per-pane window lighting, brick and concrete mid-rises,
setbacks and crowns on the tall towers, rooftop AC plant, antennas with red
obstruction beacons, roads with lane markings and kerbs, moving traffic, street
lights, parks with trees, and rooftop helipads. One directional shadow map,
hemispheric ambient, exponential fog and a filmic tonemap.

**Cameras** (`C` or the 🎥 button): **PILOT** (in the cockpit, with the
instrument panel, canopy frame and both cyclic sticks), **CHASE** (medium, just
behind and above), **WIDE** (a long cinematic view of the aircraft).

**100 levels.** Levels 1–10 are hand-designed — first lift-off, touch-and-go
landing, a low run down an avenue, rooftop delivery, a ring course, a night
shift, a canyon run, a fog bank, a sunset sprint and a storm rescue. Levels
11–100 are generated from a fixed seed with a tuned difficulty curve: more
markers, tighter time limits, stronger gusts, taller cities, and weather that
moves from clear days through dusk and night to fog and storms. Every tenth
level is a tougher "boss" mission. Ratings are 1–3 stars for speed and for
finishing undamaged.

**Running out of things.** The 🛢️ FUEL and 🔧 REPAIR buttons use a can or a kit
from the hold. If the hold is empty they pause the flight and open the shop on
the *Items* tab instead of just refusing. And if a purchase — anywhere in the
shop — costs more than the player has, a panel offers a rewarded video for 250
coins and then completes the purchase automatically. So a player who is low on
fuel and low on money is always two taps from flying again.

**Shop & hangar.** Five aircraft (AeroScout R22, UrbanHawk EC‑1, Guardian
SAR‑9, Nightblade X, Titan HX‑70) with different power, agility, speed, fuel and
armour; five upgrade lines (turbine power, rotor head, aerodynamics, fuel cells,
airframe plating) at five levels each; and consumables — hint packs, field
repair kits and reserve fuel. Coins come from missions, time bonuses,
no-damage bonuses and rewarded ads. Everything saves to `localStorage`.

**Audio.** All synthesised with the Web Audio API — a menu theme and an in-game
pad that both follow a chord progression, plus a live rotor voice whose blade-slap
rate, turbine whine and rumble track rotor RPM, collective and airspeed, and wind
noise that rises with speed. Music and SFX toggle independently in Settings.

---

## 3. Controls

| Action | Keyboard | Touch |
|---|---|---|
| Start engine | `E` | START ENGINE button |
| **Raise / lower** the helicopter | `W` / `S` | right-hand vertical slider |
| **Turn left / right** on the spot | `A` / `D` | ⟲ ⟳ buttons |
| **Fly forward / backward** | `↑` / `↓` | left stick, up/down |
| **Slide left / right** | `←` / `→` | left stick, left/right |
| Change camera | `C` | 🎥 |
| Hint | `H` | 💡 HINT |
| Pause | `P` / `Esc` | ❚❚ |
| Restart | `R` | pause menu |

On desktop a permanent **CONTROLS** legend sits in the bottom-left corner of the
flight screen spelling this out, so a first-time player never has to guess. It
collapses with one click and remembers that choice. Touch devices never see it —
they have the on-screen sticks.

**Crashing.** Touching a building is fatal: the rotor disc is wider than the
body, so a blade strike always destroys the aircraft, and the hull survives only
the gentlest brush (under 2 m/s). Any of these triggers a fireball — expanding
flame sprites, tumbling debris, a smoke column, a screen flash and heavy camera
shake — and then the mission-failed panel, where a rewarded ad buys a respawn.

**Screen orientation — automatic, never asked.** On a phone the game is always
landscape and the player is never prompted. Two mechanisms, in order:

1. On the first tap the game requests fullscreen and calls the Screen
   Orientation API to lock `landscape`. Where that is allowed (Android Chrome,
   installed PWAs) the handset genuinely turns and everything is native.
2. Where it is not allowed — iOS Safari never permits it, and neither does any
   browser on a phone with rotation lock switched on — the game turns *itself*.
   Everything the player sees lives inside one `#stage` element; when the
   viewport reports portrait, that element gets swapped dimensions and a
   `rotate(90deg)` transform, so the game renders landscape inside a portrait
   window. Canvas, HUD, touch controls, menus and the ad banner all turn
   together as one piece.

Because the whole stage turns, raw pointer coordinates no longer line up with
the UI. `toStage()` and `stageRect()` in `js/game.js` map every touch back into
stage space, so the cyclic stick and the collective slider behave identically
rotated or not. Both paths are re-evaluated on `resize`, `orientationchange`,
`visualViewport` resize and `pageshow`, so it survives the URL bar sliding away
and iOS reporting a new size a beat late. Desktop is untouched.

**Which build is this?** The start screen prints a build stamp
(`build 20260909b`), and `GAME.orientationInfo` returns it too. When
a change shows up in a browser but not inside an app, comparing that stamp is
the fastest way to tell a code problem from a caching one.

**Escape hatches**, for a device you cannot attach devtools to:
`?debug=1` shows a live readout pinned to the corner (kept outside the rotating
stage, so it stays upright); `?landscape=1` forces the quarter turn on
regardless of detection; `?landscape=0` forces it off. At runtime:
`GAME.setLandscape(true|false|null)`, `GAME.debug(true)`.

**App builds are different.** A native shell decides its own orientation, so
the CSS turn is only the fallback there — and it is a worse one, because the
OS-drawn ad banner sits at the physical bottom, which after a quarter turn is
the game's right edge. The game calls every lock API that might exist —
`screen.orientation.lock`, the legacy `screen.lockOrientation`,
`cordova-plugin-screen-orientation` and `@capacitor/screen-orientation`, retried
on `deviceready` and for a couple of seconds after — but it no longer *waits*
for one before turning itself. Waiting was safer in theory and in practice just
meant "no rotation at all" wherever a lock failed silently; the CSS turn now
happens immediately and simply undoes itself if a native lock lands later,
which is invisible because start-up sits behind the loader. If it does end up
rotating in an app, it shrinks its own stage by 58 px so the OS-drawn banner
cannot cover the collective.
Config that makes the real lock succeed lives in the `app/` folder:

- **`app/android-studio/`** — for a hand-written Android WebView wrapper: a
  complete `MainActivity.java`, `AndroidManifest.xml`, `themes.xml` and
  `colors.xml`, plus a README. The line that does the work is
  `android:screenOrientation="sensorLandscape"` on the activity, paired with
  `android:configChanges="orientation|screenSize|…"` so rotating does not
  destroy the activity and restart the game.
- **`app/README-APP.md`** — the same for Cordova (`config.xml`), Capacitor and
  iOS (`Info.plist`), with ready-to-paste snippet files.

If the wrapper loads the live site rather than bundling files, also check the
WebView cache: `setCacheMode(WebSettings.LOAD_NO_CACHE)` plus a `?v=` build tag
on the URL. A WebView on the default cache mode will replay month-old
JavaScript, which looks exactly like "the fix did not work".

**Fitting every handset.** The stage publishes its real dimensions to CSS as
`--vw` / `--vh`, and every rule that used `vw`/`vh` now reads those instead —
inside a rotated element the browser's own `vh` measures the wrong axis. A
single `--ui` scale factor, `clamp(0.62 … 1)` derived from the stage size,
scales each HUD cluster from its own corner: instruments, minimap, action
buttons, cyclic, collective and pedals. On a 320-px-tall landscape view
everything shrinks to roughly 70 % and stays fully on screen; on a large phone
it sits at 1:1. The stage is `overflow:hidden`, so nothing can spill off an edge
at any size.

---

## 4. Ads — how they are wired

Everything lives in `js/ads.js`. It detects the platform and picks the right
network automatically.

### Web (AdSense) — your IDs are already in place

```js
adClient : 'ca-pub-4203857211510947'
slotBanner: '7417753724'
```

* **Anchored bottom banner** — always visible during the menu and the HUD. The
  layout reserves space for it with the `--adh` CSS variable, so it never covers
  the controls.
* **Interstitial** — a full-screen panel after every 3 completed levels (and at
  most once every 75 seconds), with a 5-second skip timer.
* **Rewarded** — a panel with a progress bar, used for free hints, "continue
  here" after a crash, and bonus coins after a mission.

On `localhost` and `file://` the game never requests a live ad — it shows a
labelled placeholder instead, so you cannot generate invalid traffic while
testing. Live ads start serving as soon as it is on the real domain.

### App (AdMob) — the IDs from your console

```js
admob: {
  appId       : 'ca-app-pub-4203857211510947~0000000000',   // ← set this one
  banner      : 'ca-app-pub-4203857211510947/8086182570',   // "Vault Banner"
  interstitial: 'ca-app-pub-4203857211510947/3025427580',   // "Game Interstitial"
  rewarded    : 'ca-app-pub-4203857211510947/3025427580'    // ← create a rewarded unit
}
```

Two things to finish on the app side:

1. **App ID** — copy it from AdMob → *App settings* (it has a `~` in it, not a
   `/`) and paste it over the placeholder above.
2. **Rewarded unit** — the screenshot shows only a banner and an interstitial.
   Create a *Rewarded* unit in AdMob and paste its ID into `rewarded`. Until you
   do, hints and continues fall back to the interstitial, which still works but
   pays less.

The code speaks both the common Cordova AdMob plugin APIs
(`admob.banner.show`, `admob.interstitial.load/show`, `admob.rewarded.load/show`)
and the older `createBannerView` / `showInterstitial` / `showRewardVideoAd`
style, so it works with `admob-plus-cordova`, `cordova-plugin-admob-free` and
the Capacitor AdMob plugin without changes. The HTML banner hides itself
automatically when a native banner is available (`html[data-platform="app"]`
sets `--adh: 0`).

**Wrapping it as an app (Cordova example):**

```bash
cordova create heli art.offlinegames.helicopter "Helicopter Simulator 3D"
cd heli
# replace www/ with this folder
cordova platform add android
cordova plugin add admob-plus-cordova --variable APP_ID_ANDROID="ca-app-pub-4203857211510947~XXXXXXXXXX"
cordova build android --release
```

Tuning knobs at the top of `ads.js`:

```js
interstitialEveryLevels: 3,          // how often the interstitial appears
minSecondsBetweenInterstitials: 75   // hard floor so it never feels spammy
```

---

## 5. SEO

`index.html` ships with a full head: title, description, keywords, canonical,
robots, Open Graph and Twitter cards, `theme-color`, a web manifest, and
`VideoGame` JSON-LD structured data (genre, platform, free-to-play offer,
publisher, rating). There is also a crawlable, screen-reader-visible `<footer>`
with a real description, a feature list and a how-to-play section — visually
hidden but fully indexable.

Before publishing, update these to your final URL if the path differs:

* `<link rel="canonical">`
* `og:url`, `og:image`, `twitter:image`
* the `url` field in the JSON-LD block
* `sitemap.xml`

Add a `cover.jpg` (1200×630) next to `index.html` for the social preview.

---

## 6. Tuning

| What | Where |
|---|---|
| Aircraft stats and prices | `HELI.VARIANTS` in `js/helicopter.js` |
| Upgrade prices and effects | `SHOP.UPGRADES` in `js/shop.js` |
| Starting coins / hints | `DEFAULT` in `js/shop.js` |
| Level 1–10 design | `HAND` array in `js/levels.js` |
| Difficulty curve for 11–100 | `makeProcedural()` in `js/levels.js` |
| Weather presets | `ENVS` in `js/levels.js` |
| City density and heights | `WORLD.build` defaults in `js/world.js` |
| Shadow resolution | `pickShadowSize()` in `js/game.js` |
