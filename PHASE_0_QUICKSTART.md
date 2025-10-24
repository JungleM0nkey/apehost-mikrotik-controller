# Phase 0 Quick Start Guide

**Goal**: Get the project running in your browser in the next 30 minutes.

---

## Step 1: Create `index.html` (5 minutes)

Create `index.html` in the root directory:

```bash
cat > /home/m0nkey/mikrotik-dashboard/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="MikroTik Router Management Dashboard with AI Assistant" />
    <title>MikroTik Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTMLEOF
```

---

## Step 2: Create `src/main.tsx` (5 minutes)

Create the React entry point:

```bash
cat > /home/m0nkey/mikrotik-dashboard/src/main.tsx << 'TSXEOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/reset.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
TSXEOF
```

---

## Step 3: Create `.gitignore` (2 minutes)

```bash
cat > /home/m0nkey/mikrotik-dashboard/.gitignore << 'GITEOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
dist-ssr/
*.local

# Environment variables
.env
.env.local
.env.production
.env.development

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Editor directories
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Temporary files
*.tmp
*.temp
.cache/
GITEOF
```

---

## Step 4: Fix Logo Issue (3 minutes)

**Option A: Update Sidebar to not require logo (RECOMMENDED - faster)**

```bash
cat > /home/m0nkey/mikrotik-dashboard/src/components/organisms/Sidebar/Sidebar.tsx << 'LOGOEOF'
import React from 'react';
import { RouterInfo } from '../../molecules/RouterInfo/RouterInfo';
import { RouterInfo as RouterInfoType } from '../../../types/router';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  router: RouterInfoType;
  activeNav: string;
  onNavigate: (nav: string) => void;
  onReboot: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'terminal', label: 'Terminal', icon: '💻' },
  { id: 'network', label: 'Network', icon: '🌐' },
  { id: 'firewall', label: 'Firewall', icon: '🛡️' },
  { id: 'dhcp', label: 'DHCP', icon: '📡' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  router,
  activeNav,
  onNavigate,
  onReboot
}) => {
  return (
    <aside className={styles.sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.logo}>
        <h1 style={{ 
          color: 'var(--color-accent-primary)', 
          fontSize: '20px', 
          fontWeight: 'bold',
          margin: 0 
        }}>
          MikroTik Dashboard
        </h1>
      </div>

      <div className={styles.routerSection}>
        <h2 className={styles.sectionTitle}>Connected Router</h2>
        <RouterInfo router={router} />
      </div>

      <nav className={styles.navigation}>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navButton} ${activeNav === item.id ? styles.active : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeNav === item.id ? 'page' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          className={styles.rebootButton}
          onClick={onReboot}
          aria-label="Reboot router"
        >
          Reboot Router
        </button>
      </div>
    </aside>
  );
};
LOGOEOF
```

**Option B: Add a logo image (if you have one)**

```bash
mkdir -p /home/m0nkey/mikrotik-dashboard/public
# Place your logo.png in /home/m0nkey/mikrotik-dashboard/public/logo.png
```

---

## Step 5: Install Dependencies (5 minutes)

```bash
cd /home/m0nkey/mikrotik-dashboard
npm install
```

This will install:
- React 18.3.1
- React DOM 18.3.1
- Vite 5.3.1
- TypeScript 5.2.2
- All dev dependencies

---

## Step 6: First Run (2 minutes)

```bash
npm run dev
```

Expected output:
```
VITE v5.3.1  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## Step 7: Test in Browser (3 minutes)

1. Open http://localhost:5173 in your browser
2. You should see the dashboard with sidebar
3. Navigate to Settings page
4. Verify all components render

**Expected behavior**:
✅ Sidebar appears on left  
✅ Dashboard placeholder shows  
✅ Settings page loads with all sections  
✅ No console errors  

**Common Issues**:

### Issue: "Cannot find module 'react'"
**Fix**: Run `npm install` again

### Issue: Logo image not found
**Fix**: Already fixed in Step 4 Option A

### Issue: CSS not loading
**Fix**: Check that `src/styles/tokens.css` and `src/styles/reset.css` exist

### Issue: TypeScript errors
**Fix**: Run `npm run typecheck` to see details

---

## Step 8: Initialize Git (5 minutes)

```bash
cd /home/m0nkey/mikrotik-dashboard

# Initialize repository
git init

# Stage all files
git add .

# First commit
git commit -m "feat: initial commit - UI foundation complete

- Added index.html and main.tsx entry points
- Fixed Sidebar logo dependency
- All components rendering correctly
- Project is now runnable with npm run dev"
```

---

## ✅ Success Checklist

After completing these steps, verify:

- [ ] `npm run dev` runs without errors
- [ ] Browser opens to http://localhost:5173
- [ ] Sidebar displays with navigation items
- [ ] Can click through navigation (Dashboard, Settings, etc.)
- [ ] Settings page loads with all sections
- [ ] No console errors in browser DevTools
- [ ] TypeScript compilation successful
- [ ] Git repository initialized

---

## 🎉 You're Done with Phase 0!

**What you've accomplished**:
- ✅ Project is now runnable
- ✅ All UI components display correctly
- ✅ Navigation works
- ✅ Settings page functional (with mock data)
- ✅ Version controlled with Git

**Next Steps**:
- See `ROADMAP.md` for Phase 1 (Complete Frontend UI)
- Or jump to Phase 2 if you want to add backend functionality

---

## Troubleshooting Commands

```bash
# Check if dependencies installed
ls node_modules/ | wc -l
# Should show ~100+ directories

# Verify all source files exist
find src -type f -name "*.tsx" -o -name "*.ts"

# Check TypeScript compilation
npm run typecheck

# Clear cache and restart (if issues)
rm -rf node_modules dist .vite
npm install
npm run dev
```

---

**Time to complete**: ~30 minutes  
**Status after completion**: Project is RUNNABLE ✅
