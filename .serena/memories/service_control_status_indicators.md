# Service Control Status Indicators

## Overview
Transformed static status badges into interactive service control panels with detailed information and management actions.

## Components Created

### 1. ServiceControl Component
**Location**: [src/components/molecules/ServiceControl/ServiceControl.tsx](src/components/molecules/ServiceControl/ServiceControl.tsx)

**Features**:
- Click-to-expand dropdown with service details
- Real-time status display (online/offline/connecting)
- Service information display:
  - IP addresses and ports
  - Uptime (formatted)
  - Memory usage
  - Process ID (PID)
  - Node.js version
- Action buttons (Backend only):
  - Refresh Info
  - Restart Service (with confirmation)
  - Shutdown Service (with confirmation)

**Props**:
```typescript
serviceName: 'Frontend' | 'Backend'
status: 'online' | 'offline' | 'connecting'
serviceInfo?: ServiceInfo
onRestart?: () => void
onShutdown?: () => void
onRefresh?: () => void
```

### 2. Backend Service API Routes
**Location**: [server/src/routes/service.ts](server/src/routes/service.ts)

**Endpoints**:
- `GET /api/service/info` - Service information
  - Returns: addresses, port, uptime, PID, memory, Node version
- `POST /api/service/restart` - Graceful restart
  - Triggers `process.exit(0)` for process manager restart
- `POST /api/service/shutdown` - Graceful shutdown
  - Triggers `process.exit(0)` for shutdown

**Service Info Response**:
```json
{
  "service": "backend",
  "status": "online",
  "addresses": ["172.27.133.116"],
  "port": "3000",
  "uptime": 125,
  "uptimeFormatted": "2m 5s",
  "pid": 12345,
  "nodeVersion": "v20.9.0",
  "platform": "linux",
  "memory": {
    "used": 45,
    "total": 118
  }
}
```

### 3. Updated Header Component
**Location**: [src/components/organisms/Header/Header.tsx](src/components/organisms/Header/Header.tsx)

**Changes**:
- Replaced static Badge components with ServiceControl
- Added service info fetching
- Implemented restart/shutdown handlers
- Auto-refresh every 5 seconds
- Frontend info shows hostname and port
- Backend info fetched from API

## Features

### Frontend Service Control
- **Status**: Always "online" (if page loads)
- **Info Displayed**:
  - Address: hostname (e.g., localhost, 172.27.133.116)
  - Port: 5173 (Vite dev server)
- **Actions**: None (frontend can't control itself)

### Backend Service Control
- **Status**: online/offline/connecting
- **Info Displayed**:
  - Addresses: All network interfaces (e.g., 172.27.133.116:3000)
  - Port: 3000
  - Uptime: Formatted (e.g., "2h 15m 30s")
  - Memory: Used/Total in MB
  - PID: Process ID
  - Node Version: e.g., v20.9.0
- **Actions**:
  - 🔄 **Refresh Info**: Update service information
  - 🔄 **Restart Service**: Graceful restart (confirmation required)
  - ⚡ **Shutdown Service**: Graceful shutdown (confirmation required)

## User Flow

### Viewing Service Info
1. Click on "Frontend" or "Backend" badge
2. Dropdown appears with detailed service information
3. Click outside to close

### Restarting Backend
1. Click "Backend" badge
2. Click "Restart Service" button
3. Confirm action in dialog
4. Backend performs graceful exit
5. Process manager (tsx watch) restarts automatically
6. Status changes: online → connecting → online

### Shutting Down Backend
1. Click "Backend" badge
2. Click "Shutdown Service" button
3. Confirm action in dialog
4. Backend performs graceful shutdown
5. Status changes to offline

## Implementation Notes

### Graceful Shutdown
- 1-second delay before `process.exit(0)`
- Allows response to be sent before shutdown
- Clean disconnection from MikroTik router
- WebSocket connections closed properly

### Process Manager Compatibility
- Works with `tsx watch` (development)
- Works with `pm2`, `nodemon`, etc.
- `exit(0)` signals clean exit for restart

### Network Interface Detection
- Uses Node.js `os.networkInterfaces()`
- Filters out internal interfaces (127.0.0.1)
- Shows all IPv4 addresses
- Useful for WSL/Docker environments

## Testing

### To Test Frontend Info
1. Click "Frontend" badge
2. Verify hostname and port displayed
3. Confirm status is "online"

### To Test Backend Info
1. Click "Backend" badge
2. Verify all info fields populated:
   - Address(es) with port
   - Uptime updating
   - Memory usage
   - PID matches server process
3. Click "Refresh Info" to update

### To Test Backend Restart
1. Click "Backend" badge
2. Click "Restart Service"
3. Confirm dialog
4. Watch server console for restart messages
5. Verify status returns to "online" after ~2 seconds

### To Test Backend Shutdown
1. Click "Backend" badge
2. Click "Shutdown Service"
3. Confirm dialog
4. Verify status changes to "offline"
5. Manually restart server: `npm run dev`

## Files Modified/Created

**Created**:
- `src/components/molecules/ServiceControl/ServiceControl.tsx`
- `src/components/molecules/ServiceControl/ServiceControl.module.css`
- `server/src/routes/service.ts`

**Modified**:
- `src/components/organisms/Header/Header.tsx`
- `server/src/index.ts` (added service routes)

## Future Enhancements
- Add frontend build info (version, commit hash)
- Add logs viewer in dropdown
- Add resource graphs (CPU, memory over time)
- Add restart history/logs
- Add health check endpoint details
