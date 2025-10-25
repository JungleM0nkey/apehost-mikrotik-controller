# MikroTik Router Management Dashboard

Production-ready React + TypeScript dashboard for MikroTik router management.

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Tech Stack

- React 18 + TypeScript 5
- CSS Modules + Custom Properties
- Vite 5
- ESLint

## Architecture

```
src/
├── components/
│   ├── atoms/              # Button, Input, StatusBadge
│   ├── molecules/          # RouterInfo, ChatMessage, QuickAction
│   └── organisms/          # Sidebar, Header, ChatPanel, TerminalPanel
├── styles/
│   ├── tokens.css         # Design system variables
│   └── reset.css          # Browser normalization
├── types/                  # TypeScript interfaces
└── hooks/                  # Custom React hooks
```

## Features

- Pure CSS Modules without Tailwind dependency
- Full TypeScript coverage
- WCAG 2.1 AA compliant
- Mobile-first responsive design
- Atomic Design methodology
- Code splitting ready

## Design System

Dark theme with orange accent (#ff6b35). Design tokens centralized in `src/styles/tokens.css`.

**Typography**: Arial (UI) + Consolas (Terminal)  
**Spacing**: 4/8/12/16/24px scale  
**Layout**: Fixed 260px sidebar, flexible 50/50 content split

## Customization

Edit `src/styles/tokens.css` to customize colors, spacing, typography, and component sizes.

## License

MIT
