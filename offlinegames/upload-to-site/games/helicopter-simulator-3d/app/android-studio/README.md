# Locking the Android WebView app to landscape

Your app loads the live site, so it runs exactly the same JavaScript as the
browser. That means the code is not the problem — the **app's own orientation
setting** is. An Android activity decides its orientation before any web code
runs, and the WebView just inherits whatever the activity says.

Fix it in the activity and the game will be genuinely landscape: sharper than
the CSS fallback, correctly aligned with the status/gesture bars, and the
web-side rotation then never engages at all.

---

## The one line that does it

In `app/src/main/AndroidManifest.xml`, on your `<activity>`:

```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="sensorLandscape"
    android:configChanges="orientation|screenSize|smallestScreenSize|screenLayout|keyboard|keyboardHidden|uiMode|density|locale|fontScale"
    android:exported="true">
```

Two attributes, both needed:

| Attribute | Why |
|---|---|
| `android:screenOrientation="sensorLandscape"` | Locks the app to landscape, either way round. Use `landscape` to pin one direction, or `userLandscape` to honour the phone's rotation lock. |
| `android:configChanges="orientation\|screenSize\|…"` | Without this, Android **destroys and recreates the activity** on every rotation — the WebView reloads and the game restarts from level 1. |

Then in `MainActivity.onCreate()`, re-assert it so nothing can change it later:

```java
setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
```

That is the whole fix. `MainActivity.java` in this folder is a complete, working
version you can drop in — it also handles immersive fullscreen, the back
button, pause/resume and state saving.

---

## FIRST: clear the app's cache — this is almost certainly your problem

If the app is showing a **"Rotate your device"** screen with a *"Play in portrait
anyway"* button, it is running a build from two revisions ago. That screen was
deleted from the game; the string does not exist anywhere in the current source.
An app that renders it is serving cached files, not new ones.

**Right now, without rebuilding anything**, on the phone:

> Settings → Apps → *(your app)* → Storage → **Clear cache**

Then reopen the app. If it turns itself sideways, that was the whole problem.

To confirm which build a device is on, look under the start-screen buttons: it
prints a stamp like `build 20260909b`. If your phone browser shows that and the
app does not, the app is on cached files.

Then make it never happen again, with both of these:

**a) On the server** — the game folder now ships a `.htaccess` that sends
`Cache-Control: no-store` for `index.html` and a one-year immutable cache for
the versioned `js/*.js?v=…` and `css/style.css?v=…` assets. Upload it alongside
`index.html`. (An nginx version is in the comments at the bottom of that file.)
This is the real fix: the HTML is always fresh, and it names which build of the
scripts to load, so every future update propagates immediately — to browsers
and WebViews alike.

**b) In the app** — the settings below.

## The second thing to check: a stale WebView cache

A WebView on the default cache mode will happily replay JavaScript it
downloaded weeks ago.

Two defences, both in the supplied `MainActivity.java`:

```java
s.setCacheMode(WebSettings.LOAD_NO_CACHE);   // always revalidate
web.clearCache(true);                        // drop what an older build left
web.loadUrl(GAME_URL + "?v=" + BUILD_TAG);   // and bust it in the URL too
```

Bump `BUILD_TAG` each time you upload a new build.

**How to confirm which build the app is really running:** the start screen
prints a build stamp under the buttons, e.g. `build 20260909b`. If the phone
browser shows that and the app does not, the app is serving cached files — not
a code problem.

---

## WebView settings the game needs

Already in the supplied `MainActivity.java`, but if you are keeping your own:

```java
WebSettings s = webView.getSettings();
s.setJavaScriptEnabled(true);
s.setDomStorageEnabled(true);          // localStorage — saves progress, coins, upgrades
s.setUseWideViewPort(true);            // honour <meta viewport>; without it the
                                       // WebView reports a fake 980px-wide layout
s.setLoadWithOverviewMode(true);
s.setMediaPlaybackRequiresUserGesture(false);   // lets the Web Audio engine start
s.setSupportZoom(false);               // stop pinch-zoom fighting the flight controls
```

Also make sure hardware acceleration is on (it is by default, but a
`android:hardwareAccelerated="false"` anywhere will kill WebGL2):

```xml
<application android:hardwareAccelerated="true" ...>
```

---

## Files in this folder

| File | Where it goes |
|---|---|
| `AndroidManifest.xml` | `app/src/main/AndroidManifest.xml` — merge the `<activity>` block |
| `MainActivity.java` | `app/src/main/java/<your/package>/MainActivity.java` — change the `package` line and `GAME_URL` |
| `themes.xml` | `app/src/main/res/values/themes.xml` |
| `colors.xml` | `app/src/main/res/values/colors.xml` |

`build.gradle` needs nothing special beyond AndroidX AppCompat:

```gradle
dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.activity:activity:1.9.3'
}
```

---

## If it still will not behave

Add `?debug=1` to the URL in `GAME_URL` and relaunch. A readout appears in the
corner of the screen — no desktop or USB debugging needed — showing:

```
build   2026.09.09-landscape
rotated false   override null
phone   true    app false
inner   915 x 412
screen  412 x 915  dpr 2.625
stage   915 x 412   ui 0.958
locks   4
Mozilla/5.0 (Linux; Android 13; ...
```

Read it like this:

- **`build`** is not the version you just uploaded → the WebView is serving a
  cached copy. Clear the app's cache in Android settings, bump `BUILD_TAG`, and
  upload the supplied `.htaccess`.
- **a "Rotate your device" screen appears at all** → definitely a cached build.
  That screen no longer exists in the game.
- **`inner`** is landscape (wider than tall) and **`rotated false`** → the
  native lock is working. This is the goal.
- **`inner`** is portrait and **`rotated true`** → the native lock is not
  applying, and the web fallback has turned the game itself. Playable, but the
  manifest change above is still worth making.
- **`inner`** is portrait and **`rotated false`** → detection failed. Force it
  by loading `...?landscape=1`, and tell me what the `ua` line says.
- **`phone false`** → the viewport is reporting more than 1100 px on its short
  side, which usually means `setUseWideViewPort(true)` is missing.

Runtime overrides, from `chrome://inspect` or by appending to the URL:

| | |
|---|---|
| `?landscape=1` | always turn the game sideways, skip all detection |
| `?landscape=0` | never turn it |
| `?debug=1` | show the readout above |
| `GAME.setLandscape(true/false/null)` | same, at runtime |
| `GAME.orientationInfo` | the readout as an object |
