import { WebSocketService } from '../services/websocket';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Terminal {
  id: string;
  name: string;
  websocketConnection: WebSocketService;
  sessionId: string | null;
  isMinimized: boolean;
  isActive: boolean;
  position: Position;
  size: Size;
  createdAt: Date;
  lastActivity: Date;
  zIndex: number;
}

export interface TerminalManagerState {
  terminals: Map<string, Terminal>;
  activeTerminalId: string | null;
  nextTerminalNumber: number;
}

export interface PersistedTerminalData {
  id: string;
  name: string;
  position: Position;
  size: Size;
  isMinimized: boolean;
  createdAt: string;
}

export type TerminalAction =
  | { type: 'CREATE_TERMINAL'; name?: string; position?: Position }
  | { type: 'CLOSE_TERMINAL'; id: string }
  | { type: 'RENAME_TERMINAL'; id: string; name: string }
  | { type: 'MINIMIZE_TERMINAL'; id: string }
  | { type: 'RESTORE_TERMINAL'; id: string }
  | { type: 'SET_ACTIVE_TERMINAL'; id: string }
  | { type: 'UPDATE_TERMINAL_POSITION'; id: string; position: Position }
  | { type: 'UPDATE_TERMINAL_SIZE'; id: string; size: Size }
  | { type: 'UPDATE_SESSION_ID'; id: string; sessionId: string }
  | { type: 'DUPLICATE_TERMINAL'; id: string }
  | { type: 'CLOSE_ALL_TERMINALS' }
  | { type: 'RESTORE_FROM_STORAGE'; terminals: PersistedTerminalData[] };
