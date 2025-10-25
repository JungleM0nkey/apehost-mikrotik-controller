/**
 * AI Service Error Classes
 */

export class AIServiceError extends Error {
  constructor(message: string, public code?: string, public canRetry: boolean = false) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ConfigError extends AIServiceError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', false);
    this.name = 'ConfigError';
  }
}

export class NetworkError extends AIServiceError {
  constructor(message: string, canRetry: boolean = true) {
    super(message, 'NETWORK_ERROR', canRetry);
    this.name = 'NetworkError';
  }
}

export class APIError extends AIServiceError {
  constructor(message: string, public statusCode?: number, canRetry: boolean = false) {
    super(message, 'API_ERROR', canRetry);
    this.name = 'APIError';
  }
}

export class StreamingError extends AIServiceError {
  constructor(message: string) {
    super(message, 'STREAMING_ERROR', true);
    this.name = 'StreamingError';
  }
}

export class RateLimitError extends AIServiceError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', true);
    this.name = 'RateLimitError';
  }
}
