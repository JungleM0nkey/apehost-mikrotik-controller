/**
 * Terminal Types
 */

export interface TerminalLine {
  id: string;
  type: 'output' | 'command' | 'prompt' | 'error';
  content: string;
  timestamp?: string;
}

export type TerminalTab = 'terminal' | 'stats' | 'config' | 'logs';
