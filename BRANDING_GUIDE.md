# QHR Attendance System - Unified Branding Guide

## 🎨 Brand Colors (Professional Blue Theme)

### Primary Colors
```
Brand Blue:
- 50:  #eff6ff (Lightest)
- 100: #dbeafe
- 200: #bfdbfe
- 300: #93c5fd
- 400: #60a5fa
- 500: #3b82f6 (Primary)
- 600: #2563eb (Primary Dark)
- 700: #1d4ed8
- 800: #1e40af
- 900: #1e3a8a (Darkest)
```

### Accent Colors (Cyan)
```
- 400: #22d3ee
- 500: #06b6d4 (Accent Primary)
- 600: #0891b2
```

### Status Colors
```
Success: #10b981
Warning: #f59e0b
Error: #dc2626
Info: #3b82f6
```

## 📱 Application Branding

### Mobile App
- Primary: #2563eb
- Secondary: #06b6d4
- Accent: #0ea5e9
- Location: `/src/constants/theme.ts`

### Admin Panel
- Primary: #3b82f6
- Accent: #06b6d4
- Location: `/Backend/admin-panel/tailwind.config.ts`

### Landing Page
- Primary: #3b82f6
- Accent: #06b6d4
- Location: `/Backend/landing-page/tailwind.config.ts`

## 🏢 Company Branding Customization

Companies can customize their own branding in the admin panel:

### Customizable Elements
1. **Logo** - Upload company logo
2. **Primary Color** - Main brand color
3. **Secondary Color** - Accent color
4. **Font** - Choose from preset fonts

### Where Company Branding Appears
- Employee mobile app (after login)
- Company admin panel
- Employee-facing screens
- Reports and exports

### Default QHR Branding
- Used on login screens
- Landing page
- Public-facing pages
- Before company customization

## 🎯 Usage Guidelines

### Do's
✅ Use brand blue (#2563eb) for primary actions
✅ Use accent cyan (#06b6d4) for secondary actions
✅ Maintain consistent spacing and shadows
✅ Use glass-morphism effects for cards
✅ Apply smooth transitions and animations

### Don'ts
❌ Don't mix multiple color schemes
❌ Don't use harsh contrasts
❌ Don't override company custom colors
❌ Don't use outdated purple/gold theme

## 🔧 Implementation Status

### ✅ Completed
- Mobile app theme updated
- Admin panel theme updated
- Landing page theme configured
- Color constants defined

### 🚧 In Progress
- Landing page UI components
- Company branding settings page
- Theme preview functionality

### ⏳ Pending
- Company logo upload
- Custom font selection
- Theme export/import
- Dark mode refinements
