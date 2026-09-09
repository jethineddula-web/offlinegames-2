# Thunder Circuit — deployment & ad integration

Three files. Keep them together in one folder; `index.html` references the other two
by relative path.

    index.html   markup, SEO meta, ad containers
    game.css     all styling, HUD, menus, phone layout
    game.js      the whole game — physics, AI, tracks, audio

Only external dependency: `three.js r128` from cdnjs, already linked in `index.html`.

## Orientation — nothing to ask the player

The game puts itself in landscape on phones, on the web and inside an app wrapper,
and never shows a "rotate your device" screen. Three layers, in order:

1. **App wrapper** — `TCNative.lockLandscape()` if your bridge exposes it. Also set
   `android:screenOrientation="sensorLandscape"` on the activity.
2. **Real browser lock** — on the first tap the page requests fullscreen and then
   `screen.orientation.lock('landscape')`. Android Chrome only grants the lock while
   fullscreen, which is why the two are paired.
3. **CSS self-rotation** — if neither is granted (iOS Safari never grants a lock, and
   a user with rotation-lock on keeps a portrait viewport even holding the phone
   sideways), the whole game is rotated 90° in CSS. It renders landscape regardless,
   so a player holding the phone sideways sees it correctly whether or not their
   rotation lock is on.

Viewport units are virtualised through `--vw` / `--vh` so layout follows the rotated
box, and the compact phone HUD is driven by a `body.compact` class rather than a
media query, so it applies in both cases.

## Web (offlinegames.art)

Upload the folder as `https://offlinegames.art/thunder-circuit/`. AdSense is wired
with your IDs:

    AD_CLIENT       = "ca-pub-4203857211510947"      (game.js, top)
    AD_SLOT_BANNER  = "7417753724"

Banner shows in the menus, pause screen and results. An interstitial (same slot,
rectangle format) plays when you leave the results screen, throttled to once per 45 s.
Rewarded ads back the "watch ad" hint and the +250 coin button.

SEO lives in `index.html`: title, description, keywords, canonical, Open Graph,
Twitter card and `VideoGame` JSON-LD. Update the canonical URL and drop a
`cover.jpg` (1200x630) beside the files for the social preview.

## App (Android / iOS wrapper)

The page detects a webview (Cordova, Capacitor, TWA, standalone) and switches to the
app instruction screen, bottom-anchored banners and native ad calls. Your AdMob units
are at the top of `game.js`:

    ADMOB_BANNER       = "ca-app-pub-4203857211510947/8086182570"
    ADMOB_INTERSTITIAL = "ca-app-pub-4203857211510947/3025427580"
    ADMOB_REWARDED     = "ca-app-pub-4203857211510947/3025427580"   // swap when you make one

It tries, in order: `window.TCNative`, `window.AndroidBridge`,
`cordova-plugin-admob-free`, `window.AdMob`. To use your own bridge, expose any of:

    // Android @JavascriptInterface, injected as "TCNative"
    void showBanner(String json)
    void hideBanner(String json)
    void showInterstitial(String json)
    void showRewarded(String json)
    void lockLandscape(String json)

When a rewarded ad completes, call back into the page:

    webView.evaluateJavascript("window.tcRewardGranted()", null);

## Where things are in game.js

    ~line   1   ad IDs, platform detection, save data
    ~line 180   audio (procedural music and engine)
    ~line 400   the 30 circuits + environment / time-of-day tables
    ~line 700   track geometry, terrain, verges
    ~line 1200  world building — road, walls, grandstands, pit complex
    ~line 1800  car model and liveries
    ~line 2400  physics, AI, damage, pit stops
    ~line 3000  race manager, cameras, HUD
    ~line 3500  orientation, menus, shop, settings, boot

## Saving
Progress (coins, upgrades, paint, records) uses `localStorage` behind a try/catch
wrapper — if storage is blocked it falls back to memory and the game still runs.

## Branding
All sponsors, teams, drivers and liveries are original inventions. Nothing uses
NASCAR or any real advertiser's marks, so the page is safe to publish and monetise.
