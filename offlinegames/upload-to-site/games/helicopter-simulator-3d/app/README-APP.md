# Building the app version (landscape-locked)

The browser build turns itself sideways with a CSS transform because a web page
is not allowed to rotate a handset. **An app is allowed**, and a real rotation
is always better than a simulated one — sharper, correct for the native ad
banner, and it makes the system UI (status bar, gesture bar) line up with the
game.

So for the app build, lock the app itself to landscape. Do that and the game
detects a landscape viewport and never applies the CSS turn at all.

The game already calls every lock API it can find at start-up
(`screen.orientation.lock`, the legacy `screen.lockOrientation`,
`cordova-plugin-screen-orientation` and `@capacitor/screen-orientation`), and
waits ~1.2 s for one of them to take effect before falling back. Adding the
config below is what makes one of them succeed.

---

## Cordova / PhoneGap

**1. `config.xml`** — add inside `<widget>`:

```xml
<preference name="Orientation" value="landscape" />
<preference name="Fullscreen" value="true" />
<preference name="AndroidLaunchMode" value="singleTop" />
```

and for iOS specifically:

```xml
<platform name="ios">
  <preference name="Orientation" value="landscape" />
</platform>
```

**2. Install the plugin** (belt and braces — it also re-locks after a call or
notification steals focus):

```bash
cordova plugin add cordova-plugin-screen-orientation
```

**3. Rebuild.** `cordova prepare` rewrites the native manifests from
`config.xml`, so a plain `cordova build android` picks it up. If you edited
`platforms/android/...` by hand before, delete and re-add the platform:

```bash
cordova platform rm android && cordova platform add android
cordova build android --release
```

> This is the usual reason a change "works on web but not in the app": the
> native project under `platforms/` is generated, and editing it directly gets
> wiped — or, the other way round, an old `platforms/` folder keeps overriding
> your new `config.xml`.

---

## Capacitor

**1. `capacitor.config.json`** (or `.ts`):

```json
{
  "appId": "art.offlinegames.helicopter",
  "appName": "Helicopter Simulator 3D",
  "webDir": "www",
  "android": { "allowMixedContent": true },
  "plugins": {
    "SplashScreen": { "launchAutoHide": true }
  }
}
```

**2. `android/app/src/main/AndroidManifest.xml`** — on the `<activity>` tag:

```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="sensorLandscape"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
    android:exported="true">
```

`sensorLandscape` lets the player hold the phone either way round in landscape,
which is what people expect; use `landscape` to pin one direction only.

**3. `ios/App/App/Info.plist`**:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

**4.** `npx cap sync && npx cap open android`

---

## Plain Android WebView / Android Studio wrapper

`AndroidManifest.xml`:

```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="sensorLandscape"
    android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
    android:exported="true">
```

And make sure the WebView has a real viewport, otherwise it reports a fictional
980 px-wide page:

```java
WebSettings s = webView.getSettings();
s.setJavaScriptEnabled(true);
s.setDomStorageEnabled(true);        // the game saves progress in localStorage
s.setUseWideViewPort(true);
s.setLoadWithOverviewMode(true);
s.setMediaPlaybackRequiresUserGesture(false);   // lets the engine audio start
```

---

## If it still will not rotate

Open the app, then in a connected `chrome://inspect` console run:

```js
GAME.orientationInfo
```

You get, for example:

```js
{ nativeApp: true, phone: true, rotated: false, settled: true,
  lockAttempts: 5, inner: [412, 892], stage: [892, 412], ui: 0.94 }
```

- `nativeApp: false` — the shell is not exposing Cordova/Capacitor and the page
  is not on `file://`. The game is treating it as a browser tab; it still
  rotates itself, so this is not fatal.
- `phone: false` — the viewport is reporting something larger than 1100 px on
  its short side, usually a WebView without `setUseWideViewPort(true)` plus a
  missing viewport meta.
- `rotated: false` with `inner` showing a portrait pair — the native lock is
  being applied *and* winning; that is the good case.

To force the fallback rotation on immediately, for testing:

```js
GAME.forceLandscape()
```

## Native ad banner

When the CSS fallback rotation is active in an app build, the game shrinks its
own stage by 58 px so the OS-drawn AdMob banner at the physical bottom cannot
cover the collective lever. Change `NATIVE_BANNER_PX` at the top of the
orientation section in `js/game.js` if your banner is a different height, or set
it to `0` if the app build has no anchored banner.
