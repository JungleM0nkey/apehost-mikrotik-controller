import { useEffect } from 'react';
import { useTerminalManager } from '../contexts/TerminalManagerContext';

/**
 * Custom hook for terminal keyboard shortcuts
 *
 * Shortcuts:
 * - Ctrl+Shift+T: Create new terminal
 * - Ctrl+Shift+W: Close active terminal
 * - Ctrl+Tab: Switch to next terminal
 * - Ctrl+Shift+Tab: Switch to previous terminal
 * - Ctrl+M: Minimize active terminal
 * - Ctrl+1-9: Switch to terminal 1-9
 * - F2: Trigger rename on active terminal (handled by TerminalTab)
 */
export function useTerminalKeyboardShortcuts() {
  const {
    state,
    createTerminal,
    closeTerminal,
    minimizeTerminal,
    setActiveTerminal,
  } = useTerminalManager();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T - Create new terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        createTerminal();
        return;
      }

      // Ctrl+Shift+W - Close active terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        const activeTerminal = Array.from(state.terminals.values()).find(t => t.isActive);
        if (activeTerminal) {
          closeTerminal(activeTerminal.id);
        }
        return;
      }

      // Ctrl+M - Minimize active terminal
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        const activeTerminal = Array.from(state.terminals.values()).find(t => t.isActive);
        if (activeTerminal) {
          minimizeTerminal(activeTerminal.id);
        }
        return;
      }

      // Ctrl+Tab - Switch to next terminal
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const terminals = Array.from(state.terminals.values())
          .filter(t => !t.isMinimized)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (terminals.length === 0) return;

        const activeIndex = terminals.findIndex(t => t.isActive);
        const nextIndex = (activeIndex + 1) % terminals.length;
        setActiveTerminal(terminals[nextIndex].id);
        return;
      }

      // Ctrl+Shift+Tab - Switch to previous terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const terminals = Array.from(state.terminals.values())
          .filter(t => !t.isMinimized)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (terminals.length === 0) return;

        const activeIndex = terminals.findIndex(t => t.isActive);
        const prevIndex = activeIndex <= 0 ? terminals.length - 1 : activeIndex - 1;
        setActiveTerminal(terminals[prevIndex].id);
        return;
      }

      // Ctrl+1-9 - Switch to terminal by index
      if (e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const terminals = Array.from(state.terminals.values())
          .filter(t => !t.isMinimized)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (index < terminals.length) {
          setActiveTerminal(terminals[index].id);
        }
        return;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.terminals, createTerminal, closeTerminal, minimizeTerminal, setActiveTerminal]);
}
