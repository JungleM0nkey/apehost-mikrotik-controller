/**
 * Configuration is now managed by UnifiedConfigService
 * See server/src/services/config/ for configuration management
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express, { Request, Response } from 'express';
import cors from 'cors';
import { routerRoutes } from './routes/router.js';
import { terminalRoutes } from './routes/terminal.js';
import { healthRoutes } from './routes/health.js';
import { serviceRoutes } from './routes/service.js';
import { settingsRoutes } from './routes/settings.js';
import { setupRoutes } from './routes/setup.js';
import agentRoutes from './routes/agent.js';
import { backupRoutes } from './routes/backups.js';
import { wireguardRoutes } from './routes/wireguard.js';
import mikrotikService from './services/mikrotik.js';
import { Server as SocketIOServer } from 'socket.io';
import terminalSessionManager from './services/terminal-session.js';
import conversationManager from './services/ai/conversation-manager.js';
import { getGlobalProvider, refreshGlobalProvider } from './services/ai/provider-factory.js';
import { AIServiceError } from './services/ai/errors/index.js';
import { globalMCPExecutor } from './services/ai/mcp/mcp-executor.js';
import { createServer } from 'http';
import { getHealthMonitor } from './services/agent/monitor/health-monitor.js';
import { unifiedConfigService } from './services/config/unified-config.service.js';
import { startMetricsCollection, stopMetricsCollection } from './services/agent/metrics-collector.js';
import { backupManagementService } from './services/backup-management.service.js';

const app = express();
const httpServer = createServer(app);
let server: any = null;

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

// Setup routes (must be accessible before authentication)
app.use('/api/setup', setupRoutes);

// API Routes
app.use('/api/router', routerRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/wireguard', wireguardRoutes);

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

  // Stop Metrics Collector
  try {
    stopMetricsCollection();
    console.log('[Server] Metrics Collector stopped');
  } catch (error) {
    console.error('[Server] Error stopping Metrics Collector:', error);
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
      let messages = await conversationManager.getMessagesForLLM(conversationId);

      // Get MCP tool definitions for function calling
      const tools = globalMCPExecutor.getToolDefinitions();
      console.log(`[Assistant] Providing ${tools.length} MCP tools to LLM:`, tools.map(t => t.name));

      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let fullResponse = '';

      // Track total token usage across all iterations
      const totalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

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
3. COMMAND SUGGESTIONS:
   - For READ operations: Use your tools instead of suggesting commands
   - For WRITE operations: Provide the exact command since you cannot execute write operations
   - Format commands in code blocks with the 'routeros' language tag: \`\`\`routeros
   - Always explain what the command does and any risks
4. NEVER say tools are "not available" - they are available and you should use them
5. Present data concisely:
   - For small datasets (< 5 items): Use simple lists
   - For larger datasets: Use tables
   - Keep explanations brief unless user asks for details
6. Focus on answering the user's question directly with real data you retrieve

Available tools allow you to:
- Get system information and resources (CPU, memory, disk, uptime, version, identity)
- Test network connectivity and internet speed
- View network interfaces and their status
- Check DHCP leases (connected devices)
- View routing tables
- Check firewall rules
- Execute safe RouterOS commands

When asked about the network, devices, or configuration - use the appropriate tool and present the results clearly.

NETWORK SPEED TESTING - CRITICAL ROUTING RULES:

When user asks "run speed test", "test my internet", "how fast is my internet", "bandwidth test", "check internet speed":
→ ALWAYS use: test_connectivity with action="internet-speed-test"
→ NEVER use: get_router_info, get_system_resources, get_interfaces, get_traffic

Key distinctions:
- SPEED TESTING (active measurement) → test_connectivity with internet-speed-test
- SYSTEM METRICS (CPU/memory/uptime/version/identity) → get_system_resources (PREFERRED) or get_router_info (deprecated)
- TRAFFIC MONITORING (current rates) → get_interfaces
- HISTORICAL USAGE (past bandwidth) → get_traffic

TOOL PREFERENCES:
→ PREFER: get_system_resources for system info (comprehensive, supports type selection: resources/health/history/identity)
→ AVOID: get_router_info (deprecated, maintained for backward compatibility only)

Example queries and correct routing:
✓ "speed test" → test_connectivity internet-speed-test
✓ "is my internet fast" → test_connectivity internet-speed-test
✓ "check CPU usage" → get_system_resources type=resources
✓ "RouterOS version" → get_system_resources type=identity
✓ "how much bandwidth am I using" → get_interfaces (current) or get_traffic (historical)`,
          });

          // Log tool selection decision for debugging and analytics
          console.log(`[Assistant] 🎯 TOOL SELECTION DECISION:`, {
            iteration,
            userQuery: messages[messages.length - 1]?.content.substring(0, 200),
            availableTools: tools.length,
            toolsProvided: tools.map(t => t.name),
            selectedTools: response.toolCalls?.map(tc => tc.function.name) || 'none',
            finishReason: response.finishReason,
            timestamp: new Date().toISOString()
          });

          // If tools were called, log detailed selection rationale
          if (response.toolCalls && response.toolCalls.length > 0) {
            response.toolCalls.forEach((tc, idx) => {
              console.log(`[Assistant] 🔧 Tool Call #${idx + 1}:`, {
                toolName: tc.function.name,
                arguments: tc.function.arguments,
                callId: tc.id
              });
            });
          } else {
            console.log(`[Assistant] ℹ️ No tools called - Direct response generation`);
          }

          console.log(`[Assistant] LLM response - finishReason: ${response.finishReason}, hasToolCalls: ${!!response.toolCalls}`);
          console.log(`[Assistant] LLM content preview: ${response.content.substring(0, 200)}...`);

          // Accumulate token usage from this iteration
          if (response.usage) {
            totalUsage.promptTokens += response.usage.promptTokens;
            totalUsage.completionTokens += response.usage.completionTokens;
            totalUsage.totalTokens += response.usage.totalTokens;
            console.log(`[Assistant] Iteration ${iteration} usage: ${response.usage.promptTokens} prompt + ${response.usage.completionTokens} completion = ${response.usage.totalTokens} total tokens`);
            console.log(`[Assistant] Cumulative usage: ${totalUsage.totalTokens} total tokens`);

            // Emit live token update to frontend
            socket.emit('assistant:token-update', {
              conversationId,
              promptTokens: totalUsage.promptTokens,
              completionTokens: totalUsage.completionTokens,
              totalTokens: totalUsage.totalTokens,
            });
          }

          // If no tool calls, we have the final response
          if (!response.toolCalls || response.toolCalls.length === 0) {
            // Filter out thinking blocks from the response
            let cleanedResponse = response.content;

            // Remove <think>...</think> blocks (case insensitive, multiline)
            cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/gi, '');

            // Remove <thinking>...</thinking> blocks (case insensitive, multiline)
            cleanedResponse = cleanedResponse.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

            // Remove standalone <think> or </think> tags
            cleanedResponse = cleanedResponse.replace(/<\/?think>/gi, '');
            cleanedResponse = cleanedResponse.replace(/<\/?thinking>/gi, '');

            // Trim whitespace and collapse multiple newlines
            cleanedResponse = cleanedResponse.trim().replace(/\n{3,}/g, '\n\n');

            // If after filtering we have no content, provide a default message
            if (!cleanedResponse || cleanedResponse.length === 0) {
              cleanedResponse = 'I understand your request. Let me help you with that.';
            }

            fullResponse = cleanedResponse;

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
              const startTime = Date.now();

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

              const executionTime = Date.now() - startTime;

              // Track tool execution in conversation metadata
              conversationManager.trackToolExecution(
                conversationId,
                toolCall.function.name,
                args,
                result,
                result.success,
                executionTime,
                message
              );

              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(result),
              });

              console.log(`[Assistant] Tool ${toolCall.function.name} executed successfully (${executionTime}ms)`);
            } catch (error: any) {
              console.error(`[Assistant] Tool ${toolCall.function.name} failed:`, error.message);

              // Track failed tool execution
              conversationManager.trackToolExecution(
                conversationId,
                toolCall.function.name,
                {},
                { error: error.message },
                false,
                0,
                message
              );

              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify({ error: error.message }),
              });
            }
          }

          // Emit updated metadata to client after tool executions
          const metadata = conversationManager.getMetadata(conversationId);
          if (metadata) {
            socket.emit('assistant:metadata', {
              conversationId,
              metadata,
            });
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

        // Emit completion with token usage
        socket.emit('assistant:complete', {
          conversationId,
          messageId: assistantMessageId,
          fullMessage: fullResponse,
          usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
        });

        console.log(`[Assistant] Response completed for conversation ${conversationId} (${fullResponse.length} chars, ${totalUsage.totalTokens} tokens)`);
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
  // Load configuration from UnifiedConfigService
  console.log('[Server] Loading configuration...');
  const config = await unifiedConfigService.get();
  const PORT = config.server.port;

  console.log('\n[CONFIG] Configuration loaded:');
  console.log(`   Server Port: ${config.server.port}`);
  console.log(`   Server Environment: ${config.server.nodeEnv}`);
  console.log(`   Server CORS Origin: ${config.server.corsOrigin}`);
  console.log(`   MikroTik Host: ${config.mikrotik.host}:${config.mikrotik.port}`);
  console.log(`   MikroTik User: ${config.mikrotik.username}`);
  console.log(`   LLM Provider: ${config.llm.provider}`);

  // Watch for configuration changes and refresh services
  unifiedConfigService.watch();
  unifiedConfigService.on('change', async (changes) => {
    console.log('[Server] Configuration changed, refreshing services...');

    // Refresh AI provider
    try {
      aiProvider = await refreshGlobalProvider();
      console.log('[Server] AI provider refreshed successfully');
    } catch (error: any) {
      console.error('[Server] Failed to refresh AI provider:', error.message);
    }

    // Refresh MikroTik connection if config changed
    try {
      console.log('[Server] Reconnecting to MikroTik with new configuration...');
      await mikrotikService.disconnect('config_change');
      // MikroTik service will automatically reconnect on next command
      console.log('[Server] MikroTik connection reset successfully');
    } catch (error: any) {
      console.error('[Server] Failed to reset MikroTik connection:', error.message);
    }
  });

  const portAvailable = await checkPort(Number(PORT));
  if (!portAvailable) {
    console.error(`\n[Server] ERROR: Port ${PORT} is already in use!`);
    console.error(`[Server] Please stop the existing process or change the port in config.json`);
    console.error(`[Server] You can find the process with: ss -ltnp | grep :${PORT}\n`);
    process.exit(1);
  }

  // Initialize AI provider from config
  console.log('[Server] Initializing AI provider...');
  aiProvider = await refreshGlobalProvider();
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

  // Initialize Metrics Collector (Phase 3: Trend Analysis)
  console.log('[Server] Initializing Metrics Collector...');
  startMetricsCollection(5); // Collect metrics every 5 minutes
  console.log('[Server] Metrics Collector started - collecting system metrics every 5 minutes');

  // Initialize Backup Management Service
  console.log('[Server] Initializing Backup Management Service...');
  await backupManagementService.initialize();
  console.log('[Server] Backup Management Service started');

  server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n[Server] MikroTik Dashboard API Server`);
    console.log(`[Server] Port: ${PORT}`);
    console.log(`[Server] Host: 0.0.0.0 (accessible from network)`);
    console.log(`[Server] Environment: ${config.server.nodeEnv}`);
    console.log(`[Server] CORS Origin: ${config.server.corsOrigin}`);
    console.log(`\n[Server] HTTP API: http://0.0.0.0:${PORT}`);
    console.log(`[Server] WebSocket: ws://0.0.0.0:${PORT}`);
    console.log(`[Server] Health: http://0.0.0.0:${PORT}/api/health\n`);
  });
};

startServer();

export default app;
