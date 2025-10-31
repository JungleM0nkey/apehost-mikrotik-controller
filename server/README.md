# MikroTik Dashboard - Backend Server

**Status**: Phase 3 - Network Troubleshooting Enhancement Complete
**Stack**: Node.js + Express + TypeScript + MikroTik RouterOS API + Claude AI

---

## Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MikroTik router details
```

### 3. Run Development Server
```bash
npm run dev
```

Server runs on http://localhost:3000

---

## 🤖 AI Assistant & Network Troubleshooting

The backend includes a **Claude AI-powered assistant** with **14 specialized MCP (Model Context Protocol) tools** for comprehensive network troubleshooting:

### Network Troubleshooting Tools (NEW ✨)

#### 1. analyze_firewall
**Intelligent firewall path analysis** - Diagnoses why traffic is blocked/allowed
- Matches traffic against firewall rules with CIDR/port range support
- Returns exact blocking rule with actionable recommendations
- Confidence scoring: high/medium/low
- Example: "Why can't 192.168.1.100 access 10.0.0.50 on port 443?"

#### 2. test_connectivity
**Active connectivity testing** - Tests network reachability and performance
- **ping**: Packet loss, latency, quality assessment (excellent→unreachable)
- **traceroute**: Hop-by-hop path discovery, routing loop detection
- **bandwidth-test**: Upload/download throughput measurement
- Example: "Ping 8.8.8.8" or "Trace route to google.com"

#### 3. query_network
**Network layer diagnostics** - Layer 2/3 information lookup
- **arp**: IP-to-MAC mapping, duplicate IP detection
- **dns**: Hostname resolution testing
- **dhcp**: Lease information and status
- **addresses**: IP address configuration by interface
- Example: "What's the MAC for 192.168.1.100?" or "Resolve google.com"

### Systematic Troubleshooting Workflow

The AI follows a **5-phase diagnostic approach**:
1. **Understand Problem**: Gather src/dst/port/error details
2. **Test Connectivity**: Ping to check basic reachability
3. **Analyze Firewall**: Check if rules are blocking (80% of issues)
4. **Check Network Layer**: ARP, DNS, DHCP diagnostics
5. **Trace Path**: Identify routing issues

### Example AI Interactions

```
User: "Why can't 192.168.1.100 access 10.0.0.50 on HTTPS?"
AI: → analyze_firewall(analyze_path, src=192.168.1.100, dst=10.0.0.50, service=https)
    Returns: "Blocked by rule #42 'drop-external' - Recommendation: Add ACCEPT rule before it"

User: "Device 192.168.1.50 not appearing on network"
AI: → query_network(dhcp, address=192.168.1.50)
    → query_network(arp, address=192.168.1.50)
    → test_connectivity(ping, address=192.168.1.50)
    Returns: Comprehensive diagnosis with specific recommendations

User: "Is my internet connection good?"
AI: → test_connectivity(ping, address=8.8.8.8)
    Returns: "Excellent - 0% packet loss, 12ms avg latency"
```

See [MCP_TOOLS_QUICK_REFERENCE.md](./MCP_TOOLS_QUICK_REFERENCE.md) for complete tool documentation.

---

## API Endpoints

### Core Endpoints
- **GET** `/api/health` - Server and router health status
- **GET** `/api/router/status` - Router information, CPU, memory, uptime
- **GET** `/api/router/interfaces` - Network interfaces with status and traffic
- **GET** `/api/router/resources` - CPU, memory, and system resources
- **POST** `/api/terminal/execute` - Execute RouterOS command (HTTP)

### AI Agent Endpoints
- **GET** `/api/agent/issues` - Get detected network issues with AI analysis
- **GET** `/api/agent/metrics` - Agent performance metrics and statistics
- **POST** `/api/agent/scan` - Trigger AI diagnostic scan
- **PATCH** `/api/agent/issues/:id` - Update issue status

### WireGuard VPN Endpoints
- **GET** `/api/wireguard/interface` - Get WireGuard interface config
- **POST** `/api/wireguard/interface` - Create/update WireGuard interface
- **DELETE** `/api/wireguard/interface` - Remove WireGuard interface
- **GET** `/api/wireguard/peers` - List all WireGuard peers
- **POST** `/api/wireguard/peers` - Add new peer with auto-generated keys
- **GET** `/api/wireguard/peers/:id/config` - Get peer configuration file
- **GET** `/api/wireguard/peers/:id/qr` - Get QR code for mobile setup
- **PATCH** `/api/wireguard/peers/:id` - Update peer configuration
- **DELETE** `/api/wireguard/peers/:id` - Remove peer

### Configuration Backup Endpoints
- **GET** `/api/backups` - List all configuration backups
- **POST** `/api/backups/create` - Create new backup with optional name
- **GET** `/api/backups/:id/download` - Download backup file
- **POST** `/api/backups/:id/restore` - Restore configuration from backup
- **POST** `/api/backups/:id/export` - Export configuration as text
- **DELETE** `/api/backups/:id` - Delete backup file

### Settings Management Endpoints
- **GET** `/api/settings` - Get all application settings
- **PATCH** `/api/settings` - Update settings
- **POST** `/api/settings/test-connection` - Test router connection

### Service Control Endpoints
- **GET** `/api/service/status` - Get backend service status
- **POST** `/api/service/restart` - Restart backend service
- **POST** `/api/service/stop` - Stop backend service

### Setup Wizard Endpoints
- **GET** `/api/setup/status` - Get wizard completion status
- **POST** `/api/setup/complete` - Complete setup step

See [docs/API.md](../docs/API.md) for complete API documentation with request/response examples.

---

## Project Structure

```
server/
├── src/
│   ├── routes/
│   │   ├── agent.ts         # AI agent diagnostics endpoints
│   │   ├── backups.ts       # Configuration backup/restore
│   │   ├── health.ts        # Health check endpoint
│   │   ├── router.ts        # Router API endpoints
│   │   ├── service.ts       # Service management
│   │   ├── settings.ts      # Settings persistence
│   │   ├── setup.ts         # Setup wizard
│   │   ├── terminal.ts      # Terminal command execution
│   │   └── wireguard.ts     # WireGuard VPN management
│   ├── services/
│   │   ├── ai/
│   │   │   ├── mcp/         # 14 MCP tool implementations
│   │   │   │   ├── agent-query-tool.ts
│   │   │   │   ├── connectivity-tool.ts
│   │   │   │   ├── dhcp-tool.ts
│   │   │   │   ├── firewall-tool.ts
│   │   │   │   └── ... (10 more tools)
│   │   │   └── mcp-executor.ts  # MCP tool orchestration
│   │   ├── backup-management.service.ts
│   │   ├── config/          # Configuration management
│   │   │   ├── config.migrator.ts
│   │   │   └── config.validator.ts
│   │   ├── settings.ts      # Settings service
│   │   ├── setup.service.ts # Setup wizard service
│   │   └── wireguard/       # WireGuard service layer
│   ├── data/                # SQLite databases
│   │   ├── agent.db         # AI agent issue tracking
│   │   ├── wireguard.db     # WireGuard configurations
│   │   └── backups/         # Backup files storage
│   ├── utils/               # Helper functions
│   └── index.ts             # Express app entry point
├── scripts/                 # Utility scripts
│   ├── migrate-config.ts
│   ├── validate-config.ts
│   └── backup-config.ts
├── MCP_TOOLS_QUICK_REFERENCE.md
├── NETWORK_TROUBLESHOOTING_TOOLS.md
├── package.json
├── tsconfig.json
└── .env
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |
| CORS_ORIGIN | http://localhost:5173 | Frontend origin |
| MIKROTIK_HOST | 192.168.88.1 | Router IP address |
| MIKROTIK_PORT | 8728 | RouterOS API port |
| MIKROTIK_USERNAME | admin | Router username |
| MIKROTIK_PASSWORD | | Router password (quote if contains #) |
| MIKROTIK_TIMEOUT | 10000 | API connection timeout (ms) |
| MIKROTIK_KEEPALIVE_SEC | 30 | Keep-alive interval (seconds) |
| ANTHROPIC_API_KEY | | Claude API key for AI features |
| DATA_DIR | ./data | Data storage directory |
| BACKUPS_DIR | ./data/backups | Backup files directory |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload (tsx watch) |
| `npm run build` | Build TypeScript to JavaScript (dist/) |
| `npm start` | Run production server from dist/ |
| `npm run typecheck` | Check TypeScript types without building |
| `npm run migrate-config` | Migrate configuration to new schema |
| `npm run validate-config` | Validate current configuration |
| `npm run backup-config` | Create configuration backup |
| `npm run restore-config` | Restore configuration from backup |
| `npm run list-backups` | List available configuration backups |

---

## Current Implementation

### Phase 3 - Network Troubleshooting Enhancement (Complete)
- ✅ Express server with Socket.IO WebSocket
- ✅ TypeScript with strict mode
- ✅ CORS middleware with origin validation
- ✅ Complete routing structure (10 route files)
- ✅ MikroTik RouterOS API integration
- ✅ Real-time terminal with session management
- ✅ Claude AI integration with 14 MCP tools
- ✅ SQLite databases (agent, wireguard, backups)
- ✅ Configuration backup/restore system
- ✅ WireGuard VPN management with QR codes
- ✅ Settings persistence with validation
- ✅ Service control endpoints
- ✅ Setup wizard flow
- ✅ Request logging and audit trails
- ✅ Comprehensive error handling

### AI Assistant Features
- ✅ 14 specialized MCP tools for network diagnostics
- ✅ Intelligent firewall path analysis
- ✅ Active connectivity testing (ping, traceroute, bandwidth)
- ✅ Network layer diagnostics (ARP, DNS, DHCP)
- ✅ Confidence scoring for recommendations
- ✅ 5-phase systematic troubleshooting workflow
- ✅ Rate limiting and security controls
- ✅ Audit logging for all tool executions

---

## Future Enhancements

### High Priority
- [ ] JWT authentication and authorization
- [ ] User management and roles
- [ ] Multi-router support
- [ ] Advanced analytics and reporting
- [ ] Network topology mapping

### Medium Priority
- [ ] Automated scheduled backups
- [ ] Email notifications for alerts
- [ ] API rate limiting per user
- [ ] Redis caching layer
- [ ] Prometheus metrics export

### Low Priority
- [ ] OpenAPI/Swagger documentation
- [ ] Comprehensive unit test coverage
- [ ] Integration test suite
- [ ] Docker containerization
- [ ] Kubernetes deployment configs

---

## Security Notes

### Current Status (Development/Testing)
- ⚠ **No user authentication** - Single user mode only
- ⚠ **API access unrestricted** - All endpoints publicly accessible
- ⚠ **Passwords in .env** - Not suitable for production without secrets manager
- ✅ **MCP tool rate limiting** - 20 calls per minute per session
- ✅ **Command whitelist** - Only safe RouterOS commands allowed
- ✅ **Audit logging** - All MCP tool executions logged
- ✅ **Input validation** - Zod schemas for API requests
- ✅ **CORS configured** - Origin restriction in place

### Production Requirements
- ⚠ **Critical**: Implement JWT authentication and user sessions
- ⚠ **Critical**: Add per-user API rate limiting
- ⚠ **Critical**: Use environment secrets management (Vault, AWS Secrets Manager)
- ⚠ **Critical**: Enable HTTPS with valid certificates
- ⚠ **Important**: Implement role-based access control (RBAC)
- ⚠ **Important**: Add API request signing and validation
- ⚠ **Important**: Implement IP whitelisting
- ⚠ **Recommended**: Add intrusion detection monitoring
- ⚠ **Recommended**: Implement comprehensive audit logging with retention

---

## Testing

### Test API Endpoints

Health check:
```bash
curl http://localhost:3000/api/health
```

Router status:
```bash
curl http://localhost:3000/api/router/status
```

Interfaces:
```bash
curl http://localhost:3000/api/router/interfaces
```

Execute command:
```bash
curl -X POST http://localhost:3000/api/terminal/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "/system resource print"}'
```

---

## Dependencies

### Production
- **express**: Web framework for REST API
- **socket.io**: WebSocket library for real-time communication
- **cors**: Cross-origin resource sharing middleware
- **node-routeros**: MikroTik RouterOS API client
- **@anthropic-ai/sdk**: Claude AI integration for diagnostics
- **better-sqlite3**: SQLite database for local persistence
- **qrcode**: QR code generation for WireGuard mobile setup
- **zod**: Runtime type validation
- **chalk** & **boxen**: Enhanced terminal output

### Development
- **typescript**: Type safety and modern JavaScript features
- **tsx**: Fast TypeScript execution and hot reload
- **@types/***: TypeScript type definitions
- **chokidar**: File watching for configuration changes

---

## Integration with Frontend

### Frontend API Service
Update frontend to call backend endpoints:

```typescript
// src/services/api.ts
const API_BASE = 'http://localhost:3000/api';

export const getRouterStatus = async () => {
  const response = await fetch(`${API_BASE}/router/status`);
  return response.json();
};
```

### CORS Configuration
Frontend (http://localhost:5173) is allowed by default. Update `CORS_ORIGIN` in `.env` for production.

---

## Next Steps

### Immediate (Phase 4)
1. **Authentication System**: Implement JWT-based user authentication
2. **User Management**: Add user creation, roles, and permissions
3. **Enhanced Security**: Add API rate limiting and request signing
4. **Advanced Analytics**: Expand metrics collection and reporting

### Short Term
1. **Multi-Router Support**: Manage multiple routers from single dashboard
2. **Automated Backups**: Scheduled configuration backups
3. **Alert System**: Email/webhook notifications for critical events
4. **Network Topology**: Visual network mapping and device discovery

### Long Term
1. **Production Deployment**: Docker containerization and orchestration
2. **High Availability**: Redis caching and load balancing
3. **Monitoring Integration**: Prometheus metrics and Grafana dashboards
4. **API Documentation**: OpenAPI/Swagger specification

---

## Development Tips

### Hot Reload
The `npm run dev` command watches for file changes and automatically restarts the server.

### TypeScript
All code is type-checked. Run `npm run typecheck` to verify types without building.

### Debugging
Add `console.log()` or use a debugger. Logs appear in the terminal running `npm run dev`.

### Port Conflicts
If port 3000 is in use, change `PORT` in `.env`.

---

**Status**: Phase 3 Complete - Network Troubleshooting Enhancement
**Current Version**: 1.0.0 (Development/Testing)
**Next Phase**: Phase 4 - Authentication & Multi-Router Support
**Production Ready**: No (See Security Notes and Warning in Main README)
