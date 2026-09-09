package art.offlinegames.helicopter;

import android.annotation.SuppressLint;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Helicopter Simulator 3D — Android WebView wrapper.
 *
 * The three things that actually matter here:
 *
 *  1. LANDSCAPE LOCK. Set in two places on purpose: the manifest handles the
 *     very first frame (before any Java runs), and setRequestedOrientation()
 *     below re-asserts it if anything ever changes it at runtime.
 *
 *  2. CACHE. This app loads the live site, so a stale WebView cache is the
 *     usual reason a change appears in Chrome but not in the app. LOAD_DEFAULT
 *     will happily serve month-old JavaScript. See GAME_URL / cache handling.
 *
 *  3. WEBVIEW SETTINGS. The game needs JavaScript, DOM storage (it saves
 *     progress to localStorage) and a real viewport. Without
 *     setUseWideViewPort(true) the WebView reports a fictional 980 px-wide
 *     layout and every responsive rule reads the wrong size.
 */
public class MainActivity extends AppCompatActivity {

    /** Point this at your published game. */
    private static final String GAME_URL =
            "https://offlinegames.art/helicopter-simulator-3d/";

    /**
     * Bump this string whenever you upload a new build of the game. It is
     * appended as a cache-busting query parameter, which guarantees the
     * WebView fetches the new index.html instead of replaying the old one.
     * The game ignores unknown parameters.
     */
    private static final String BUILD_TAG = "20260909b";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ---- 1. landscape, belt and braces ----------------------------------
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        // ---- 2. edge-to-edge immersive, so the game owns the whole screen ---
        goImmersive();

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#070c12"));
        setContentView(web);

        // ---- 3. WebView settings the game depends on -----------------------
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // localStorage: saves progress
        s.setDatabaseEnabled(true);
        s.setUseWideViewPort(true);              // honour <meta name="viewport">
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);   // lets the audio engine start
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        // Always revalidate against the server. The alternative, LOAD_DEFAULT,
        // is why an updated site can keep showing the old build inside an app.
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // follow the phone's dark/light setting rather than forcing one
            s.setForceDark(WebSettings.FORCE_DARK_AUTO);
        }

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // keep the game in the app; anything else is not our concern
                return false;
            }
        });

        // Uncomment while debugging, then attach chrome://inspect on a desktop.
        // WebView.setWebContentsDebuggingEnabled(true);

        if (savedInstanceState == null) {
            web.clearCache(true);                // drop anything left by an older build
            web.loadUrl(GAME_URL + "?v=" + BUILD_TAG);
        } else {
            web.restoreState(savedInstanceState);
        }

        // ---- 4. back button: step through game history, then leave ---------
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });
    }

    /** Hide the status and navigation bars and keep them hidden. */
    private void goImmersive() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                  | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                  | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                  | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                  | View.SYSTEM_UI_FLAG_FULLSCREEN
                  | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // a call or notification can restore the bars; put them back
            goImmersive();
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        }
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override protected void onPause()  { super.onPause();  web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); goImmersive(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
