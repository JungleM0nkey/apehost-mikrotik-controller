/**
 * Routes Tool
 *
 * Retrieves routing table information including:
 * - Destination networks
 * - Gateways
 * - Route status and metrics
 * - Routing protocols
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class RoutesTool extends BaseMCPTool {
  readonly name = 'get_routes';
  readonly description =
    'Get routing table information including destination networks, gateways, and route status. Use this when the user asks about routing, network paths, or connectivity to specific networks.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateInput(params);
      if (!validation.valid) {
        return this.error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      if (!mikrotikService) {
        return this.error('MikroTik service not available');
      }

      // Execute command
      const output = await mikrotikService.executeTerminalCommand('/ip route print');
      const routes = this.parseRoutesOutput(output);

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          routes,
          count: routes.length,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve routes',
        executionTime
      );
    }
  }

  private parseRoutesOutput(output: string): Array<Record<string, unknown>> {
    const routes: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const routeData: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          routeData[key] = value;
        }
      }

      if (Object.keys(routeData).length > 0) {
        routes.push(routeData);
      }
    }

    return routes;
  }
}
