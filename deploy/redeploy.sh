#!/usr/bin/env bash
# Unpack a code drop and rebuild QHR in place.
# Touches only /home/ubuntu/apps/qhr-attendance and qhr-* PM2 apps.
#
# Usage (on the server):
#   cd /home/ubuntu/apps/qhr-attendance && ./redeploy.sh
#
# The server keeps the deploy scripts flat at the app root, so this script does not
# look inside a deploy/ directory.
set -euo pipefail

APP_DIR=/home/ubuntu/apps/qhr-attendance
BUNDLE="$APP_DIR/qhr-deploy.tar.gz"

cd "$APP_DIR"

if [ ! -f "$BUNDLE" ]; then
  echo "No bundle at $BUNDLE" >&2
  exit 1
fi

echo "== extracting bundle"
tar -xzf "$BUNDLE"
rm -f "$BUNDLE"

# Only run npm install when package.json actually changed, so a code-only drop is fast.
install_if_changed() {
  local dir="$1"
  shift
  local stamp="$dir/node_modules/.deps-stamp"
  local current
  current=$(sha256sum "$dir/package.json" | cut -d' ' -f1)
  if [ -d "$dir/node_modules" ] && [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$current" ]; then
    echo "== deps unchanged: $dir"
    return
  fi
  echo "== installing deps: $dir"
  ( cd "$dir" && npm install --no-audit --no-fund "$@" )
  echo "$current" > "$stamp"
}

install_if_changed attendance-mobile/Backend --omit=dev
install_if_changed admin-panel
install_if_changed landing-page
install_if_changed attendance-mobile

echo "== rebuilding under /qhr and restarting qhr-* apps"
chmod +x ./install-multi-project.sh ./verify.sh
./install-multi-project.sh

echo "== verifying"
./verify.sh http://127.0.0.1/qhr
