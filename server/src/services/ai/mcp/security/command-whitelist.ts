/**
 * Command Whitelist for Safe RouterOS Command Execution
 *
 * Defines which RouterOS commands are safe to execute and validates
 * incoming commands against this whitelist.
 *
 * Security Philosophy:
 * - Allow read-only commands that retrieve information
 * - Block ALL write commands (set, add, remove, edit)
 * - Block user management commands
 * - Block system control commands (reboot, shutdown, reset)
 * - Block file operations
 */

/**
 * Whitelist of safe RouterOS commands
 * These are exact command matches or regex patterns
 */
const SAFE_COMMANDS: Array<string | RegExp> = [
  // System Information (read-only)
  '/system resource print',
  '/system identity print',
  '/system clock print',
  '/system routerboard print',
  '/system package print',
  '/system license print',
  '/system history print',

  // Interface Information (read-only)
  '/interface print',
  '/interface print detail',
  '/interface print stats',
  '/interface ethernet print',
  '/interface wireless print',
  '/interface bridge print',
  '/interface vlan print',
  '/interface bonding print',

  // IP Configuration (read-only)
  '/ip address print',
  '/ip route print',
  '/ip route print detail',
  '/ip dhcp-server lease print',
  '/ip dhcp-client print',
  '/ip dns print',
  '/ip arp print',
  '/ip neighbor print',

  // Firewall (read-only)
  '/ip firewall filter print',
  '/ip firewall nat print',
  '/ip firewall mangle print',
  '/ip firewall address-list print',
  '/ip firewall connection print',

  // Routing (read-only)
  '/routing bgp peer print',
  '/routing ospf instance print',
  '/routing ospf neighbor print',
  '/routing rip neighbor print',

  // Wireless (read-only)
  '/interface wireless registration-table print',
  '/interface wireless access-list print',

  // Queue (read-only)
  '/queue simple print',
  '/queue tree print',

  // User and System (read-only - limited)
  '/user print',
  '/user active print',

  // Logs (read-only)
  '/log print',
  '/log print follow=no',
  /^\/log print where topics~".*"$/,

  // Tools (safe diagnostic commands)
  '/tool ping',
  '/tool traceroute',
  '/tool ip-scan',
  '/tool netwatch print',
  '/tool sniffer print',

  // System monitoring
  '/system health print',
  '/system watchdog print',

  // File listing (read-only)
  '/file print',
];

/**
 * Patterns for dangerous commands that must NEVER be allowed
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\bset\b/i, // Any set command
  /\badd\b/i, // Any add command
  /\bremove\b/i, // Any remove command
  /\bedit\b/i, // Any edit command
  /\benable\b/i, // Enable/disable commands
  /\bdisable\b/i,
  /\breboot\b/i, // System control
  /\bshutdown\b/i,
  /\breset-configuration\b/i,
  /\/user.*set/i, // User password changes
  /\/user.*add/i, // User creation
  /\/user.*remove/i, // User deletion
  /\/system.*reboot/i,
  /\/system.*shutdown/i,
  /\/system.*reset/i,
  /\/file.*remove/i, // File deletion
  /\/file.*set/i, // File modification
  /;/, // Command chaining
  /\|/, // Piping (could be used for injection)
  /`/, // Command substitution
  /\$/, // Variable expansion
];

export class CommandWhitelist {
  /**
   * Validate if a command is safe to execute
   */
  validate(command: string): { safe: boolean; reason?: string } {
    // Trim and normalize command
    const normalizedCommand = command.trim();

    // Check for empty command
    if (!normalizedCommand) {
      return { safe: false, reason: 'Empty command' };
    }

    // Check for dangerous patterns first
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(normalizedCommand)) {
        return {
          safe: false,
          reason: `Command contains dangerous pattern: ${pattern.source}`,
        };
      }
    }

    // Check against whitelist
    for (const allowedCommand of SAFE_COMMANDS) {
      if (typeof allowedCommand === 'string') {
        // Exact match
        if (normalizedCommand === allowedCommand) {
          return { safe: true };
        }
      } else {
        // Regex match
        if (allowedCommand.test(normalizedCommand)) {
          return { safe: true };
        }
      }
    }

    // Command not in whitelist
    return {
      safe: false,
      reason: 'Command not in whitelist. Only read-only commands are allowed.',
    };
  }

  /**
   * Get list of safe command examples
   */
  getSafeCommandExamples(): string[] {
    return SAFE_COMMANDS.filter((cmd) => typeof cmd === 'string') as string[];
  }

  /**
   * Check if command is a print/read command
   */
  isPrintCommand(command: string): boolean {
    return command.includes('print') || command.includes('show');
  }
}

// Global command whitelist instance
export const globalCommandWhitelist = new CommandWhitelist();
