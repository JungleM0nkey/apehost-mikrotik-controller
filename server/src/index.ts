// Load environment variables FIRST before any imports
// IMPORTANT: Always load from project root .env, not from current working directory
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (2 levels up from dist/)
config({ path: path.resolve(__dirname, '../../.env') });

import express, { Request, Response } from 'express';
import cors from 'cors';
import { routerRoutes } from './routes/router.js';
import { terminalRoutes } from './routes/terminal.js';
import { healthRoutes } from './routes/health.js';
import { serviceRoutes } from './routes/service.js';
import { settingsRoutes } from './routes/settings.js';
import agentRoutes from './routes/agent.js';
import mikrotikService from './services/mikrotik.js';
import { Server as SocketIOServer } from 'socket.io';
import terminalSessionManager from './services/terminal-session.js';
import conversationManager from './services/ai/conversation-manager.js';
import { getGlobalProvider } from './services/ai/provider-factory.js';
import { AIServiceError } from './services/ai/errors/index.js';
import { globalMCPExecutor } from './services/ai/mcp/mcp-executor.js';
import { createServer } from 'http';
import { getHealthMonitor } from './services/agent/monitor/health-monitor.js';

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
let server: any = null;

// Log configuration on startup
console.log('\n[CONFIG] Configuration:');
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
app.use('/api/settings', settingsRoutes);
app.use('/api/agent', agentRoutes);

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

  // Stop Health Monitor
  try {
    const healthMonitor = getHealthMonitor();
    healthMonitor.stop();
    console.log('[Server] Health Monitor stopped');
  } catch (error) {
    console.error('[Server] Error stopping Health Monitor:', error);
  }

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

// Track interface streaming intervals per socket
const interfaceStreamingIntervals = new Map<string, NodeJS.Timeout>();

// Initialize AI provider (will be loaded async at startup)
console.log('[Server] AI provider will be initialized at startup...');
export let aiProvider: Awaited<ReturnType<typeof getGlobalProvider>> = null;

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

  // Handle interface statistics streaming
  socket.on('interfaces:subscribe', async (data: { interval?: number } = {}) => {
    const interval = data.interval || 1000; // Default 1 second
    console.log(`[WebSocket] Client ${socket.id} subscribed to interface updates (${interval}ms)`);

    // Clear any existing interval for this socket
    const existingInterval = interfaceStreamingIntervals.get(socket.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Pre-warm traffic stats to avoid sending 0.0 rates on first update
    // This populates previousInterfaceStats without sending to client
    try {
      console.log(`[WebSocket] Pre-warming traffic stats for client ${socket.id}`);
      await mikrotikService.getInterfaces(); // Baseline query - stores stats but rates will be 0.0

      // Wait 200ms for traffic to accumulate before sending first real update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Now get real rates and send initial data
      const interfaces = await mikrotikService.getInterfaces();
      socket.emit('interfaces:update', {
        interfaces,
        timestamp: new Date().toISOString()
      });
      console.log(`[WebSocket] Sent initial traffic data with real rates to client ${socket.id}`);
    } catch (error: any) {
      console.error('[WebSocket] Error during initial data fetch:', error.message);
      socket.emit('interfaces:error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Start streaming updates
    const streamInterval = setInterval(async () => {
      try {
        const interfaces = await mikrotikService.getInterfaces();
        socket.emit('interfaces:update', {
          interfaces,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('[WebSocket] Error fetching interfaces:', error.message);
        socket.emit('interfaces:error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, interval);

    interfaceStreamingIntervals.set(socket.id, streamInterval);
  });

  // Handle unsubscribe from interface updates
  socket.on('interfaces:unsubscribe', () => {
    console.log(`[WebSocket] Client ${socket.id} unsubscribed from interface updates`);
    const existingInterval = interfaceStreamingIntervals.get(socket.id);
    if (existingInterval) {
      clearInterval(existingInterval);
      interfaceStreamingIntervals.delete(socket.id);
    }
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
    terminalSessionManager.removeSessionBySocketId(socket.id);

    // Clean up interface streaming interval
    const existingInterval = interfaceStreamingIntervals.get(socket.id);
    if (existingInterval) {
      clearInterval(existingInterval);
      interfaceStreamingIntervals.delete(socket.id);
    }
  });

  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // AI Assistant events
  socket.on('assistant:message', async (data: { message: string; conversationId: string; context?: any }) => {
    try {
      if (!aiProvider) {
        socket.emit('assistant:error', {
          error: 'AI Assistant not configured. Set up LLM_PROVIDER in .env',
          conversationId: data.conversationId,
          code: 'CONFIG_ERROR',
          canRetry: false,
        });
        return;
      }

      const { message, conversationId } = data;

      if (!message || message.trim().length === 0) {
        socket.emit('assistant:error', {
          error: 'Message cannot be empty',
          conversationId,
          code: 'VALIDATION_ERROR',
          canRetry: false,
        });
        return;
      }

      console.log(`[Assistant] Message received from ${socket.id} (conversation: ${conversationId})`);

      // Add user message to conversation
      const userMessage = conversationManager.addMessage(conversationId, 'user', message);

      // Emit typing indicator
      socket.emit('assistant:typing', {
        conversationId,
        isTyping: true,
      });

      // Get conversation history for LLM
      let messages = conversationManager.getMessagesForLLM(conversationId);

      // Get MCP tool definitions for function calling
      const tools = globalMCPExecutor.getToolDefinitions();
      console.log(`[Assistant] Providing ${tools.length} MCP tools to LLM:`, tools.map(t => t.name));

      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let fullResponse = '';

      try {
        // Tool execution loop - max 5 iterations to prevent infinite loops
        const maxIterations = 5;
        let iteration = 0;

        while (iteration < maxIterations) {
          iteration++;
          console.log(`[Assistant] Tool execution iteration ${iteration}/${maxIterations}`);

          // Provide tools on every iteration to allow multi-step reasoning
          // LLM can call multiple tools until it has enough data to answer
          const response = await aiProvider.sendMessage(messages, {
            tools: tools, // Tools available on all iterations
            maxTokens: 2000,
            systemPrompt: `You are an AI assistant with direct access to a MikroTik router through specialized tools.

IMPORTANT INSTRUCTIONS:
1. You have access to tools that query the router directly - USE THEM to answer questions
2. When you receive tool results, present the ACTUAL DATA to the user in a clear, helpful format
3. NEVER tell users to run manual commands or access the router themselves
4. NEVER say tools are "not available" - they are available and you should use them
5. Present data in tables, lists, or formatted text as appropriate
6. Focus on answering the user's question with the real data you retrieve

Available tools allow you to:
- Get router information and system details
- View network interfaces and their status
- Check DHCP leases (connected devices)
- View routing tables
- Check firewall rules
- Execute safe RouterOS commands

When asked about the network, devices, or configuration - use the appropriate tool and present the results clearly.`,
          });

          console.log(`[Assistant] LLM response - finishReason: ${response.finishReason}, hasToolCalls: ${!!response.toolCalls}`);
          console.log(`[Assistant] LLM content preview: ${response.content.substring(0, 200)}...`);

          // If no tool calls, we have the final response
          if (!response.toolCalls || response.toolCalls.length === 0) {
            fullResponse = response.content;

            // Stream the final response to the client character by character with delay
            for (const char of fullResponse) {
              socket.emit('assistant:stream', {
                chunk: char,
                conversationId,
                messageId: assistantMessageId,
              });
              // Add small delay for realistic typing animation (5ms per character)
              await new Promise(resolve => setTimeout(resolve, 5));
            }
            break;
          }

          // Execute tool calls
          console.log(`[Assistant] Executing ${response.toolCalls.length} tool calls`);
          const toolResults: any[] = [];

          for (const toolCall of response.toolCalls) {
            console.log(`[Assistant] Calling tool: ${toolCall.function.name}`);

            try {
              const args = JSON.parse(toolCall.function.arguments);

              // Execute tool with proper ToolCall and ToolExecutionContext parameters
              const result = await globalMCPExecutor.executeTool(
                {
                  name: toolCall.function.name,
                  input: args,
                  id: toolCall.id,
                },
                {
                  sessionId: socket.id,
                  conversationId: conversationId,
                  timestamp: new Date(),
                }
              );

              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(result),
              });

              console.log(`[Assistant] Tool ${toolCall.function.name} executed successfully`);
            } catch (error: any) {
              console.error(`[Assistant] Tool ${toolCall.function.name} failed:`, error.message);
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify({ error: error.message }),
              });
            }
          }

          // Add assistant message with tool calls to conversation
          messages.push({
            role: 'assistant',
            content: response.content || '[Tool execution in progress]',
          });

          // Add tool results as a clear system message with formatted output
          const toolResultsText = toolResults.map(tr => {
            const resultData = JSON.parse(tr.content);

            // Extract the actual data from the result wrapper
            if (resultData.success && resultData.data) {
              return `TOOL RESULT for ${tr.name}:\n${JSON.stringify(resultData.data, null, 2)}`;
            } else if (resultData.error) {
              return `TOOL ERROR for ${tr.name}:\n${resultData.error}`;
            } else {
              // Fallback to showing the full result
              return `TOOL RESULT for ${tr.name}:\n${JSON.stringify(resultData, null, 2)}`;
            }
          }).join('\n\n');

          const userMessage = `Here are the results from the tools you called:\n\n${toolResultsText}\n\nNow present this data to the user in a clear, helpful format. Do NOT tell them to run commands manually.`;

          messages.push({
            role: 'user',
            content: userMessage,
          });

          console.log(`[Assistant] Sending tool results to LLM (${userMessage.length} chars)`);
          console.log(`[Assistant] Tool result preview: ${toolResultsText.substring(0, 200)}...`);
        }

        if (iteration >= maxIterations) {
          fullResponse = 'I apologize, but I reached the maximum number of tool calls. Please try rephrasing your question.';
        }

        // Add assistant message to conversation
        conversationManager.addMessage(conversationId, 'assistant', fullResponse);

        // Emit completion
        socket.emit('assistant:complete', {
          conversationId,
          messageId: assistantMessageId,
          fullMessage: fullResponse,
        });

        console.log(`[Assistant] Response completed for conversation ${conversationId} (${fullResponse.length} chars)`);
      } catch (streamError: any) {
        console.error('[Assistant] Streaming error:', streamError);

        socket.emit('assistant:error', {
          error: streamError instanceof AIServiceError
            ? streamError.message
            : 'Failed to generate response. Please try again.',
          conversationId,
          code: streamError.code || 'UNKNOWN_ERROR',
          canRetry: streamError.canRetry !== false,
        });
      } finally {
        // Stop typing indicator
        socket.emit('assistant:typing', {
          conversationId,
          isTyping: false,
        });
      }
    } catch (error: any) {
      console.error('[Assistant] Error handling message:', error);
      socket.emit('assistant:error', {
        error: 'Internal server error. Please try again.',
        conversationId: data.conversationId,
        code: 'SERVER_ERROR',
        canRetry: true,
      });
    }
  });

  // Get conversation history
  socket.on('assistant:getHistory', (data: { conversationId: string }) => {
    try {
      const conversation = conversationManager.getConversation(data.conversationId);
      socket.emit('assistant:history', {
        conversationId: data.conversationId,
        messages: conversation ? conversation.messages : [],
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Assistant] Error getting history:', error);
      socket.emit('assistant:error', {
        error: 'Failed to load conversation history',
        conversationId: data.conversationId,
        code: 'HISTORY_ERROR',
        canRetry: true,
      });
    }
  });

  // Clear conversation history
  socket.on('assistant:clearHistory', (data: { conversationId: string }) => {
    try {
      conversationManager.clearConversation(data.conversationId);
      socket.emit('assistant:historyCleared', {
        conversationId: data.conversationId,
        timestamp: new Date().toISOString(),
      });
      console.log(`[Assistant] Cleared history for conversation ${data.conversationId}`);
    } catch (error: any) {
      console.error('[Assistant] Error clearing history:', error);
      socket.emit('assistant:error', {
        error: 'Failed to clear conversation history',
        conversationId: data.conversationId,
        code: 'CLEAR_ERROR',
        canRetry: true,
      });
    }
  });
});

// Periodic session cleanup
setInterval(() => {
  terminalSessionManager.cleanupExpiredSessions();
  conversationManager.cleanupExpiredConversations();
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

  // Initialize AI provider from config
  console.log('[Server] Initializing AI provider...');
  aiProvider = await getGlobalProvider();
  if (aiProvider) {
    console.log(`[Server] AI Provider: ${aiProvider.getName()}`);
    const valid = await aiProvider.validateConfig();
    if (valid) {
      console.log('[Server] AI Provider validated successfully');
    } else {
      console.warn('[Server] AI Provider validation failed - assistant features may not work');
    }
  } else {
    console.warn('[Server] AI Provider not configured - assistant features disabled');
  }

  // Initialize Health Monitor
  console.log('[Server] Initializing Health Monitor...');
  const healthMonitor = getHealthMonitor();
  healthMonitor.setWebSocketEmitter((event: string, data: any) => {
    io.emit(event, data); // Broadcast to all connected clients
  });
  healthMonitor.start();
  console.log('[Server] Health Monitor started - running health checks every 5 minutes');

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
