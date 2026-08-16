# Payroll Structure Changes - Special Allowance Fix

## 🎯 Changes Made

### Issue
Previously, the system was automatically calculating **Special Allowance** as a balancing component:
- `Special Allowance = Monthly Gross - (Basic + HRA + Other Earnings)`
- This meant special allowance was ALWAYS included in every salary, even when not wanted

### Solution
Special Allowance is now **MANUAL ONLY** - it will only be included if explicitly provided by the admin.

---

## ✅ What's Changed

### 1. Default Salary Components (Automatic)
**These are calculated by default:**
- ✅ **Basic Salary** - 50% of monthly gross (default)
- ✅ **HRA (House Rent Allowance)** - 40% of basic salary (default)
- ✅ **Conveyance Allowance** - 5% of monthly gross (default, active by default)

### 2. Manual Components (Optional)
**These must be added manually:**
- ⚠️ **Special Allowance** - NO longer auto-calculated
- ⚠️ **Other Custom Allowances** - Admin adds as needed

---

## 🔧 Technical Changes

### Backend Changes (`attendance-mobile/Backend/src/utils/payroll.js`)

#### 1. Conveyance Allowance Now Active by Default
**Before:**
```javascript
{
  code: 'conveyance',
  name: 'Conveyance allowance',
  calculation: 'fixed',
  defaultValue: 0,  // Was zero
  active: true,
}
```

**After:**
```javascript
{
  code: 'conveyance',
  name: 'Conveyance allowance',
  calculation: 'percentage_of_gross',
  defaultValue: 5,  // 5% of gross by default
  active: true,
}
```

#### 2. Special Allowance No Longer Auto-Calculated
**Before:**
```javascript
const legacySpecialAllowance = amount(input.specialAllowance ?? input.allowances);
// ...
const specialAllowance = amount(Math.max(0, monthlyGrossTarget - committedGross));
```

**After:**
```javascript
// Only use special allowance if explicitly provided
const legacySpecialAllowance = input.specialAllowance !== undefined || input.allowances !== undefined 
  ? amount(input.specialAllowance ?? input.allowances) 
  : 0;
// ...
// Special allowance is ONLY used if manually provided
const specialAllowance = legacySpecialAllowance;
```

#### 3. Monthly Gross Calculation Updated
**Before:**
```javascript
// Gross = Basic + HRA + Conveyance + Special Allowance (auto-calculated)
const monthlyGross = amount(committedGross + specialAllowance);
```

**After:**
```javascript
// Gross = Basic + HRA + Conveyance + Special Allowance (if provided)
const monthlyGross = amount(committedGross + specialAllowance);
// specialAllowance will be 0 unless manually provided
```

### Frontend Changes (`admin-panel/src/app/components/PayrollWorkspace.tsx`)

#### Special Allowance Removed from Auto-Calculation
**Before:**
```typescript
const specialAllowance = rounded(Math.max(0, target - committed));
const earningsLines = [
  editorLine("basic", "Basic salary", basic),
  editorLine("hra", "House rent allowance", hra),
  editorLine("special_allowance", "Special allowance", specialAllowance),
  ...customEarnings,
];
```

**After:**
```typescript
// Special allowance is NOT auto-calculated - only use if manually provided
const specialAllowance = 0; // Manual entry only

const earningsLines = [
  editorLine("basic", "Basic salary", basic),
  editorLine("hra", "House rent allowance", hra),
  // Special allowance removed from default
  ...customEarnings,
];
```

---

## 📊 Example Salary Calculation

### Scenario: Employee with ₹20,000 Monthly Gross

#### Before (OLD - Automatic Special Allowance)
```
Monthly Gross Target: ₹20,000

Calculated Components:
- Basic (50%):           ₹10,000
- HRA (40% of basic):    ₹4,000
- Conveyance (fixed):    ₹0
- Special Allowance:     ₹6,000  ← AUTO-CALCULATED as balance
--------------------------------
Total:                   ₹20,000
```

#### After (NEW - Manual Special Allowance)
```
Monthly Gross Target: ₹20,000

Calculated Components:
- Basic (50%):           ₹10,000
- HRA (40% of basic):    ₹4,000
- Conveyance (5%):       ₹1,000  ← NOW ACTIVE BY DEFAULT
- Special Allowance:     ₹0      ← NOT AUTO-CALCULATED
--------------------------------
Total:                   ₹15,000

Note: Total is less than target because special allowance 
is not auto-calculated. Admin must add it manually if needed.
```

#### With Manual Special Allowance
```
Monthly Gross Target: ₹20,000

Calculated Components:
- Basic (50%):           ₹10,000
- HRA (40% of basic):    ₹4,000
- Conveyance (5%):       ₹1,000
- Special Allowance:     ₹5,000  ← MANUALLY ADDED BY ADMIN
--------------------------------
Total:                   ₹20,000
```

---

## 🎯 User Impact

### For Admins
1. **Conveyance is now automatic** - No need to manually add conveyance allowance
2. **Special allowance is now manual** - Must explicitly add if needed
3. **More control** - Salary structure won't have unwanted special allowance

### For Employees
- **No automatic special allowance** in their salary breakdown
- **Clearer salary structure** - only components that are actually configured
- **More accurate payslips** - no confusing "balance" components

---

## 📝 Migration Notes

### Existing Salary Structures
- Existing employees with special allowance will **keep their special allowance**
- The stored value in the database will be preserved
- Only new salary calculations will follow the new rules

### New Employees
- Will get: Basic + HRA + Conveyance (by default)
- Special allowance must be added manually if required

---

## 🔍 How to Add Special Allowance Manually

### In Admin Panel:

1. Go to **Payroll** → **Salary Structures**
2. Select employee
3. Click **Edit Salary**
4. In the **Salary additions** section:
   - Click **"Add earning"**
   - Enter name: "Special Allowance"
   - Select calculation type: "Fixed" or "% of gross"
   - Enter value
   - Check **Active**
   - Click **Save**

---

## ✅ Testing Checklist

- [ ] Create new employee salary - verify NO special allowance appears
- [ ] Verify conveyance allowance appears automatically at 5%
- [ ] Manually add special allowance - verify it's included
- [ ] Edit existing salary with special allowance - verify it's preserved
- [ ] Generate payslip - verify earnings are correct
- [ ] Check monthly gross calculation matches Basic + HRA + Conveyance + Manual additions

---

## 🐛 Potential Issues & Solutions

### Issue: "My total is less than monthly gross target"
**Solution:** This is expected. The system no longer auto-fills the gap with special allowance. Add components manually to reach your target.

### Issue: "Existing employees missing special allowance"
**Solution:** Existing employees retain their special allowance from the database. Only affects new salary calculations.

### Issue: "I want to go back to auto-calculated special allowance"
**Solution:** This change aligns with standard HR practices. To achieve similar behavior, manually add special allowance as needed.

---

## 📚 Related Files Changed

1. `attendance-mobile/Backend/src/utils/payroll.js` - Backend calculation logic
2. `admin-panel/src/app/components/PayrollWorkspace.tsx` - Frontend UI
3. This documentation file

---

*Last Updated: [Current Date]*
*Version: 2.0*
