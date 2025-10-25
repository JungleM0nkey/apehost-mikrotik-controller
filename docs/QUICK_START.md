# Quick Start Guide

Get your MikroTik Dashboard up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- MikroTik router accessible on your network
- Terminal/command line access

## Step 1: Clone or Extract Project

```bash
cd /path/to/mikrotik-dashboard
```

## Step 2: Install Dependencies

### Backend:
```bash
cd server
npm install
```

### Frontend:
```bash
cd ..
npm install
```

## Step 3: Configure Environment

Create `server/.env` file:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# MikroTik Router Configuration (IMPORTANT: Quote passwords with # or special chars!)
MIKROTIK_HOST=192.168.100.2
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD="your_password_here"
MIKROTIK_TIMEOUT=10000
MIKROTIK_KEEPALIVE_SEC=30
```

**⚠️ CRITICAL:** If your password contains `#` or other special characters, **wrap it in quotes**!

## Step 4: Start Servers

### Terminal 1 - Backend:
```bash
cd server
npm run dev
```

**Should see:**
```
[Server] MikroTik Dashboard API Server
[Server] Port: 3000
[Server] HTTP API: http://localhost:3000
[Server] WebSocket: ws://localhost:3000
```

### Terminal 2 - Frontend:
```bash
npm run dev
```

**Should see:**
```
VITE ready in X ms
➜  Local:   http://localhost:5173/
```

## Step 5: Access Dashboard

Open your browser to: **http://localhost:5173**

## Step 6: Test Terminal

1. Navigate to the **Terminal** page
2. Wait for green "Connected" indicator
3. Try a test command:
   ```
   /system/identity/print
   ```

## ✅ Success Indicators

- ✅ Green dot in terminal header = WebSocket connected
- ✅ Commands execute and return output
- ✅ UP/DOWN arrows navigate command history
- ✅ Dashboard shows real router data

## 🔧 Troubleshooting

### "Connection failed" error:
- Check MikroTik router is accessible: `ping 192.168.100.2`
- Verify API service is enabled on router: `/ip service print`
- Check username/password are correct

### "Port already in use":
- Kill existing process: `kill $(lsof -t -i:3000)`
- Or change PORT in `.env`

### WebSocket not connecting:
- Ensure backend is running first
- Check browser console for errors
- Verify CORS_ORIGIN matches frontend URL

## 🚀 Next Steps

- [Terminal Guide](TERMINAL.md) - Learn all terminal features
- [Configuration Guide](CONFIGURATION.md) - Advanced settings
- [API Reference](API.md) - Integrate with other tools

---

**Need Help?** See [Troubleshooting](TROUBLESHOOTING.md)
