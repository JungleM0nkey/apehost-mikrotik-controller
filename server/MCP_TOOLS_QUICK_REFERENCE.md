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

### 5. analyze_firewall
**Purpose**: Intelligent firewall analysis and troubleshooting
**Parameters**:
- `action` (required) - list_rules, analyze_path, list_nat
- `src_address` - Source IP address (for analyze_path)
- `dst_address` - Destination IP address (for analyze_path)
- `port` - Port number (for analyze_path)
- `service` - Service name like 'http', 'https', 'ssh' (for analyze_path)
- `protocol` - tcp or udp (default: tcp)
- `chain` - input, forward, output (default: forward)

**Test Queries**:
- "Show me all firewall rules"
- "Why can't 192.168.1.100 access 10.0.0.50 on port 443?"
- "Is traffic from 192.168.1.0/24 to 8.8.8.8 allowed?"
- "Check if SSH from 192.168.1.50 to the router is blocked"
- "Show me NAT rules"

**Returns**:
- **list_rules**: Firewall filter rules with statistics
- **analyze_path**: Exact verdict (allowed/blocked), blocking rule ID, insights, warnings, recommendations with confidence score
- **list_nat**: NAT rules with statistics

**Key Feature**: The analyze_path action intelligently matches traffic against firewall rules considering:
- Protocol matching (TCP/UDP/ICMP)
- CIDR range matching (192.168.1.0/24)
- Port range matching (8000-9000)
- Negation rules (!192.168.1.0/24)
- Service name resolution (http→80, https→443)
- First-match-wins logic with terminal actions

### 6. test_connectivity
**Purpose**: Active network connectivity testing
**Parameters**:
- `action` (required) - ping, traceroute, bandwidth-test
- `address` (required) - Target IP address or hostname
- `count` - Number of packets/hops (default: 4 for ping, 30 for traceroute)
- `size` - Packet size in bytes (default: 64)
- `interval` - Interval between packets (e.g., "1s", "100ms")
- `interface` - Source interface to use
- `protocol` - tcp or udp for bandwidth-test (default: tcp)
- `direction` - send, receive, or both for bandwidth-test (default: both)

**Test Queries**:
- "Ping 8.8.8.8"
- "Test connectivity to 192.168.1.100"
- "Trace route to google.com"
- "Check bandwidth to 10.0.0.50"
- "Is host 192.168.1.50 reachable?"

**Returns**:
- **ping**: Packet loss %, avg/min/max latency, quality assessment (excellent/good/fair/poor/unreachable)
- **traceroute**: Hop-by-hop path, routing loop detection, path completeness
- **bandwidth-test**: Upload/download speeds in bps and human-readable format

**Quality Assessment**:
- Excellent: <5% loss, <50ms latency
- Good: <5% loss, <100ms latency
- Fair: 5-20% loss or >100ms latency
- Poor: >20% loss
- Unreachable: 100% packet loss

### 7. query_network
**Purpose**: Network layer information (ARP, DNS, DHCP, IP addresses)
**Parameters**:
- `action` (required) - arp, dns, dhcp, addresses
- `address` - IP address to lookup (for arp, dns, dhcp, addresses)
- `mac_address` - MAC address to search for (for arp)
- `hostname` - Hostname to resolve (for dns)
- `interface` - Filter by interface (for arp, dhcp, addresses)

**Test Queries**:
- "What's the MAC address for 192.168.1.100?"
- "Lookup ARP entry for 192.168.1.50"
- "Resolve google.com"
- "Check DHCP lease for 192.168.1.25"
- "Show all IP addresses on ether1"
- "Find which IP has MAC address AA:BB:CC:DD:EE:FF"

**Returns**:
- **arp**: IP-to-MAC mappings, duplicate IP detection, ARP completeness
- **dns**: Hostname resolution results, DNS server connectivity
- **dhcp**: Lease information (IP, MAC, hostname, status, expiry)
- **addresses**: IP address configuration by interface

**Diagnostic Insights**:
- Detects duplicate IP addresses in ARP table
- Identifies incomplete ARP entries
- Reports DNS resolution failures with recommendations
- Shows DHCP lease status (bound, waiting, blocked)
- Provides MAC conflict warnings

### 8. execute_safe_command
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
→ Uses: analyze_firewall (action: list_rules)

Connectivity Troubleshooting: "Why can't host X access host Y?"
→ Uses: analyze_firewall (analyze_path), test_connectivity (ping), query_network (arp/dns)

Connection Quality Test: "Test connection to 8.8.8.8"
→ Uses: test_connectivity (action: ping)

Network Path Discovery: "Trace route to google.com"
→ Uses: test_connectivity (action: traceroute)

Device Lookup: "Find device with IP 192.168.1.100"
→ Uses: query_network (action: arp), get_dhcp_leases
```

## 🔍 Network Troubleshooting Workflows

### Systematic Diagnostic Approach

When users report connectivity issues, follow this 5-phase workflow:

#### Phase 1: Understand the Problem
- Source host/IP?
- Destination host/IP?
- Service/port? (HTTP, SSH, port 80, 443)
- Error message? (timeout, connection refused, DNS failure)

#### Phase 2: Test Basic Connectivity
```
Query: "Ping 10.0.0.50"
Tool: test_connectivity (action: ping)
Result: Unreachable → Host offline or routing issue
Result: High latency → Network congestion
Result: Packet loss → Network instability
```

#### Phase 3: Analyze Firewall Rules (Most Common Issue)
```
Query: "Why can't 192.168.1.100 access 10.0.0.50 on port 443?"
Tool: analyze_firewall (action: analyze_path)
  src_address: 192.168.1.100
  dst_address: 10.0.0.50
  port: 443
  protocol: tcp
  chain: forward

Result: Returns exact blocking rule with ID and recommendations
Confidence: high/medium/low
```

#### Phase 4: Check Network Layer
```
Query: "Check ARP for 192.168.1.100"
Tool: query_network (action: arp, address: 192.168.1.100)
Result: No ARP entry → Host not on network
Result: Incomplete → ARP resolution failed

Query: "Resolve google.com"
Tool: query_network (action: dns, hostname: google.com)
Result: Failed → DNS server issue
```

#### Phase 5: Trace Routing Path
```
Query: "Trace route to 8.8.8.8"
Tool: test_connectivity (action: traceroute)
Result: Shows hop-by-hop path
Detects: Routing loops, dropped packets, path issues
```

### Example Troubleshooting Scenarios

**Scenario 1: "Host X can't access server Y on HTTPS"**
```
1. analyze_firewall(analyze_path, src=X, dst=Y, service=https)
   → If blocked: Shows exact rule, recommends fix
   → If allowed: Continue to next step

2. test_connectivity(ping, address=Y)
   → If unreachable: Routing or host offline
   → If reachable: Application layer issue
```

**Scenario 2: "Device not getting internet"**
```
1. test_connectivity(ping, address=8.8.8.8)
   → Test external connectivity

2. query_network(dns, hostname=google.com)
   → Test DNS resolution

3. test_connectivity(traceroute, address=8.8.8.8)
   → Find where routing fails
```

**Scenario 3: "New device not appearing on network"**
```
1. query_network(dhcp, address=<ip>)
   → Check DHCP lease status

2. query_network(arp, address=<ip>)
   → Check layer 2 visibility

3. test_connectivity(ping, address=<ip>)
   → Test basic connectivity
```

### Key Troubleshooting Principles

1. **Firewall First**: 80% of connectivity issues are firewall-related
2. **Systematic Layers**: Progress through network layers systematically
3. **Evidence-Based**: Use tool insights, warnings, and recommendations
4. **Start Specific**: Use analyze_path before generic rule listing

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

## 📈 Tool Statistics

**Total Tools**: 14 (was 11)
- **Core Network Tools**: 5 (get_router_info, get_interfaces, get_dhcp_leases, get_routes, execute_safe_command)
- **Network Troubleshooting**: 3 (analyze_firewall, test_connectivity, query_network) ⭐ NEW
- **Traffic & Monitoring**: 3 (get_traffic_stats, get_wireless_info, get_system_info)
- **System & Logs**: 2 (get_system_logs, run_diagnostics)
- **Advanced**: 1 (execute_safe_command)

---

**Version**: Phase 3 - Network Troubleshooting Enhancement
**Status**: ✅ Production Ready
**New Capabilities**:
- ✅ Intelligent firewall path analysis with CIDR/port matching
- ✅ Active connectivity testing (ping, traceroute, bandwidth)
- ✅ Network layer diagnostics (ARP, DNS, DHCP, IP addresses)
- ✅ Systematic 5-phase troubleshooting workflows
- ✅ Confidence scoring and actionable recommendations

**Last Updated**: January 2025
