#!/usr/bin/env bash
# Live check for the reported payslip and pay-date behaviour.
#
# Asserts the payslip header no longer carries the company profile, that the
# identifiers which remain are the ones tied to an actual deduction, and that the
# payroll preview reports the working-day-adjusted salary pay date.
set -uo pipefail

ROOT="${QHR_ROOT:-http://127.0.0.1/qhr}"
EMAIL="${QHR_ADMIN_EMAIL:-company@example.com}"
PASSWORD="${QHR_ADMIN_PASSWORD:-password123}"

pass=0
fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then printf '%-56s ok\n' "$1"; pass=$((pass + 1));
  else printf '%-56s FAILED (expected %s, got %s)\n' "$1" "$2" "$3"; fail=$((fail + 1)); fi
}

TOKEN=$(curl -s -X POST "$ROOT/api/v1/auth/admin-login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')
[ -n "$TOKEN" ] && printf '%-56s ok\n' 'company admin sign-in' || { echo 'sign-in FAILED'; exit 1; }

ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$ROOT/api/v1/payroll?limit=1" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["payroll"][0]["_id"])')
HTML=$(curl -s -H "Authorization: Bearer $TOKEN" "$ROOT/api/v1/payroll/$ID/download")

echo
echo '=== the payslip header is a wage record, not a company profile ==='
HEADER=$(printf '%s' "$HTML" | sed -n 's/.*<div class="company">\(.*\)<\/div><\/div><div class="document">.*/\1/p')
echo "$HEADER" | sed 's/<[^>]*>/ /g' | tr -s ' '
echo
check 'GSTIN is gone'                 0 "$(printf '%s' "$HEADER" | grep -c 'GSTIN')"
check 'employer PAN is gone'          0 "$(printf '%s' "$HEADER" | grep -c 'PAN ')"
check 'one address only'              1 "$(printf '%s' "$HEADER" | grep -o 'class="tag"' | grep -c .)"

echo
echo '=== identifiers appear only when the deduction applies ==='
PF_DEDUCTED=$(curl -s -H "Authorization: Bearer $TOKEN" "$ROOT/api/v1/payroll/$ID" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]["payroll"]; print(1 if any(l["code"]=="provident_fund" and l["amount"] for l in (d.get("employeeDeductions") or [])) else 0)')
TDS_DEDUCTED=$(curl -s -H "Authorization: Bearer $TOKEN" "$ROOT/api/v1/payroll/$ID" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]["payroll"]; print(1 if any(l["code"]=="tds" and l["amount"] for l in (d.get("employeeDeductions") or [])) else 0)')
check 'PF code shown exactly when PF is deducted'   "$PF_DEDUCTED"  "$(printf '%s' "$HEADER" | grep -c 'PF:')"
check 'TAN shown exactly when TDS is deducted'      "$TDS_DEDUCTED" "$(printf '%s' "$HEADER" | grep -c 'TAN ')"

echo
echo '=== salary pay date respects the working calendar ==='
curl -s -H "Authorization: Bearer $TOKEN" "$ROOT/api/v1/payroll/preview?period=2026-08" \
  | python3 -c '
import sys, json
payment = json.load(sys.stdin)["data"].get("payment")
if not payment:
    print("payment block missing FAILED"); raise SystemExit(1)
print("configured day  :", payment["requestedDate"])
print("effective payout:", payment["date"])
print("moved earlier   :", payment["shifted"])
if payment["reason"]: print("reason          :", payment["reason"])
assert payment["date"] <= payment["requestedDate"], "a pay date must never move later"
print("never moves later                                        ok")
'
[ $? -eq 0 ] && pass=$((pass + 1)) || fail=$((fail + 1))

echo
if [ "$fail" -eq 0 ]; then echo "ALL PAYSLIP AND PAY-DATE CHECKS PASSED ($pass)"; else echo "$fail CHECK(S) FAILED"; exit 1; fi
