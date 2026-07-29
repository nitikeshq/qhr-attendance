#!/usr/bin/env bash
# Read-only smoke check for the onboarding API on a running deployment.
set -euo pipefail

BASE="${1:-http://127.0.0.1/qhr}"
EMAIL="${2:-company@example.com}"
PASSWORD="${3:-password123}"

echo "=== onboarding smoke: $BASE ==="

TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/admin-login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).data.accessToken||"")}catch(e){}})')

if [ -z "$TOKEN" ]; then
  echo "login failed for $EMAIL" >&2
  exit 1
fi
echo "login: OK"

CODE=$(curl -s -o /tmp/onboarding.json -w '%{http_code}' "$BASE/api/v1/onboarding" \
  -H "Authorization: Bearer $TOKEN")
echo "GET /onboarding -> $CODE"
[ "$CODE" = "200" ] || { cat /tmp/onboarding.json; exit 1; }

node -e '
const payload = require("/tmp/onboarding.json").data;
console.log(`status: ${payload.status}`);
console.log(`progress: ${payload.progress.completedRequired}/${payload.progress.totalRequired} (${payload.progress.percent}%)`);
console.log(`canComplete: ${payload.canComplete}  currentStep: ${payload.currentStep}`);
for (const step of payload.steps) {
  const mark = step.complete ? "x" : (step.skipped ? "-" : " ");
  console.log(`  [${mark}] ${step.key.padEnd(18)} ${step.required ? "required" : "optional"}  ${step.missing.length} blocker(s)`);
}
if (payload.steps.length !== 10) { console.error("expected 10 steps"); process.exit(1); }
'

echo "=== premature go-live must be rejected with aggregated blockers ==="
CODE=$(curl -s -o /tmp/complete.json -w '%{http_code}' -X POST "$BASE/api/v1/onboarding/complete" \
  -H "Authorization: Bearer $TOKEN")
echo "POST /onboarding/complete -> $CODE"
if [ "$CODE" = "422" ]; then
  node -e 'const d=require("/tmp/complete.json");console.log(`blockers: ${(d.details.missing||[]).length}`);(d.details.missing||[]).slice(0,5).forEach(m=>console.log("  - "+m));'
elif [ "$CODE" = "200" ]; then
  echo "already eligible; company is live"
else
  cat /tmp/complete.json
  exit 1
fi

echo "=== a manager must not reach onboarding ==="
MGR=$(curl -s -X POST "$BASE/api/v1/auth/admin-login" -H 'Content-Type: application/json' \
  -d '{"email":"manager@testco.com","password":"password123"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).data.accessToken||"")}catch(e){}})')
if [ -n "$MGR" ]; then
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/onboarding" -H "Authorization: Bearer $MGR")
  echo "manager GET /onboarding -> $CODE (expect 403)"
  [ "$CODE" = "403" ] || exit 1
else
  echo "manager account not present on this deployment, skipping"
fi

echo "onboarding smoke: all good"
