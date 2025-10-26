/**
 * Standard response format for all MikroTik MCP tools
 * Provides structured data, insights, warnings, and recommendations for AI consumption
 */

export interface MCPToolResponse<T = any> {
  /** Whether the tool execution succeeded */
  success: boolean;

  /** Structured data from RouterOS API */
  data: T | null;

  /** Human-readable summary of the results */
  summary: string;

  /** AI-friendly insights extracted from the data */
  insights?: string[];

  /** Potential issues or concerns detected */
  warnings?: string[];

  /** Actionable recommendations for the user */
  recommendations?: string[];

  /** Confidence level in the diagnosis (for diagnostic tools) */
  confidence?: 'high' | 'medium' | 'low';

  /** Additional metadata for context */
  metadata?: {
    executionTime?: number;
    queryParams?: Record<string, any>;
    timestamp?: string;
  };
}

/**
 * Standard error response format
 */
export interface MCPToolError {
  success: false;
  data: null;
  summary: string;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  warnings: string[];
  recommendations: string[];
}

/**
 * Helper to create success responses
 */
export function createSuccessResponse<T>(
  data: T,
  summary: string,
  options?: {
    insights?: string[];
    warnings?: string[];
    recommendations?: string[];
    confidence?: 'high' | 'medium' | 'low';
    metadata?: Record<string, any>;
  }
): MCPToolResponse<T> {
  return {
    success: true,
    data,
    summary,
    ...options,
  };
}

/**
 * Helper to create error responses
 */
export function createErrorResponse(
  error: Error | string,
  context?: string
): MCPToolError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = typeof error === 'string' ? 'TOOL_ERROR' : error.name;

  return {
    success: false,
    data: null,
    summary: `Failed to execute tool${context ? `: ${context}` : ''}`,
    error: {
      code: errorCode,
      message: errorMessage,
      details: typeof error === 'object' ? error : undefined,
    },
    warnings: ['Tool execution failed - check RouterOS connectivity and permissions'],
    recommendations: [
      'Verify MikroTik router is accessible',
      'Check API user permissions',
      'Review error details for specific issues',
    ],
  };
}
