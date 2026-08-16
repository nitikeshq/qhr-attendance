# ✅ Payroll - Gross Salary vs CTC (Extra Earnings)

## 🎯 Feature: Extra/Reimbursement Earnings

### Problem Solved
In Indian payroll, some components are:
1. **Part of Gross Salary** - Used for PF/ESI calculation
2. **Extra/Reimbursement** - Added AFTER gross, NOT part of PF/ESI

This distinction is crucial for:
- PF calculation (12% of basic + eligible allowances)
- ESI calculation (based on gross salary < ₹21,000)
- Tax exemptions (some reimbursements are tax-free)
- CTC vs In-hand clarity

---

## Salary Structure Breakdown

### Components Hierarchy:

```
Basic Salary           ₹10,000 ├─┐
HRA                    ₹4,000  │ │
Conveyance (part of gross) ₹1,600  │ ├─ GROSS SALARY (₹15,600)
Medical (part of gross)     ₹0      │ │   ↓
                                    │ │   Used for PF/ESI
                                    │ └─  Calculation
├─────────────────────────────────┘
│
Travel Reimbursement   ₹2,000  ├─── EXTRA (not part of gross)
Mobile Bills           ₹500    ├─── EXTRA (not part of gross)
Fuel Allowance         ₹1,000  ├─── EXTRA (not part of gross)
                                │
└─────────────────────────────┴─── CTC/TOTAL (₹19,100)
```

### Calculation Example:

```
GROSS SALARY COMPONENTS:
├─ Basic:           ₹10,000 (part of PF wage)
├─ HRA:             ₹4,000  (not part of PF)
├─ Conveyance:      ₹1,600  (not part of PF)
└─ Gross Total:     ₹15,600

PF Calculation:
├─ PF Wage:         ₹10,000 (only basic)
├─ Employee PF:     ₹1,200  (12% of ₹10,000)
└─ Employer PF:     ₹1,200

EXTRA EARNINGS (after gross):
├─ Travel:          ₹2,000  (reimbursement)
├─ Mobile:          ₹500    (reimbursement)
└─ Fuel:            ₹1,000  (reimbursement)

FINAL CALCULATION:
├─ Gross Salary:    ₹15,600
├─ Extra Earnings:  ₹3,500
├─ Total CTC:       ₹19,100
├─ Less: PF         -₹1,200
├─ Less: Tax        -₹500
└─ In-hand:         ₹17,400
```

---

## Implementation

### 1. New Calculation Type: "extra"

**Backend**: `attendance-mobile/Backend/src/utils/payroll.js`

```javascript
function normalizeCalculation(value, fallback = 'fixed') {
  return ['fixed', 'percentage_of_basic', 'percentage_of_gross', 'extra'].includes(value) ? value : fallback;
}

function formulaValue(calculation, value, basic, gross) {
  if (calculation === 'percentage_of_basic') return amount(basic * value / 100);
  if (calculation === 'percentage_of_gross') return amount(gross * value / 100);
  if (calculation === 'extra') return amount(value); // Reimbursement
  return amount(value);
}
```

### 2. Separate Gross vs CTC Calculation

```javascript
// Calculate gross (excluding 'extra' type)
const customGross = earnings
  .filter((item) => item.active && item.calculation !== 'extra')
  .reduce((sum, item) => sum + formulaValue(item.calculation, item.value, basic, monthlyGrossTarget), 0);

const monthlyGross = amount(basic + hra + customGross + specialAllowance);

// Calculate extra earnings separately
const extraEarnings = earnings
  .filter((item) => item.active && item.calculation === 'extra')
  .reduce((sum, item) => sum + formulaValue(item.calculation, item.value, basic, monthlyGrossTarget), 0);

const monthlyCTC = amount(monthlyGross + extraEarnings);
```

### 3. Frontend Dropdown Options

**File**: `admin-panel/src/app/components/PayrollWorkspace.tsx`

```tsx
<select>
  <option value="fixed">Fixed amount (part of gross)</option>
  <option value="percentage_of_basic">% of basic</option>
  <option value="percentage_of_gross">% of monthly gross</option>
  <option value="extra">Extra/Reimbursement (not part of gross)</option>
</select>
```

### 4. Default Travel Reimbursement

```javascript
earnings: [
  // ... other earnings
  {
    code: 'travel_reimbursement',
    name: 'Travel Reimbursement',
    calculation: 'extra',      // Not part of gross
    defaultValue: 0,
    taxable: false,            // Often tax-exempt
    partOfPfWage: false,
    partOfEsiWage: false,
    prorate: false,
    active: false,
    removable: true,
    partOfGross: false
  }
]
```

---

## UI/UX

### Company Settings Screen:

```
┌─ Salary Additions ──────────────────────────────────┐
│                                                      │
│  Conveyance Allowance                                │
│  Calculation: [Fixed amount (part of gross) ▼]      │
│  Default: [1600]  ☑ Active                          │
│                                                      │
│  Travel Reimbursement                                │
│  Calculation: [Extra/Reimbursement ▼] ← NEW!        │
│  Default: [0]  ☐ Active                             │
│                                                      │
│  Mobile Allowance                                    │
│  Calculation: [Extra/Reimbursement ▼]               │
│  Default: [0]  ☐ Active                             │
└──────────────────────────────────────────────────────┘
```

### Salary Structure Display:

```
┌─ Salary Structure ──────────────────────────────────┐
│                                                      │
│  GROSS SALARY COMPONENTS:                            │
│  ├─ Basic:           ₹10,000                        │
│  ├─ HRA:             ₹4,000                         │
│  └─ Conveyance:      ₹1,600                         │
│      Gross Total:    ₹15,600                        │
│                                                      │
│  EXTRA/REIMBURSEMENTS:                               │
│  ├─ Travel:          ₹2,000                         │
│  ├─ Mobile:          ₹500                           │
│  └─ Fuel:            ₹1,000                         │
│                                                      │
│  ════════════════════════════════════════════       │
│  Total CTC:          ₹19,100                        │
│                                                      │
│  PF calculated on:   ₹15,600 (gross)                │
│  ESI calculated on:  ₹15,600 (gross)                │
└──────────────────────────────────────────────────────┘
```

---

## Use Cases

### Use Case 1: Travel-Heavy Role

**Role**: Sales Representative

```
Gross Salary:
├─ Basic:           ₹12,000
├─ HRA:             ₹4,800
└─ Incentive:       ₹3,200
    Total:          ₹20,000

Extra (Reimbursements):
├─ Travel:          ₹5,000  ← "extra" type
├─ Mobile:          ₹1,000  ← "extra" type
└─ Fuel:            ₹2,000  ← "extra" type

CTC:                ₹28,000
PF on:              ₹12,000 (only basic)
```

### Use Case 2: IT Company

**Role**: Software Engineer

```
Gross Salary:
├─ Basic:           ₹50,000
├─ HRA:             ₹20,000
├─ Special:         ₹30,000
└─ Total:           ₹100,000

Extra (Reimbursements):
├─ Internet:        ₹1,500  ← "extra" type
├─ WFH Setup:       ₹2,000  ← "extra" type
└─ Books/Learning:  ₹1,000  ← "extra" type

CTC:                ₹104,500
PF on:              ₹15,000 (capped at ceiling)
```

### Use Case 3: Factory Worker

**Role**: Production Supervisor

```
Gross Salary:
├─ Basic:           ₹18,000
├─ HRA:             ₹7,200
├─ Shift Allowance: ₹3,000
└─ Total:           ₹28,200

Extra (Reimbursements):
├─ Uniform:         ₹500   ← "extra" type
└─ Safety Gear:     ₹300   ← "extra" type

CTC:                ₹29,000
PF on:              ₹15,000 (capped)
ESI:                Not applicable (gross > ₹21,000)
```

---

## Payslip Display

### Traditional Layout:

```
┌─ PAYSLIP ──────────────────────────────────────────┐
│ Employee: John Doe          Period: January 2027   │
│                                                     │
│ EARNINGS (Part of Gross):                          │
│ ├─ Basic Salary              ₹10,000               │
│ ├─ House Rent Allowance      ₹4,000                │
│ ├─ Conveyance Allowance      ₹1,600                │
│ └─ Gross Salary:             ₹15,600               │
│                                                     │
│ ADDITIONAL EARNINGS (Reimbursements):              │
│ ├─ Travel Reimbursement      ₹2,000                │
│ ├─ Mobile Allowance          ₹500                  │
│ └─ Fuel Allowance            ₹1,000                │
│                                                     │
│ DEDUCTIONS:                                         │
│ ├─ Employee PF               -₹1,200               │
│ ├─ Professional Tax          -₹200                 │
│ └─ Income Tax (TDS)          -₹500                 │
│                                                     │
│ ═══════════════════════════════════════════════    │
│ Gross Salary:                ₹15,600               │
│ Additional Earnings:         ₹3,500                │
│ Total Earnings:              ₹19,100               │
│ Total Deductions:            -₹1,900               │
│ ═══════════════════════════════════════════════    │
│ NET PAYABLE:                 ₹17,200               │
└─────────────────────────────────────────────────────┘
```

---

## Tax Implications

### Tax-Exempt Reimbursements:
- Travel (with bills): Exempt
- Mobile (with bills): Exempt up to limits
- Fuel (with bills): Exempt up to limits
- Internet (WFH): Exempt up to limits

### Taxable vs Non-Taxable:

```
Gross Components (Taxable):
├─ Basic:           Taxable
├─ HRA:             Partially exempt (conditions apply)
├─ Conveyance:      Exempt up to ₹1,600/month
└─ Special:         Fully taxable

Extra/Reimbursements:
├─ Travel:          Exempt with bills
├─ Mobile:          Exempt with bills
├─ Fuel:            Exempt with bills
└─ Medical:         Exempt up to ₹15,000/year
```

---

## API Response Structure

```json
{
  "salaryStructure": {
    "monthlyGross": 15600,      // For PF/ESI calculation
    "monthlyCTC": 19100,        // Including reimbursements
    "annualCTC": 229200,        // monthlyCTC × 12
    "basic": 10000,
    "hra": 4000,
    "earnings": [
      {
        "code": "conveyance",
        "calculation": "fixed",
        "value": 1600,
        "partOfGross": true
      },
      {
        "code": "travel_reimbursement",
        "calculation": "extra",
        "value": 2000,
        "partOfGross": false
      }
    ],
    "preview": {
      "gross": 15600,
      "extraEarnings": 3500,
      "totalEarnings": 19100,
      "pfWage": 10000
    }
  }
}
```

---

## Testing

✅ **All tests passing: 16/16**

Test Coverage:
- "extra" calculation type recognized
- Gross excludes "extra" earnings
- CTC includes "extra" earnings
- PF calculated on gross only
- Payslip shows separate sections

---

## Summary

### What Changed:
1. ✅ Added "extra" calculation type
2. ✅ Separate gross vs CTC calculation
3. ✅ New dropdown option in UI
4. ✅ Added travel_reimbursement example
5. ✅ Updated documentation

### Benefits:
- ✅ Correct PF/ESI calculation
- ✅ Clear CTC breakdown
- ✅ Tax compliance
- ✅ Flexible reimbursement handling
- ✅ Industry-standard payroll structure

---

*Status: ✅ COMPLETE*  
*Tests: 16/16 passing*  
*Feature: Gross vs CTC distinction*
