# Terminal WebSocket Connection Issue - Root Cause Analysis

## Problem
Terminal shows "WebSocket not connected" error when typing commands.

## Root Causes Identified

### 1. Port Mismatch (Critical)
- **Location**: `vite.config.ts:18`
- **Issue**: Proxy target points to port 3001, but server runs on port 3000
- **Impact**: All API and WebSocket connections fail or go to wrong port
- **Fix**: Change proxy target from `http://localhost:3001` → `http://localhost:3000`

### 2. WebSocket Singleton Disconnect Issue
- **Location**: `src/components/organisms/TerminalPanel/TerminalPanel.tsx:132`
- **Issue**: Component unmount calls `websocket.disconnect()` which sets `socket=null`
- **Impact**: When ResizableTerminal switches states (minimize/maximize), TerminalPanel remounts with null socket
- **Fix**: Remove `websocket.disconnect()` from cleanup, only cleanup event listeners

### 3. Race Condition in Command Execution
- **Location**: `src/services/websocket.ts:138-140`
- **Issue**: `executeCommand()` throws immediately if not connected, even if connection is in progress
- **Impact**: Fast typing or command execution during connection throws error
- **Fix**: Add waiting logic - wait for connection if `isConnecting=true`

### 4. Missing WebSocket Proxy Configuration
- **Location**: `vite.config.ts`
- **Issue**: No WebSocket/socket.io proxy configuration in Vite
- **Impact**: WebSocket connections may bypass proxy, causing CORS issues
- **Fix**: Add socket.io to proxy paths

## File Dependencies
- Frontend: `src/services/websocket.ts`, `src/components/organisms/TerminalPanel/TerminalPanel.tsx`
- Backend: `server/src/index.ts` (Socket.IO server)
- Config: `vite.config.ts`, `server/.env`

## Solution Priority
1. Fix port mismatch (critical - nothing works without this)
2. Fix singleton disconnect issue (high - prevents reconnection)
3. Add connection waiting logic (high - prevents race conditions)
4. Add WebSocket proxy config (medium - improves reliability)
