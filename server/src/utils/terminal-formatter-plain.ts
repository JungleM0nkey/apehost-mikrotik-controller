/**
 * Colorful Terminal Formatter with HTML/CSS
 * Provides rich terminal output with color-coded values
 */

export const SYMBOLS = {
  CHECK: '✓',
  CROSS: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
  ARROW: '→',
  BULLET: '•',
  DIAMOND: '◆',
  STAR: '★',
  UP: '▲',
  DOWN: '▼',
  INTERFACE: '⚡',
  CLOCK: '🕐',
};

/**
 * Colorful Terminal Formatter
 * Uses HTML and CSS classes for rich terminal output
 */
export class PlainTerminalFormatter {
  /**
   * Wrap text in a span with CSS class
   */
  private colorize(text: string, className: string): string {
    return `<span class="${className}">${this.escapeHtml(text)}</span>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Create a status indicator
   */
  status(text: string, type: 'success' | 'error' | 'warning' | 'info'): string {
    const symbols = {
      success: SYMBOLS.CHECK,
      error: SYMBOLS.CROSS,
      warning: SYMBOLS.WARNING,
      info: SYMBOLS.INFO
    };

    const className = `status-${type}`;
    return `<span class="${className}">${symbols[type]} ${this.escapeHtml(text)}</span>`;
  }

  /**
   * Create a section header
   */
  header(text: string, width = 60): string {
    const paddedText = ` ${text} `;
    const borderLength = Math.max(width - paddedText.length, 2);
    const leftBorder = '─'.repeat(Math.floor(borderLength / 2));
    const rightBorder = '─'.repeat(Math.ceil(borderLength / 2));

    return `<span class="section-header">${this.escapeHtml(leftBorder + paddedText + rightBorder)}</span>`;
  }

  /**
   * Format a key-value pair
   */
  keyValue(key: string, value: any, keyWidth = 20): string {
    const paddedKey = key.padEnd(keyWidth);
    const formattedValue = this.formatValue(key, value);
    return `<span class="key">${this.escapeHtml(paddedKey)}</span>: ${formattedValue}`;
  }

  /**
   * Format a value based on its type
   */
  private formatValue(key: string, value: any): string {
    if (value === null || value === undefined) {
      return this.colorize('null', 'value-null');
    }

    const valueStr = String(value);

    // Boolean/Status - True/Enabled
    if (/^(true|enabled|running|yes|up|active)$/i.test(valueStr)) {
      return this.colorize(valueStr, 'value-true');
    }

    // Boolean/Status - False/Disabled
    if (/^(false|disabled|stopped|no|down|inactive)$/i.test(valueStr)) {
      return this.colorize(valueStr, 'value-false');
    }

    // IP Addresses
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(valueStr)) {
      return this.colorize(valueStr, 'value-ip');
    }

    // MAC Addresses
    if (/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i.test(valueStr)) {
      return this.colorize(valueStr, 'value-mac');
    }

    // Interface Names
    if (/^(ether|wlan|bridge|vlan|pppoe|sfp|lo)/i.test(valueStr)) {
      return this.colorize(valueStr, 'value-interface');
    }

    // Time/Uptime
    if (/\d+[wdhms]/.test(valueStr)) {
      return this.colorize(valueStr, 'value-time');
    }

    // Numbers
    if (/^\d+(\.\d+)?$/.test(valueStr)) {
      return this.colorize(valueStr, 'value-number');
    }

    return this.colorize(valueStr, 'value-default');
  }

  /**
   * Create a command summary
   */
  commandSummary(command: string, executionTime: number, success: boolean): string {
    const statusIcon = success ? SYMBOLS.CHECK : SYMBOLS.CROSS;
    const statusText = success ? 'SUCCESS' : 'FAILED';
    const className = success ? 'command-summary success' : 'command-summary error';

    return `<div class="${className}">` +
           `<span class="terminal-command">${this.escapeHtml(command)}</span>` +
           ` ${SYMBOLS.ARROW} ` +
           `<span>${statusIcon} ${statusText}</span>` +
           ` <span class="value-number">(${executionTime}ms)</span>` +
           `</div>`;
  }

  /**
   * Format a progress bar (plain text)
   */
  progressBar(current: number, total: number, width = 20): string {
    const percentage = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.round(percentage * 100);

    return `<span class="progress-bar">${this.escapeHtml(bar)} ` +
           `<span class="value-number">${percent}%</span></span>`;
  }

  /**
   * Format system resources
   */
  systemResources(cpu: number, memory: number, disk?: number): string {
    let result = `<span class="key">CPU:   </span> ${this.progressBar(cpu, 100)}\n`;
    result += `<span class="key">Memory:</span> ${this.progressBar(memory, 100)}`;

    if (disk !== undefined) {
      result += `\n<span class="key">Disk:  </span> ${this.progressBar(disk, 100)}`;
    }

    return result;
  }

  /**
   * Format interface status
   */
  interfaceStatus(name: string, status: string, rxRate?: number, txRate?: number): string {
    const statusIcon = status === 'up' ? SYMBOLS.UP : SYMBOLS.DOWN;
    const statusClass = status === 'up' ? 'value-status-up' : 'value-status-down';

    let result = `<span class="${statusClass}">${statusIcon} ${SYMBOLS.INTERFACE} ` +
                 `${this.escapeHtml(name)} (${status.toUpperCase()})</span>`;

    if (rxRate !== undefined && txRate !== undefined) {
      result += ` <span class="value-number">↓${this.formatBytes(rxRate)}/s ↑${this.formatBytes(txRate)}/s</span>`;
    }

    return result;
  }

  /**
   * Format bytes with units
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
   * Create a table border
   */
  tableBorder(type: 'top' | 'middle' | 'bottom', columnWidths: number[]): string {
    const chars = {
      top: { left: '┌', middle: '┬', right: '┐', horizontal: '─' },
      middle: { left: '├', middle: '┼', right: '┤', horizontal: '─' },
      bottom: { left: '└', middle: '┴', right: '┘', horizontal: '─' }
    };
    
    const c = chars[type];
    const segments = columnWidths.map(w => c.horizontal.repeat(w + 2));
    return `${c.left}${segments.join(c.middle)}${c.right}`;
  }

  /**
   * Create a box around content
   */
  box(content: string, title?: string): string {
    const lines = content.split('\n');
    // Strip HTML tags for width calculation
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
    const maxWidth = Math.max(...lines.map(line => stripHtml(line).length), title ? title.length : 0);
    const boxWidth = maxWidth + 4;

    let result = '<div class="output-section">';

    // Top border
    if (title) {
      const padding = boxWidth - title.length - 4;
      const leftPad = Math.floor(padding / 2);
      const rightPad = Math.ceil(padding / 2);
      result += `<span class="section-header">┌${'─'.repeat(leftPad)} ${this.escapeHtml(title)} ${'─'.repeat(rightPad)}┐</span>\n`;
    } else {
      result += `┌${'─'.repeat(boxWidth - 2)}┐\n`;
    }

    // Content
    lines.forEach(line => {
      const strippedLine = stripHtml(line);
      const padding = boxWidth - strippedLine.length - 4;
      result += `│ ${line}${' '.repeat(Math.max(padding, 0))} │\n`;
    });

    // Bottom border
    result += `└${'─'.repeat(boxWidth - 2)}┘`;
    result += '</div>';

    return result;
  }
}
