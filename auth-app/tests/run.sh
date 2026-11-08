#!/usr/bin/env bash
# Chạy toàn bộ test trên Firebase Emulator (project demo-webbanhang, không đụng dữ liệu thật).
#   ./run.sh            test rules + E2E
#   ./run.sh rules      chỉ test Security Rules
#   ./run.sh e2e        chỉ test E2E Playwright
#   ./run.sh audit      kiểm tra accessibility (axe-core) + đo tốc độ
#   ./run.sh dev        chạy thử trên máy: emulator + sản phẩm mẫu, mở http://localhost:5000
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
  audit) CMD="node audit.mjs" ;;
  dev)   CMD="node seed.mjs && sleep infinity" ;;
  *)     CMD="node rules.test.mjs && node e2e.mjs && node audit.mjs" ;;
esac

cd ..
exec firebase emulators:exec --project demo-webbanhang --only auth,firestore,hosting \
  "cd tests && $CMD"
