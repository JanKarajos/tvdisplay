package sk.laudate.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Laudate – ovládanie textov na TV v kostole.
 * Aplikácia je len okno s webovým ovládaním (http://ADRESA:5173/#control),
 * ktoré beží na Orange Pi v kostole. Adresa sa zadá pri prvom spustení.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "laudate";
    private static final String KEY_ADDRESS = "address";
    private static final int DEFAULT_PORT = 5173;
    private static final int FILE_CHOOSER = 1;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String currentAddress = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Počas omše nech obrazovka mobilu nezhasne
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1C1A2B"));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        applyInsets(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " LaudateApp/1.0");

        webView.addJavascriptInterface(new Bridge(), "LaudateApp");
        webView.setWebViewClient(new Client());
        webView.setWebChromeClient(new Chrome());

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            currentAddress = savedInstanceState.getString(KEY_ADDRESS, savedAddress());
        } else if (savedAddress().isEmpty()) {
            showWelcome();
            askAddress(false);
        } else {
            open(savedAddress());
        }
    }

    // Android 15 kreslí aplikáciu aj pod stavový riadok; odsadíme obsah od systémových líšt a klávesnice
    private void applyInsets(View root) {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft();
                t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight();
                b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private String savedAddress() {
        return prefs().getString(KEY_ADDRESS, "");
    }

    /** "192.168.1.50" → "http://192.168.1.50:5173/#control" */
    static String controlUrl(String address) {
        String a = address.trim();
        while (a.endsWith("/")) a = a.substring(0, a.length() - 1);
        if (!a.matches("(?i)^https?://.*")) a = "http://" + a;
        Uri u = Uri.parse(a);
        String host = u.getHost() == null ? "" : u.getHost();
        boolean hasPath = u.getPath() != null && !u.getPath().isEmpty() && !"/".equals(u.getPath());
        StringBuilder sb = new StringBuilder(u.getScheme()).append("://").append(host);
        if (u.getPort() != -1) sb.append(':').append(u.getPort());
        else if (!hasPath && "http".equalsIgnoreCase(u.getScheme())) sb.append(':').append(DEFAULT_PORT);
        sb.append(hasPath ? u.getPath() : "/");
        sb.append(u.getFragment() != null ? "#" + u.getFragment() : "#control");
        return sb.toString();
    }

    private void open(String address) {
        currentAddress = address;
        webView.loadUrl(controlUrl(address));
    }

    private void askAddress(boolean cancelable) {
        int pad = dp(20);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(pad, dp(8), pad, 0);

        TextView info = new TextView(this);
        info.setText("Zadajte IP adresu Orange Pi v kostole, napríklad 192.168.1.50.\n"
                + "Je to tá istá adresa, ktorú používate v prehliadači (port 5173 sa doplní sám).");
        info.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        box.addView(info);

        EditText input = new EditText(this);
        input.setHint("192.168.1.50");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setText(savedAddress());
        input.setSelection(input.getText().length());
        box.addView(input);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Adresa zariadenia v kostole")
                .setView(box)
                .setCancelable(cancelable)
                .setPositiveButton("Pripojiť", null)
                .setNegativeButton(cancelable ? "Zrušiť" : "Ukončiť", (d, w) -> {
                    if (!cancelable) finish();
                })
                .create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String value = input.getText().toString().trim();
            if (value.isEmpty() || Uri.parse(controlUrl(value)).getHost() == null
                    || Uri.parse(controlUrl(value)).getHost().isEmpty()) {
                input.setError("Zadajte adresu, napríklad 192.168.1.50");
                return;
            }
            prefs().edit().putString(KEY_ADDRESS, value).apply();
            dialog.dismiss();
            open(value);
        }));
        dialog.show();
    }

    private void showWelcome() {
        webView.loadDataWithBaseURL(null, page("Vitajte v aplikácii Laudate",
                "Na ovládanie textov na TV v kostole potrebujete adresu zariadenia v kostole.", false),
                "text/html", "utf-8", null);
    }

    private void showError(String detail) {
        webView.loadDataWithBaseURL(null, page("Nepodarilo sa pripojiť",
                "Zariadenie na adrese <b>" + escape(currentAddress) + "</b> neodpovedá.<br><br>"
                        + "Skontrolujte, či je mobil na tej istej Wi-Fi ako zariadenie v kostole "
                        + "(alebo má zapnutý Tailscale) a či je zariadenie zapnuté."
                        + (detail == null ? "" : "<br><br><small>" + escape(detail) + "</small>"), true),
                "text/html", "utf-8", null);
    }

    private static String page(String title, String text, boolean retry) {
        return "<!doctype html><html><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;"
                + "background:#1C1A2B;color:#F6F2EA;font-family:sans-serif;padding:24px;box-sizing:border-box}"
                + ".c{max-width:420px}h1{font-family:serif;font-size:28px;margin:0 0 12px;color:#C08A2E}"
                + "p{line-height:1.5;color:#CFC8DA}small{color:#8F88A0}"
                + "button{display:block;width:100%;margin-top:12px;padding:14px;border-radius:12px;border:0;"
                + "font-size:16px;font-weight:bold}.p{background:#C08A2E;color:#1C1A2B}"
                + ".s{background:transparent;color:#F6F2EA;border:1px solid #4A4558}</style></head><body><div class='c'>"
                + "<h1>" + title + "</h1><p>" + text + "</p>"
                + (retry ? "<button class='p' onclick='LaudateApp.retry()'>Skúsiť znova</button>" : "")
                + "<button class='" + (retry ? "s" : "p") + "' onclick='LaudateApp.changeAddress()'>"
                + (retry ? "Zmeniť adresu" : "Zadať adresu") + "</button>"
                + "</div></body></html>";
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /** Tlačidlá na stránke s chybou */
    private class Bridge {
        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> {
                if (!currentAddress.isEmpty()) open(currentAddress);
                else askAddress(false);
            });
        }

        @JavascriptInterface
        public void changeAddress() {
            runOnUiThread(() -> askAddress(!savedAddress().isEmpty()));
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            Uri home = Uri.parse(controlUrl(currentAddress));
            String scheme = url.getScheme() == null ? "" : url.getScheme();
            boolean sameServer = url.getHost() != null && url.getHost().equalsIgnoreCase(home.getHost());
            if ((scheme.equals("http") || scheme.equals("https")) && sameServer) return false;
            // Odkazy mimo zariadenia (napr. YouTube) otvoríme v prehliadači
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
                // nič
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
        }
    }

    private class Chrome extends WebChromeClient {
        // Nahrávanie obrázkov a prezentácií z mobilu
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                startActivityForResult(params.createIntent(), FILE_CHOOSER);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Laudate")
                .setItems(new CharSequence[]{"Obnoviť stránku", "Zmeniť adresu zariadenia", "Ukončiť aplikáciu"}, (d, which) -> {
                    if (which == 0) {
                        if (currentAddress.isEmpty()) askAddress(false); else open(currentAddress);
                    } else if (which == 1) {
                        askAddress(!savedAddress().isEmpty());
                    } else {
                        finish();
                    }
                })
                .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
        outState.putString(KEY_ADDRESS, currentAddress);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
