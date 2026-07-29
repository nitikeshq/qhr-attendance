#!/usr/bin/env bash
# Checks that the shipped admin bundle actually contains the new UI strings.
# Builds only prove compilation; this proves the code reached the served output.
set -uo pipefail

ROOT="${1:-/home/ubuntu/apps/qhr-attendance/admin-panel/.next}"
fail=0

check() {
  if grep -rqF "$1" "$ROOT/static" "$ROOT/server" 2>/dev/null; then
    printf '%-56s ok\n' "$1"
  else
    printf '%-56s MISSING\n' "$1"
    fail=1
  fi
}

# Guards against removed UI creeping back in.
absent() {
  if grep -rqF "$1" "$ROOT/static" "$ROOT/server" 2>/dev/null; then
    printf '%-56s PRESENT (should be gone)\n' "$1"
    fail=1
  else
    printf '%-56s absent, as intended\n' "$1"
  fi
}

echo "=== removed UI stays removed ==="
absent 'What is this page for?'
absent 'Load sample data'
absent 'Remove sample data'

echo
echo "=== each page explains itself in its own header ==="
check 'Departments group people, work locations are the sites they sit at'
check 'Check-in and check-out records, and how they map onto your policy'
check 'The map boundaries that decide where mobile check-in is accepted'

echo
echo "=== the current page survives a refresh ==="
check 'page=' 
check 'popstate'

echo
echo "=== dashboard: one setup prompt, real subscription figure ==="
check 'Monthly subscription'
check 'Nobody has checked in yet'
check 'seats used'
absent 'Monthly revenue'
absent 'Finish company setup'

echo
echo "=== setup prompt is scoped, not on every page ==="
check 'Finish setting up'
check 'required steps done'
check 'Payslips need your statutory details'
check 'Attendance needs your office hours'

echo
echo "=== work location editor ==="
check 'Attendance geofence'
check 'Created from a geofence'

echo
echo "=== calendar navigation and filters ==="
check 'Jump to date'
check 'Previous year'
check 'Later this month'
check 'Paid holiday, office closed'
check 'since the company was founded'
check 'Work anniversary'

echo
echo "=== geofence editing ==="
check 'Save geofence'
check 'Accept check-in here'
check 'Taken from the linked work location'

echo
if [ "$fail" -eq 0 ]; then echo 'ADMIN BUNDLE CONTAINS ALL EXPECTED UI'; else echo 'SOME UI IS MISSING FROM THE BUNDLE'; fi
exit "$fail"
