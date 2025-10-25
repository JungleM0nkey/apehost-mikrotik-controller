import { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { createWebSocketService } from '../services/websocket';
import type {
  Terminal,
  TerminalManagerState,
  TerminalAction,
  Position,
  Size,
  PersistedTerminalData
} from '../types/terminal-manager';

const STORAGE_KEY = 'terminal-manager-state';
const MAX_TERMINALS = 10;
const BASE_Z_INDEX = 1000;

// Initial state
const initialState: TerminalManagerState = {
  terminals: new Map(),
  activeTerminalId: null,
  nextTerminalNumber: 1,
};

// Generate unique ID
function generateId(): string {
  return `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate staggered position
function calculatePosition(_terminalCount: number, lastPosition?: Position): Position {
  if (!lastPosition) {
    return { x: 100, y: 100 };
  }
  const offset = 50;
  return {
    x: lastPosition.x + offset,
    y: lastPosition.y + offset,
  };
}

// Reducer
function terminalReducer(state: TerminalManagerState, action: TerminalAction): TerminalManagerState {
  switch (action.type) {
    case 'CREATE_TERMINAL': {
      // Check max terminals
      if (state.terminals.size >= MAX_TERMINALS) {
        console.warn(`Maximum ${MAX_TERMINALS} terminals reached`);
        return state;
      }

      const id = generateId();
      const name = action.name || `Terminal ${state.nextTerminalNumber}`;

      // Calculate position
      const lastTerminal = Array.from(state.terminals.values()).pop();
      const position = action.position || calculatePosition(state.terminals.size, lastTerminal?.position);

      const newTerminal: Terminal = {
        id,
        name,
        websocketConnection: createWebSocketService(),
        sessionId: null,
        isMinimized: false,
        isActive: true,
        position,
        size: { width: 900, height: 600 },
        createdAt: new Date(),
        lastActivity: new Date(),
        zIndex: BASE_Z_INDEX + state.terminals.size,
        resetCount: 0,
      };

      const newTerminals = new Map(state.terminals);

      // Deactivate all other terminals
      newTerminals.forEach(term => {
        term.isActive = false;
      });

      newTerminals.set(id, newTerminal);

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: id,
        nextTerminalNumber: state.nextTerminalNumber + 1,
      };
    }

    case 'CLOSE_TERMINAL': {
      const newTerminals = new Map(state.terminals);
      const terminal = newTerminals.get(action.id);

      if (terminal) {
        // Disconnect WebSocket
        terminal.websocketConnection.disconnect();
        newTerminals.delete(action.id);
      }

      // If no terminals left, create a new one
      if (newTerminals.size === 0) {
        const id = generateId();
        const newTerminal: Terminal = {
          id,
          name: 'Terminal 1',
          websocketConnection: createWebSocketService(),
          sessionId: null,
          isMinimized: false,
          isActive: true,
          position: { x: 100, y: 100 },
          size: { width: 900, height: 600 },
          createdAt: new Date(),
          lastActivity: new Date(),
          zIndex: BASE_Z_INDEX,
          resetCount: 0,
        };
        newTerminals.set(id, newTerminal);
        return {
          ...state,
          terminals: newTerminals,
          activeTerminalId: id,
          nextTerminalNumber: 2,
        };
      }

      // If closed terminal was active, activate another
      let newActiveId = state.activeTerminalId;
      if (action.id === state.activeTerminalId) {
        // Find first non-minimized terminal
        const visibleTerminal = Array.from(newTerminals.values()).find(t => !t.isMinimized);
        if (visibleTerminal) {
          visibleTerminal.isActive = true;
          newActiveId = visibleTerminal.id;
        } else {
          // All minimized, just pick the first
          const firstTerminal = Array.from(newTerminals.values())[0];
          if (firstTerminal) {
            firstTerminal.isActive = true;
            firstTerminal.isMinimized = false;
            newActiveId = firstTerminal.id;
          }
        }
      }

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: newActiveId,
      };
    }

    case 'RENAME_TERMINAL': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      // Check for duplicate names
      const nameExists = Array.from(state.terminals.values()).some(
        t => t.id !== action.id && t.name === action.name
      );

      if (nameExists) {
        console.warn('Terminal name already exists');
        return state;
      }

      const newTerminals = new Map(state.terminals);
      const updatedTerminal = { ...terminal, name: action.name };
      newTerminals.set(action.id, updatedTerminal);

      return {
        ...state,
        terminals: newTerminals,
      };
    }

    case 'MINIMIZE_TERMINAL': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      const newTerminals = new Map(state.terminals);
      const updatedTerminal = { ...terminal, isMinimized: true, isActive: false };
      newTerminals.set(action.id, updatedTerminal);

      // If this was active, activate another visible terminal
      let newActiveId = state.activeTerminalId;
      if (action.id === state.activeTerminalId) {
        const visibleTerminal = Array.from(newTerminals.values()).find(
          t => !t.isMinimized && t.id !== action.id
        );
        if (visibleTerminal) {
          visibleTerminal.isActive = true;
          newActiveId = visibleTerminal.id;
        } else {
          newActiveId = null;
        }
      }

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: newActiveId,
      };
    }

    case 'RESTORE_TERMINAL': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      const newTerminals = new Map(state.terminals);

      // Deactivate all terminals
      newTerminals.forEach(term => {
        term.isActive = false;
      });

      // Restore and activate
      const updatedTerminal = {
        ...terminal,
        isMinimized: false,
        isActive: true,
        zIndex: BASE_Z_INDEX + state.terminals.size,
      };
      newTerminals.set(action.id, updatedTerminal);

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: action.id,
      };
    }

    case 'SET_ACTIVE_TERMINAL': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      const newTerminals = new Map(state.terminals);

      // Deactivate all terminals
      newTerminals.forEach(term => {
        term.isActive = false;
      });

      // Activate and restore if minimized
      const updatedTerminal = {
        ...terminal,
        isMinimized: false,
        isActive: true,
        zIndex: BASE_Z_INDEX + state.terminals.size,
      };
      newTerminals.set(action.id, updatedTerminal);

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: action.id,
      };
    }

    case 'DEACTIVATE_ALL_TERMINALS': {
      const newTerminals = new Map(state.terminals);

      // Deactivate all terminals
      newTerminals.forEach(term => {
        term.isActive = false;
      });

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: null,
      };
    }

    case 'UPDATE_TERMINAL_POSITION': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      const newTerminals = new Map(state.terminals);
      const updatedTerminal = {
        ...terminal,
        position: action.position,
        lastActivity: new Date(),
      };
      newTerminals.set(action.id, updatedTerminal);

      return {
        ...state,
        terminals: newTerminals,
      };
    }

    case 'UPDATE_TERMINAL_SIZE': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      const newTerminals = new Map(state.terminals);
      const updatedTerminal = {
        ...terminal,
        size: action.size,
        lastActivity: new Date(),
      };
      newTerminals.set(action.id, updatedTerminal);

      return {
        ...state,
        terminals: newTerminals,
      };
    }

    case 'UPDATE_SESSION_ID': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      const newTerminals = new Map(state.terminals);
      const updatedTerminal = { ...terminal, sessionId: action.sessionId };
      newTerminals.set(action.id, updatedTerminal);

      return {
        ...state,
        terminals: newTerminals,
      };
    }

    case 'DUPLICATE_TERMINAL': {
      if (state.terminals.size >= MAX_TERMINALS) {
        console.warn(`Maximum ${MAX_TERMINALS} terminals reached`);
        return state;
      }

      const originalTerminal = state.terminals.get(action.id);
      if (!originalTerminal) return state;

      const id = generateId();
      const newTerminal: Terminal = {
        ...originalTerminal,
        id,
        name: `${originalTerminal.name} (Copy)`,
        websocketConnection: createWebSocketService(),
        sessionId: null,
        isActive: true,
        position: {
          x: originalTerminal.position.x + 50,
          y: originalTerminal.position.y + 50,
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        zIndex: BASE_Z_INDEX + state.terminals.size,
        resetCount: 0,
      };

      const newTerminals = new Map(state.terminals);

      // Deactivate all terminals
      newTerminals.forEach(term => {
        term.isActive = false;
      });

      newTerminals.set(id, newTerminal);

      return {
        ...state,
        terminals: newTerminals,
        activeTerminalId: id,
      };
    }

    case 'CLOSE_ALL_TERMINALS': {
      // Disconnect all WebSockets
      state.terminals.forEach(terminal => {
        terminal.websocketConnection.disconnect();
      });

      // Create one new terminal
      const id = generateId();
      const newTerminal: Terminal = {
        id,
        name: 'Terminal 1',
        websocketConnection: createWebSocketService(),
        sessionId: null,
        isMinimized: false,
        isActive: true,
        position: { x: 100, y: 100 },
        size: { width: 900, height: 600 },
        createdAt: new Date(),
        lastActivity: new Date(),
        zIndex: BASE_Z_INDEX,
        resetCount: 0,
      };

      const newTerminals = new Map();
      newTerminals.set(id, newTerminal);

      return {
        terminals: newTerminals,
        activeTerminalId: id,
        nextTerminalNumber: 2,
      };
    }

    case 'RESET_TERMINAL': {
      const terminal = state.terminals.get(action.id);
      if (!terminal) return state;

      // Disconnect old WebSocket
      terminal.websocketConnection.disconnect();

      // Create new WebSocket connection
      const newTerminals = new Map(state.terminals);
      const resetTerminal: Terminal = {
        ...terminal,
        websocketConnection: createWebSocketService(),
        sessionId: null,
        lastActivity: new Date(),
        resetCount: terminal.resetCount + 1,
      };
      newTerminals.set(action.id, resetTerminal);

      return {
        ...state,
        terminals: newTerminals,
      };
    }

    case 'RESTORE_FROM_STORAGE': {
      if (action.terminals.length === 0) {
        return state;
      }

      const newTerminals = new Map<string, Terminal>();
      let maxNumber = 1;

      action.terminals.forEach((persisted, index) => {
        const terminal: Terminal = {
          ...persisted,
          websocketConnection: createWebSocketService(),
          sessionId: null,
          isActive: index === 0, // First terminal is active
          createdAt: new Date(persisted.createdAt),
          lastActivity: new Date(),
          zIndex: BASE_Z_INDEX + index,
          resetCount: 0,
        };
        newTerminals.set(persisted.id, terminal);

        // Extract number from name to calculate next number
        const match = persisted.name.match(/Terminal (\d+)/);
        if (match) {
          maxNumber = Math.max(maxNumber, parseInt(match[1]) + 1);
        }
      });

      return {
        terminals: newTerminals,
        activeTerminalId: action.terminals[0]?.id || null,
        nextTerminalNumber: maxNumber,
      };
    }

    default:
      return state;
  }
}

// Context
interface TerminalManagerContextValue {
  state: TerminalManagerState;
  createTerminal: (name?: string) => void;
  closeTerminal: (id: string) => void;
  renameTerminal: (id: string, name: string) => void;
  minimizeTerminal: (id: string) => void;
  restoreTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  deactivateAllTerminals: () => void;
  updateTerminalPosition: (id: string, position: Position) => void;
  updateTerminalSize: (id: string, size: Size) => void;
  updateSessionId: (id: string, sessionId: string) => void;
  duplicateTerminal: (id: string) => void;
  closeAllTerminals: () => void;
  resetTerminal: (id: string) => void;
}

const TerminalManagerContext = createContext<TerminalManagerContextValue | undefined>(undefined);

// Provider
export function TerminalManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialState, (initial) => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PersistedTerminalData[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Return initial state, will dispatch RESTORE action in useEffect
          return { ...initial, _shouldRestore: parsed };
        }
      }
    } catch (error) {
      console.error('Failed to restore terminal state:', error);
    }

    // Return initial state, will create default terminal in useEffect
    return initial;
  });

  // Initialize terminals on mount
  useEffect(() => {
    if ((state as any)._shouldRestore) {
      dispatch({ type: 'RESTORE_FROM_STORAGE', terminals: (state as any)._shouldRestore });
    } else if (state.terminals.size === 0) {
      // Create default terminal if none exist
      dispatch({ type: 'CREATE_TERMINAL' });
    }
  }, []);

  // Persist to localStorage (debounced)
  useEffect(() => {
    const persistState = () => {
      const persisted: PersistedTerminalData[] = Array.from(state.terminals.values()).map(terminal => ({
        id: terminal.id,
        name: terminal.name,
        position: terminal.position,
        size: terminal.size,
        isMinimized: terminal.isMinimized,
        createdAt: terminal.createdAt.toISOString(),
      }));

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch (error) {
        console.error('Failed to persist terminal state:', error);
      }
    };

    const timeoutId = setTimeout(persistState, 500);
    return () => clearTimeout(timeoutId);
  }, [state.terminals]);

  // Actions
  const createTerminal = useCallback((name?: string) => {
    dispatch({ type: 'CREATE_TERMINAL', name });
  }, []);

  const closeTerminal = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_TERMINAL', id });
  }, []);

  const renameTerminal = useCallback((id: string, name: string) => {
    dispatch({ type: 'RENAME_TERMINAL', id, name });
  }, []);

  const minimizeTerminal = useCallback((id: string) => {
    dispatch({ type: 'MINIMIZE_TERMINAL', id });
  }, []);

  const restoreTerminal = useCallback((id: string) => {
    dispatch({ type: 'RESTORE_TERMINAL', id });
  }, []);

  const setActiveTerminal = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_TERMINAL', id });
  }, []);

  const deactivateAllTerminals = useCallback(() => {
    dispatch({ type: 'DEACTIVATE_ALL_TERMINALS' });
  }, []);

  const updateTerminalPosition = useCallback((id: string, position: Position) => {
    dispatch({ type: 'UPDATE_TERMINAL_POSITION', id, position });
  }, []);

  const updateTerminalSize = useCallback((id: string, size: Size) => {
    dispatch({ type: 'UPDATE_TERMINAL_SIZE', id, size });
  }, []);

  const updateSessionId = useCallback((id: string, sessionId: string) => {
    dispatch({ type: 'UPDATE_SESSION_ID', id, sessionId });
  }, []);

  const duplicateTerminal = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_TERMINAL', id });
  }, []);

  const closeAllTerminals = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL_TERMINALS' });
  }, []);

  const resetTerminal = useCallback((id: string) => {
    dispatch({ type: 'RESET_TERMINAL', id });
  }, []);

  return (
    <TerminalManagerContext.Provider
      value={{
        state,
        createTerminal,
        closeTerminal,
        renameTerminal,
        minimizeTerminal,
        restoreTerminal,
        setActiveTerminal,
        deactivateAllTerminals,
        updateTerminalPosition,
        updateTerminalSize,
        updateSessionId,
        duplicateTerminal,
        closeAllTerminals,
        resetTerminal,
      }}
    >
      {children}
    </TerminalManagerContext.Provider>
  );
}

// Custom hook
export function useTerminalManager() {
  const context = useContext(TerminalManagerContext);
  if (context === undefined) {
    throw new Error('useTerminalManager must be used within a TerminalManagerProvider');
  }
  return context;
}
