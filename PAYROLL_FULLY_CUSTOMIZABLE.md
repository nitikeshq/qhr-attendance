# ✅ Payroll System - Fully Customizable

## 🎯 Final Implementation

### Key Principle
**COMPLETE FLEXIBILITY** - Admins manually configure EVERY component they need. No pre-defined earnings or deductions.

---

## What Changed

### ❌ OLD System (Auto-Calculated)
```
✓ Basic: 50% auto-calculated
✓ HRA: 40% auto-calculated  
✓ Conveyance: Pre-defined field
✓ Special Allowance: Auto-balance
```

### ✅ NEW System (Fully Manual)
```
□ Basic & HRA formulas: Configurable (company settings)
□ Earnings: Empty list - admin adds what they need
□ Deductions: Empty list - admin adds what they need
□ Every field: Manually configured
```

---

## System Architecture

### 1. Company-Level Configuration

Admins configure payroll settings at company level:

```javascript
POST /api/v1/payroll/settings
{
  "salaryTemplate": {
    "basic": { 
      "calculation": "percentage_of_gross",  // or "fixed"
      "value": 50  // 50% or fixed amount
    },
    "hra": { 
      "calculation": "percentage_of_basic",  // or "percentage_of_gross" or "fixed"
      "value": 40  // 40% or fixed amount
    }
  },
  "earnings": [
    // Admin adds custom earnings they want available
    {
      "code": "conveyance",
      "name": "Conveyance Allowance",
      "calculation": "fixed",  // or "percentage_of_gross", "percentage_of_basic"
      "defaultValue": 0,
      "taxable": true,
      "partOfPfWage": false,
      "partOfEsiWage": true,
      "prorate": true,
      "active": false  // Not active by default - employee-specific
    },
    {
      "code": "mobile_allowance",
      "name": "Mobile Allowance",
      "calculation": "fixed",
      "defaultValue": 0,
      "taxable": true,
      "active": false
    }
  ],
  "deductions": [
    {
      "code": "insurance",
      "name": "Insurance Premium",
      "calculation": "fixed",
      "defaultValue": 0,
      "active": false
    }
  ]
}
```

### 2. Employee-Level Salary Structure

For each employee, admin manually adds components:

```javascript
PUT /api/v1/payroll/salary-structures/{employeeId}
{
  "payrollEnabled": true,
  "monthlyGrossTarget": 20000,
  "earnings": [
    // Admin selects and configures each earning
    {
      "code": "conveyance",
      "name": "Conveyance Allowance",
      "calculation": "fixed",
      "value": 1600,  // Admin enters this
      "active": true
    },
    {
      "code": "mobile_allowance",
      "name": "Mobile Allowance",
      "calculation": "fixed",
      "value": 500,
      "active": true
    },
    {
      "code": "special_allowance",
      "name": "Special Allowance",
      "calculation": "fixed",
      "value": 3900,
      "active": true
    }
  ],
  "deductions": [
    {
      "code": "insurance",
      "name": "Insurance Premium",
      "calculation": "fixed",
      "value": 500,
      "active": true
    }
  ]
}
```

**Result:**
```
Basic:              ₹10,000 (50% of ₹20,000 - from formula)
HRA:                ₹4,000  (40% of ₹10,000 - from formula)
Conveyance:         ₹1,600  (manually added)
Mobile:             ₹500    (manually added)
Special Allowance:  ₹3,900  (manually added)
─────────────────────────────────────────
Gross:              ₹20,000

Deductions:
Insurance:          ₹500    (manually added)
```

---

## UI/UX Flow

### Company Settings Screen

```
┌─ Payroll Settings ─────────────────────────┐
│                                             │
│  Default Salary Formula:                    │
│  ┌──────────────────────────────────────┐  │
│  │ Basic Calculation: [% of Gross ▼] 50 │  │
│  │ HRA Calculation:   [% of Basic ▼] 40  │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Available Earnings:                        │
│  ┌──────────────────────────────────────┐  │
│  │ [+ Add Earning Component]            │  │
│  │                                       │  │
│  │ □ Conveyance Allowance (Fixed)       │  │
│  │ □ Mobile Allowance (Fixed)           │  │
│  │ □ Internet Allowance (Fixed)         │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Available Deductions:                      │
│  ┌──────────────────────────────────────┐  │
│  │ [+ Add Deduction Component]          │  │
│  │                                       │  │
│  │ □ Insurance Premium (Fixed)          │  │
│  │ □ Meal Deduction (Fixed)             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [Save Settings]                            │
└─────────────────────────────────────────────┘
```

### Employee Salary Structure Screen

```
┌─ Salary Structure: John Doe ───────────────┐
│                                             │
│  Monthly Gross Target: [20000]              │
│                                             │
│  Auto-Calculated (from company formula):    │
│  ├─ Basic:  ₹10,000 (50% of gross)         │
│  └─ HRA:    ₹4,000  (40% of basic)         │
│                                             │
│  Add Earnings:                              │
│  ┌──────────────────────────────────────┐  │
│  │ [+ Add Earning]                      │  │
│  │                                       │  │
│  │ ✓ Conveyance:      [1600]  [×]       │  │
│  │ ✓ Mobile:          [500]   [×]       │  │
│  │ ✓ Special Allow.:  [3900]  [×]       │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Add Deductions:                            │
│  ┌──────────────────────────────────────┐  │
│  │ [+ Add Deduction]                    │  │
│  │                                       │  │
│  │ ✓ Insurance:       [500]   [×]       │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Current Total: ₹20,000                     │
│                                             │
│  [Save Structure]                           │
└─────────────────────────────────────────────┘
```

---

## Benefits

### ✅ Complete Flexibility
- Admins decide which components they need
- No forced default fields
- Each company configures their own structure

### ✅ Field Organization
- Add/remove fields dynamically
- Drag and drop to reorder (frontend feature)
- Show/hide based on employee type

### ✅ Clean UI
- Only shows components admin has configured
- No clutter with unused fields
- Customizable per employee

### ✅ Multi-Company Support
- Each company defines their own components
- Different industries have different needs
- Full customization per tenant

---

## Implementation Details

### Backend Changes

**File**: `attendance-mobile/Backend/src/utils/payroll.js`

1. **Removed default earnings**:
```javascript
earnings: [
  // Empty - admins add what they need
],
```

2. **Special allowance NOT auto-calculated**:
```javascript
// Only use if explicitly provided
const specialAllowance = input.specialAllowance !== undefined 
  ? amount(input.specialAllowance) 
  : 0;
```

3. **Allow earnings in template mode**:
```javascript
// Allow customizing even in template mode
const suppliedEarnings = Array.isArray(input.earnings) ? input.earnings : [];
```

### Frontend Considerations

**File**: `admin-panel/src/app/components/PayrollWorkspace.tsx`

Features needed:
1. **"Add Earning" button** - Opens modal to select from available earnings
2. **"Add Deduction" button** - Opens modal to select from available deductions
3. **Drag-and-drop** - Reorder components
4. **Delete button** - Remove component
5. **Value input** - For each active component
6. **Preview** - Show calculated totals

---

## API Examples

### 1. Configure Company Earnings

```bash
PATCH /api/v1/payroll/settings
Authorization: Bearer {admin_token}

{
  "earnings": [
    {
      "code": "conveyance",
      "name": "Conveyance Allowance",
      "calculation": "fixed",
      "defaultValue": 0,
      "taxable": true,
      "partOfPfWage": false,
      "partOfEsiWage": true,
      "prorate": true,
      "active": false
    },
    {
      "code": "special_allowance",
      "name": "Special Allowance",
      "calculation": "fixed",
      "defaultValue": 0,
      "taxable": true,
      "partOfPfWage": false,
      "partOfEsiWage": true,
      "prorate": true,
      "active": false
    }
  ]
}
```

### 2. Create Employee Salary with Custom Components

```bash
PUT /api/v1/payroll/salary-structures/EMP001
Authorization: Bearer {admin_token}

{
  "payrollEnabled": true,
  "monthlyGrossTarget": 25000,
  "salaryMode": "company_template",
  "earnings": [
    {
      "code": "conveyance",
      "calculation": "fixed",
      "value": 1600,
      "active": true
    },
    {
      "code": "special_allowance",
      "calculation": "fixed",
      "value": 6400,
      "active": true
    }
  ],
  "deductions": []
}
```

**Response:**
```json
{
  "data": {
    "salaryStructure": {
      "structure": {
        "basic": 12500,
        "hra": 5000,
        "specialAllowance": 0,
        "earnings": [
          {
            "code": "conveyance",
            "value": 1600,
            "active": true
          },
          {
            "code": "special_allowance",
            "value": 6400,
            "active": true
          }
        ],
        "monthlyGross": 25500,
        "preview": {
          "earnings": [
            { "code": "basic", "amount": 12500 },
            { "code": "hra", "amount": 5000 },
            { "code": "conveyance", "amount": 1600 },
            { "code": "special_allowance", "amount": 6400 }
          ]
        }
      }
    }
  }
}
```

---

## Migration Guide

### For Existing Companies

1. **Review current earnings** - Check what's in their settings
2. **Add missing components** - Conveyance, mobile, etc.
3. **Update employee structures** - Add earnings to each employee
4. **Test payroll generation** - Verify calculations are correct

### For New Companies

1. **Configure company settings** first
2. **Define available earnings/deductions**
3. **Create employee salary structures**
4. **Add components per employee as needed**

---

## Testing

✅ **All tests passing: 16/16**

```
# tests 16
# pass 16
# fail 0
```

**Test Coverage:**
- Empty default earnings list
- Manual addition of earnings
- Special allowance not auto-calculated
- Company settings customization
- Employee salary with custom components
- Payslip generation with manual components

---

## Files Changed

1. ✅ `attendance-mobile/Backend/src/utils/payroll.js`
2. ✅ `attendance-mobile/Backend/test/api.test.js`
3. ✅ Documentation files created

---

## Summary

### What Admins Must Do:

1. **Company Level**:
   - Configure Basic/HRA formulas
   - Define available earnings (conveyance, mobile, special, etc.)
   - Define available deductions

2. **Employee Level**:
   - Enter monthly gross target
   - Manually add each earning component they want
   - Enter value for each component
   - Manually add deductions if needed

### What System Does:

- Calculates Basic and HRA from formulas
- Lists available components from company settings
- Sums up all active components
- Generates payslip with configured structure

---

*Status: ✅ COMPLETE*  
*Tests: 16/16 passing*  
*System: Fully Customizable*
