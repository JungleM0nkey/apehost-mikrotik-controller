# MikroTik Router Management Dashboard

React + TypeScript dashboard for MikroTik router management with **AI-powered network troubleshooting**.

## ✨ Key Features

- 🤖 **AI Assistant**: Claude-powered network troubleshooting with 14 specialized tools
- 🔍 **Intelligent Diagnostics**: Automatic firewall path analysis, connectivity testing, and network layer inspection
- 🎯 **Systematic Troubleshooting**: 5-phase diagnostic workflow for resolving connectivity issues
- 📊 **Real-time Monitoring**: Live router metrics, interface status, and traffic analysis
- 🎨 **Modern UI**: Dark theme, accessible design (WCAG 2.1 AA), responsive layout

### AI Network Troubleshooting

Ask questions like:
- "Why can't host 192.168.1.100 access 10.0.0.50 on port 443?"
- "Is my internet connection good?"
- "Device not appearing on network - what's wrong?"

The AI automatically uses the right tools to diagnose and provide actionable recommendations.

See [server/MCP_TOOLS_QUICK_REFERENCE.md](server/MCP_TOOLS_QUICK_REFERENCE.md) for complete AI assistant documentation.

## Quick Start

### Frontend
```bash
npm install
npm run dev       # Development server on port 5173
npm run build     # Production build
```

### Backend (AI Assistant)
```bash
cd server
npm install
cp .env.example .env
# Edit .env with MikroTik credentials and Claude API key
npm run dev       # Backend server on port 3000
```

### Full Stack Development
```bash
npm run dev:full  # Runs both frontend and backend
```

## Tech Stack

### Frontend
- React 18 + TypeScript 5
- CSS Modules + Custom Properties
- Vite 5
- ESLint

### Backend
- Node.js + Express + TypeScript
- MikroTik RouterOS API
- Claude AI (Anthropic)
- WebSocket for real-time communication
- MCP (Model Context Protocol) tools

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

### UI/UX
- Pure CSS Modules without Tailwind dependency
- Full TypeScript coverage
- WCAG 2.1 AA compliant
- Mobile-first responsive design
- Atomic Design methodology
- Code splitting ready

### AI Assistant Capabilities
- **Firewall Analysis**: Intelligent path analysis with exact blocking rule identification
- **Connectivity Testing**: Ping, traceroute, and bandwidth testing with quality metrics
- **Network Diagnostics**: ARP lookups, DNS resolution, DHCP lease tracking
- **Systematic Workflows**: 5-phase troubleshooting approach (80% of issues are firewall-related)
- **Smart Recommendations**: Confidence-scored insights with actionable next steps
- **Natural Language**: Ask questions in plain English, get detailed technical answers

### Monitoring & Management
- Real-time router metrics (CPU, memory, uptime)
- Network interface status and traffic statistics
- DHCP lease management
- Firewall rule inspection
- System logs with filtering
- Wireless client monitoring

## Design System

Dark theme with orange accent (#ff6b35). Design tokens centralized in `src/styles/tokens.css`.

**Typography**: Arial (UI) + Consolas (Terminal)  
**Spacing**: 4/8/12/16/24px scale  
**Layout**: Fixed 260px sidebar, flexible 50/50 content split

## Customization

Edit `src/styles/tokens.css` to customize colors, spacing, typography, and component sizes.

## License

MIT
