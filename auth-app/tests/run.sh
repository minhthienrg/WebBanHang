#!/usr/bin/env bash
# Chạy toàn bộ test trên Firebase Emulator (project demo-webbanhang, không đụng dữ liệu thật).
#   ./run.sh            test rules + E2E
#   ./run.sh rules      chỉ test Security Rules
#   ./run.sh e2e        chỉ test E2E Playwright (cửa hàng)
#   ./run.sh admin      chỉ test E2E trang quản trị
#   ./run.sh cskh       chỉ test E2E vai trò chăm sóc khách hàng
#   ./run.sh audit      kiểm tra accessibility (axe-core) + đo tốc độ
#   ./run.sh dev        chạy thử trên máy: emulator + 254 linh kiện NEXORA, mở http://localhost:5000
#   ./run.sh dev-mau    như trên nhưng dùng 23 sản phẩm mẫu
# Cần: Java 11+ (biến JAVA_HOME hoặc `java` trong PATH), Chromium của Playwright
# (`npx playwright install chromium`, hoặc đặt PLAYWRIGHT_BROWSERS_PATH).
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v java >/dev/null; then
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    export PATH="$JAVA_HOME/bin:$PATH"
  else
    echo "Không tìm thấy Java. Cài: sudo apt install openjdk-21-jre-headless (hoặc đặt JAVA_HOME)." >&2
    exit 1
  fi
fi
[[ -d node_modules ]] || npm install --no-audit --no-fund

case "${1:-all}" in
  rules) CMD="node rules.test.mjs" ;;
  e2e)   CMD="node e2e.mjs" ;;
  admin) CMD="node admin-e2e.mjs" ;;
  cskh)  CMD="node cskh-e2e.mjs" ;;
  audit) CMD="node audit.mjs" ;;
  dev)   CMD="node seed.mjs && sleep infinity" ;;
  dev-mau) CMD="node seed.mjs mau && sleep infinity" ;;
  *)     CMD="node rules.test.mjs && node e2e.mjs && node admin-e2e.mjs && node cskh-e2e.mjs && node audit.mjs" ;;
esac

cd ..
exec firebase emulators:exec --project demo-webbanhang --only auth,firestore,hosting \
  "cd tests && $CMD"
