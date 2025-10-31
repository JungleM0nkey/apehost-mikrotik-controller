# MikroTik Dashboard Documentation

Welcome to the comprehensive documentation for MikroTik Dashboard - a modern, real-time router management application.

## 📋 Quick Navigation

### Getting Started
- **[Quick Start Guide](QUICK_START.md)** - Get up and running in 5 minutes
- **[API Reference](API.md)** - Complete REST API and WebSocket documentation
- **[Bridge Implementation](bridge-implementation.md)** - Network bridge setup and configuration
- **[Bridge Visualization](bridge-visualization.md)** - Visual guide to bridge concepts

### Technical Documentation
- **[MCP Tools Quick Reference](../server/MCP_TOOLS_QUICK_REFERENCE.md)** - AI assistant tool documentation (14 tools)
- **[Network Troubleshooting Tools](../server/NETWORK_TROUBLESHOOTING_TOOLS.md)** - Diagnostic workflow guide
- **[CLAUDE.md](../CLAUDE.md)** - Design system and UI implementation guidelines

### Features
- **Real-Time Terminal**: WebSocket-based RouterOS command execution
- **AI Agent Diagnostics**: Claude-powered network troubleshooting with confidence scoring
- **WireGuard VPN**: Complete VPN setup with QR codes for mobile clients
- **Configuration Backups**: Automated backup creation, download, and restore
- **Network Monitoring**: Live router metrics, interface status, and traffic stats
- **Service Management**: Backend service control with status monitoring

### Additional Resources
- **[Main README](../README.md)** - Project overview and quick start
- **[Server README](../server/README.md)** - Backend architecture and setup
- **[ROADMAP](../ROADMAP.md)** - Planned features and development timeline

---

## 🎯 Documentation for Different Roles

### 👤 **For Users**
1. Start with [Main README](../README.md) for project overview
2. Follow [Quick Start Guide](QUICK_START.md) to get running in 5 minutes
3. Review [API Reference](API.md) for integration capabilities
4. Explore AI features via [MCP Tools Reference](../server/MCP_TOOLS_QUICK_REFERENCE.md)

### 👨‍💻 **For Developers**
1. Read [CLAUDE.md](../CLAUDE.md) for design system and UI guidelines
2. Study [API Reference](API.md) for all endpoints
3. Review [Server README](../server/README.md) for backend architecture
4. Check [MCP Tools Reference](../server/MCP_TOOLS_QUICK_REFERENCE.md) for AI tooling

### 🔧 **For Network Administrators**
1. Follow [Quick Start Guide](QUICK_START.md) for installation
2. Learn network troubleshooting via [Network Tools Guide](../server/NETWORK_TROUBLESHOOTING_TOOLS.md)
3. Set up VPN with WireGuard page (see [API Reference](API.md))
4. Configure backups and settings via web interface

---

## 🚀 Quick Links

| Feature | Documentation | Status |
|---------|---------------|--------|
| Real-time Terminal | [API Reference](API.md#websocket-api) | ✅ Complete |
| AI Agent Diagnostics | [MCP Tools Reference](../server/MCP_TOOLS_QUICK_REFERENCE.md) | ✅ Complete |
| WireGuard VPN | [API Reference](API.md#wireguard-vpn) | ✅ Complete |
| Configuration Backups | [API Reference](API.md#configuration-backups) | ✅ Complete |
| REST API | [API Reference](API.md) | ✅ Complete |
| WebSocket Protocol | [API Reference](API.md#websocket-api) | ✅ Complete |
| Network Troubleshooting | [Network Tools Guide](../server/NETWORK_TROUBLESHOOTING_TOOLS.md) | ✅ Complete |
| Design System | [CLAUDE.md](../CLAUDE.md) | ✅ Complete |

---

## 📊 Project Stats

- **Version:** 1.0.0
- **Backend:** Node.js + Express + Socket.IO + TypeScript + Better-SQLite3
- **Frontend:** React 18 + TypeScript + Vite + CSS Modules + Ant Design (selective)
- **Router Support:** MikroTik RouterOS 6.x, 7.x
- **AI Integration:** Claude AI with 14 specialized MCP tools
- **Real-time:** WebSocket with auto-reconnection and persistent sessions
- **Storage:** SQLite for settings, backups metadata, WireGuard configs, and AI agent data
- **Performance:** Optimized with intelligent caching and parallel processing

---

## 🔍 Search Documentation

Use your browser's search (Ctrl+F / Cmd+F) to find specific topics across all documentation files.

---

## 📝 Contributing to Documentation

Found an error or want to improve documentation? See [Development Guide](DEVELOPMENT.md) for contribution guidelines.

---

**Last Updated:** October 2025
**Status:** Work In Progress - Not Production Ready (See Warning in Main README)
**License:** MIT

## 📦 Current Implementation Status

### ✅ Completed Features
- Real-time terminal with WebSocket
- Dashboard with live router metrics
- Network interface management
- AI agent diagnostics with 14 MCP tools
- WireGuard VPN management
- Configuration backup/restore system
- Settings persistence
- Service management
- Setup wizard
- Firewall analysis
- Network troubleshooting tools

### 🚧 In Development
- Advanced analytics
- Network topology mapping
- Enhanced firewall management
- Learning dashboard
- Multi-router support

### 📋 Planned Features
See [ROADMAP.md](../ROADMAP.md) for complete feature planning
