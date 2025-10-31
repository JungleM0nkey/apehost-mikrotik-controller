import { Router, Request, Response } from 'express';
import os from 'os';
import { aiProvider } from '../index.js';
import { globalMCPExecutor } from '../services/ai/mcp/mcp-executor.js';

export const serviceRoutes = Router();

/**
 * GET /api/service/info
 * Get service information (IP, port, uptime, etc.)
 */
serviceRoutes.get('/info', (req: Request, res: Response) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses: string[] = [];

  // Get all IPv4 addresses
  Object.values(networkInterfaces).forEach(netInterface => {
    netInterface?.forEach(details => {
      if (details.family === 'IPv4' && !details.internal) {
        addresses.push(details.address);
      }
    });
  });

  const uptime = process.uptime();
  const port = process.env.PORT || '3000';

  res.json({
    service: 'backend',
    status: 'online',
    addresses,
    port,
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/service/ai-info
 * Get AI model information (model name, token costs, context window)
 */
serviceRoutes.get('/ai-info', (req: Request, res: Response) => {
  try {
    if (!aiProvider) {
      return res.status(503).json({
        error: 'AI provider not initialized',
        available: false,
      });
    }

    const capabilities = aiProvider.getCapabilities();
    const providerName = aiProvider.getName();

    // Token cost estimation (per 1M tokens)
    // These are rough estimates - adjust based on your actual provider costs
    const tokenCosts = {
      'LM Studio': { prompt: 0, completion: 0, note: 'Free (local)' },
      'Claude': { prompt: 3.00, completion: 15.00, note: 'USD per 1M tokens' },
    };

    const cost = tokenCosts[providerName as keyof typeof tokenCosts] || {
      prompt: 0,
      completion: 0,
      note: 'Unknown'
    };

    res.json({
      available: true,
      provider: providerName,
      model: capabilities.modelInfo || 'Unknown',
      context_window: capabilities.maxTokens || 'Unknown',
      features: {
        streaming: capabilities.streaming,
        function_calling: capabilities.functionCalling,
      },
      token_costs: {
        prompt_per_1m: cost.prompt,
        completion_per_1m: cost.completion,
        note: cost.note,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Service] Error fetching AI info:', error);
    res.status(500).json({
      error: 'Failed to fetch AI information',
      available: false,
    });
  }
});

/**
 * POST /api/service/restart
 * Restart the service (graceful shutdown + process manager restart)
 */
serviceRoutes.post('/restart', (req: Request, res: Response) => {
  console.log('[Service] Restart requested via API');

  res.json({
    message: 'Server restart initiated',
    timestamp: new Date().toISOString(),
  });

  // Trigger graceful shutdown which will cause process manager to restart
  setTimeout(() => {
    console.log('[Service] Initiating graceful restart...');
    process.exit(0);
  }, 1000);
});

/**
 * POST /api/service/shutdown
 * Shutdown the service (graceful shutdown)
 */
serviceRoutes.post('/shutdown', (req: Request, res: Response) => {
  console.log('[Service] Shutdown requested via API');

  res.json({
    message: 'Server shutdown initiated',
    timestamp: new Date().toISOString(),
  });

  // Trigger graceful shutdown
  setTimeout(() => {
    console.log('[Service] Initiating graceful shutdown...');
    process.exit(0);
  }, 1000);
});

/**
 * GET /api/service/mcp-tools
 * Get all available MCP tools with their definitions
 */
serviceRoutes.get('/mcp-tools', (req: Request, res: Response) => {
  try {
    const toolDefinitions = globalMCPExecutor.getToolDefinitions();
    const stats = globalMCPExecutor.getStats();

    // Enhance tool definitions with category and risk level
    const enhancedTools = toolDefinitions.map(tool => {
      const category = categorizeTool(tool.name, tool.description);
      const riskLevel = determineRiskLevel(tool.name, tool.description);

      return {
        name: tool.name,
        description: tool.description,
        category,
        risk_level: riskLevel,
        input_schema: tool.input_schema,
      };
    });

    res.json({
      tools: enhancedTools,
      count: enhancedTools.length,
      stats: {
        total_tools: stats.toolCount,
        audit_stats: stats.auditStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Service] Error fetching MCP tools:', error);
    res.status(500).json({
      error: 'Failed to fetch MCP tools',
      tools: [],
      count: 0,
    });
  }
});

/**
 * Categorize a tool based on its name and description
 */
function categorizeTool(name: string, description: string): string {
  const nameLower = name.toLowerCase();
  const descLower = description.toLowerCase();

  // Network & Connectivity
  if (
    nameLower.includes('interface') ||
    nameLower.includes('network') ||
    nameLower.includes('connectivity') ||
    nameLower.includes('host') ||
    nameLower.includes('arp') ||
    nameLower.includes('dhcp')
  ) {
    return 'Network & Connectivity';
  }

  // Routing & Firewall
  if (
    nameLower.includes('route') ||
    nameLower.includes('firewall') ||
    nameLower.includes('nat')
  ) {
    return 'Routing & Firewall';
  }

  // Wireless
  if (nameLower.includes('wireless') || nameLower.includes('wifi')) {
    return 'Wireless';
  }

  // Monitoring & Diagnostics
  if (
    nameLower.includes('traffic') ||
    nameLower.includes('log') ||
    nameLower.includes('diagnostic') ||
    nameLower.includes('system') ||
    nameLower.includes('router_info')
  ) {
    return 'Monitoring & Diagnostics';
  }

  // Troubleshooting & AI
  if (
    nameLower.includes('troubleshoot') ||
    nameLower.includes('agent') ||
    nameLower.includes('trend') ||
    nameLower.includes('pattern') ||
    nameLower.includes('system_state')
  ) {
    return 'Troubleshooting & AI';
  }

  // Commands
  if (nameLower.includes('command') || nameLower.includes('execute')) {
    return 'Commands';
  }

  return 'General';
}

/**
 * Determine risk level of a tool based on its name and description
 */
function determineRiskLevel(name: string, description: string): 'safe' | 'read_only' | 'write' | 'dangerous' {
  const nameLower = name.toLowerCase();
  const descLower = description.toLowerCase();

  // Dangerous operations
  if (
    nameLower.includes('command') ||
    nameLower.includes('execute') ||
    descLower.includes('execute command')
  ) {
    return 'dangerous';
  }

  // Write operations
  if (
    descLower.includes('update') ||
    descLower.includes('modify') ||
    descLower.includes('change') ||
    descLower.includes('configure') ||
    descLower.includes('set') ||
    descLower.includes('enable') ||
    descLower.includes('disable')
  ) {
    return 'write';
  }

  // Read-only operations
  if (
    descLower.includes('get') ||
    descLower.includes('retrieve') ||
    descLower.includes('fetch') ||
    descLower.includes('list') ||
    descLower.includes('view') ||
    descLower.includes('show')
  ) {
    return 'read_only';
  }

  // AI/Analysis operations (safe)
  if (
    nameLower.includes('agent') ||
    nameLower.includes('trend') ||
    nameLower.includes('pattern') ||
    nameLower.includes('analyze')
  ) {
    return 'safe';
  }

  return 'read_only';
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
