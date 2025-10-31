/**
 * Client-side Terminal Output Enhancements
 * Utilities for better terminal rendering and formatting
 */

export interface TerminalColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  ip: string;
  mac: string;
  interface: string;
  time: string;
  number: string;
}

export const TERMINAL_COLORS: TerminalColors = {
  primary: '#ff8c00',
  secondary: '#e5e7eb',
  accent: '#06b6d4',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  ip: '#10b981',
  mac: '#60a5fa',
  interface: '#fbbf24',
  time: '#9ca3af',
  number: '#f472b6',
};

export const TERMINAL_SYMBOLS = {
  CHECK: '✅',
  CROSS: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  ARROW: '→',
  BULLET: '•',
  DIAMOND: '◆',
  STAR: '★',
  LIGHTNING: '⚡',
  GEAR: '⚙️',
  NETWORK: '🌐',
  ROUTER: '📡',
  INTERFACE: '🔌',
  CLOCK: '⏰',
  MEMORY: '💾',
  CPU: '🔥',
  UP: '🟢',
  DOWN: '🔴',
  UNKNOWN: '🟡',
};

/**
 * Enhanced terminal output processing
 */
export class TerminalOutputProcessor {
  /**
   * Process raw terminal output and add visual enhancements
   */
  static enhanceOutput(rawOutput: string): string {
    let enhanced = rawOutput;

    // Add syntax highlighting for common patterns
    enhanced = this.highlightCommands(enhanced);
    enhanced = this.highlightPaths(enhanced);
    enhanced = this.highlightUrls(enhanced);
    enhanced = this.addProgressIndicators(enhanced);

    return enhanced;
  }

  /**
   * Highlight RouterOS commands
   */
  private static highlightCommands(text: string): string {
    return text.replace(
      /(\/[a-zA-Z0-9\/\-_]+(?:\s+[a-zA-Z0-9\-_]+)*)/g,
      '<span class="terminal-command">$1</span>'
    );
  }

  /**
   * Highlight file paths
   */
  private static highlightPaths(text: string): string {
    return text.replace(
      /([\/~][a-zA-Z0-9\/\-_\.]+)/g,
      '<span class="terminal-path">$1</span>'
    );
  }

  /**
   * Highlight URLs
   */
  private static highlightUrls(text: string): string {
    return text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<span class="terminal-url">$1</span>'
    );
  }

  /**
   * Add visual progress indicators for long-running commands
   */
  private static addProgressIndicators(text: string): string {
    // Look for percentage patterns and enhance them
    return text.replace(
      /(\d+(?:\.\d+)?%)/g,
      '<span class="terminal-progress">$1</span>'
    );
  }

  /**
   * Format execution time
   */
  static formatExecutionTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Create a loading spinner animation
   */
  static createLoadingSpinner(): HTMLSpanElement {
    const spinner = document.createElement('span');
    spinner.className = 'terminal-spinner';
    spinner.textContent = '⠋';
    
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    
    const interval = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      spinner.textContent = frames[frameIndex];
    }, 100);
    
    // Store interval on element for cleanup
    (spinner as any)._interval = interval;
    
    return spinner;
  }

  /**
   * Stop and remove loading spinner
   */
  static removeLoadingSpinner(spinner: HTMLSpanElement): void {
    if ((spinner as any)._interval) {
      clearInterval((spinner as any)._interval);
    }
    spinner.remove();
  }

  /**
   * Create status badge
   */
  static createStatusBadge(status: string, type: 'success' | 'error' | 'warning' | 'info'): string {
    const symbols = {
      success: TERMINAL_SYMBOLS.CHECK,
      error: TERMINAL_SYMBOLS.CROSS,
      warning: TERMINAL_SYMBOLS.WARNING,
      info: TERMINAL_SYMBOLS.INFO,
    };

    return `<span class="status-${type}">${symbols[type]} ${status}</span>`;
  }

  /**
   * Format bytes with units
   */
  static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format uptime string
   */
  static formatUptime(uptime: string): string {
    // Parse RouterOS uptime format like "1w2d3h4m5s"
    const matches = uptime.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    
    if (!matches) return uptime;
    
    const [, weeks, days, hours, minutes, seconds] = matches;
    const parts = [];
    
    if (weeks) parts.push(`${weeks} week${weeks !== '1' ? 's' : ''}`);
    if (days) parts.push(`${days} day${days !== '1' ? 's' : ''}`);
    if (hours) parts.push(`${hours} hour${hours !== '1' ? 's' : ''}`);
    if (minutes) parts.push(`${minutes} minute${minutes !== '1' ? 's' : ''}`);
    if (seconds) parts.push(`${seconds} second${seconds !== '1' ? 's' : ''}`);
    
    return parts.join(', ') || uptime;
  }

  /**
   * Create ASCII art border
   */
  static createBorder(text: string, width = 60): string {
    const paddedText = ` ${text} `;
    const borderLength = Math.max(width - paddedText.length, 2);
    const leftBorder = '─'.repeat(Math.floor(borderLength / 2));
    const rightBorder = '─'.repeat(Math.ceil(borderLength / 2));
    
    return `┌${leftBorder}${paddedText}${rightBorder}┐`;
  }

  /**
   * Parse and format RouterOS table output
   */
  static formatTable(data: any[]): string {
    if (!data || data.length === 0) {
      return this.createStatusBadge('No data available', 'info');
    }

    // Get all unique keys
    const allKeys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!key.startsWith('.')) {
          allKeys.add(key);
        }
      });
    });

    const keys = Array.from(allKeys);
    if (keys.length === 0) return this.createStatusBadge('No valid data', 'warning');

    // Calculate column widths
    const colWidths = keys.map(key => {
      const values = data.map(item => String(item[key] || ''));
      return Math.max(key.length, ...values.map(v => v.length)) + 2;
    });

    // Create header
    const header = keys.map((key, i) => key.padEnd(colWidths[i])).join('│');
    const separator = colWidths.map(w => '─'.repeat(w)).join('┼');

    // Create rows
    const rows = data.map(item => 
      keys.map((key, i) => String(item[key] || '').padEnd(colWidths[i])).join('│')
    );

    return [
      `┌${separator.replace(/┼/g, '┬')}┐`,
      `│${header}│`,
      `├${separator}┤`,
      ...rows.map(row => `│${row}│`),
      `└${separator.replace(/┼/g, '┴')}┘`
    ].join('\n');
  }
}

/**
 * Terminal animations and effects
 */
export class TerminalAnimations {
  /**
   * Typewriter effect for text
   */
  static async typeWriter(element: HTMLElement, text: string, speed = 50): Promise<void> {
    element.textContent = '';
    
    for (let i = 0; i < text.length; i++) {
      element.textContent += text.charAt(i);
      await new Promise(resolve => setTimeout(resolve, speed));
    }
  }

  /**
   * Matrix-style text reveal
   */
  static async matrixReveal(element: HTMLElement, text: string): Promise<void> {
    const chars = '01';
    const originalText = text;
    let revealed = '';
    
    for (let i = 0; i < text.length; i++) {
      // Show random characters first
      for (let j = 0; j < 5; j++) {
        const randomText = revealed + 
          Array.from({ length: text.length - i }, () => 
            chars[Math.floor(Math.random() * chars.length)]
          ).join('');
        element.textContent = randomText;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      // Reveal the actual character
      revealed += originalText[i];
      element.textContent = revealed + originalText.slice(i + 1);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    element.textContent = originalText;
  }

  /**
   * Pulse effect for status indicators
   */
  static addPulsEffect(element: HTMLElement, color: string): void {
    element.style.animation = `pulse 2s infinite`;
    element.style.setProperty('--pulse-color', color);
  }
}

/**
 * Command completion and suggestions
 */
export class TerminalCommandHelper {
  private static readonly MIKROTIK_COMMANDS = [
    // System commands
    '/system resource print',
    '/system identity print',
    '/system clock print',
    '/system reboot',
    '/system shutdown',
    '/system backup save',
    '/system reset-configuration',
    
    // Interface commands
    '/interface print',
    '/interface ethernet print',
    '/interface wireless print',
    '/interface bridge print',
    '/interface vlan print',
    
    // IP commands
    '/ip address print',
    '/ip route print',
    '/ip route add',
    '/ip firewall filter print',
    '/ip firewall nat print',
    '/ip firewall mangle print',
    '/ip dns print',
    '/ip dhcp-server print',
    '/ip dhcp-client print',
    
    // User commands
    '/user print',
    '/user add',
    '/user remove',
    
    // Log commands
    '/log print',
    '/log print follow',
    
    // File commands
    '/file print',
    
    // Tool commands
    '/tool ping',
    '/tool traceroute',
    '/tool bandwidth-test',
    '/tool profile',
    
    // Routing commands
    '/routing bgp peer print',
    '/routing ospf instance print',
    '/routing rip interface print',
    
    // Wireless commands
    '/interface wireless registration-table print',
    '/interface wireless scan',
    
    // Queue commands
    '/queue simple print',
    '/queue tree print',
    
    // Special commands
    '/quit',
    '/help',
    '/clear'
  ];

  /**
   * Get command suggestions based on input
   */
  static getSuggestions(input: string): string[] {
    if (!input.startsWith('/')) return [];
    
    return this.MIKROTIK_COMMANDS.filter(cmd =>
      cmd.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 10);
  }

  /**
   * Get command description
   */
  static getCommandDescription(command: string): string {
    const descriptions: Record<string, string> = {
      '/system resource print': 'Display system resources (CPU, memory, disk)',
      '/system identity print': 'Show router identity and hostname',
      '/interface print': 'List all network interfaces',
      '/ip address print': 'Show IP addresses assigned to interfaces',
      '/ip route print': 'Display routing table',
      '/user print': 'List all users',
      '/log print': 'Show system logs',
      '/tool ping': 'Ping a host to test connectivity',
      '/help': 'Show available commands',
      '/clear': 'Clear terminal screen',
    };
    
    return descriptions[command] || 'RouterOS command';
  }

  /**
   * Validate command syntax
   */
  static validateCommand(command: string): { valid: boolean; error?: string } {
    if (!command.trim()) {
      return { valid: false, error: 'Command cannot be empty' };
    }
    
    if (!command.startsWith('/') && !['help', 'clear'].includes(command.trim())) {
      return { 
        valid: false, 
        error: 'RouterOS commands must start with / (e.g., /system resource print)' 
      };
    }
    
    return { valid: true };
  }
}