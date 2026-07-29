#!/usr/bin/env bash
# Reports whether any records tagged as demo data are left in the live data file.
#
# The feature that created them has been removed. This is kept as a guard: if a
# tenant's workspace ever shows rows labelled "sample", run this to find out
# which tenant holds them, then delete them through the normal screens.
set -uo pipefail

DB="${1:-/home/ubuntu/apps/qhr-attendance/attendance-mobile/Backend/data/db.json}"

if [ ! -f "$DB" ]; then
  echo "data file not found: $DB"
  exit 1
fi

count=$(grep -o '"isSample": *true' "$DB" | wc -l | tr -d ' ')
echo "demo-tagged records in the data file: ${count}"

if [ "$count" != "0" ]; then
  echo
  echo 'tenants holding them:'
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const tally = new Map();
    const bump = (id, key, n) => {
      if (!n) return;
      const row = tally.get(id) || {};
      row[key] = (row[key] || 0) + n;
      tally.set(id, row);
    };
    for (const company of data.companies || []) {
      const label = `${company.name} (${company.code})`;
      for (const key of ["departments", "designations", "workLocations", "holidays", "calendarEvents", "attendanceAreas"]) {
        bump(label, key, (company[key] || []).filter((item) => item.isSample).length);
      }
    }
    for (const employee of data.employees || []) {
      if (!employee.isSample) continue;
      const company = (data.companies || []).find((item) => item._id === employee.companyId);
      bump(company ? `${company.name} (${company.code})` : employee.companyId, "employees", 1);
    }
    for (const [label, row] of tally) {
      console.log(`  ${label}: ${Object.entries(row).map(([k, v]) => `${v} ${k}`).join(", ")}`);
    }
  ' "$DB"
  echo
  echo 'RESIDUE PRESENT: delete these records through Organisation, Employees and Calendar'
  exit 1
fi

echo 'CLEAN: no demo records in any tenant'
exit 0
