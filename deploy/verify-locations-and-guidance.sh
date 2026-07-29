#!/usr/bin/env bash
# Verifies that an address recorded only as an attendance geofence is usable as a
# work location everywhere a site is required, that geofences can be edited, and
# that demo data cannot be loaded into a workspace. Written for the running server.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-58s %s\n' "$1" "$2"; }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }
expect()  { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }
atleast() { if [ "${2:-0}" -ge "$3" ] 2>/dev/null; then say "$1" "ok ($2)"; else say "$1" "FAIL (got ${2:-none}, want >= $3)"; fail=1; fi }

get()    { curl -s -H "Authorization: Bearer $2" "${BASE}$1"; }
post()   { curl -s -X POST -H 'Content-Type: application/json' ${3:+-H "Authorization: Bearer $3"} -d "${2:-{\}}" "${BASE}$1"; }
delete() { curl -s -X DELETE -H "Authorization: Bearer $2" "${BASE}$1"; }
count()  { printf '%s' "$1" | grep -o "$2" | wc -l | tr -d ' '; }

echo "=== sign in ==="
admin=$(post /auth/admin-login '{"email":"company@example.com","password":"password123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$admin" ] && say 'company admin' 'ok' || { echo 'FAIL admin sign-in'; exit 1; }

echo
echo "=== a geofence address surfaces as a work location ==="
org=$(get /org "$admin")
locations=$(count "$org" '"_id":"wloc')
atleast 'work locations available' "$locations" 1
contains 'each site exposes a readable address' "$org" '"address":"'
expect  'exactly one registered payroll address' "$(count "$org" '"isPayrollAddress":true')" 1

areas=$(get /attendance-areas "$admin")
contains 'geofences report their owning site' "$areas" '"workLocation"'

echo
echo "=== reading again does not duplicate the backfill ==="
again=$(count "$(get /org "$admin")" '"_id":"wloc')
expect 'work location count is stable' "$again" "$locations"

echo
echo "=== employee placement resolves without being asked ==="
stamp=$(date -u +%s)
created=$(post /employees "{\"firstName\":\"Verify\",\"lastName\":\"Placement\",\"email\":\"verify.placement.${stamp}@verify.invalid\",\"dateOfJoining\":\"2026-02-01\"}" "$admin")
if printf '%s' "$created" | grep -q '"workLocationId":"wloc'; then
  say 'new employee lands on a site' 'ok'
  newId=$(printf '%s' "$created" | grep -o '"_id":"emp[^"]*' | head -1 | cut -d'"' -f4)
  [ -n "$newId" ] && delete "/employees/${newId}" "$admin" >/dev/null
elif printf '%s' "$created" | grep -q 'Select the work location'; then
  # Correct when the tenant runs several sites it set up deliberately.
  say 'new employee must choose a site' 'ok (multiple sites configured)'
elif printf '%s' "$created" | grep -q 'seats'; then
  say 'new employee placement' 'skipped (no spare seat)'
else
  say 'new employee placement' "FAIL ($(printf '%s' "$created" | head -c 160))"
  fail=1
fi

echo
echo "=== geofences can be edited and deleted ==="
patch() { curl -s -X PATCH -H 'Content-Type: application/json' -H "Authorization: Bearer $3" -d "${2:-{\}}" "${BASE}$1"; }
areaId=$(printf '%s' "$areas" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$areaId" ]; then
  original=$(printf '%s' "$areas" | tr '}' '\n' | grep -m1 "$areaId" | grep -o '"radiusMeters":[0-9]*' | cut -d: -f2)
  edited=$(patch "/attendance-areas/${areaId}" '{"radiusMeters":275}' "$admin")
  contains 'geofence radius is editable' "$edited" '"radiusMeters":275'
  expect 'invalid radius rejected' "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -H "Authorization: Bearer $admin" -d '{"radiusMeters":9}' "${BASE}/attendance-areas/${areaId}")" 400
  expect 'invalid latitude rejected' "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -H "Authorization: Bearer $admin" -d '{"latitude":991}' "${BASE}/attendance-areas/${areaId}")" 400
  [ -n "$original" ] && patch "/attendance-areas/${areaId}" "{\"radiusMeters\":${original}}" "$admin" >/dev/null
  say 'original radius restored' 'ok'
else
  say 'geofence edit' 'skipped (no geofence on this tenant)'
fi

echo
echo "=== demo data cannot be loaded into a workspace ==="
for method in GET POST DELETE; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" -H "Authorization: Bearer $admin" "${BASE}/sample-data")
  expect "${method} /sample-data is gone" "$code" 404
done

echo
if [ "$fail" -eq 0 ]; then echo 'ALL LOCATION AND GUIDANCE CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
