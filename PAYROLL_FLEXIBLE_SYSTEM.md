# ✅ Payroll - Flexible Component System

## 🎯 Final Design

### Core Principle
**Flexible Defaults with Full Control** - System provides default options (Basic, HRA, Conveyance, etc.), but users can:
- ✅ Remove any default field
- ✅ Re-add removed fields
- ✅ Add custom fields
- ✅ Reorder/organize all fields
- ✅ Control which fields are active

---

## System Architecture

### 1. Default Salary Formula Section

**Defaults Provided:**
```
├─ Basic Salary (50% of gross)
├─ HRA (40% of basic)
└─ Conveyance Allowance (fixed amount)
```

**User Can:**
- Remove Basic (make it custom earning instead)
- Remove HRA
- Change formulas (% to fixed, or vice versa)
- Change percentages/values
- Cannot delete completely (just disable)

### 2. Salary Additions Section

**Default Options Provided:**
```
Available Earnings:
├─ Conveyance Allowance (inactive by default)
├─ Medical Allowance (inactive by default)
├─ Special Allowance (inactive by default)
└─ [+ Add Custom Earning]
```

**User Can:**
- Activate any default earning
- Remove any default earning from list
- Add new custom earnings
- Modify calculation type
- Reorder list

### 3. Deductions Section

**Default Options Provided:**
```
Available Deductions:
├─ Professional Tax (inactive by default)
├─ Loan Recovery (inactive by default)
└─ [+ Add Custom Deduction]
```

**User Can:**
- Activate any default deduction
- Remove any default deduction from list
- Add new custom deductions
- Reorder list

### 4. Statutory Configuration

**Default Options:**
```
├─ PF (Provident Fund)
├─ ESI (Employee State Insurance)
├─ Professional Tax
├─ Gratuity
└─ TDS
```

**User Can:**
- Enable/disable each component
- Configure rates
- Add custom statutory components
- Cannot delete (regulatory requirement)

---

## UI/UX Design

### Company Settings - Default Salary Formula

```
┌─ Default Salary Formula ────────────────────────────┐
│                                                      │
│  Components (user can remove/modify):                │
│  ┌────────────────────────────────────────────────┐ │
│  │ ☑ Basic Salary                                 │ │
│  │    Calculation: [% of Gross ▼]  Value: [50]   │ │
│  │    [Remove]  [↑] [↓]                           │ │
│  │                                                 │ │
│  │ ☑ HRA (House Rent Allowance)                   │ │
│  │    Calculation: [% of Basic ▼]  Value: [40]   │ │
│  │    [Remove]  [↑] [↓]                           │ │
│  │                                                 │ │
│  │ ☐ Conveyance Allowance                         │ │
│  │    Calculation: [Fixed ▼]  Value: [0]         │ │
│  │    [Remove]  [↑] [↓]                           │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [+ Re-add Removed Component]                        │
│  [+ Add Custom Component]                            │
│                                                      │
│  [Save Settings]                                     │
└──────────────────────────────────────────────────────┘
```

### Company Settings - Salary Additions

```
┌─ Salary Additions (Earnings) ───────────────────────┐
│                                                      │
│  Available Components:                               │
│  ┌────────────────────────────────────────────────┐ │
│  │ ☐ Conveyance Allowance                         │ │
│  │    Type: Fixed    Default: ₹0                  │ │
│  │    [Edit] [Remove] [↑] [↓]                     │ │
│  │                                                 │ │
│  │ ☐ Medical Allowance                            │ │
│  │    Type: Fixed    Default: ₹0                  │ │
│  │    [Edit] [Remove] [↑] [↓]                     │ │
│  │                                                 │ │
│  │ ☐ Special Allowance                            │ │
│  │    Type: Fixed    Default: ₹0                  │ │
│  │    [Edit] [Remove] [↑] [↓]                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [+ Add Custom Earning]                              │
│                                                      │
│  Note: These are available options. Activate per     │
│  employee as needed.                                 │
│                                                      │
│  [Save Settings]                                     │
└──────────────────────────────────────────────────────┘
```

### Employee Salary Structure

```
┌─ Salary Structure: John Doe ────────────────────────┐
│                                                      │
│  Monthly Gross Target: [20000]                       │
│                                                      │
│  Formula-Based (from company settings):              │
│  ├─ ☑ Basic:  ₹10,000 (50% of gross)               │
│  └─ ☑ HRA:    ₹4,000  (40% of basic)               │
│                                                      │
│  Earnings (select from available):                   │
│  ┌────────────────────────────────────────────────┐ │
│  │ Available:                 Added:               │ │
│  │ □ Conveyance        →      ✓ Conveyance: [1600]│ │
│  │ □ Medical                  ✓ Medical: [1500]   │ │
│  │ □ Special                  ✓ Special: [2900]   │ │
│  │                                                 │ │
│  │ [+ Add from list] [+ Add custom]               │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Deductions:                                         │
│  ┌────────────────────────────────────────────────┐ │
│  │ Available:                 Added:               │ │
│  │ □ Professional Tax  →      (none)              │ │
│  │ □ Loan Recovery                                 │ │
│  │                                                 │ │
│  │ [+ Add from list] [+ Add custom]               │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Current Total: ₹20,000                             │
│                                                      │
│  [Save Structure]                                    │
└──────────────────────────────────────────────────────┘
```

---

## API Structure

### Get Company Settings (with defaults)

```json
GET /api/v1/payroll/settings

Response:
{
  "data": {
    "settings": {
      "salaryTemplate": {
        "basic": {
          "calculation": "percentage_of_gross",
          "value": 50
        },
        "hra": {
          "calculation": "percentage_of_basic",
          "value": 40
        },
        "balanceComponentName": "Special allowance"
      },
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
          "active": false,
          "removable": true
        },
        {
          "code": "medical_allowance",
          "name": "Medical Allowance",
          "calculation": "fixed",
          "defaultValue": 0,
          "taxable": true,
          "active": false,
          "removable": true
        },
        {
          "code": "special_allowance",
          "name": "Special Allowance",
          "calculation": "fixed",
          "defaultValue": 0,
          "taxable": true,
          "active": false,
          "removable": true
        }
      ],
      "deductions": [
        {
          "code": "professional_tax",
          "name": "Professional Tax",
          "calculation": "fixed",
          "defaultValue": 0,
          "prorate": false,
          "active": false,
          "removable": true
        },
        {
          "code": "loan_recovery",
          "name": "Loan Recovery",
          "calculation": "fixed",
          "defaultValue": 0,
          "prorate": true,
          "active": false,
          "removable": true
        }
      ]
    }
  }
}
```

### Update Company Settings (customize/remove/add)

```json
PATCH /api/v1/payroll/settings
{
  "salaryTemplate": {
    "basic": {
      "calculation": "percentage_of_gross",
      "value": 45  // Changed from 50
    },
    "hra": {
      "calculation": "fixed",  // Changed from percentage
      "value": 5000
    }
  },
  "earnings": [
    // Removed medical_allowance
    {
      "code": "conveyance",
      "name": "Conveyance Allowance",
      "calculation": "fixed",
      "defaultValue": 1500,  // Changed default
      "active": false,
      "removable": true
    },
    {
      "code": "special_allowance",
      "name": "Special Allowance",
      "calculation": "fixed",
      "defaultValue": 0,
      "active": false,
      "removable": true
    },
    // Added new custom earning
    {
      "code": "mobile_allowance",
      "name": "Mobile Allowance",
      "calculation": "fixed",
      "defaultValue": 500,
      "taxable": true,
      "active": false,
      "removable": true
    }
  ],
  "deductions": [
    // Removed professional_tax
    {
      "code": "loan_recovery",
      "name": "Loan Recovery",
      "calculation": "fixed",
      "defaultValue": 0,
      "active": false,
      "removable": true
    },
    // Added new custom deduction
    {
      "code": "canteen_charges",
      "name": "Canteen Charges",
      "calculation": "fixed",
      "defaultValue": 0,
      "active": false,
      "removable": true
    }
  ]
}
```

---

## User Workflows

### Scenario 1: Use Defaults As-Is

```
1. Company opens payroll settings
2. Sees defaults: Basic (50%), HRA (40%), Conveyance, Medical, Special
3. Clicks "Save Settings" (no changes)
4. Creates employee salary:
   - Basic: ₹10,000 (auto)
   - HRA: ₹4,000 (auto)
   - Manually adds: Conveyance ₹1,600
```

### Scenario 2: Remove HRA, Add Custom

```
1. Company opens payroll settings
2. Clicks [Remove] next to HRA
3. Clicks [+ Add Custom Component]
4. Adds "Transport Allowance" (fixed, ₹3,000)
5. Clicks "Save Settings"
6. Creates employee salary:
   - Basic: ₹10,000 (auto from formula)
   - Transport: ₹3,000 (manually added)
   - Conveyance: ₹2,000 (manually added)
```

### Scenario 3: Change Basic Formula

```
1. Company opens payroll settings
2. Changes Basic from "% of Gross" to "Fixed"
3. Changes value from 50 to 12000
4. Clicks "Save Settings"
5. Creates employee salary:
   - Basic: ₹12,000 (fixed amount)
   - HRA: ₹4,800 (40% of ₹12,000)
```

### Scenario 4: Re-add Removed Component

```
1. User removed "Medical Allowance"
2. Later wants it back
3. Clicks [+ Re-add Removed Component]
4. Selects "Medical Allowance" from list
5. Component restored with original settings
```

---

## Implementation Details

### Default Components

**File**: `attendance-mobile/Backend/src/utils/payroll.js`

```javascript
earnings: [
  {
    code: 'conveyance',
    name: 'Conveyance Allowance',
    calculation: 'fixed',
    defaultValue: 0,
    taxable: true,
    partOfPfWage: false,
    partOfEsiWage: true,
    prorate: true,
    active: false,      // Not active by default
    removable: true     // User can delete
  },
  {
    code: 'medical_allowance',
    name: 'Medical Allowance',
    calculation: 'fixed',
    defaultValue: 0,
    taxable: true,
    active: false,
    removable: true
  },
  {
    code: 'special_allowance',
    name: 'Special Allowance',
    calculation: 'fixed',
    defaultValue: 0,
    taxable: true,
    active: false,
    removable: true
  }
]
```

### Key Properties

- **`active`**: Whether component is available for use
- **`removable`**: Whether user can delete from list
- **`defaultValue`**: Pre-filled value (user can override)
- **`calculation`**: Formula type (fixed, percentage, etc.)

---

## Benefits

### ✅ For Companies
- Start with sensible defaults
- Customize to match their payroll structure
- Remove unnecessary components
- Add company-specific components
- Full flexibility without starting from scratch

### ✅ For Users
- Familiar components pre-configured
- Easy to understand default structure
- Can experiment (remove/re-add)
- Organized, not overwhelming

### ✅ For Different Industries
- **IT Companies**: Keep defaults, add special allowance
- **Manufacturing**: Remove conveyance, add shift allowance
- **Healthcare**: Add medical benefits, uniform allowance
- **Startups**: Minimal - just Basic + Special
- **Traditional**: Full structure with all statutory components

---

## Testing

✅ **All tests passing: 16/16**

```
# tests 16
# pass 16
# fail 0
```

**Test Coverage:**
- Default earnings available
- Earnings can be added to employee structure
- Settings can be updated
- Custom earnings can be added
- Payroll generation works correctly

---

## Summary

### What We Provide by Default:

**Default Salary Formula:**
- Basic Salary (50% of gross)
- HRA (40% of basic)

**Available Earnings (inactive):**
- Conveyance Allowance
- Medical Allowance  
- Special Allowance

**Available Deductions (inactive):**
- Professional Tax
- Loan Recovery

### What Users Can Do:

1. **Use defaults as-is** - Quick start
2. **Remove defaults** - Clean up unused components
3. **Modify defaults** - Change formulas/values
4. **Add custom** - Company-specific components
5. **Reorder** - Organize for clarity
6. **Re-add** - Restore removed defaults

---

*Status: ✅ COMPLETE*  
*Tests: 16/16 passing*  
*System: Flexible defaults with full customization*
