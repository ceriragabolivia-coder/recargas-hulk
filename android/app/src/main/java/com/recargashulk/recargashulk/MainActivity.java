package com.recargashulk.recargashulk;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final String BASE_URL = "https://recargashulk.com";
    private static final String HOME_URL = BASE_URL + "/";
    private static final String PEDIDOS_URL = BASE_URL + "/Mis-Pedidos";
    private static final String BILLETERA_URL = BASE_URL + "/Billetera";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);

        // Configure WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " RecargasHulkApp/1.0");

        // Keep sessions/cookies within the app
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Handle all recargashulk.com URLs inside the WebView
                if (url != null && url.startsWith(BASE_URL)) {
                    view.loadUrl(url);
                    return true;
                }
                return false;
            }
        });

        // Load the main page
        webView.loadUrl(HOME_URL);

        // Bottom nav buttons
        LinearLayout btnHome = findViewById(R.id.btn_home);
        LinearLayout btnPedidos = findViewById(R.id.btn_pedidos);
        LinearLayout btnBilletera = findViewById(R.id.btn_billetera);
        LinearLayout btnBack = findViewById(R.id.btn_back);

        btnHome.setOnClickListener(v -> webView.loadUrl(HOME_URL));

        btnPedidos.setOnClickListener(v -> webView.loadUrl(PEDIDOS_URL));

        btnBilletera.setOnClickListener(v -> webView.loadUrl(BILLETERA_URL));

        btnBack.setOnClickListener(v -> {
            if (webView.canGoBack()) {
                webView.goBack();
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
