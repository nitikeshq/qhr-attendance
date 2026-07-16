# QHR Attendance System - Complete Tech Stack & Libraries

## 🎨 Design Systems Used

### 1. **Neumorphism Design** (Admin Panel)
- Soft UI with 3D raised/inset effects
- Warm cream & amber color palette
- Tactile, modern appearance

### 2. **Modern Glassmorphism/Material Design** (Landing Page & Mobile)
- Clean, flat design with subtle shadows
- Professional blue & cyan colors
- Corporate B2B aesthetic

---

## 📦 Backend (Node.js API)

### Framework & Core
```json
{
  "express": "^4.21.2",
  "node": ">=20"
}
```

### Security & Middleware
```json
{
  "cors": "^2.8.5",
  "helmet": "^8.0.0",
  "morgan": "^1.10.0"
}
```

### Environment & Config
```json
{
  "dotenv": "^16.4.7"
}
```

---

## 🎨 Admin Panel (Next.js - Neumorphism Design)

### Framework
```json
{
  "next": "14.1.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "node": ">=24.0.0"
}
```

### State Management
```json
{
  "zustand": "^4.5.0"
}
```

### Data Fetching
```json
{
  "@tanstack/react-query": "^5.17.9",
  "axios": "^1.6.5"
}
```

### UI Components & Icons
```json
{
  "lucide-react": "^0.312.0"
}
```

### Charts & Visualization
```json
{
  "recharts": "^2.10.4"
}
```

### Utilities
```json
{
  "date-fns": "^3.2.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.1"
}
```

### Styling
```json
{
  "tailwindcss": "^3.4.1",
  "autoprefixer": "^10.4.17",
  "postcss": "^8.4.33"
}
```

### TypeScript
```json
{
  "typescript": "^5.3.3",
  "@types/node": "^24.0.0",
  "@types/react": "^18.2.48",
  "@types/react-dom": "^18.2.18"
}
```

---

## 🌐 Landing Page (Next.js - Glassmorphism Design)

### Framework
```json
{
  "next": "14.1.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "node": ">=24.0.0"
}
```

### Animations
```json
{
  "framer-motion": "^11.0.3"
}
```

### UI Components
```json
{
  "lucide-react": "^0.312.0",
  "@radix-ui/react-accordion": "^1.1.2"
}
```

### Utilities
```json
{
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.1"
}
```

### Styling
```json
{
  "tailwindcss": "^3.4.1",
  "autoprefixer": "^10.4.17",
  "postcss": "^8.4.33"
}
```

### TypeScript
```json
{
  "typescript": "^5.3.3",
  "@types/node": "^24.0.0",
  "@types/react": "^18.2.48",
  "@types/react-dom": "^18.2.18"
}
```

---

## 🖥️ Desktop App (Electron)

### Framework
```json
{
  "electron": "^28.1.0",
  "node": ">=24.0.0"
}
```

### Activity Tracking
```json
{
  "active-win": "^8.1.0",
  "uiohook-napi": "^1.5.4"
}
```

### System Integration
```json
{
  "auto-launch": "^5.0.6",
  "electron-store": "^8.1.0",
  "electron-updater": "^6.1.7"
}
```

### Networking & Storage
```json
{
  "node-fetch": "^2.7.0",
  "ioredis": "^5.3.2"
}
```

### Build Tools
```json
{
  "electron-builder": "^24.9.1"
}
```

---

## 🎨 Design Tokens & Colors

### Professional Blue Theme (Landing Page & Mobile)
```css
/* Primary Colors */
--primary-blue-50: #eff6ff;
--primary-blue-500: #3b82f6;
--primary-blue-600: #2563eb; /* Main */
--primary-blue-700: #1d4ed8;

/* Accent Colors */
--accent-cyan-400: #22d3ee;
--accent-cyan-500: #06b6d4; /* Main */
--accent-cyan-600: #0891b2;

/* Status Colors */
--success: #10b981;
--warning: #f59e0b;
--error: #dc2626;
--info: #3b82f6;
```

### Neumorphic Warm Theme (Admin Panel)
```css
/* Background */
--neu-bg: #F5F0E8;
--neu-bg-alt: #EBE4D8;

/* Shadows */
--neu-shadow-dark: #D4CEC2;
--neu-shadow-light: #FFFFFF;

/* Brand Colors */
--primary: #E07B39;
--primary-light: #F09856;
--accent: #D4A853;
--secondary: #2D9B83;

/* Text */
--text: #3D3229;
--text-secondary: #5C4F3D;
```

---

## 🎯 Key Design Patterns & CSS Techniques

### Neumorphism Effects
```css
/* Raised Card */
.neu-card {
  box-shadow: 5px 5px 10px var(--neu-shadow-dark),
              -5px -5px 10px var(--neu-shadow-light);
}

/* Inset/Pressed */
.neu-inset {
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark),
              inset -3px -3px 6px var(--neu-shadow-light);
}

/* Button with Hover */
.neu-button:hover {
  box-shadow: 5px 5px 10px var(--neu-shadow-dark),
              -5px -5px 10px var(--neu-shadow-light);
}

.neu-button:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark),
              inset -2px -2px 4px var(--neu-shadow-light);
}
```

### Glassmorphism Effects
```css
/* Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Sticky Header with Blur */
.header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
}
```

### Modern Shadow System
```css
/* Tailwind Shadow Utilities Used */
shadow-sm       /* Small subtle shadow */
shadow-lg       /* Large shadow for elevation */
shadow-xl       /* Extra large for modals */
shadow-2xl      /* Maximum elevation */

/* Colored Shadows */
shadow-blue-600/20   /* Blue shadow at 20% opacity */
shadow-blue-900/10   /* Dark blue at 10% opacity */
```

---

## 📱 Installation Commands

### For Admin Panel (Neumorphism)
```bash
npm create next-app@14.1.0 my-admin-panel
cd my-admin-panel
npm install zustand @tanstack/react-query axios lucide-react recharts date-fns clsx tailwind-merge
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss postcss autoprefixer
```

### For Landing Page (Glassmorphism)
```bash
npm create next-app@14.1.0 my-landing-page
cd my-landing-page
npm install framer-motion lucide-react @radix-ui/react-accordion clsx tailwind-merge
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss postcss autoprefixer
```

### For Backend API
```bash
mkdir my-backend && cd my-backend
npm init -y
npm install express cors helmet morgan dotenv
```

### For Desktop App
```bash
mkdir my-desktop-app && cd my-desktop-app
npm init -y
npm install electron active-win auto-launch electron-store electron-updater node-fetch ioredis
npm install -D electron-builder
```

---

## 🔗 Useful Resources

### Design Inspiration
- **Neumorphism Generator**: https://neumorphism.io/
- **Glassmorphism Generator**: https://glassmorphism.com/
- **Tailwind Components**: https://tailwindui.com/
- **Shadcn UI**: https://ui.shadcn.com/
- **Radix UI**: https://www.radix-ui.com/

### Icon Libraries
- **Lucide React**: https://lucide.dev/ (Used in this project)
- **Heroicons**: https://heroicons.com/
- **React Icons**: https://react-icons.github.io/react-icons/

### Animation Libraries
- **Framer Motion**: https://www.framer.com/motion/ (Used in landing page)
- **React Spring**: https://www.react-spring.dev/
- **GSAP**: https://greensock.com/gsap/

### Charts & Data Viz
- **Recharts**: https://recharts.org/ (Used in admin panel)
- **Chart.js**: https://www.chartjs.org/
- **Victory**: https://formidable.com/open-source/victory/

---

## 🚀 Quick Start Template

### Copy This for New Projects

```bash
# 1. Create Next.js app with TypeScript
npx create-next-app@14.1.0 my-app --typescript --tailwind --app

# 2. Install core UI dependencies
npm install lucide-react clsx tailwind-merge

# 3. Install state & data fetching (if needed)
npm install zustand @tanstack/react-query axios

# 4. Install animations (if needed)
npm install framer-motion

# 5. Install UI components (if needed)
npm install @radix-ui/react-accordion @radix-ui/react-dialog @radix-ui/react-dropdown-menu

# 6. Install charts (if needed)
npm install recharts

# 7. Install utilities (if needed)
npm install date-fns

# 8. Start development
npm run dev
```

---

## 📋 Summary

### Design Systems
1. **Neumorphism** - Admin panels, dashboards (warm, tactile)
2. **Glassmorphism** - Landing pages, modern web apps (clean, corporate)

### Core Stack
- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: TailwindCSS 3.4 + Custom CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **State**: Zustand
- **Data Fetching**: TanStack Query + Axios
- **Charts**: Recharts
- **Backend**: Node.js + Express
- **Desktop**: Electron

### Key Libraries
- `lucide-react` - Icons
- `framer-motion` - Animations
- `zustand` - State management
- `@tanstack/react-query` - Server state
- `recharts` - Charts
- `clsx` + `tailwind-merge` - Class utilities
- `date-fns` - Date formatting

---

*Use this list to replicate the QHR design system in any new application!*
