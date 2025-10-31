# API Reference

Complete API documentation for MikroTik Dashboard REST API and WebSocket protocol.

## REST API

Base URL: `http://localhost:3000/api`

### Table of Contents
- [Health & Status](#health-check)
- [Router Management](#router-status)
- [Network Interfaces](#network-interfaces)
- [AI Agent](#ai-agent)
- [WireGuard VPN](#wireguard-vpn)
- [Configuration Backups](#configuration-backups)
- [Settings Management](#settings-management)
- [Service Control](#service-control)
- [Setup Wizard](#setup-wizard)
- [Terminal](#execute-terminal-command-legacy-http)
- [WebSocket API](#websocket-api)

### Health Check

**GET** `/api/health`

Returns server and router health status.

**Response:**
```json
{
  "status": "ok",
  "pid": 12345,
  "port": "3000",
  "timestamp": "2025-10-25T00:00:00.000Z",
  "uptime": 3600.5,
  "memory": {
    "rss": 110252032,
    "heapTotal": 20496384,
    "heapUsed": 11774816
  },
  "env": {
    "host": "192.168.100.2",
    "port": "8728"
  },
  "router": {
    "connected": true,
    "connectedSince": "2025-10-25T00:00:00.000Z",
    "lastError": null,
    "routerIdentity": "MikroTik",
    "host": "192.168.100.2",
    "port": 8728
  }
}
```

### Router Status

**GET** `/api/router/status`

Returns detailed router information.

**Response:**
```json
{
  "name": "MikroTik",
  "ip": "192.168.100.2",
  "model": "CCR2004-1G-12S+2XS",
  "version": "7.20 (stable)",
  "status": "online",
  "cpuLoad": 0,
  "memoryUsed": 309157888,
  "memoryTotal": 4294967296,
  "uptime": 645868,
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

### Network Interfaces

**GET** `/api/router/interfaces`

Returns list of network interfaces.

**Response:**
```json
[
  {
    "id": "*1",
    "name": "ether1",
    "type": "ether",
    "status": "up",
    "rxRate": 1024000,
    "txRate": 512000,
    "rxBytes": 1073741824,
    "txBytes": 536870912,
    "comment": "WAN"
  }
]
```

### System Resources

**GET** `/api/router/resources`

Returns CPU, memory, and uptime information.

**Response:**
```json
{
  "cpu": {
    "load": 5,
    "count": 4
  },
  "memory": {
    "used": 309157888,
    "total": 4294967296,
    "percentage": 7
  },
  "disk": {
    "used": 0,
    "total": 0,
    "percentage": 0
  },
  "uptime": 645868,
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

### Execute Terminal Command (Legacy HTTP)

**POST** `/api/terminal/execute`

Executes a RouterOS command via HTTP.

**Request:**
```json
{
  "command": "/system/identity/print"
}
```

**Response:**
```json
{
  "command": "/system/identity/print",
  "output": "name: MikroTik",
  "timestamp": "2025-10-25T00:00:00.000Z",
  "executionTime": 45
}
```

---

### AI Agent

**GET** `/api/agent/issues`

Returns detected network issues with AI analysis.

**Response:**
```json
[
  {
    "id": "issue_123",
    "title": "High CPU Usage",
    "description": "Router CPU usage exceeded 80%",
    "severity": "high",
    "category": "performance",
    "status": "detected",
    "confidence": 0.95,
    "detectedAt": "2025-10-25T00:00:00.000Z",
    "recommendations": [
      "Check for runaway processes",
      "Review firewall rules complexity"
    ]
  }
]
```

**GET** `/api/agent/metrics`

Returns agent performance metrics.

**Response:**
```json
{
  "totalIssues": 5,
  "criticalCount": 1,
  "highCount": 2,
  "mediumCount": 1,
  "lowCount": 1,
  "resolvedCount": 10,
  "averageConfidence": 0.87,
  "lastScanTime": "2025-10-25T00:00:00.000Z"
}
```

**POST** `/api/agent/scan`

Triggers an AI diagnostic scan.

**Request:**
```json
{
  "deepScan": true
}
```

**Response:**
```json
{
  "scanId": "scan_456",
  "status": "running",
  "startedAt": "2025-10-25T00:00:00.000Z"
}
```

**PATCH** `/api/agent/issues/:id`

Updates issue status.

**Request:**
```json
{
  "status": "resolved"
}
```

**Response:**
```json
{
  "id": "issue_123",
  "status": "resolved",
  "updatedAt": "2025-10-25T00:00:00.000Z"
}
```

---

### WireGuard VPN

**GET** `/api/wireguard/interface`

Returns WireGuard interface configuration.

**Response:**
```json
{
  "name": "wireguard1",
  "address": "10.0.0.1/24",
  "listenPort": 51820,
  "mtu": 1420,
  "enabled": true,
  "publicKey": "base64_public_key",
  "privateKey": "base64_private_key"
}
```

**POST** `/api/wireguard/interface`

Creates or updates WireGuard interface.

**Request:**
```json
{
  "name": "wireguard1",
  "address": "10.0.0.1/24",
  "listenPort": 51820,
  "mtu": 1420,
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "publicKey": "base64_public_key",
  "message": "Interface created successfully"
}
```

**DELETE** `/api/wireguard/interface`

Removes WireGuard interface.

**Response:**
```json
{
  "success": true,
  "message": "Interface removed successfully"
}
```

**GET** `/api/wireguard/peers`

Returns list of WireGuard peers.

**Response:**
```json
[
  {
    "id": "peer_1",
    "name": "Mobile Client",
    "publicKey": "base64_public_key",
    "allowedAddress": "10.0.0.2/32",
    "endpoint": "203.0.113.1:51820",
    "persistentKeepalive": 25,
    "enabled": true,
    "lastHandshake": "2025-10-25T00:00:00.000Z",
    "rxBytes": 1048576,
    "txBytes": 2097152
  }
]
```

**POST** `/api/wireguard/peers`

Adds a new WireGuard peer.

**Request:**
```json
{
  "name": "Mobile Client",
  "allowedAddress": "10.0.0.2/32",
  "persistentKeepalive": 25,
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "peer": {
    "id": "peer_1",
    "publicKey": "base64_public_key",
    "privateKey": "base64_private_key",
    "presharedKey": "base64_preshared_key"
  }
}
```

**GET** `/api/wireguard/peers/:id/config`

Returns peer configuration as text file.

**Response:**
```
[Interface]
PrivateKey = base64_private_key
Address = 10.0.0.2/32
DNS = 1.1.1.1

[Peer]
PublicKey = base64_server_public_key
PresharedKey = base64_preshared_key
Endpoint = your-server.com:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

**GET** `/api/wireguard/peers/:id/qr`

Returns QR code image for mobile client setup.

**Response:** PNG image (binary)

**PATCH** `/api/wireguard/peers/:id`

Updates peer configuration.

**Request:**
```json
{
  "enabled": false
}
```

**DELETE** `/api/wireguard/peers/:id`

Removes a peer.

**Response:**
```json
{
  "success": true,
  "message": "Peer removed successfully"
}
```

---

### Configuration Backups

**GET** `/api/backups`

Returns list of available backups.

**Response:**
```json
[
  {
    "id": "backup_123",
    "filename": "backup_2025-10-25_12-30-45.backup",
    "name": "backup_2025-10-25_12-30-45",
    "size": 102400,
    "createdAt": "2025-10-25T12:30:45.000Z",
    "type": "manual"
  }
]
```

**POST** `/api/backups/create`

Creates a new router configuration backup.

**Request:**
```json
{
  "name": "pre-upgrade-backup"
}
```

**Response:**
```json
{
  "success": true,
  "backup": {
    "id": "backup_124",
    "filename": "pre-upgrade-backup.backup",
    "size": 102400,
    "createdAt": "2025-10-25T12:35:00.000Z"
  }
}
```

**GET** `/api/backups/:id/download`

Downloads a backup file.

**Response:** Binary file download

**POST** `/api/backups/:id/restore`

Restores router configuration from backup.

**Response:**
```json
{
  "success": true,
  "message": "Configuration restored successfully"
}
```

**DELETE** `/api/backups/:id`

Deletes a backup file.

**Response:**
```json
{
  "success": true,
  "message": "Backup deleted successfully"
}
```

**POST** `/api/backups/:id/export`

Exports router configuration as text.

**Response:**
```json
{
  "success": true,
  "export": {
    "id": "export_123",
    "filename": "export_2025-10-25_12-40-00.rsc",
    "content": "# Router configuration export..."
  }
}
```

---

### Settings Management

**GET** `/api/settings`

Returns all application settings.

**Response:**
```json
{
  "routerHost": "192.168.1.1",
  "routerPort": 8728,
  "routerUsername": "admin",
  "apiEnabled": true,
  "theme": "dark",
  "autoRefresh": true,
  "refreshInterval": 5000
}
```

**PATCH** `/api/settings`

Updates application settings.

**Request:**
```json
{
  "routerHost": "192.168.1.1",
  "autoRefresh": true,
  "refreshInterval": 10000
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "routerHost": "192.168.1.1",
    "autoRefresh": true,
    "refreshInterval": 10000
  }
}
```

**POST** `/api/settings/test-connection`

Tests router connection with current settings.

**Response:**
```json
{
  "success": true,
  "connected": true,
  "routerIdentity": "MikroTik",
  "version": "7.20 (stable)",
  "latency": 12
}
```

---

### Service Control

**GET** `/api/service/status`

Returns backend service status.

**Response:**
```json
{
  "status": "running",
  "uptime": 3600,
  "pid": 12345,
  "memory": 104857600,
  "cpu": 5.2
}
```

**POST** `/api/service/restart`

Restarts the backend service.

**Response:**
```json
{
  "success": true,
  "message": "Service restart initiated",
  "newPid": 12346
}
```

**POST** `/api/service/stop`

Stops the backend service gracefully.

**Response:**
```json
{
  "success": true,
  "message": "Service stopped"
}
```

---

### Setup Wizard

**GET** `/api/setup/status`

Returns setup wizard completion status.

**Response:**
```json
{
  "completed": false,
  "currentStep": "router-config",
  "steps": {
    "welcome": true,
    "router-config": false,
    "api-keys": false,
    "testing": false,
    "complete": false
  }
}
```

**POST** `/api/setup/complete`

Marks setup wizard as complete.

**Request:**
```json
{
  "step": "router-config",
  "data": {
    "routerHost": "192.168.1.1",
    "routerPort": 8728,
    "routerUsername": "admin",
    "routerPassword": "secure_password"
  }
}
```

**Response:**
```json
{
  "success": true,
  "nextStep": "api-keys",
  "completed": false
}
```

---

## WebSocket API

Base URL: `ws://localhost:3000`

### Connection

Connect using Socket.IO client:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
});
```

### Events: Server → Client

#### session:created
Sent when a new terminal session is created.

**Payload:**
```json
{
  "sessionId": "term_1729814400000_abc123xyz",
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

#### terminal:executing
Sent when command execution starts.

**Payload:**
```json
{
  "command": "/system/identity/print",
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

#### terminal:output
Sent with command execution result.

**Payload:**
```json
{
  "command": "/system/identity/print",
  "output": "name: MikroTik",
  "executionTime": 45,
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

#### terminal:error
Sent when command execution fails.

**Payload:**
```json
{
  "command": "/invalid/command",
  "error": "no such command prefix",
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

#### terminal:history
Sent in response to history request.

**Payload:**
```json
{
  "history": [
    "/system/identity/print",
    "/interface/print",
    "/ip/address/print"
  ],
  "timestamp": "2025-10-25T00:00:00.000Z"
}
```

#### pong
Response to ping for connection health check.

**Payload:**
```json
{
  "timestamp": 1729814400000
}
```

### Events: Client → Server

#### terminal:execute
Execute a RouterOS command.

**Payload:**
```json
{
  "command": "/system/identity/print",
  "sessionId": "term_1729814400000_abc123xyz"  // optional
}
```

#### terminal:getHistory
Request command history.

**Payload:**
```json
{
  "sessionId": "term_1729814400000_abc123xyz"  // optional
}
```

#### ping
Check connection health.

**Payload:** `{}`

### Example Usage

```javascript
import { io } from 'socket.io-client';

// Connect
const socket = io('http://localhost:3000');

// Listen for session creation
socket.on('session:created', (data) => {
  console.log('Session:', data.sessionId);
});

// Listen for output
socket.on('terminal:output', (data) => {
  console.log('Output:', data.output);
});

// Execute command
socket.emit('terminal:execute', {
  command: '/system/identity/print'
});

// Get history
socket.emit('terminal:getHistory', {});

// Listen for history
socket.on('terminal:history', (data) => {
  console.log('History:', data.history);
});
```

---

## Error Handling

### HTTP Errors

**400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Command is required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch router status",
  "message": "Username or password is invalid"
}
```

### WebSocket Errors

Errors are sent via `terminal:error` event with error details.

---

## Rate Limiting

Currently no rate limiting is enforced. For production use, implement rate limiting on API endpoints.

---

## Authentication

Currently no authentication is required. For production use, implement JWT or session-based authentication.

---

## CORS

CORS is configured to allow requests from `http://localhost:5173` by default. Update `CORS_ORIGIN` environment variable for production.

---

**Need Help?** See [Troubleshooting](TROUBLESHOOTING.md) or [Development Guide](DEVELOPMENT.md)
