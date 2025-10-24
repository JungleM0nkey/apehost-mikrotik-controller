import type {
  HealthResponse,
  RouterStatus,
  NetworkInterface,
  SystemResources,
  TerminalCommandRequest,
  TerminalCommandResponse,
  ApiError
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
}

// Export singleton instance
export const api = new ApiService();
export default api;
