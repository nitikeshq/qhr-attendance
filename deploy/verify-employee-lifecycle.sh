#!/usr/bin/env bash
# End-to-end check of the reported bugs on the running server: registration
# prefill, profile read-back, department availability, and employee creation
# completing with a one-time password. Creates a throwaway tenant.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0
suffix=$(date -u +%H%M%S)
code="VER${suffix}"
email="ver.${suffix}@verify.test"
password='Str0ng!Passw0rd'

say() { printf '%-56s %s\n' "$1" "$2"; }
expect() { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }

post() { curl -s -X POST -H 'Content-Type: application/json' ${3:+-H "Authorization: Bearer $3"} -d "$2" "${BASE}$1"; }
get()  { curl -s -H "Authorization: Bearer $2" "${BASE}$1"; }

echo "=== register a throwaway tenant ==="
reg=$(post /companies/register "{\"companyName\":\"Verify Co ${suffix}\",\"companyCode\":\"${code}\",\"industry\":\"Retail\",\"address\":\"12 MG Road\",\"city\":\"Bengaluru\",\"state\":\"Karnataka\",\"postalCode\":\"560001\",\"adminFirstName\":\"Ver\",\"adminLastName\":\"Admin\",\"adminEmail\":\"${email}\",\"adminPhone\":\"+91 90000 00000\",\"adminPassword\":\"${password}\",\"termsAccepted\":true}")
vcode=$(printf '%s' "$reg" | grep -o '"verificationCode":"[^"]*' | cut -d'"' -f4)
if [ -z "$vcode" ]; then echo "FAIL registration: $reg"; exit 1; fi
say 'register' 'ok'
post /companies/verify-email "{\"companyCode\":\"${code}\",\"verificationCode\":\"${vcode}\"}" >/dev/null
token=$(post /auth/admin-login "{\"companyCode\":\"${code}\",\"email\":\"${email}\",\"password\":\"${password}\"}" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
[ -n "$token" ] && say 'admin login' 'ok' || { echo 'FAIL login'; exit 1; }

echo
echo "=== ISSUE 1: registration prefills the setup checklist ==="
snap=$(get /onboarding "$token")
contains 'company name prefilled'      "$snap" "Verify Co ${suffix}"
contains 'registered address prefilled' "$snap" '12 MG Road'
contains 'city prefilled'              "$snap" 'Bengaluru'
contains 'industry prefilled'          "$snap" 'Retail'
contains 'head office seeded'          "$snap" '"isPayrollAddress":true'

echo
echo "=== ISSUE 2: saved company profile reads back ==="
curl -s -o /dev/null -X PATCH -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -d '{"name":"Verify Renamed","email":"'"${email}"'","phone":"+91 91111 11111","registeredAddress":"99 New Street","city":"Pune","state":"Maharashtra","pincode":"411045","industry":"Manufacturing","timezone":"Asia/Kolkata","officeStart":"09:30","officeEnd":"18:30"}' \
  "${BASE}/onboarding/company_profile"
snap=$(get /onboarding "$token")
contains 're-read new name'    "$snap" 'Verify Renamed'
contains 're-read new city'    "$snap" 'Pune'
contains 're-read new address' "$snap" '99 New Street'

echo
echo "=== ISSUE 3/4: departments reach designations and employees ==="
org=$(curl -s -X PATCH -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -d '{"departments":[{"name":"Engineering","code":"ENGV","status":"active"}],"designations":[{"name":"Engineer","code":"ENGRV","level":1,"departmentRef":"Engineering","status":"active"}]}' \
  "${BASE}/onboarding/org_structure")
contains 'org structure saved' "$org" '"message"'
snap=$(get /onboarding "$token")
contains 'department listed'  "$snap" '"name":"Engineering"'
contains 'designation listed' "$snap" '"name":"Engineer"'
orgList=$(get /org "$token")
contains '/org exposes departments' "$orgList" '"name":"Engineering"'

echo
echo "=== ISSUE 5: employee creation completes ==="
start=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
emp=$(post /employees '{"employeeId":"VER001","firstName":"Ver","lastName":"Employee","email":"emp.'"${suffix}"'@verify.test","phone":"+91 90000 00001","addressLine1":"4 Baner Road","city":"Pune","state":"Maharashtra","pincode":"411045","permanentSameAsCurrent":true,"emergencyContactName":"Asha Rao"}' "$token")
finish=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
contains 'employee created'                "$emp" '"employee"'
contains 'one-time password returned'      "$emp" '"oneTimePassword"'
contains 'forced change on first login'    "$emp" '"mustChangeOnFirstLogin":true'
contains 'work location auto-assigned'     "$emp" '"workLocationId":"wloc'
contains 'address captured'                "$emp" '"city":"Pune"'
say "completed in $((finish - start))ms" 'ok'

otp=$(printf '%s' "$emp" | grep -o '"oneTimePassword":"[^"]*' | cut -d'"' -f4)
signin=$(post /auth/login "{\"companyCode\":\"${code}\",\"employeeId\":\"VER001\",\"password\":\"${otp}\"}")
contains 'employee signs in with ID + password' "$signin" '"accessToken"'
contains 'sign-in demands a password change'    "$signin" '"requiresPasswordChange":true'

empId=$(printf '%s' "$emp" | grep -o '"_id":"emp[^"]*' | head -1 | cut -d'"' -f4)
reset=$(post "/employees/${empId}/reset-password" '{}' "$token")
contains 'admin can reset the password' "$reset" '"oneTimePassword"'
stale=$(post /auth/login "{\"companyCode\":\"${code}\",\"employeeId\":\"VER001\",\"password\":\"${otp}\"}")
if printf '%s' "$stale" | grep -q '"accessToken"'; then say 'old password revoked' 'FAIL still valid'; fail=1; else say 'old password revoked' 'ok'; fi

echo
if [ "$fail" -eq 0 ]; then echo 'ALL EMPLOYEE LIFECYCLE CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
echo "throwaway tenant: ${code}"
exit "$fail"
