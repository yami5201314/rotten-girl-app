#!/usr/bin/env bash
# 未签名 iOS 构建：tauri ios build 没有跳过签名的选项，而 Xcode 工程里的 "Build Rust Code" 阶段
# 需要 tauri CLI 会话在后台提供构建参数。做法：后台启动 tauri 会话（--open 不调起 xcodebuild），
# 等它就绪后由 xcodebuild 关闭签名编译，最后打包成 Payload/*.app 的 IPA。
# 用法：scripts/ios-unsigned.sh <输出 IPA 路径>
set -euo pipefail

OUT="${1:?usage: ios-unsigned.sh <out.ipa>}"
ROOT="$(pwd)"
APPLE="$ROOT/src-tauri/gen/apple"
LOG="$ROOT/tauri-ios-session.log"
OPTIONS="$APPLE/.tauri/cli-options-server.json"

pnpm tauri ios build --open --ci >"$LOG" 2>&1 &
SESSION=$!
trap 'kill "$SESSION" 2>/dev/null || true; echo "--- tauri session log ---"; cat "$LOG"' EXIT

for _ in $(seq 1 600); do
  kill -0 "$SESSION" 2>/dev/null || { echo "tauri 会话提前退出" >&2; exit 1; }
  [[ -s "$OPTIONS" ]] && break
  sleep 1
done
[[ -s "$OPTIONS" ]] || { echo "等待 tauri 会话超时" >&2; exit 1; }

PROJECT="$(ls -d "$APPLE"/*.xcodeproj | head -n1)"
SCHEME="$(basename "$PROJECT" .xcodeproj)_iOS"
xcodebuild build \
  -project "$PROJECT" -scheme "$SCHEME" \
  -configuration release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$ROOT/build/ios" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""

APP="$(ls -d "$ROOT"/build/ios/Build/Products/release-iphoneos/*.app | head -n1)"
BIN="$APP/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist")"
file "$BIN" | grep -q 'arm64'
# 防止把指向开发服务器的调试包当成产物
if strings "$BIN" | grep -F 'localhost:1420' >/dev/null; then
  echo "产物指向开发服务器，拒绝打包" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
mkdir "$STAGE/Payload"
cp -R "$APP" "$STAGE/Payload/"
mkdir -p "$(dirname "$OUT")"
(cd "$STAGE" && zip -qry "$ROOT/$OUT" Payload)
ls -lh "$ROOT/$OUT"
