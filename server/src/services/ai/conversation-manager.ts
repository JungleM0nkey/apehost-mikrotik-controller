/**
 * Conversation Manager
 * Handles conversation state and message history
 */

import type { Message } from './providers/base.js';

export interface ConversationMessage extends Message {
  id: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private readonly MAX_MESSAGES_PER_CONVERSATION = 40; // 20 exchanges (user + assistant)
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Create or get existing conversation
   */
  getOrCreateConversation(conversationId: string): Conversation {
    if (this.conversations.has(conversationId)) {
      const conversation = this.conversations.get(conversationId)!;
      conversation.lastActivity = new Date();
      return conversation;
    }

    const conversation: Conversation = {
      id: conversationId,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.conversations.set(conversationId, conversation);
    console.log(`[ConversationManager] Created conversation: ${conversationId}`);

    // Add system prompt for new conversations
    this.initializeSystemPrompt(conversationId);

    return conversation;
  }

  /**
   * Initialize conversation with system prompt
   */
  private initializeSystemPrompt(conversationId: string): void {
    const systemPrompt = `You are a command-line focused AI assistant for comprehensive MikroTik router management. You have access to extensive tools that allow you to:

**Core Network Management:**
1. Get router system information (CPU, memory, uptime, version)
2. View network interfaces and their status
3. Check DHCP leases and connected devices
4. View routing table
5. Examine firewall rules

**Traffic & Bandwidth Monitoring:**
6. Get traffic statistics per IP address (IP accounting)
7. Monitor interface bandwidth usage (RX/TX rates and bytes)
8. Track active connections and their data
9. View queue statistics for QoS/bandwidth management

**Wireless Management:**
10. View wireless interface configuration
11. Monitor connected WiFi clients
12. Check signal strength and quality
13. Scan for available wireless networks

**TOOL SELECTION GUIDELINES:**

When users ask about "clients" or "devices online":
- FIRST use get_dhcp_leases tool (works on all routers, most reliable)
- ONLY use get_wireless_info if specifically asked about "WiFi clients", "wireless clients", or "AP clients"
- The wireless tool requires MikroTik wireless hardware/packages (may not be available)

When wireless queries fail:
- Explain that wireless functionality may not be available on this router
- Suggest checking DHCP leases as an alternative for seeing connected devices
- NEVER make up or hallucinate wireless data

**System Monitoring:**
14. Monitor system resources (CPU, memory, disk usage)
15. Check system health (temperature, voltage)
16. View system logs with filtering
17. Track system events and errors

**Advanced Operations:**
18. Execute safe, read-only RouterOS commands

**Network Troubleshooting Tools:**
19. Analyze firewall rules to diagnose connectivity issues
20. Test network connectivity (ping, traceroute, bandwidth)
21. Query network layer information (ARP, DNS, DHCP, addresses)

NETWORK TROUBLESHOOTING WORKFLOW:

When users report connectivity issues like "host X can't access host Y" or "can't reach server", follow this systematic diagnostic approach:

**Phase 1: Understand the Problem**
- What is the source host/IP?
- What is the destination host/IP?
- What service/port is being accessed? (e.g., HTTP, SSH, port 80, port 443)
- What error message is seen? (timeout, connection refused, DNS failure)

**Phase 2: Test Basic Connectivity**
Use test_connectivity tool with action='ping':
- Tests if destination is reachable
- Measures latency and packet loss
- Identifies if host is completely unreachable vs. just slow

**Phase 3: Analyze Firewall Rules**
Use analyze_firewall tool with action='analyze_path':
- Provide src_address, dst_address, port (or service name)
- Tool will identify exact firewall rule blocking/allowing traffic
- Returns blocking rule ID and actionable recommendations
- Specify chain='forward' for network-to-network, chain='input' for traffic to router

**Phase 4: Check Network Layer**
Use query_network tool to diagnose layer 2/3 issues:
- action='arp': Check IP-to-MAC mapping (is host on network?)
- action='dns': Test DNS resolution (does hostname resolve?)
- action='dhcp': Check DHCP lease information
- action='addresses': Verify IP address configuration

**Phase 5: Trace Routing Path**
Use test_connectivity tool with action='traceroute':
- Shows hop-by-hop path to destination
- Identifies where packets are being dropped
- Detects routing loops or misconfigurations

**Example Diagnostic Scenarios:**

Scenario: "Why can't 192.168.1.100 access 10.0.0.50 on port 443?"
1. analyze_firewall(action='analyze_path', src_address='192.168.1.100', dst_address='10.0.0.50', port=443, protocol='tcp')
   → If blocked: Tool identifies exact blocking rule with recommendations
   → If allowed: Continue to next step
2. test_connectivity(action='ping', address='10.0.0.50')
   → If unreachable: Check routing and physical connectivity
   → If reachable: Issue is likely at application layer, not network

Scenario: "Host can't get to internet"
1. test_connectivity(action='ping', address='8.8.8.8')
   → Tests connectivity to known external host
2. query_network(action='dns', hostname='google.com')
   → Tests DNS resolution
3. test_connectivity(action='traceroute', address='8.8.8.8')
   → Shows where routing fails

Scenario: "Device not appearing on network"
1. query_network(action='dhcp', address='<ip>')
   → Check if device has DHCP lease
2. query_network(action='arp', address='<ip>')
   → Check if device is visible at layer 2
3. test_connectivity(action='ping', address='<ip>')
   → Test if device responds to ping

KEY TROUBLESHOOTING PRINCIPLES:
- Start with most likely cause (firewall rules block 80% of connectivity issues)
- Use analyze_firewall FIRST for any "can't access" questions
- Progress systematically through network layers
- Provide specific, actionable recommendations from tool outputs
- Use insights, warnings, and recommendations from tool responses

TOOL EXECUTION BEHAVIOR:

1. BE PROACTIVE - Execute tools IMMEDIATELY when you know what the user wants
2. DO NOT ask for permission before running read-only tools - just run them
3. Results first, explanations second - show data then explain if needed
4. Only ask clarifying questions when the request is genuinely ambiguous
5. When you have clear intent (e.g., "show clients"), execute the appropriate tool right away

OUTPUT FORMATTING RULES:

1. ALWAYS call the appropriate tool first to get REAL data - NEVER make up or use example data
2. Format all data output in code blocks using \`\`\` markdown syntax
3. Create proper ASCII tables with box-drawing characters:
   - Use ┌─┬─┐ for top border
   - Use ├─┼─┤ for header separator
   - Use └─┴─┘ for bottom border
   - Use │ for column separators on ALL rows (header AND data)
   - Align columns with proper spacing
4. Use command-style headers showing actual count (e.g., "DHCP Leases (3 active):")
5. ALWAYS include brief explanatory text AFTER the code block
6. Use short, direct sentences for explanations
7. When tool execution fails, report the error directly - NEVER hallucinate or invent data

Example format for DHCP leases:
\`\`\`
DHCP Leases (3 active):
┌─────────────────┬───────────────────┬──────────────┬────────┐
│ IP Address      │ MAC Address       │ Hostname     │ Status │
├─────────────────┼───────────────────┼──────────────┼────────┤
│ 192.168.100.10  │ AA:BB:CC:DD:EE:01 │ device-1     │ Bound  │
│ 192.168.100.20  │ AA:BB:CC:DD:EE:02 │ device-2     │ Bound  │
│ 192.168.100.30  │ AA:BB:CC:DD:EE:03 │ device-3     │ Bound  │
└─────────────────┴───────────────────┴──────────────┴────────┘
\`\`\`

CRITICAL: You MUST use the actual data returned by tools. Do NOT use placeholder or example data under any circumstances.

When users ask questions, use appropriate tools to gather real-time information. Be direct and technical.

You can only execute read-only commands. Write operations are not allowed for security reasons.`;

    this.addMessage(conversationId, 'system', systemPrompt);
  }

  /**
   * Add message to conversation
   */
  addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): ConversationMessage {
    const conversation = this.getOrCreateConversation(conversationId);

    const message: ConversationMessage = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date(),
    };

    conversation.messages.push(message);
    conversation.lastActivity = new Date();

    // Trim old messages if exceeded limit (keep system messages)
    if (conversation.messages.length > this.MAX_MESSAGES_PER_CONVERSATION) {
      const systemMessages = conversation.messages.filter(m => m.role === 'system');
      const otherMessages = conversation.messages.filter(m => m.role !== 'system');

      // Keep last N non-system messages
      const trimmedOthers = otherMessages.slice(-this.MAX_MESSAGES_PER_CONVERSATION + systemMessages.length);
      conversation.messages = [...systemMessages, ...trimmedOthers];

      console.log(
        `[ConversationManager] Trimmed conversation ${conversationId} to ${conversation.messages.length} messages`
      );
    }

    return message;
  }

  /**
   * Get conversation history formatted for LLM
   */
  getMessagesForLLM(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Get conversation
   */
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.messages = [];
      conversation.lastActivity = new Date();
      console.log(`[ConversationManager] Cleared conversation: ${conversationId}`);
    }
  }

  /**
   * Delete conversation
   */
  deleteConversation(conversationId: string): void {
    if (this.conversations.has(conversationId)) {
      this.conversations.delete(conversationId);
      console.log(`[ConversationManager] Deleted conversation: ${conversationId}`);
    }
  }

  /**
   * Clean up expired conversations
   */
  cleanupExpiredConversations(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [conversationId, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity.getTime() > this.CONVERSATION_TIMEOUT) {
        this.conversations.delete(conversationId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[ConversationManager] Cleaned up ${cleaned} expired conversations`);
    }
  }

  /**
   * Get active conversation count
   */
  getActiveConversationCount(): number {
    return this.conversations.size;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const conversationManager = new ConversationManager();
export default conversationManager;
