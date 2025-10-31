/**
 * Advanced Terminal Output Formatter
 * Provides enhanced coloring, formatting, and visual improvements for terminal output
 */

import chalk from 'chalk';

// Text-based symbols for clean terminal output (no emojis)
export const SYMBOLS = {
  CHECK: '[OK]',
  CROSS: '[FAILED]',
  WARNING: '[WARN]',
  INFO: '[INFO]',
  ARROW: '->',
  BULLET: '*',
  DIAMOND: '*',
  STAR: '*',
  LIGHTNING: '[!]',
  GEAR: '[*]',
  NETWORK: '[NET]',
  ROUTER: '[RTR]',
  INTERFACE: '[IF]',
  CLOCK: '[TIME]',
  MEMORY: '[MEM]',
  CPU: '[CPU]',
  UP: '[UP]',
  DOWN: '[DOWN]',
  UNKNOWN: '[?]',
  BOX_TOP_LEFT: '┌',
  BOX_TOP_RIGHT: '┐',
  BOX_BOTTOM_LEFT: '└',
  BOX_BOTTOM_RIGHT: '┘',
  BOX_HORIZONTAL: '─',
  BOX_VERTICAL: '│',
  BOX_TEE_DOWN: '┬',
  BOX_TEE_UP: '┴',
  BOX_TEE_RIGHT: '├',
  BOX_TEE_LEFT: '┤',
  BOX_CROSS: '┼'
};

// Color themes
export const COLORS = {
  // Status colors
  SUCCESS: '#10b981',
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
  
  // MikroTik brand colors
  MIKROTIK: '#ff8c00',
  MIKROTIK_DARK: '#cc6600',
  
  // Data type colors
  IP: '#10b981',
  MAC: '#60a5fa',
  INTERFACE: '#fbbf24',
  TIME: '#9ca3af',
  NUMBER: '#f472b6',
  BOOLEAN_TRUE: '#10b981',
  BOOLEAN_FALSE: '#ef4444',
  
  // UI colors
  KEY: '#60a5fa',
  VALUE: '#e5e7eb',
  HEADER: '#ff8c00',
  BORDER: '#374151',
  ACCENT: '#06b6d4'
};

export interface TerminalTheme {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

export const DEFAULT_THEME: TerminalTheme = {
  primary: COLORS.MIKROTIK,
  secondary: COLORS.VALUE,
  accent: COLORS.ACCENT,
  success: COLORS.SUCCESS,
  error: COLORS.ERROR,
  warning: COLORS.WARNING,
  info: COLORS.INFO
};

/**
 * HTML-safe color formatter for web terminal
 */
export class HtmlTerminalFormatter {
  constructor(private theme: TerminalTheme = DEFAULT_THEME) {}

  /**
   * Create a colored span element
   */
  private colorSpan(text: string, color: string, bold = false, className?: string): string {
    const style = `color: ${color}; ${bold ? 'font-weight: bold;' : ''}`;
    const classAttr = className ? ` class="${className}"` : '';
    return `<span style="${style}"${classAttr}>${this.escapeHtml(text)}</span>`;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Create a status indicator
   */
  status(text: string, type: 'success' | 'error' | 'warning' | 'info'): string {
    const colors = {
      success: this.theme.success,
      error: this.theme.error,
      warning: this.theme.warning,
      info: this.theme.info
    };

    const symbols = {
      success: SYMBOLS.CHECK,
      error: SYMBOLS.CROSS,
      warning: SYMBOLS.WARNING,
      info: SYMBOLS.INFO
    };

    return `${symbols[type]} ${this.colorSpan(text, colors[type], true, `status-${type}`)}`;
  }

  /**
   * Create a section header with decorative borders
   */
  header(text: string, width = 60): string {
    const paddedText = ` ${text} `;
    const borderLength = Math.max(width - paddedText.length, 2);
    const leftBorder = SYMBOLS.BOX_HORIZONTAL.repeat(Math.floor(borderLength / 2));
    const rightBorder = SYMBOLS.BOX_HORIZONTAL.repeat(Math.ceil(borderLength / 2));
    
    return this.colorSpan(
      `${leftBorder}${paddedText}${rightBorder}`,
      this.theme.primary,
      true,
      'section-header'
    );
  }

  /**
   * Create a key-value pair with proper alignment
   */
  keyValue(key: string, value: any, keyWidth = 20): string {
    const paddedKey = key.padEnd(keyWidth);
    const coloredValue = this.colorizeValue(key, value);
    
    return `${this.colorSpan(paddedKey, this.theme.info, false, 'key')} ${this.colorSpan(':', this.theme.secondary)} ${coloredValue}`;
  }

  /**
   * Create a progress bar
   */
  progressBar(current: number, total: number, width = 40): string {
    const percentage = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.round(percentage * 100);
    
    return `${this.colorSpan(bar, this.theme.accent)} ${this.colorSpan(`${percent}%`, this.theme.secondary)}`;
  }

  /**
   * Create a table with proper alignment
   */
  table(headers: string[], rows: string[][]): string {
    if (rows.length === 0) return this.colorSpan('No data available', this.theme.warning);
    
    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => (row[i] || '').toString().length));
      return Math.max(header.length, maxRowWidth) + 2;
    });

    // Create header
    const headerRow = headers.map((header, i) => 
      this.colorSpan(header.padEnd(colWidths[i]), this.theme.primary, true)
    ).join('');

    const separator = this.colorSpan(
      colWidths.map(w => SYMBOLS.BOX_HORIZONTAL.repeat(w)).join(''),
      this.theme.primary
    );

    // Create rows
    const dataRows = rows.map(row => 
      row.map((cell, i) => {
        const cellStr = (cell || '').toString();
        const paddedCell = cellStr.padEnd(colWidths[i]);
        return this.colorSpan(paddedCell, this.theme.secondary);
      }).join('')
    ).join('\n');

    return `${headerRow}\n${separator}\n${dataRows}`;
  }

  /**
   * Create a box around content
   */
  box(content: string, title?: string): string {
    const lines = content.split('\n');
    const maxWidth = Math.max(...lines.map(line => line.length));
    const boxWidth = Math.max(maxWidth + 4, 20);
    
    let result = '';
    
    // Top border
    if (title) {
      const titlePadding = Math.max(boxWidth - title.length - 4, 0);
      const leftPadding = Math.floor(titlePadding / 2);
      const rightPadding = Math.ceil(titlePadding / 2);
      result += this.colorSpan(
        `${SYMBOLS.BOX_TOP_LEFT}${SYMBOLS.BOX_HORIZONTAL.repeat(leftPadding)} ${title} ${SYMBOLS.BOX_HORIZONTAL.repeat(rightPadding)}${SYMBOLS.BOX_TOP_RIGHT}`,
        this.theme.primary
      ) + '\n';
    } else {
      result += this.colorSpan(
        `${SYMBOLS.BOX_TOP_LEFT}${SYMBOLS.BOX_HORIZONTAL.repeat(boxWidth - 2)}${SYMBOLS.BOX_TOP_RIGHT}`,
        this.theme.primary
      ) + '\n';
    }
    
    // Content lines
    lines.forEach(line => {
      const padding = boxWidth - line.length - 4;
      result += this.colorSpan(SYMBOLS.BOX_VERTICAL, this.theme.primary) + 
               ` ${line}${' '.repeat(Math.max(padding, 0))} ` +
               this.colorSpan(SYMBOLS.BOX_VERTICAL, this.theme.primary) + '\n';
    });
    
    // Bottom border
    result += this.colorSpan(
      `${SYMBOLS.BOX_BOTTOM_LEFT}${SYMBOLS.BOX_HORIZONTAL.repeat(boxWidth - 2)}${SYMBOLS.BOX_BOTTOM_RIGHT}`,
      this.theme.primary
    );
    
    return result;
  }

  /**
   * Colorize values based on their type and content
   */
  private colorizeValue(key: string, value: any): string {
    if (value === null || value === undefined) {
      return this.colorSpan('null', this.theme.warning, false, 'value-null');
    }

    const valueStr = String(value);

    // Boolean values
    if (valueStr === 'true' || valueStr === 'yes' || valueStr === 'enabled' || valueStr === 'up') {
      return this.colorSpan(valueStr, COLORS.BOOLEAN_TRUE, true, 'value-true');
    }
    if (valueStr === 'false' || valueStr === 'no' || valueStr === 'disabled' || valueStr === 'down') {
      return this.colorSpan(valueStr, COLORS.BOOLEAN_FALSE, true, 'value-false');
    }

    // IP Addresses
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(valueStr)) {
      return this.colorSpan(valueStr, COLORS.IP, true, 'value-ip');
    }

    // MAC Addresses
    if (/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(valueStr)) {
      return this.colorSpan(valueStr, COLORS.MAC, false, 'value-mac');
    }

    // Numbers with units (bytes, bps, etc.)
    if (/^\d+(\.\d+)?\s*(b|B|kb|KB|mb|MB|gb|GB|bps|Kbps|Mbps|Gbps)$/i.test(valueStr)) {
      return this.colorSpan(valueStr, COLORS.NUMBER, false, 'value-number');
    }

    // Pure numbers
    if (/^\d+(\.\d+)?$/.test(valueStr)) {
      return this.colorSpan(valueStr, COLORS.NUMBER, false, 'value-number');
    }

    // Time/Uptime (1w2d3h4m5s)
    if (/\d+[wdhms]/.test(valueStr)) {
      return this.colorSpan(valueStr, COLORS.TIME, false, 'value-time');
    }

    // Interface Names
    if (/^(ether|wlan|bridge|vlan|pppoe|sfp|lo)/i.test(valueStr)) {
      return this.colorSpan(valueStr, COLORS.INTERFACE, true, 'value-interface');
    }

    // Status indicators
    if (['running', 'active', 'connected', 'online'].includes(valueStr.toLowerCase())) {
      return `${SYMBOLS.UP} ${this.colorSpan(valueStr, COLORS.SUCCESS, true, 'value-status-up')}`;
    }
    if (['stopped', 'inactive', 'disconnected', 'offline'].includes(valueStr.toLowerCase())) {
      return `${SYMBOLS.DOWN} ${this.colorSpan(valueStr, COLORS.ERROR, true, 'value-status-down')}`;
    }

    // Default
    return this.colorSpan(valueStr, this.theme.secondary, false, 'value-default');
  }

  /**
   * Create an interface status display
   */
  interfaceStatus(name: string, status: string, rxRate?: number, txRate?: number): string {
    const statusIcon = status === 'up' ? SYMBOLS.UP : SYMBOLS.DOWN;
    const statusColor = status === 'up' ? COLORS.SUCCESS : COLORS.ERROR;
    
    let result = `${statusIcon} ${this.colorSpan(name, COLORS.INTERFACE, true)} `;
    result += `${this.colorSpan(status.toUpperCase(), statusColor, true)}`;
    
    if (rxRate !== undefined && txRate !== undefined) {
      result += ` (${this.colorSpan(`↓${this.formatBytes(rxRate)}/s`, COLORS.INFO)} `;
      result += `${this.colorSpan(`↑${this.formatBytes(txRate)}/s`, COLORS.WARNING)})`;
    }
    
    return result;
  }

  /**
   * Format bytes with appropriate units
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Create a system resource display
   */
  systemResources(cpu: number, memory: number, disk?: number): string {
    let result = `${SYMBOLS.CPU} CPU: ${this.progressBar(cpu, 100)} ${cpu.toFixed(1)}%\n`;
    result += `${SYMBOLS.MEMORY} Memory: ${this.progressBar(memory, 100)} ${memory.toFixed(1)}%`;
    
    if (disk !== undefined) {
      result += `\n${SYMBOLS.GEAR} Disk: ${this.progressBar(disk, 100)} ${disk.toFixed(1)}%`;
    }
    
    return result;
  }

  /**
   * Create a command execution summary
   */
  commandSummary(command: string, executionTime: number, success: boolean): string {
    const statusIcon = success ? SYMBOLS.CHECK : SYMBOLS.CROSS;
    const statusColor = success ? COLORS.SUCCESS : COLORS.ERROR;
    const timeColor = executionTime > 1000 ? COLORS.WARNING : COLORS.TIME;
    
    return `${statusIcon} ${this.colorSpan(command, COLORS.KEY)} ` +
           `${this.colorSpan(success ? 'SUCCESS' : 'FAILED', statusColor, true)} ` +
           `${this.colorSpan(`(${executionTime}ms)`, timeColor)}`;
  }
}

/**
 * Console-based formatter for server logs
 */
export class ConsoleTerminalFormatter {
  constructor(private theme: TerminalTheme = DEFAULT_THEME) {}

  /**
   * Create colored console output
   */
  status(text: string, type: 'success' | 'error' | 'warning' | 'info'): string {
    const colors = {
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };

    const symbols = {
      success: SYMBOLS.CHECK,
      error: SYMBOLS.CROSS,
      warning: SYMBOLS.WARNING,
      info: SYMBOLS.INFO
    };

    return `${symbols[type]} ${colors[type].bold(text)}`;
  }

  /**
   * Create a section header
   */
  header(text: string, width = 60): string {
    const paddedText = ` ${text} `;
    const borderLength = Math.max(width - paddedText.length, 2);
    const leftBorder = SYMBOLS.BOX_HORIZONTAL.repeat(Math.floor(borderLength / 2));
    const rightBorder = SYMBOLS.BOX_HORIZONTAL.repeat(Math.ceil(borderLength / 2));
    
    return chalk.hex(this.theme.primary).bold(`${leftBorder}${paddedText}${rightBorder}`);
  }

  /**
   * Create a boxed message
   */
  box(content: string, title?: string): string {
    const lines = content.split('\n');
    const maxWidth = Math.max(...lines.map(line => line.length));
    const boxWidth = Math.max(maxWidth + 4, 20);
    
    let result = '';
    
    // Top border
    if (title) {
      const titlePadding = Math.max(boxWidth - title.length - 4, 0);
      const leftPadding = Math.floor(titlePadding / 2);
      const rightPadding = Math.ceil(titlePadding / 2);
      result += chalk.hex(this.theme.primary)(
        `${SYMBOLS.BOX_TOP_LEFT}${SYMBOLS.BOX_HORIZONTAL.repeat(leftPadding)} ${title} ${SYMBOLS.BOX_HORIZONTAL.repeat(rightPadding)}${SYMBOLS.BOX_TOP_RIGHT}`
      ) + '\n';
    } else {
      result += chalk.hex(this.theme.primary)(
        `${SYMBOLS.BOX_TOP_LEFT}${SYMBOLS.BOX_HORIZONTAL.repeat(boxWidth - 2)}${SYMBOLS.BOX_TOP_RIGHT}`
      ) + '\n';
    }
    
    // Content lines
    lines.forEach(line => {
      const padding = boxWidth - line.length - 4;
      result += chalk.hex(this.theme.primary)(SYMBOLS.BOX_VERTICAL) + 
               ` ${line}${' '.repeat(Math.max(padding, 0))} ` +
               chalk.hex(this.theme.primary)(SYMBOLS.BOX_VERTICAL) + '\n';
    });
    
    // Bottom border
    result += chalk.hex(this.theme.primary)(
      `${SYMBOLS.BOX_BOTTOM_LEFT}${SYMBOLS.BOX_HORIZONTAL.repeat(boxWidth - 2)}${SYMBOLS.BOX_BOTTOM_RIGHT}`
    );
    
    return result;
  }
}