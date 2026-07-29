#!/usr/bin/env bash
# Verifies the notification centre on the running server: birthday wishes derived
# from employee data, dedupe, per-person read state, and holiday announcements.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-58s %s\n' "$1" "$2"; }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }
absent()  { if printf '%s' "$2" | grep -q "$3"; then say "$1" "FAIL (found $3)"; fail=1; else say "$1" 'ok'; fi }
expect()  { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }

post() { curl -s -X POST -H 'Content-Type: application/json' ${3:+-H "Authorization: Bearer $3"} -d "${2:-{\}}" "${BASE}$1"; }
patch() { curl -s -X PATCH -H 'Content-Type: application/json' ${3:+-H "Authorization: Bearer $3"} -d "${2:-{\}}" "${BASE}$1"; }
get() { curl -s -H "Authorization: Bearer $2" "${BASE}$1"; }

echo "=== sign in ==="
admin=$(post /auth/admin-login '{"email":"company@example.com","password":"password123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$admin" ] && say 'company admin' 'ok' || { echo 'FAIL admin sign-in'; exit 1; }

empId=$(get /employees "$admin" | grep -o '"_id":"emp[^"]*","companyId[^}]*"employeeId":"EMP001"' | head -1 | grep -o '"_id":"emp[^"]*' | cut -d'"' -f4)
if [ -z "$empId" ]; then
  empId=$(get /employees "$admin" | tr ',' '\n' | grep -B0 -m1 '"_id":"emp' | cut -d'"' -f4)
fi
[ -n "$empId" ] && say 'located EMP001' 'ok' || { echo 'FAIL could not find EMP001'; exit 1; }

echo
echo "=== birthdays come from the employee record, not manual entry ==="
today=$(date -u +%Y-%m-%d)
monthday=$(date -u +-%m-%d)
patch "/employees/${empId}" "{\"dateOfBirth\":\"1990${monthday}\",\"dateOfJoining\":\"2020${monthday}\",\"hideBirthday\":false}" "$admin" >/dev/null
patch /calendar/settings '{"showBirthdays":true,"showAnniversaries":true}' "$admin" >/dev/null
say 'employee dates set via employee record' 'ok'

emp=$(post /auth/login '{"companyCode":"TESTCO","employeeId":"EMP001","passcode":"1234"}' "" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$emp" ] && say 'employee sign-in' 'ok' || { echo 'FAIL employee sign-in'; exit 1; }

inbox=$(get '/notifications?limit=50' "$emp")
contains 'employee receives birthday wishes'   "$inbox" '"kind":"birthday_self"'
contains 'employee receives anniversary wishes' "$inbox" '"kind":"anniversary_self"'
absent   'celebrant does not get the team notice' "$inbox" '"kind":"birthday_team"'

adminInbox=$(get '/notifications?limit=50' "$admin")
contains 'colleagues see the birthday notice' "$adminInbox" '"kind":"birthday_team"'

echo
echo "=== generation is idempotent ==="
first=$(printf '%s' "$inbox" | grep -o '"kind":"birthday_self"' | wc -l | tr -d ' ')
second=$(get '/notifications?limit=50' "$emp" | grep -o '"kind":"birthday_self"' | wc -l | tr -d ' ')
expect 'reopening the inbox does not duplicate' "$second" "$first"

echo
echo "=== a holiday added later notifies everyone ==="
future="$(( $(date -u +%Y) + 3 ))-11-14"
post /calendar/holidays "{\"date\":\"${future}\",\"name\":\"Verify Holiday\",\"paid\":true}" "$admin" >/dev/null
contains 'holiday announcement delivered' "$(get '/notifications?limit=50' "$emp")" 'Verify Holiday'

echo
echo "=== read state is per person ==="
target=$(get '/notifications?limit=1' "$emp" | grep -o '"_id":"notif[^"]*' | head -1 | cut -d'"' -f4)
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "Authorization: Bearer $admin" "${BASE}/notifications/${target}/read")
expect 'another user cannot mark it read' "$code" 404
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "Authorization: Bearer $emp" "${BASE}/notifications/${target}/read")
expect 'owner can mark it read' "$code" 200
post /notifications/read-all '{}' "$emp" >/dev/null
expect 'unread clears' "$(get /notifications/unread-count "$emp" | grep -o '"unread":[0-9]*' | cut -d: -f2)" 0

echo
echo "=== company anniversary is derived from the founding date ==="
patch /onboarding/company_profile '{"name":"Test Co","email":"company@example.com","registeredAddress":"1 Test Road","city":"Pune","state":"Maharashtra","pincode":"411045","industry":"IT services","timezone":"Asia/Kolkata","officeStart":"09:30","officeEnd":"18:30","foundedOn":"2018-06-11"}' "$admin" >/dev/null
year=$(( $(date -u +%Y) + 4 ))
contains 'company anniversary on the calendar' "$(get "/calendar?from=${year}-01-01&to=${year}-12-31" "$admin")" '"kind":"company_anniversary"'

echo
if [ "$fail" -eq 0 ]; then echo 'ALL NOTIFICATION CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
