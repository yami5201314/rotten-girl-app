# rotten girl App

rotten girl 短剧平台的移动端外壳：Tauri 2 + React 19 + Vite + Tailwind CSS 4，目标 Android / iOS（Windows 桌面可用于调试）。

## 目录

| 路径 | 说明 |
|---|---|
| `src/` | 前端页面与组件；唯一后端出口为 `src/lib/api.ts`（经 Rust 命令 `api_request` 代发） |
| `shared/types.ts` | 与后端接口契约一致的类型（只含 App 用到的部分） |
| `messages/` | 6 种界面语言文案：zh-CN、zh-TW、ko、ja、th、vi |
| `src-tauri/` | Rust：网络与 Cookie、`rgmedia` 媒体代理、Android 原生横屏桥 |

## 站点地址

构建时嵌入，优先级：环境变量 `RG_SITE_ORIGIN` > 本地 `app.config.json`（不入库）> `app.config.example.json`（占位 `https://example.invalid`）。
本地开发复制 `app.config.example.json` 为 `app.config.json` 并填写自己的后端地址。

## 开发

```bash
pnpm install
pnpm typecheck && pnpm test && pnpm build
pnpm tauri android build --apk   # 需 Android SDK / NDK
pnpm tauri ios build             # 需 macOS + Xcode
```

## 许可证

[PolyForm Noncommercial 1.0.0](LICENSE)：仅限非商业用途。
