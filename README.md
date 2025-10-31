# apehost.net Mikrotik Bard - Router Management Dashboard

> [!WARNING]
> **Work In Progress - Not Production Ready**
>
> This project is under active development and is **NOT ready for production use**. Features are incomplete, bugs are expected, and breaking changes may occur without notice. Use at your own risk.
>
> - Security features are not fully implemented
> - API stability is not guaranteed
> - Data loss may occur during updates
> - Not all features are fully functional

Web-based management interface for MikroTik routers with AI-powered network diagnostics and troubleshooting capabilities.

## Interface Overview

The dashboard provides multiple specialized views for comprehensive network management:

### Dashboard
Real-time router metrics, system resource monitoring, interface status overview, and traffic statistics at a glance.

![Dashboard](docs/screenshots/dashboard.png)

### AI Agent Diagnostics
Claude-powered network troubleshooting with automated issue detection, confidence scoring, and actionable recommendations. Features 14 specialized MCP tools for deep network analysis.

![AI Agent](docs/screenshots/ai-agent.png)

### Network Interfaces
Comprehensive interface management with detailed configuration options, traffic monitoring, and status indicators. Toggle interfaces on/off and view real-time statistics.

![Network Interfaces](docs/screenshots/network.png)

### Additional Pages

- **Chat**: Interactive AI assistant for natural language network queries
- **Analytics**: Traffic analysis, usage patterns, and historical data visualization
- **Firewall**: Firewall rule management and connection tracking
- **WireGuard**: VPN configuration, peer management, and QR code generation
- **Network Map**: Visual topology mapping and device discovery
- **Documentation**: Built-in help system and API reference
- **Learning Dashboard**: Network education resources and tutorials
- **Settings**: System configuration, API credentials, backup/restore, and service management
- **Terminal**: Direct router CLI access with command history and persistent sessions

## Core Features

- **AI-Powered Diagnostics**: Claude-based network troubleshooting with 14 specialized MCP tools
- **Real-Time Monitoring**: Live router metrics (CPU, memory, uptime, traffic)
- **Interface Management**: Configure and monitor all network interfaces
- **WireGuard VPN**: Complete VPN setup with automatic key generation, peer management, and mobile QR codes
- **Configuration Backups**: Automated backup creation, download, restore with SQLite persistence
- **Service Management**: Start, stop, restart backend services with real-time status monitoring
- **Firewall Analysis**: Automatic path analysis and blocking rule identification
- **Network Diagnostics**: Ping, traceroute, ARP lookups, DNS resolution, DHCP lease tracking
- **Systematic Troubleshooting**: 5-phase diagnostic workflow for connectivity issues
- **Persistent Terminal**: WebSocket-based terminal with session history and auto-reconnection
- **Dark Theme UI**: WCAG 2.1 AA compliant, responsive design with custom component system

## Quick Start

### Prerequisites
- Node.js 18+
- MikroTik router with API access
- AI Provider (choose one):
  - **Claude** (Anthropic) - Premium quality, highest cost
  - **Cloudflare Workers AI** - 93% cheaper, function calling support
  - **LM Studio** - Free local inference

### Frontend Setup
```bash
npm install
npm run dev       # Development server on port 5173
npm run build     # Production build
```

### Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Configure .env with:
# - MikroTik router credentials
# - Claude API key
# - Server settings
npm run dev       # Backend server on port 3000
```

### Full Stack Development
```bash
npm run dev:full  # Runs frontend and backend concurrently
```

## Tech Stack

**Frontend**
- React 18 + TypeScript 5
- CSS Modules with custom properties
- Vite 5 build system
- Atomic design architecture

**Backend**
- Node.js + Express + TypeScript
- MikroTik RouterOS API client
- Multi-provider AI support with 14 MCP tools:
  - Claude AI SDK (Anthropic)
  - Cloudflare Workers AI (llama-4-scout-17b-16e)
  - LM Studio (local inference)
- Socket.IO for real-time WebSocket updates
- Better-SQLite3 for local data persistence
- QR code generation for WireGuard mobile configs
- Configuration backup/restore system

## Project Structure

```
src/
├── components/
│   ├── atoms/              # Input, Button, StatusBadge
│   ├── molecules/          # RouterInfo, ChatMessage, QuickAction
│   └── organisms/          # Sidebar, Header, ChatPanel, TerminalPanel
├── pages/                  # Dashboard, Network, Firewall, Settings
├── styles/
│   ├── tokens.css         # Design system variables
│   └── reset.css          # CSS normalization
├── types/                  # TypeScript interfaces
└── hooks/                  # React hooks

server/
├── src/
│   ├── routes/            # API endpoints
│   │   ├── agent.ts       # AI agent diagnostics
│   │   ├── backups.ts     # Configuration backup/restore
│   │   ├── health.ts      # Health check
│   │   ├── router.ts      # Router status & interfaces
│   │   ├── service.ts     # Service management
│   │   ├── settings.ts    # Settings persistence
│   │   ├── setup.ts       # Initial setup wizard
│   │   ├── terminal.ts    # Terminal command execution
│   │   └── wireguard.ts   # WireGuard VPN management
│   ├── services/
│   │   ├── ai/            # Claude AI integration
│   │   │   └── mcp/       # 14 MCP tool implementations
│   │   ├── backup-management.service.ts
│   │   ├── config/        # Configuration management
│   │   ├── settings.ts    # Settings service
│   │   └── wireguard/     # WireGuard service
│   ├── data/              # SQLite databases
│   │   ├── agent.db       # AI agent data
│   │   └── wireguard.db   # WireGuard configs
│   └── utils/             # Helper functions
├── MCP_TOOLS_QUICK_REFERENCE.md
└── NETWORK_TROUBLESHOOTING_TOOLS.md
```

## AI Assistant Capabilities

**Diagnostic Tools**
- Firewall path analysis with exact blocking rule identification
- Connectivity testing (ping, traceroute) with quality metrics
- Network layer inspection (ARP, DNS, DHCP)
- Interface status and traffic analysis
- System resource monitoring

**Troubleshooting Workflow**
1. Initial assessment and symptom collection
2. Layer-by-layer network analysis
3. Firewall rule path testing (80% of connectivity issues)
4. Interface and routing verification
5. Confidence-scored recommendations

**Natural Language Interface**
- Plain English query support
- Automatic tool selection based on context
- Detailed technical explanations
- Actionable remediation steps

See [server/MCP_TOOLS_QUICK_REFERENCE.md](server/MCP_TOOLS_QUICK_REFERENCE.md) for complete tool documentation.

## Design System

**Theme**: Dark background (#0a0a0a) with orange accent (#ff6b35)

**Typography**
- UI: Arial
- Terminal: Consolas

**Spacing Scale**: 4px, 8px, 12px, 16px, 24px, 32px

**Layout**
- Fixed sidebar: 260px
- Content split: 50/50 flexible
- Mobile-first responsive breakpoints

**Customization**: Edit `src/styles/tokens.css` to modify design tokens.

## Configuration

### Environment Variables

**Frontend** (`.env`)
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

**Backend** (`server/.env`)
```
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# MikroTik Router
MIKROTIK_HOST=192.168.x.x
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=your_password_here
MIKROTIK_TIMEOUT=10000
MIKROTIK_KEEPALIVE_SEC=30

# AI Provider (choose one: claude, cloudflare, or lmstudio)
LLM_PROVIDER=claude

# Claude AI - Premium quality, high cost
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Cloudflare Workers AI - 93% cheaper, with function calling
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_AI_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct
# Optional: AI Gateway for caching/analytics
# CLOUDFLARE_AI_GATEWAY=my-gateway-name

# LM Studio - Free local inference
LMSTUDIO_ENDPOINT=http://localhost:1234/v1
LMSTUDIO_MODEL=your-model-name
LMSTUDIO_CONTEXT_WINDOW=32768

# Data Storage
DATA_DIR=./data
BACKUPS_DIR=./data/backups
```

## Development

**Code Quality**
- Full TypeScript coverage
- ESLint configuration
- CSS Modules (no Tailwind dependency)
- Atomic design methodology

**Performance**
- Code splitting ready
- Vite HMR for fast development
- WebSocket for efficient real-time updates

## License

MIT
