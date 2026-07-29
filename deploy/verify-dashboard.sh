#!/usr/bin/env bash
# Checks the tenant dashboard summary on the running server: the subscription
# figure must come from the real plan, not a hardcoded per-head price.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-58s %s\n' "$1" "$2"; }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }
absent()  { if printf '%s' "$2" | grep -q "$3"; then say "$1" "FAIL (found $3)"; fail=1; else say "$1" 'ok'; fi }

admin=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"company@example.com","password":"password123"}' \
  "${BASE}/auth/admin-login" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$admin" ] && say 'company admin sign-in' 'ok' || { echo 'FAIL admin sign-in'; exit 1; }

summary=$(curl -s -H "Authorization: Bearer $admin" "${BASE}/admin/dashboard")

echo
echo "=== the tile reports a subscription, not revenue ==="
absent   'no revenue field on a tenant'      "$summary" '"monthlyRevenue"'
contains 'subscription amount present'       "$summary" '"monthlySubscription"'
contains 'seat allowance present'            "$summary" '"totalSeats"'
contains 'renewal date present'              "$summary" '"nextRenewalAt"'
contains 'plan name present'                 "$summary" '"planName"'

echo
echo "=== the amount follows the plan, not the headcount ==="
seats=$(printf '%s' "$summary" | grep -o '"totalSeats":[0-9]*' | cut -d: -f2)
amount=$(printf '%s' "$summary" | grep -o '"monthlySubscription":[0-9.]*' | cut -d: -f2)
staff=$(printf '%s' "$summary" | grep -o '"employees":[0-9]*' | cut -d: -f2)
say 'seats / employees / amount' "${seats:-?} / ${staff:-?} / ${amount:-?}"

renewal=$(curl -s -H "Authorization: Bearer $admin" "${BASE}/subscriptions" \
  | grep -o '"renewalAmount":[0-9.]*' | head -1 | cut -d: -f2)
if [ -n "$renewal" ] && [ -n "$amount" ]; then
  if [ "$renewal" = "$amount" ]; then
    say 'dashboard agrees with billing' "ok (${amount})"
  else
    # A yearly cycle divides by twelve, so a mismatch is only a failure monthly.
    cycle=$(printf '%s' "$summary" | grep -o '"billingCycle":"[^"]*' | cut -d'"' -f4)
    if [ "$cycle" = 'yearly' ]; then
      say 'dashboard agrees with billing' "ok (yearly: ${amount} of ${renewal})"
    else
      say 'dashboard agrees with billing' "FAIL (dashboard ${amount}, billing ${renewal})"
      fail=1
    fi
  fi
fi

echo
if [ "$fail" -eq 0 ]; then echo 'ALL DASHBOARD CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
