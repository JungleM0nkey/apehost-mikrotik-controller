/**
 * Wireless Management Tool
 *
 * Retrieves wireless/WiFi information including:
 * - Wireless interface configuration
 * - Connected WiFi clients
 * - Signal strength and quality
 * - Access point status
 * - Registration table
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolResult, ToolExecutionContext, ToolInputSchema } from '../types.js';
import mikrotikService from '../../../mikrotik.js';

export class WirelessTool extends BaseMCPTool {
  readonly name = 'get_wireless_info';
  readonly description =
    'Get wireless/WiFi information including AP configuration, connected clients, signal strength, and registration data. ' +
    'ONLY use when users SPECIFICALLY ask about WiFi, wireless, or AP (access point). ' +
    'For general "clients online" queries, use get_dhcp_leases instead (more reliable and works on all routers). ' +
    'Note: Requires MikroTik wireless hardware/packages - may not be available on all routers.';

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of wireless data to retrieve',
        enum: ['interfaces', 'clients', 'registration', 'scan'],
      },
      interface: {
        type: 'string',
        description: 'Optional: Specific wireless interface name (e.g., wlan1)',
      },
    },
    required: ['type'],
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

      const type = params.type as string;
      const interfaceName = params.interface as string | undefined;

      let result: any;

      switch (type) {
        case 'interfaces':
          result = await this.getWirelessInterfaces(interfaceName);
          break;
        case 'clients':
          result = await this.getWirelessClients(interfaceName);
          break;
        case 'registration':
          result = await this.getRegistrationTable(interfaceName);
          break;
        case 'scan':
          result = await this.scanWirelessNetworks(interfaceName);
          break;
        default:
          return this.error(`Unknown wireless type: ${type}`);
      }

      const executionTime = Date.now() - startTime;

      return this.success(
        {
          type,
          timestamp: new Date().toISOString(),
          ...result,
        },
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.error(
        error instanceof Error ? error.message : 'Failed to retrieve wireless information',
        executionTime
      );
    }
  }

  /**
   * Get wireless interface configuration
   */
  private async getWirelessInterfaces(filterInterface?: string): Promise<any> {
    let command = '/interface wireless print detail';
    if (filterInterface) {
      command += ` where name="${filterInterface}"`;
    }

    try {
      const output = await mikrotikService.executeTerminalCommand(command);

      // Check for common error messages
      if (output.includes('no such command prefix') || output.includes('bad command name')) {
        throw new Error(
          'Wireless functionality not available on this router. ' +
          'This router may not have wireless hardware or the wireless package is not installed.'
        );
      }

      const interfaces = this.parseWirelessInterfaces(output);

      // If no interfaces found, provide helpful message
      if (interfaces.length === 0) {
        return {
          interfaces: [],
          count: 0,
          filtered_interface: filterInterface,
          message: 'No wireless interfaces found. This router may not have wireless capability.',
        };
      }

      return {
        interfaces,
        count: interfaces.length,
        filtered_interface: filterInterface,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Wireless functionality not available')) {
        throw error;
      }
      throw new Error(
        `Failed to retrieve wireless interfaces: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get connected wireless clients
   */
  private async getWirelessClients(filterInterface?: string): Promise<any> {
    let command = '/interface wireless registration-table print detail';
    if (filterInterface) {
      command += ` where interface="${filterInterface}"`;
    }

    try {
      const output = await mikrotikService.executeTerminalCommand(command);

      // Check for common error messages
      if (output.includes('no such command prefix') || output.includes('bad command name')) {
        throw new Error(
          'Wireless functionality not available on this router. ' +
          'This router may not have wireless hardware or the wireless package is not installed. ' +
          'Try checking DHCP leases instead for connected devices.'
        );
      }

      if (output.includes('syntax error') || output.includes('invalid')) {
        throw new Error(`Invalid wireless command syntax: ${output}`);
      }

      const clients = this.parseWirelessClients(output);

      return {
        clients,
        total_clients: clients.length,
        filtered_interface: filterInterface,
      };
    } catch (error) {
      // Provide helpful context for different error types
      if (error instanceof Error && error.message.includes('Wireless functionality not available')) {
        throw error; // Re-throw our custom error
      }
      throw new Error(
        `Failed to retrieve wireless clients: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'The router may not support wireless operations.'
      );
    }
  }

  /**
   * Get wireless registration table (detailed client info)
   */
  private async getRegistrationTable(filterInterface?: string): Promise<any> {
    let command = '/interface wireless registration-table print stats';
    if (filterInterface) {
      command += ` where interface="${filterInterface}"`;
    }

    try {
      const output = await mikrotikService.executeTerminalCommand(command);

      // Check for common error messages
      if (output.includes('no such command prefix') || output.includes('bad command name')) {
        throw new Error(
          'Wireless functionality not available on this router. ' +
            'This router may not have wireless hardware or the wireless package is not installed. ' +
            'Try checking DHCP leases instead for connected devices.'
        );
      }

      if (output.includes('syntax error') || output.includes('invalid')) {
        throw new Error(`Invalid wireless command syntax: ${output}`);
      }

      const registrations = this.parseRegistrationTable(output);

      return {
        registrations,
        count: registrations.length,
        filtered_interface: filterInterface,
      };
    } catch (error) {
      // Provide helpful context for different error types
      if (error instanceof Error && error.message.includes('Wireless functionality not available')) {
        throw error; // Re-throw our custom error
      }
      throw new Error(
        `Failed to retrieve wireless registration table: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'The router may not support wireless operations.'
      );
    }
  }

  /**
   * Scan for available wireless networks
   */
  private async scanWirelessNetworks(interfaceName?: string): Promise<any> {
    if (!interfaceName) {
      throw new Error('Interface name is required for wireless scanning. Please specify a wireless interface (e.g., wlan1).');
    }

    // Initiate scan and wait for results
    try {
      const command = `/interface wireless scan ${interfaceName} duration=3`;
      const output = await mikrotikService.executeTerminalCommand(command);

      // Check for common error messages
      if (output.includes('no such command prefix') || output.includes('bad command name')) {
        throw new Error(
          'Wireless functionality not available on this router. ' +
            'This router may not have wireless hardware or the wireless package is not installed.'
        );
      }

      if (output.includes('no such item') || output.includes('invalid interface')) {
        throw new Error(`Wireless interface '${interfaceName}' not found. Check available interfaces first.`);
      }

      if (output.includes('interface is busy') || output.includes('already scanning')) {
        throw new Error(`Interface '${interfaceName}' is busy or already scanning. Try again in a few seconds.`);
      }

      const networks = this.parseScanResults(output);

      return {
        scan_results: networks,
        interface: interfaceName,
        count: networks.length,
      };
    } catch (error) {
      // Provide helpful context for different error types
      if (error instanceof Error && error.message.includes('Wireless functionality not available')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('busy')) {
        throw error;
      }
      throw new Error(
        `Failed to scan for wireless networks: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'The router may not support wireless operations or scanning.'
      );
    }
  }

  /**
   * Parse wireless interface output
   */
  private parseWirelessInterfaces(output: string): Array<Record<string, unknown>> {
    const interfaces: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const iface: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().replace(/-/g, '_');
          const value = match[2].trim();
          iface[key] = value;
        }
      }

      if (Object.keys(iface).length > 0) {
        interfaces.push(iface);
      }
    }

    return interfaces;
  }

  /**
   * Parse wireless clients output
   */
  private parseWirelessClients(output: string): Array<Record<string, unknown>> {
    const clients: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const client: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().replace(/-/g, '_');
          const value = match[2].trim();
          client[key] = value;
        }
      }

      if (Object.keys(client).length > 0) {
        clients.push(client);
      }
    }

    return clients;
  }

  /**
   * Parse registration table
   */
  private parseRegistrationTable(output: string): Array<Record<string, unknown>> {
    const registrations: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const reg: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().replace(/-/g, '_');
          const value = match[2].trim();
          reg[key] = value;
        }
      }

      if (Object.keys(reg).length > 0) {
        registrations.push(reg);
      }
    }

    return registrations;
  }

  /**
   * Parse wireless scan results
   */
  private parseScanResults(output: string): Array<Record<string, unknown>> {
    const networks: Array<Record<string, unknown>> = [];
    const blocks = output.split(/\n\s*\n/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const network: Record<string, unknown> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().replace(/-/g, '_');
          const value = match[2].trim();
          network[key] = value;
        }
      }

      if (Object.keys(network).length > 0) {
        networks.push(network);
      }
    }

    return networks;
  }
}
