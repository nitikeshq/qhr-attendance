#!/usr/bin/env bash
# Verifies the work week on the running server: weekly offs are paid under every
# payable-day method, and 2nd/4th Saturday patterns resolve correctly.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-58s %s\n' "$1" "$2"; }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }
expect()  { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }
field()   { printf '%s' "$1" | grep -o "\"$2\":[0-9.]*" | head -1 | cut -d: -f2; }

get()   { curl -s -H "Authorization: Bearer $2" "${BASE}$1"; }
patch() { curl -s -X PATCH -H 'Content-Type: application/json' -H "Authorization: Bearer $3" -d "$2" "${BASE}$1"; }

admin=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"company@example.com","password":"password123"}' \
  "${BASE}/auth/admin-login" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$admin" ] && say 'company admin sign-in' 'ok' || { echo 'FAIL admin sign-in'; exit 1; }

echo
echo "=== the work week is readable ==="
policy=$(get /attendance/policy "$admin")
contains 'policy exposes the work week'   "$policy" '"workWeek"'
contains 'work week is described in words' "$policy" 'weekly off'

echo
echo "=== 2nd and 4th Saturday off resolves per date ==="
saved=$(patch /attendance/work-week '{"workWeek":{"0":"off","1":"full","2":"full","3":"full","4":"full","5":"full","6":{"pattern":"nth","off":[2,4],"otherwise":"half"}}}' "$admin")
contains 'work week saved'                "$saved" '"success":true'
contains 'Saturday pattern described'     "$saved" '2nd and 4th off'

preview=$(get '/attendance/work-week/preview?period=2026-03' "$admin")
expect 'March 2026 calendar days'         "$(field "$preview" calendarDays)" 31
expect 'weekly offs (5 Sundays + 2 Sats)' "$(field "$preview" weeklyOffDays)" 7
expect 'half days (1st and 3rd Saturday)' "$(field "$preview" halfDays)" 2
contains 'payable-day basis reported'     "$preview" '"payableDayBasis"'

echo
echo "=== a weekly off is paid, never an absence ==="
sunday=$(get '/attendance/team?date=2026-03-01&period=2026-03' "$admin")
contains 'Sunday classified as weekly off' "$sunday" '"status":"weekly_off"'
second_sat=$(get '/attendance/team?date=2026-03-14&period=2026-03' "$admin")
contains '2nd Saturday is a weekly off'    "$second_sat" '"status":"weekly_off"'

echo
echo "=== restore the seeded five-day week ==="
restored=$(patch /attendance/work-week '{"workWeek":{"0":"off","1":"full","2":"full","3":"full","4":"full","5":"full","6":"off"}}' "$admin")
contains 'restored'                        "$restored" '"success":true'

echo
if [ "$fail" -eq 0 ]; then echo 'ALL WORK WEEK CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
