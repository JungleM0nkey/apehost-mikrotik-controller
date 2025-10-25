/**
 * Firewall Tool
 *
 * Retrieves firewall filter rules including:
 * - Rule chains (input, forward, output)
 * - Rule actions (accept, drop, reject)
 * - Source/destination addresses and ports
 * - Rule statistics
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class FirewallTool extends BaseMCPTool {
  readonly name = 'get_firewall_rules';
  readonly description =
    'Get firewall filter rules including chains, actions, and addresses. Use this when the user asks about firewall configuration, security rules, or blocked/allowed traffic.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'Optional filter by firewall chain',
        enum: ['input', 'forward', 'output'],
      },
    },
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
      const output = await mikrotikService.executeTerminalCommand('/ip firewall filter print');
      const rules = this.parseFirewallOutput(output);

      // Apply chain filter if provided
      const chainFilter = params.chain as string | undefined;
      const filteredRules = chainFilter
        ? rules.filter((rule) => rule.chain === chainFilter)
        : rules;

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          rules: filteredRules,
          count: filteredRules.length,
          timestamp: new Date().toISOString(),
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve firewall rules',
        executionTime
      );
    }
  }

  private parseFirewallOutput(output: string): Array<Record<string, unknown>> {
    const rules: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const ruleData: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          ruleData[key] = value;
        }
      }

      if (Object.keys(ruleData).length > 0) {
        rules.push(ruleData);
      }
    }

    return rules;
  }
}
