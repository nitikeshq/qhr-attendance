#!/usr/bin/env bash
# Verifies the seat model, the plan catalogue, and the shared company calendar
# on the running server. Read-only except for one temporary plan it deletes.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-54s %s\n' "$1" "$2"; }
expect() { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }

login() {
  curl -s -X POST -H 'Content-Type: application/json' -d "$2" "${BASE}/auth/admin-login" \
    | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4
}

echo "=== sign in ==="
super=$(login super '{"email":"admin@qhr.com","password":"admin123"}')
admin=$(login admin '{"email":"company@example.com","password":"password123"}')
[ -n "$super" ] && say 'super admin token' 'ok' || { echo 'FAIL super admin sign-in'; exit 1; }
[ -n "$admin" ] && say 'company admin token' 'ok' || { echo 'FAIL company admin sign-in'; exit 1; }

echo
echo "=== seat model: no bundled free admin seat ==="
plans=$(curl -s -H "Authorization: Bearer $super" "${BASE}/admin/subscription-plans")
if printf '%s' "$plans" | grep -q '"freeAdminSeats"'; then
  say 'legacy freeAdminSeats removed from plans' 'FAIL still present'; fail=1
else
  say 'legacy freeAdminSeats removed from plans' 'ok'
fi
if printf '%s' "$plans" | grep -q '"includedSeats"'; then
  say 'plans expose includedSeats' 'ok'
else
  say 'plans expose includedSeats' 'FAIL'; fail=1
fi

overview=$(curl -s -H "Authorization: Bearer $super" "${BASE}/admin/billing-overview")
if printf '%s' "$overview" | grep -q '"totalSeats"'; then
  say 'subscriptions report totalSeats' 'ok'
else
  say 'subscriptions report totalSeats' 'FAIL'; fail=1
fi

echo
echo "=== plan catalogue is editable and guarded ==="
createdCode=$(curl -s -o /tmp/qhr-plan.json -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $super" \
  -d '{"name":"Verify Probe","pricePerUser":49,"includedSeats":0,"features":["A","B"]}' \
  "${BASE}/admin/subscription-plans")
expect 'POST /admin/subscription-plans' "$createdCode" 201
planId=$(grep -o '"_id":"[^"]*' /tmp/qhr-plan.json | head -1 | cut -d'"' -f4)

badFree=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $super" \
  -d '{"pricePerUser":0,"includedSeats":0}' \
  "${BASE}/admin/subscription-plans/${planId}")
expect 'free plan with zero seats rejected' "$badFree" 400

blocked=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $admin" \
  "${BASE}/admin/subscription-plans")
expect 'company admin cannot read the catalogue' "$blocked" 403

removed=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer $super" "${BASE}/admin/subscription-plans/${planId}")
expect 'temporary plan cleaned up' "$removed" 200

echo
echo "=== company calendar ==="
year=$(date -u +%Y)
feed=$(curl -s -H "Authorization: Bearer $admin" "${BASE}/calendar?from=${year}-01-01&to=${year}-12-31")
for key in '"events"' '"upcoming"' '"counts"' '"settings"'; do
  if printf '%s' "$feed" | grep -q "$key"; then say "feed contains $key" 'ok'; else say "feed contains $key" 'FAIL'; fail=1; fi
done

oversized=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $admin" \
  "${BASE}/calendar?from=2020-01-01&to=2030-01-01")
expect 'oversized range rejected' "$oversized" 400

empLogin=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"companyCode":"TESTCO","employeeId":"EMP001","passcode":"1234"}' "${BASE}/auth/login")
empToken=$(printf '%s' "$empLogin" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$empToken" ]; then
  readable=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $empToken" \
    "${BASE}/calendar?from=${year}-01-01&to=${year}-12-31")
  expect 'employees can read the calendar' "$readable" 200
  writable=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $empToken" -d '{"title":"Nope","startDate":"'"${year}"'-06-01"}' \
    "${BASE}/calendar/events")
  expect 'employees cannot add company events' "$writable" 403
else
  say 'employee sign-in' 'skipped'
fi

rm -f /tmp/qhr-plan.json
echo
if [ "$fail" -eq 0 ]; then echo 'ALL CALENDAR AND PLAN CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
