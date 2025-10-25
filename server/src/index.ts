// Load environment variables FIRST before any imports
import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from 'cors';
import { routerRoutes } from './routes/router.js';
import { terminalRoutes } from './routes/terminal.js';
import { healthRoutes } from './routes/health.js';
import { serviceRoutes } from './routes/service.js';
import mikrotikService from './services/mikrotik.js';
import { Server as SocketIOServer } from 'socket.io';
import terminalSessionManager from './services/terminal-session.js';
import { createServer } from 'http';

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
let server: any = null;

// Log configuration on startup
console.log('\n📋 Configuration:');
console.log(`   MikroTik Host: ${process.env.MIKROTIK_HOST}`);
console.log(`   MikroTik Port: ${process.env.MIKROTIK_PORT}`);
console.log(`   MikroTik User: ${process.env.MIKROTIK_USERNAME}`);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.use('/api/health', healthRoutes);

// API Routes
app.use('/api/router', routerRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/service', serviceRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'MikroTik Dashboard API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      router: '/api/router',
      terminal: '/api/terminal'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown handler
let shutdownInProgress = false;
const gracefulShutdown = async (signal: string) => {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  
  console.log(`\n[Server] Received ${signal}, starting graceful shutdown...`);
  
  // Close HTTP server
  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed');
    });
  }
  
  // Disconnect from MikroTik
  try {
    await mikrotikService.disconnect('shutdown');
  } catch (error) {
    console.error('[Server] Error disconnecting from MikroTik:', error);
  }
  
  console.log('[Server] Graceful shutdown complete');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Check if port is already in use
import net from 'net';
const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
};

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  
  // Create terminal session
  const session = terminalSessionManager.createSession(socket.id);
  
  // Send session ID to client
  socket.emit('session:created', {
    sessionId: session.id,
    timestamp: new Date().toISOString()
  });
  
  // Handle terminal command execution
  socket.on('terminal:execute', async (data: { command: string; sessionId?: string }) => {
    try {
      const sessionId = data.sessionId || session.id;
      console.log(`[WebSocket] Executing command in session ${sessionId}: ${data.command}`);
      
      // Send command acknowledgment
      socket.emit('terminal:executing', {
        command: data.command,
        timestamp: new Date().toISOString()
      });
      
      const startTime = Date.now();
      const output = await terminalSessionManager.executeCommand(sessionId, data.command);
      const executionTime = Date.now() - startTime;
      
      // Send command output
      socket.emit('terminal:output', {
        command: data.command,
        output,
        executionTime,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[WebSocket] Command execution error:', error.message);
      socket.emit('terminal:error', {
        command: data.command,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Handle get command history
  socket.on('terminal:getHistory', (data: { sessionId?: string }) => {
    const sessionId = data.sessionId || session.id;
    const history = terminalSessionManager.getHistory(sessionId);
    socket.emit('terminal:history', {
      history,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
    terminalSessionManager.removeSessionBySocketId(socket.id);
  });
  
  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// Periodic session cleanup
setInterval(() => {
  terminalSessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000); // Every 5 minutes

// Start server
const startServer = async () => {
  const portAvailable = await checkPort(Number(PORT));
  if (!portAvailable) {
    console.error(`\n[Server] ERROR: Port ${PORT} is already in use!`);
    console.error(`[Server] Please stop the existing process or change the PORT in .env`);
    console.error(`[Server] You can find the process with: ss -ltnp | grep :${PORT}\n`);
    process.exit(1);
  }

  server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n[Server] MikroTik Dashboard API Server`);
    console.log(`[Server] Port: ${PORT}`);
    console.log(`[Server] Host: 0.0.0.0 (accessible from network)`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`\n[Server] HTTP API: http://0.0.0.0:${PORT}`);
    console.log(`[Server] WebSocket: ws://0.0.0.0:${PORT}`);
    console.log(`[Server] Health: http://0.0.0.0:${PORT}/api/health\n`);
  });
};

startServer();

export default app;
