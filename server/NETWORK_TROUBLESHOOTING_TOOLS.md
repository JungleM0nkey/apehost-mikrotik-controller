# Network Troubleshooting AI - MCP Tools Implementation Plan

## Current State Analysis

### ✅ Existing Tools (Basic Data Retrieval)
- **firewall-tool.ts** - Retrieves firewall filter rules
- **routes-tool.ts** - Retrieves routing table
- **interfaces-tool.ts** - Retrieves interface information
- **dhcp-tool.ts** - Retrieves DHCP server/lease information
- **logs-tool.ts** - Retrieves system logs
- **system-tool.ts** - Retrieves system information
- **traffic-tool.ts** - Retrieves traffic statistics
- **wireless-tool.ts** - Retrieves wireless configuration
- **diagnostics-tool.ts** - Runs issue detection scans

### ❌ Missing Capabilities for AI Troubleshooting

**Current tools only retrieve data** - they don't provide:
1. **Intelligent analysis** of firewall paths (why is traffic blocked?)
2. **Connectivity testing** (ping, traceroute to verify reachability)
3. **Network resolution** (ARP tables, DNS queries)
4. **NAT analysis** (source/destination NAT rules)
5. **Connection tracking** (active connections)
6. **Bridge/VLAN analysis** (L2 switching, VLAN configuration)
7. **AI-friendly insights** (structured recommendations, confidence scores)

## Enhancement Strategy

### Phase 1: Core Infrastructure ✅ COMPLETE
Created shared utilities in `server/src/services/ai/mcp/tools/common/`:
- ✅ `tool-response.interface.ts` - Standard response format with insights/warnings/recommendations
- ✅ `network-parsers.ts` - IP/CIDR/port parsing and matching utilities
- ✅ `routeros-helpers.ts` - RouterOS API wrappers with typed parsers

### Phase 2: Enhanced Existing Tools

#### 2.1 Enhanced Firewall Tool (HIGH PRIORITY)
**Current**: Only retrieves rules
**Enhanced**: Add intelligent analysis capabilities

**New Actions**:
```typescript
{
  action: 'list-rules' | 'analyze-path' | 'list-nat' | 'list-connections'

  // For analyze-path:
  srcAddress: string;
  dstAddress: string;
  port?: number;
  service?: 'http' | 'https' | 'ssh' | ...;
  protocol?: 'tcp' | 'udp' | 'icmp';
}
```

**Capabilities**:
- ✅ Analyze if specific traffic (src → dst:port) is allowed/blocked
- ✅ Identify exact blocking rule with rule number
- ✅ Provide confidence scores (high/medium/low)
- ✅ Return actionable recommendations
- ✅ Check NAT rules that affect connectivity
- ✅ List active connection tracking entries

**Expected Output**:
```json
{
  "success": true,
  "data": { "verdict": "blocked", "blockingRule": {...} },
  "summary": "Traffic is blocked by firewall rule #15",
  "insights": [
    "Analyzing path: 192.168.1.100 → 10.0.0.50:443 (tcp)",
    "Found rule #15 that blocks all traffic from 192.168.1.0/24"
  ],
  "warnings": ["Traffic is BLOCKED by explicit DROP rule"],
  "recommendations": [
    "Consider adding ACCEPT rule before rule #15",
    "Or modify rule #15 to allow specific traffic"
  ],
  "confidence": "high"
}
```

#### 2.2 Enhanced Routing Tool (MEDIUM PRIORITY)
**Current**: Only lists routes
**Enhanced**: Add route path analysis

**New Capabilities**:
- Check if specific destination is routable
- Verify gateway status
- Identify routing loops or blackholes

### Phase 3: New Essential Tools

#### 3.1 Connectivity Tool (HIGH PRIORITY)
**Purpose**: Active connectivity testing

**Tool**: `connectivity-tool.ts`

**Actions**:
```typescript
{
  action: 'ping' | 'traceroute' | 'bandwidth-test';
  address: string;  // Required target
  count?: number;   // Ping count (default: 4)
  size?: number;    // Packet size
  interface?: string; // Source interface
}
```

**RouterOS Commands**:
- `/ping address=X.X.X.X count=5`
- `/tool/traceroute address=X.X.X.X`
- `/tool/bandwidth-test address=X.X.X.X`

**Output**:
```json
{
  "success": true,
  "data": {
    "sent": 5,
    "received": 5,
    "loss": "0%",
    "avgRtt": "2.5ms"
  },
  "summary": "Successfully pinged 10.0.0.50 (0% loss)",
  "insights": ["All packets received", "Average RTT: 2.5ms"],
  "confidence": "high"
}
```

#### 3.2 Network Resolution Tool (MEDIUM PRIORITY)
**Purpose**: ARP, DNS, DHCP lookups

**Tool**: `network-tool.ts`

**Actions**:
```typescript
{
  action: 'arp-lookup' | 'dns-query' | 'dhcp-leases' | 'service-ports';
  address?: string;  // For ARP lookup
  hostname?: string; // For DNS query
}
```

**RouterOS Commands**:
- `/ip/arp/print`
- `/ip/dns/cache/print`
- `/ip/dhcp-server/lease/print`
- `/ip/service/print`

#### 3.3 Bridge/VLAN Tool (LOW PRIORITY)
**Purpose**: Layer 2 switching analysis

**Tool**: `bridge-tool.ts`

**Actions**:
```typescript
{
  action: 'list-bridges' | 'list-ports' | 'list-vlans' | 'mac-table';
  bridge?: string;
}
```

**RouterOS Commands**:
- `/interface/bridge/print`
- `/interface/bridge/port/print`
- `/interface/vlan/print`
- `/interface/bridge/host/print`

## AI Diagnostic Workflow

### Query: "Why can't 192.168.1.100 access 10.0.0.50 on port 443?"

**Step 1**: Parse query
```
src = 192.168.1.100
dst = 10.0.0.50
port = 443
protocol = tcp (inferred from HTTPS)
```

**Step 2**: Check interfaces
```
Tool: interfaces-tool
Verify: Both 192.168.1.0/24 and 10.0.0.0/24 exist on router
Result: ✅ Both networks configured
```

**Step 3**: Check routing
```
Tool: routes-tool (enhanced)
Verify: Route exists from 192.168.1.0/24 to 10.0.0.0/24
Result: ✅ Route exists via gateway 10.0.0.1
```

**Step 4**: Analyze firewall (CRITICAL)
```
Tool: firewall-tool (enhanced)
Action: analyze-path
Parameters: {
  srcAddress: "192.168.1.100",
  dstAddress: "10.0.0.50",
  port: 443,
  protocol: "tcp"
}
Result: ❌ BLOCKED by rule #15 (DROP from 192.168.1.0/24)
```

**Step 5**: Test connectivity (if allowed by firewall)
```
Tool: connectivity-tool
Action: ping
Parameters: { address: "10.0.0.50", count: 5 }
Result: Verify actual reachability
```

**Step 6**: Synthesize diagnosis
```
Root Cause: Firewall rule #15 blocks all traffic from 192.168.1.0/24
Confidence: HIGH
Recommendation: Add explicit ACCEPT rule before rule #15 for port 443
```

## Implementation Timeline

### Week 1: Core Infrastructure ✅ DONE
- [x] Create `common/` directory structure
- [x] Implement `tool-response.interface.ts`
- [x] Implement `network-parsers.ts`
- [x] Implement `routeros-helpers.ts`

### Week 2: Phase 2 - Enhanced Tools
- [ ] Enhance `firewall-tool.ts` with analyze-path capability
- [ ] Add NAT analysis to firewall tool
- [ ] Add connection tracking to firewall tool
- [ ] Enhance `routes-tool.ts` with route validation

### Week 3: Phase 3 - New Tools (Critical)
- [ ] Implement `connectivity-tool.ts` (ping, traceroute)
- [ ] Implement `network-tool.ts` (ARP, DNS)
- [ ] Update MCP executor to register new tools

### Week 4: Phase 3 - New Tools (Nice to Have)
- [ ] Implement `bridge-tool.ts` (L2 switching, VLANs)
- [ ] Add QoS/queue analysis tool

### Week 5: Integration & Testing
- [ ] Update conversation manager prompts for troubleshooting
- [ ] Add diagnostic workflow documentation
- [ ] End-to-end testing with real scenarios
- [ ] Performance optimization

## Success Metrics

- ✅ AI can diagnose firewall blocking in 1-2 queries
- ✅ AI can identify routing issues automatically
- ✅ AI provides specific, actionable fixes with rule numbers
- ✅ 95% of common connectivity issues resolved within 3 tool calls
- ✅ Confidence scores guide user trust in diagnosis

## Example AI Conversation

**User**: "Why can't 192.168.1.100 access web server at 10.0.0.50?"

**AI**: "I'll investigate this connectivity issue systematically. Let me check the firewall rules first..."

*[Calls firewall-tool with analyze-path]*

**AI**: "I found the issue! 🚨

**Root Cause**: Firewall rule #15 is blocking this traffic.

**Details**:
- Source: 192.168.1.100
- Destination: 10.0.0.50:443 (HTTPS)
- Blocking Rule: #15 (forward chain)
  - Action: DROP
  - Match: src-address=192.168.1.0/24
  - Comment: 'Block guest network'

**Fix Options**:
1. **Recommended**: Add explicit ACCEPT rule before rule #15:
   ```
   /ip firewall filter add chain=forward src-address=192.168.1.100 dst-address=10.0.0.50 dst-port=443 protocol=tcp action=accept place-before=15
   ```

2. **Alternative**: Modify rule #15 to exclude this specific traffic

Would you like me to help you implement either of these fixes?"

## Technical Notes

### RouterOS API Integration
- Use `mikrotikService.executeTerminalCommand()` for all commands
- Parse terminal output (not API sentences) for compatibility
- Handle async operations (ping, traceroute) with timeouts
- Cache results for 30 seconds to reduce load

### Error Handling
- All tools return `MCPToolResponse` format
- Include `success: false` for failures
- Provide actionable error messages
- Suggest troubleshooting steps in `recommendations`

### Performance Considerations
- Firewall rules: Can be 100+ rules, filter efficiently
- Connection tracking: Can be 1000+ entries, use WHERE clauses
- Routing table: Cache for quick lookups
- Ping tests: Default to count=4, max=10

