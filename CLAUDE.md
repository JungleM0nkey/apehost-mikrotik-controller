# MikroTik Dashboard Design Guidelines

**CRITICAL**: This document defines the design system and UI implementation rules for this project. All code must follow these guidelines.

## Design System Architecture

This application uses a **custom design system** with **selective Ant Design integration**. It is NOT a pure Ant Design application.

### Component Hierarchy

```
Atoms (Basic Components)
├── Input
├── Button
├── Toggle
└── Textarea

Molecules (Composite Components)
├── FormField (wraps Input/Textarea with label, helpText, error)
├── ToggleField (wraps Toggle with label, description)
└── [other molecules as needed]

Organisms (Complex Components)
├── SettingsSection (groups related settings)
└── [other organisms as needed]

Ant Design (Selective Use Only)
├── Tabs (has token overrides)
├── Slider (has token overrides)
├── Card (has token overrides)
├── Alert (has token overrides)
├── Spin (has token overrides)
├── Progress (has token overrides)
├── Badge (has token overrides)
├── Tag (has token overrides)
├── Statistic (has token overrides)
└── Modal (has token overrides)
```

## Core Rules

### Rule 0: No Emojis

**NEVER** use emojis in any code, documentation, comments, commit messages, or UI text unless explicitly instructed by the user.

This includes but is not limited to:
- Code comments
- README files
- Documentation
- UI labels and text
- Error messages
- Log messages
- Commit messages
- Component names or descriptions

Use plain text equivalents instead:
- Instead of "✅ Success", use "Success" or "[OK]"
- Instead of "❌ Error", use "Error" or "[FAILED]"
- Instead of "🚀 Deploy", use "Deploy"
- Instead of "⚠️ Warning", use "Warning" or "[WARN]"

### Rule 1: Use Custom Components for Form Elements

**ALWAYS** use our custom components instead of Ant Design equivalents:

**Correct:**
```tsx
import { Input } from '../../components/atoms/Input/Input';
import { Button } from '../../components/atoms/Button/Button';
import { Toggle } from '../../components/atoms/Toggle/Toggle';
import { Textarea } from '../../components/atoms/Textarea/Textarea';

<Input value={value} onChange={setValue} />
<Button variant="primary">Save</Button>
<Toggle checked={enabled} onChange={setEnabled} />
<Textarea value={text} onChange={setText} />
```

**Wrong:**
```tsx
import { Input, Button, Switch, Form } from 'antd';

<Form.Item>
  <Input value={value} onChange={e => setValue(e.target.value)} />
</Form.Item>
<Button type="primary">Save</Button>
<Switch checked={enabled} onChange={setEnabled} />
```

### Rule 2: Use FormField and ToggleField for Form Layouts

**ALWAYS** wrap form inputs with FormField or ToggleField molecules:

**Correct:**
```tsx
import { FormField } from '../../components/molecules/FormField/FormField';
import { ToggleField } from '../../components/molecules/ToggleField/ToggleField';

<FormField
  label="Server Port"
  helpText="Port number for the backend server"
  error={errors.port}
>
  <Input
    type="number"
    value={port}
    onChange={setPort}
    placeholder="3000"
  />
</FormField>

<ToggleField
  label="Enable Feature"
  description="Toggle this feature on or off"
  checked={enabled}
  onChange={setEnabled}
/>
```

**Wrong:**
```tsx
<div>
  <label>Server Port</label>
  <Input value={port} onChange={setPort} />
  <span>Port number for the backend server</span>
</div>

<div>
  <Toggle checked={enabled} onChange={setEnabled} />
  <span>Enable Feature</span>
</div>
```

### Rule 3: Use SettingsSection for Grouping

**ALWAYS** group related settings using SettingsSection:

**Correct:**
```tsx
import { SettingsSection } from '../../components/organisms/SettingsSection/SettingsSection';

<SettingsSection
  title="Server Configuration"
  description="Configure backend server settings"
>
  <FormField label="Port">
    <Input value={port} onChange={setPort} />
  </FormField>
  {/* more fields */}
</SettingsSection>
```

**Wrong:**
```tsx
<div>
  <h3>Server Configuration</h3>
  <p>Configure backend server settings</p>
  <Input value={port} onChange={setPort} />
</div>
```

### Rule 4: Only Use Approved Ant Design Components

**ONLY** use Ant Design components that have CSS token overrides in `src/styles/tokens.css`:

**Approved for Use:**
- `Tabs` - Tab navigation
- `Slider` - Range inputs
- `Card` - Content containers
- `Alert` - Notifications
- `Spin` - Loading indicators
- `Progress` - Progress bars
- `Badge` - Status indicators
- `Tag` - Labels and tags
- `Statistic` - Numeric displays
- `Modal` - Dialog boxes and confirmations

**Never Use (Use Custom Components Instead):**
- `Form` → Use controlled components with useState
- `Input` → Use custom `Input` component
- `Button` → Use custom `Button` component
- `Switch` → Use custom `Toggle` component
- `Select` → Use custom `<select>` with CSS modules
- `InputNumber` → Use custom `Input` with type="number"
- `TextArea` → Use custom `Textarea` component
- `Checkbox` → Use custom checkbox implementation
- `Radio` → Use custom radio implementation

### Rule 5: All Styling Via CSS Modules with Design Tokens

**NEVER** use inline styles. **ALWAYS** use CSS modules with design tokens.

**Correct:**
```tsx
// Component.module.css
.container {
  padding: var(--space-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  gap: var(--space-lg);
}

.title {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  font-weight: 600;
}

// Component.tsx
import styles from './Component.module.css';

<div className={styles.container}>
  <h2 className={styles.title}>Title</h2>
</div>
```

**Wrong:**
```tsx
<div style={{
  padding: '24px',
  background: '#1a1a1a',
  border: '1px solid #2d2d2d',
  borderRadius: '8px',
  gap: '16px'
}}>
  <h2 style={{ fontSize: '20px', color: '#ffffff', fontWeight: 600 }}>
    Title
  </h2>
</div>
```

## Design Tokens Reference

**Location:** `src/styles/tokens.css`

### Spacing
```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 24px;
--space-2xl: 32px;
```

### Colors - Backgrounds
```css
--color-bg-primary: #0a0a0a;
--color-bg-secondary: #1a1a1a;
--color-bg-tertiary: #1f1f1f;
--color-bg-terminal: #000000;
```

### Colors - Text
```css
--color-text-primary: #ffffff;
--color-text-secondary: #a0a0a0;
--color-text-tertiary: #6b6b6b;
```

### Colors - Borders
```css
--color-border-primary: #2d2d2d;
--color-border-secondary: #262626;
--color-border-transparent: rgba(0, 0, 0, 0);
```

### Colors - Accent
```css
--color-accent-primary: #ff6b35;
--color-accent-success: #10b981;
--color-accent-error: #ef4444;
```

### Typography
```css
--font-family-primary: Arial, sans-serif;
--font-family-mono: Consolas, 'Courier New', monospace;
--font-mono: var(--font-family-mono);
--font-size-xs: 14px;
--font-size-sm: 16px;
--font-size-md: 18px;
--font-size-lg: 20px;
--font-size-2xl: 28px;
```

### Border Radius
```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-full: 9999px;
```

### Transitions
```css
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
```

### Component Sizes
```css
--size-icon-sm: 16px;
--size-icon-md: 20px;
--size-button-sm: 32px;
--size-input: 36px;
--size-avatar: 40px;
--size-button-lg: 48px;
--size-header: 56px;
--size-sidebar: 267px;
```

### Z-Index Layers
```css
--z-base: 0;
--z-sticky: 10;
--z-dropdown: 20;
--z-modal: 30;
--z-tooltip: 40;
```

## Common Patterns

### Page Container Pattern
```tsx
// Page.module.css
.container {
  height: 100vh;
  overflow-y: auto;
  background-color: var(--color-bg-primary);
}

.header {
  padding: 0 var(--space-xl);
  height: 49px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-primary);
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.content {
  padding: var(--space-xl);
  max-width: 1200px;
}

// Page.tsx
<div className={styles.container}>
  <header className={styles.header}>
    <h1 className={styles.title}>Page Title</h1>
  </header>
  <div className={styles.content}>
    {/* content */}
  </div>
</div>
```

### Tabs Layout Pattern
```tsx
import { Tabs } from 'antd';
import styles from './Page.module.css';

const items = [
  {
    key: 'tab1',
    label: 'Tab 1',
    children: <div className={styles.tabContent}>
      {/* tab content */}
    </div>
  },
  {
    key: 'tab2',
    label: 'Tab 2',
    children: <div className={styles.tabContent}>
      {/* tab content */}
    </div>
  }
];

<Tabs items={items} />
```

```css
.tabContent {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}
```

### Grid Layout Pattern
```css
.gridTwo {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-lg);
}

@media (max-width: 1024px) {
  .gridTwo {
    grid-template-columns: 1fr;
  }
}
```

### Select/Dropdown Pattern
```tsx
// Use native <select> with custom styling
<select className={styles.select} value={value} onChange={e => setValue(e.target.value)}>
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
</select>
```

```css
.select {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.select:hover {
  border-color: var(--color-border-secondary);
}

.select:focus {
  outline: none;
  border-color: var(--color-accent-primary);
}
```

## State Management Patterns

### Controlled Components
**ALWAYS** use controlled components with useState:

**Correct:**
```tsx
const [port, setPort] = useState('3000');
const [enabled, setEnabled] = useState(false);

<Input value={port} onChange={setPort} />
<Toggle checked={enabled} onChange={setEnabled} />
```

**Wrong:**
```tsx
import { Form } from 'antd';
const [form] = Form.useForm();

<Form form={form}>
  <Form.Item name="port">
    <Input />
  </Form.Item>
</Form>
```

### Change Tracking
Track unsaved changes with boolean flags:

```tsx
const [hasChanges, setHasChanges] = useState(false);

const handleChange = (value: string) => {
  setValue(value);
  setHasChanges(true);
};

const handleSave = async () => {
  // save logic
  setHasChanges(false);
};
```

## File Organization

### Component Structure
```
src/components/
├── atoms/          # Basic building blocks
│   ├── Input/
│   │   ├── Input.tsx
│   │   ├── Input.module.css
│   │   └── index.ts
│   ├── Button/
│   └── Toggle/
├── molecules/      # Composite components
│   ├── FormField/
│   └── ToggleField/
└── organisms/      # Complex components
    └── SettingsSection/
```

### Import Order
1. React and React hooks
2. Third-party libraries (Ant Design, etc.)
3. Custom components (atoms, molecules, organisms)
4. Hooks
5. Utils and helpers
6. Types
7. Styles (always last)

**Correct:**
```tsx
import React, { useState, useEffect } from 'react';
import { Tabs, Alert } from 'antd';
import { Input } from '../../components/atoms/Input/Input';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { SettingsSection } from '../../components/organisms/SettingsSection/SettingsSection';
import { useSettings } from '../../hooks/useSettings';
import { ServerSettings } from '../../types/settings';
import styles from './SettingsPage.module.css';
```

## Pre-Implementation Checklist

Before creating any new UI component or page, verify:

- [ ] Are you avoiding ALL emojis in code, comments, and UI text?
- [ ] Are you using custom Input/Button/Toggle/Textarea components?
- [ ] Are you wrapping inputs with FormField or ToggleField?
- [ ] Are you using SettingsSection for grouping?
- [ ] Are you only using approved Ant Design components?
- [ ] Is ALL styling in CSS modules with design tokens?
- [ ] Are there ZERO inline styles?
- [ ] Are you using controlled components with useState?
- [ ] Does your CSS module follow the naming conventions?
- [ ] Are imports ordered correctly?
- [ ] Does it follow the established patterns from other pages?
- [ ] If using fixed positioning at bottom, is it positioned at `bottom: 48px`?
- [ ] If page has fixed footer, is content `padding-bottom` at least 130px?

## Reference Examples

**Good Examples to Follow:**
- `src/pages/SettingsPage/SettingsPage.tsx` (corrected version)
- `src/pages/DashboardPage/DashboardPage.tsx`
- `src/components/molecules/FormField/FormField.tsx`
- `src/components/organisms/SettingsSection/SettingsSection.tsx`

**Bad Example (DO NOT FOLLOW):**
- `src/pages/SettingsPage/SettingsPage.wrong.tsx` (uses Ant Design components incorrectly)

## Layout Considerations

### Terminal Taskbar
The application has a **fixed terminal taskbar** at the bottom of the screen (48px height, z-index: 9999).

**Important rules:**
- Any fixed footers must be positioned at `bottom: 48px` (not `bottom: 0`)
- Content areas with fixed footers need `padding-bottom: 130px` minimum (footer + taskbar + spacing)
- The terminal taskbar is always visible and has the highest z-index

**Correct:**
```css
.footer {
  position: fixed;
  bottom: 48px; /* Above terminal taskbar */
  z-index: var(--z-sticky);
}

.content {
  padding-bottom: 130px; /* Footer (64px) + Terminal taskbar (48px) + spacing */
}
```

**Wrong:**
```css
.footer {
  position: fixed;
  bottom: 0; /* Will be covered by terminal taskbar */
}
```

## When in Doubt

1. **Check tokens.css** - If an Ant Design component doesn't have overrides there, don't use it
2. **Check existing pages** - Look at DashboardPage or SettingsPage for patterns
3. **Check component library** - Look at atoms, molecules, and organisms first
4. **Use CSS modules** - Never inline styles
5. **Follow the hierarchy** - Atoms → Molecules → Organisms → Pages
6. **Account for terminal taskbar** - Fixed elements at bottom must be at `bottom: 48px`

---

**Remember:** This is a custom design system with selective Ant Design integration. When in doubt, use custom components and CSS modules with design tokens.
