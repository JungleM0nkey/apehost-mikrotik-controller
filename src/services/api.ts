import type {
  HealthResponse,
  RouterStatus,
  NetworkInterface,
  SystemResources,
  TerminalCommandRequest,
  TerminalCommandResponse,
  UpdateInterfaceRequest,
  IpAddress,
  Route,
  ArpEntry,
  ApiError,
  FirewallFilterRule,
  FirewallNatRule,
  FirewallMangleRule,
  FirewallAddressList
} from '../types/api';

const API_BASE_URL = '/api';

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.message || error.error || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Health Check
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Router Status
  async getRouterStatus(): Promise<RouterStatus> {
    return this.request<RouterStatus>('/router/status');
  }

  // Network Interfaces
  async getInterfaces(): Promise<NetworkInterface[]> {
    return this.request<NetworkInterface[]>('/router/interfaces');
  }

  async updateInterface(
    id: string,
    updates: UpdateInterfaceRequest
  ): Promise<NetworkInterface> {
    return this.request<NetworkInterface>(`/router/interfaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // System Resources
  async getResources(): Promise<SystemResources> {
    return this.request<SystemResources>('/router/resources');
  }

  // Terminal Command Execution
  async executeCommand(command: string): Promise<TerminalCommandResponse> {
    return this.request<TerminalCommandResponse>('/terminal/execute', {
      method: 'POST',
      body: JSON.stringify({ command } as TerminalCommandRequest),
    });
  }

  // IP Addresses
  async getIpAddresses(): Promise<IpAddress[]> {
    return this.request<IpAddress[]>('/router/ip/addresses');
  }

  // Routes
  async getRoutes(): Promise<Route[]> {
    return this.request<Route[]>('/router/ip/routes');
  }

  // ARP Table
  async getArpTable(): Promise<ArpEntry[]> {
    return this.request<ArpEntry[]>('/router/ip/arp');
  }

  // Firewall Filter Rules
  async getFirewallFilterRules(): Promise<FirewallFilterRule[]> {
    return this.request<FirewallFilterRule[]>('/router/firewall/filter');
  }

  // Firewall NAT Rules
  async getFirewallNatRules(): Promise<FirewallNatRule[]> {
    return this.request<FirewallNatRule[]>('/router/firewall/nat');
  }

  // Firewall Mangle Rules
  async getFirewallMangleRules(): Promise<FirewallMangleRule[]> {
    return this.request<FirewallMangleRule[]>('/router/firewall/mangle');
  }

  // Firewall Address Lists
  async getFirewallAddressLists(): Promise<FirewallAddressList[]> {
    return this.request<FirewallAddressList[]>('/router/firewall/address-list');
  }

  // AI Agent Methods
  async getAgentIssues(params?: string): Promise<any> {
    const endpoint = params ? `/agent/issues?${params}` : '/agent/issues';
    return this.request<any>(endpoint);
  }

  async getAgentMetrics(): Promise<any> {
    return this.request<any>('/agent/metrics');
  }

  async updateAgentIssueStatus(id: string, status: string): Promise<any> {
    return this.request<any>(`/agent/issues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async triggerAgentScan(deepScan: boolean = false): Promise<any> {
    return this.request<any>('/agent/scan', {
      method: 'POST',
      body: JSON.stringify({ deep_scan: deepScan }),
    });
  }

  // Service Information
  async getMCPTools(): Promise<any> {
    return this.request<any>('/service/mcp-tools');
  }

  async getServiceInfo(): Promise<any> {
    return this.request<any>('/service/info');
  }

  async getAIInfo(): Promise<any> {
    return this.request<any>('/service/ai-info');
  }
}

// Export singleton instance
export const api = new ApiService();
export default api;
