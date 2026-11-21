package com.mantiqatix.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * MantiqaTix Unified Android Application Activity
 * Architecture: Website + Android App + Admin Dashboard -> Shared Backend/API -> Shared Database -> Shared Business Logic
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val productionUrl = "https://mantiqatix.com/?client=android_app"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = "${settings.userAgentString} MantiqatiXAndroid/4.19.0"

        webView.addJavascriptInterface(MantiqaTixNativeBridge(), "MantiqatiXAndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://") || url.startsWith("tel:")) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }
                return false
            }
        }

        webView.loadUrl(productionUrl)
    }

    inner class MantiqaTixNativeBridge {
        @JavascriptInterface
        fun getAppVersion(): String = "4.19.0-production"

        @JavascriptInterface
        fun getSharedApiEndpoint(): String = "https://mantiqatix.com/api"
    }

    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
