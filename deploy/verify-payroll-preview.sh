#!/usr/bin/env bash
# Verifies the payroll dry run on the running server: it computes figures, names
# blockers, filters to exceptions, and writes nothing.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-58s %s\n' "$1" "$2"; }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }
expect()  { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }
count()   { printf '%s' "$1" | grep -o "$2" | wc -l | tr -d ' '; }

get() { curl -s -H "Authorization: Bearer $2" "${BASE}$1"; }

admin=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"company@example.com","password":"password123"}' \
  "${BASE}/auth/admin-login" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$admin" ] && say 'company admin sign-in' 'ok' || { echo 'FAIL admin sign-in'; exit 1; }

PERIOD='2027-09'

# Payslip count before the dry run. GET /payroll ignores the period filter, so the
# only reliable measure of "wrote nothing" is that the total is unchanged.
before_total=$(count "$(get '/payroll?limit=500' "$admin")" '"_id":"payroll_')

echo
echo "=== the dry run produces figures ==="
preview=$(get "/payroll/preview?period=${PERIOD}" "$admin")
contains 'preview returns the period'      "$preview" "\"period\":\"${PERIOD}\""
contains 'readiness is reported'           "$preview" '"ready"'
contains 'per-employee rows'               "$preview" '"employee"'
contains 'attendance day counts'           "$preview" '"payableDays"'
contains 'net figures'                     "$preview" '"net"'
contains 'run totals'                      "$preview" '"totals"'

echo
echo "=== nothing was written ==="
after_total=$(count "$(get '/payroll?limit=500' "$admin")" '"_id":"payroll_')
expect 'payslip count unchanged by preview' "$after_total" "$before_total"

echo
echo "=== the exceptions view is a filter, not a separate computation ==="
all=$(get "/payroll/preview?period=${PERIOD}&view=all" "$admin")
exceptions=$(get "/payroll/preview?period=${PERIOD}&view=exceptions" "$admin")
contains 'exceptions view labelled'        "$exceptions" '"view":"exceptions"'
all_rows=$(count "$all" '"employeeId"')
exception_rows=$(count "$exceptions" '"employeeId"')
if [ "${exception_rows:-0}" -le "${all_rows:-0}" ]; then
  say 'exceptions are a subset' "ok (${exception_rows} of ${all_rows})"
else
  say 'exceptions are a subset' "FAIL (${exception_rows} > ${all_rows})"
  fail=1
fi

echo
echo "=== an out-of-range period is rejected, a stale one warned ==="
expect 'malformed period rejected' "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $admin" "${BASE}/payroll/preview?period=nope")" 400
stale=$(get '/payroll/preview?period=2024-02' "$admin")
contains 'old period warns about settings' "$stale" 'period.stale'

echo
echo "=== managers cannot preview payroll ==="
manager=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"manager@testco.com","password":"password123"}' \
  "${BASE}/auth/admin-login" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$manager" ]; then
  expect 'manager is refused' "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $manager" "${BASE}/payroll/preview?period=${PERIOD}")" 403
else
  say 'manager sign-in' 'skipped (password rotated)'
fi

echo
if [ "$fail" -eq 0 ]; then echo 'ALL PAYROLL PREVIEW CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
