package com.rottengirl.app

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // 播放页全屏横屏：WebView 不支持锁方向，由原生切换 Activity 方向并隐藏系统栏。
  // App 只加载内置页面（见 capabilities/default.json），桥只暴露这一个方法。
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(ScreenBridge(), "RgScreen")
  }

  inner class ScreenBridge {
    @JavascriptInterface
    fun setLandscape(on: Boolean) {
      runOnUiThread {
        requestedOrientation =
          if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        val bars = WindowCompat.getInsetsController(window, window.decorView)
        if (on) {
          bars.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
          bars.hide(WindowInsetsCompat.Type.systemBars())
        } else {
          bars.show(WindowInsetsCompat.Type.systemBars())
        }
      }
    }
  }
}
