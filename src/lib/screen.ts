/** Android 原生桥（MainActivity.ScreenBridge）：切换横屏并隐藏系统栏 */
interface NativeScreen {
  setLandscape(on: boolean): void;
}

declare global {
  interface Window {
    RgScreen?: NativeScreen;
  }
}

export function setLandscape(on: boolean) {
  if (window.RgScreen) return window.RgScreen.setLandscape(on);
  // 桌面 / iOS 暂无原生桥：退化为 Fullscreen API，不旋转
  if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}
