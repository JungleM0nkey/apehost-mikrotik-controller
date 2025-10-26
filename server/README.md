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

### Health Check
```
GET /api/health
```
Returns server health status

### Router Status
```
GET /api/router/status
```
Returns router information, CPU, memory, uptime

### Network Interfaces
```
GET /api/router/interfaces
```
Returns list of network interfaces with status and traffic

### Resources
```
GET /api/router/resources
```
Returns CPU, memory, and system resources

### Terminal Command
```
POST /api/terminal/execute
Body: { "command": "/system resource print" }
```
Executes RouterOS command and returns output

---

## Project Structure

```
server/
├── src/
│   ├── routes/
│   │   ├── health.ts        # Health check endpoint
│   │   ├── router.ts        # Router API endpoints
│   │   └── terminal.ts      # Terminal command execution
│   ├── services/
│   │   └── (future: mikrotik service)
│   ├── middleware/
│   │   └── (future: auth, validation)
│   ├── types/
│   │   └── (future: TypeScript types)
│   └── index.ts             # Express app entry point
├── config/
│   └── (future: configuration files)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |
| MIKROTIK_HOST | 192.168.88.1 | Router IP |
| MIKROTIK_PORT | 8728 | RouterOS API port |
| MIKROTIK_USERNAME | admin | Router username |
| MIKROTIK_PASSWORD | | Router password |
| CORS_ORIGIN | http://localhost:5173 | Frontend origin |
| WS_PORT | 3001 | WebSocket port |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run typecheck` | Check TypeScript types |

---

## Current Implementation

### Phase 2 Foundation (Complete)
- ✅ Express server setup
- ✅ TypeScript configuration
- ✅ CORS middleware
- ✅ Basic routing structure
- ✅ Mock API endpoints
- ✅ Request logging
- ✅ Error handling

### Mock Data
All endpoints currently return mock data matching the frontend expectations. This allows frontend development to continue while real MikroTik integration is implemented.

---

## TODO (Phase 2 Continued)

### High Priority
- [ ] Real MikroTik RouterOS API integration
- [ ] WebSocket server for terminal
- [ ] Authentication middleware
- [ ] Session management
- [ ] Input validation

### Medium Priority
- [ ] Rate limiting
- [ ] Request caching
- [ ] Error logging service
- [ ] Database integration (optional)

### Low Priority
- [ ] API documentation (Swagger)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Docker support

---

## Security Notes

### Current Status (Development Only)
- ⚠ No authentication implemented yet
- ⚠ Mock data only, no real router access
- ⚠ CORS open to frontend origin
- ⚠ Passwords in .env (not committed)

### Production Requirements
- Implement JWT authentication
- Add rate limiting
- Validate all inputs
- Use environment secrets management
- Enable HTTPS
- Restrict CORS properly

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
- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment configuration
- **ws**: WebSocket library (future)
- **node-routeros**: MikroTik API client (future)

### Development
- **typescript**: Type safety
- **tsx**: TypeScript execution
- **@types/***: Type definitions

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

1. **Test Mock API**: Verify all endpoints return expected data
2. **Frontend Integration**: Connect Dashboard to real API
3. **MikroTik Integration**: Implement real router communication
4. **WebSocket Terminal**: Add real-time terminal communication
5. **Authentication**: Implement user authentication
6. **Production Deploy**: Docker + environment setup

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

**Status**: Backend foundation complete, ready for MikroTik integration  
**Next Phase**: Phase 3 - Frontend-Backend Integration
