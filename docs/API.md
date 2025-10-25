# API Reference

Complete API documentation for MikroTik Dashboard REST API and WebSocket protocol.

## REST API

Base URL: `http://localhost:3000/api`

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
