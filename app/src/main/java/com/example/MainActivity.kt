package com.example

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : ComponentActivity() {

  private var webView: WebView? = null

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // Immersive display for gaming
    val insetsController = WindowCompat.getInsetsController(window, window.decorView)
    insetsController.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    insetsController.hide(WindowInsetsCompat.Type.systemBars())

    setContent {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(Color.Black)
      ) {
        AndroidView(
          modifier = Modifier.fillMaxSize(),
          factory = { context ->
            WebView(context).apply {
              layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
              )
              setBackgroundColor(AndroidColor.BLACK)
              overScrollMode = View.OVER_SCROLL_NEVER
              isVerticalScrollBarEnabled = false
              isHorizontalScrollBarEnabled = false

              // Let system manage layer acceleration appropriately for the emulator / GPU environment
              // Avoid forcing LAYER_TYPE_HARDWARE which causes Mesa rendernode query crashes in virtualized emulators

              settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_DEFAULT
              }

              webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                  Log.d(
                    "HillClimber",
                    "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}"
                  )
                  return true
                }
              }

              webViewClient = object : WebViewClient() {
                override fun onRenderProcessGone(
                  view: WebView?,
                  detail: RenderProcessGoneDetail?
                ): Boolean {
                  Log.w("HillClimber", "WebView render process exited (crashed=${detail?.didCrash()}). Recovering gracefully.")
                  // Return true so host app process is not terminated by OS
                  return true
                }
              }

              loadUrl("file:///android_asset/index.html")
              this@MainActivity.webView = this
            }
          }
        )
      }
    }
  }

  override fun onResume() {
    super.onResume()
    webView?.onResume()
  }

  override fun onPause() {
    webView?.onPause()
    super.onPause()
  }

  override fun onDestroy() {
    webView?.destroy()
    super.onDestroy()
  }
}

@androidx.compose.runtime.Composable
fun Greeting(name: String, modifier: androidx.compose.ui.Modifier = androidx.compose.ui.Modifier) {
  androidx.compose.material3.Text(text = "Hello $name!", modifier = modifier)
}

