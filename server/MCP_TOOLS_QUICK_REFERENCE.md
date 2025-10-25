# MCP Tools Quick Reference

## 🎯 Available Tools

### 1. get_router_info
**Purpose**: System information
**Parameters**: None
**Test Query**: "What's my router's CPU and memory usage?"
**Returns**: CPU load, memory usage, uptime, version, hostname

### 2. get_interfaces
**Purpose**: Network interface information
**Parameters**: `type` (optional) - ethernet, wireless, bridge, vlan, bonding
**Test Queries**:
- "Show me all network interfaces"
- "Show me only ethernet interfaces"
- "What's the status of my wireless interfaces?"
**Returns**: Interface names, types, status, traffic stats

### 3. get_dhcp_leases
**Purpose**: DHCP lease information
**Parameters**: `status` (optional) - bound, waiting, offered
**Test Queries**:
- "Which devices have DHCP leases?"
- "Show me active DHCP clients"
- "List all bound DHCP leases"
**Returns**: IP addresses, MAC addresses, hostnames, lease status

### 4. get_routes
**Purpose**: Routing table
**Parameters**: None
**Test Query**: "Show me the routing table"
**Returns**: Destination networks, gateways, route status

### 5. get_firewall_rules
**Purpose**: Firewall filter rules
**Parameters**: `chain` (optional) - input, forward, output
**Test Queries**:
- "Show me all firewall rules"
- "What firewall rules are in the input chain?"
- "Show me forward chain rules"
**Returns**: Firewall chains, actions, addresses, statistics

### 6. execute_safe_command
**Purpose**: Execute whitelisted RouterOS commands
**Parameters**: `command` (required) - RouterOS command string
**Test Queries**:
- "Execute the command: /system resource print"
- "Run /log print"
- "Execute /tool ping address=8.8.8.8 count=3"
**Returns**: Command output
**Security**: Only read-only commands allowed

## 🔒 Security Features

### Command Whitelist
**Allowed**: Read-only commands (print, show, monitor)
**Blocked**: Write operations, user management, system control

**Example Safe Commands**:
```
/system resource print
/interface print
/ip address print
/log print where topics~"system"
/tool ping address=8.8.8.8 count=3
```

**Example Blocked Commands**:
```
/user add name=test          ❌ User management
/system reboot               ❌ System control
/interface set disabled=yes  ❌ Write operation
/file remove backup.rsc      ❌ File operations
```

### Rate Limiting
- **Limit**: 20 tool calls per minute per session
- **Reset**: Automatically after 60 seconds
- **Exceeded**: Returns error message with remaining count

### Audit Logging
- All tool executions logged
- Includes: tool name, session ID, parameters, result, execution time
- Tracks: success/failure rate, tool usage statistics

## 🧪 Testing Scenarios

### Basic Tool Testing
```
1. Single Tool Query
   Input: "What's my router's uptime?"
   Expected: Uses get_router_info

2. Tool with Parameter
   Input: "Show me ethernet interfaces only"
   Expected: Uses get_interfaces with type=ethernet

3. Multi-Tool Query
   Input: "Give me a full health summary: system info, interfaces, and DHCP leases"
   Expected: Uses get_router_info, get_interfaces, get_dhcp_leases
```

### Security Testing
```
4. Whitelist Block
   Input: "Execute /user add name=hacker password=test"
   Expected: Blocked with security error message

5. Rate Limit Test
   - Make 20 rapid queries: All should succeed
   - 21st query: Should fail with rate limit error
   - Wait 60 seconds: Should reset and work again
```

### Error Handling
```
6. Invalid Tool Use
   Input: "Execute /invalid-command"
   Expected: Command not in whitelist error

7. Invalid Parameter
   Input: Ask for interface type "invalid-type"
   Expected: Parameter validation error
```

## 📊 Expected Tool Flow

1. **User sends query** → WebSocket receives message
2. **Claude analyzes** → Determines which tool(s) needed
3. **Tool calling** → Claude makes tool_use request
4. **Security checks**:
   - Rate limit check
   - Command whitelist (for execute_safe_command)
   - Input validation
5. **Execution** → Tool executes RouterOS command
6. **Audit log** → Execution recorded
7. **Result formatting** → Data parsed and returned
8. **Response** → Claude generates natural language response with data
9. **Stream to user** → Response streamed to UI

## 💡 Usage Tips

### For Best Results:
- **Be specific**: "Show me ethernet interfaces" vs "show interfaces"
- **Use natural language**: "What's my router's CPU usage?" works
- **Multi-tool queries**: "Give me a summary of..." triggers multiple tools
- **Command execution**: Explicitly say "execute command: /..."

### Common Patterns:
```
Health Check: "How is my router performing?"
→ Uses: get_router_info

Network Overview: "Show me my network setup"
→ Uses: get_interfaces, get_dhcp_leases, get_routes

Firewall Review: "Review my firewall security"
→ Uses: get_firewall_rules

Connectivity Test: "Test connection to 8.8.8.8"
→ Uses: execute_safe_command with /tool ping
```

## 🔧 Troubleshooting

### Tool Not Executing
- Check: Is MikroTik service connected?
- Check: Are credentials correct in .env?
- Check: Is Claude API key valid?

### Command Blocked
- Verify: Command is in whitelist
- Check: No write operations in command
- Check: No dangerous patterns (set, add, remove, etc.)

### Rate Limit Hit
- Solution: Wait 60 seconds for reset
- Or: Reduce query frequency

### Parsing Errors
- Check: Router is returning expected format
- Check: RouterOS version compatibility
- Check: Command output structure

---

**Version**: Phase 2 Implementation
**Status**: ✅ Ready for Testing
**Last Updated**: January 2025
