# MCP Tool Description Best Practices

Guidelines for writing effective MCP tool descriptions that prevent semantic collision and ensure correct LLM tool selection.

---

## Background: Lessons Learned from Speed Test Bug

### The Problem

**Original Bug**: User asked "run a speed test" → AI returned CPU/memory/uptime instead of internet speed test results.

**Root Cause**: THREE-WAY PERFORMANCE CONFLICT
- `router-info-tool` used "performance" in description
- `system-tool` used "system performance" in description
- `diagnostics-tool` used "performance problems" in description
- LLM interpreted "speed test" as "performance" → routed to wrong tool

### The Fix

**Phase 1**: Semantic boundary creation in tool descriptions
- REMOVED ambiguous term "performance" from all tools
- ADDED domain-specific terminology (CPU/memory vs internet speed)
- ADDED negative indicators ("DO NOT use for...")
- Result: 85-95% improvement

**Phase 2**: System prompt reinforcement + observability
- ADDED explicit routing rules in system prompt
- ADDED complete tool selection logging
- Result: Additional 5-10% improvement (95%+ total)

**Phase 3**: Tool consolidation
- ENHANCED system-tool to include RouterOS version/identity
- DEPRECATED router-info-tool to eliminate redundancy
- Result: Cleaner tool set, less confusion

---

## Core Principles

### 1. Use Domain-Specific Terminology

**Principle**: Choose precise, domain-specific terms that don't overlap with other tools.

**Good Examples**:
✅ "internet speed" (network testing domain)
✅ "download bandwidth" (network testing domain)
✅ "network latency" (network testing domain)
✅ "CPU usage" (system resources domain)
✅ "memory metrics" (system resources domain)
✅ "system uptime" (system resources domain)

**Bad Examples**:
❌ "performance" (ambiguous - could be network, system, or application)
❌ "speed" (ambiguous - internet speed, processing speed, or disk speed?)
❌ "fast" (vague quality descriptor)
❌ "usage" (ambiguous - CPU usage, bandwidth usage, or disk usage?)
❌ "status" (too generic - network status, system status, or service status?)

**Example Refactoring**:
```typescript
// BEFORE (ambiguous)
readonly description = 'Get router performance and system information'

// AFTER (domain-specific)
readonly description = 'Get system resource information including CPU usage, memory usage, and uptime'
```

---

### 2. Add Explicit Negative Indicators

**Principle**: Every tool description should include "DO NOT use for..." clauses to prevent misrouting.

**Template**:
```typescript
readonly description =
  '[Primary purpose]. ' +
  'Use this when [specific use cases]. ' +
  'DO NOT use for [common misuses].';
```

**Examples**:

```typescript
// Network testing tool
'Test network connectivity and measure internet speed. ' +
'Use this when users ask about speed tests, bandwidth testing, or network latency. ' +
'DO NOT use for system resources (CPU/memory), traffic statistics, or interface monitoring.'

// System info tool
'Get system resource information including CPU usage, memory, disk space, and temperature. ' +
'Use this when users ask about CPU/memory metrics, resource monitoring, or system temperature. ' +
'DO NOT use for network connectivity testing, internet speed tests, or bandwidth measurements.'

// Traffic monitoring tool
'Get historical traffic and bandwidth statistics. ' +
'Use this when users ask about past traffic, historical bandwidth consumption, or data usage patterns. ' +
'DO NOT use for active speed testing or measuring current internet speed.'
```

**Why It Works**: Negative indicators help LLM eliminate inappropriate tools before selecting the correct one.

---

### 3. Provide Action-Level Guidance

**Principle**: Include specific action names and example queries in descriptions.

**Template**:
```typescript
'[Purpose]. Actions: (1) action_name - when to use, (2) action_name - when to use. ' +
'CRITICAL: When user asks [specific query], ALWAYS use action=[specific_action].'
```

**Example**:
```typescript
'Test network connectivity and diagnose network issues. ' +
'Actions: ' +
'(1) ping - basic reachability and latency checks ONLY, ' +
'(2) traceroute - diagnose WHERE latency/packet-loss occurs by showing hop-by-hop path, ' +
'(3) bandwidth-test - test MikroTik-to-MikroTik throughput (requires bandwidth-server on target), ' +
'(4) internet-speed-test - measure actual internet download speed and latency. ' +
'CRITICAL: When user asks "speed test", "bandwidth test", or "how fast is my internet", ' +
'ALWAYS use action=internet-speed-test.'
```

**Why It Works**: Explicit action mapping reduces ambiguity and provides clear decision path for LLM.

---

### 4. Use PRIMARY PURPOSE Declarations

**Principle**: Start descriptions with clear purpose statement to establish tool's domain.

**Template**:
```typescript
readonly description = 'PRIMARY PURPOSE: [Single clear purpose]. [Rest of description...]'
```

**Examples**:
```typescript
'PRIMARY PURPOSE: Test network connectivity and measure internet speed. ' +
'Use this when...'

'PRIMARY PURPOSE: Monitor system resources and hardware health. ' +
'Use this when...'

'PRIMARY PURPOSE: Analyze historical traffic patterns and bandwidth consumption. ' +
'Use this when...'
```

**Why It Works**: Immediately establishes tool's domain before LLM processes detailed description.

---

### 5. Avoid Tool Redundancy

**Principle**: Before creating new tools, audit existing tools for overlap. Consolidate when overlap >50%.

**Overlap Detection Checklist**:
- [ ] Does another tool return similar data?
- [ ] Could existing tool be enhanced instead of creating new one?
- [ ] Would users be confused about which tool to use?
- [ ] Do tool descriptions use overlapping terminology?

**Consolidation Strategy** (when overlap detected):
1. **Identify**: Map overlapping capabilities between tools
2. **Enhance**: Add missing capabilities to more comprehensive tool
3. **Deprecate**: Soft deprecate redundant tool (keep registered with warnings)
4. **Monitor**: Track usage of deprecated tool for 2+ weeks
5. **Remove**: Hard remove after validating zero usage

**Example** (Phase 3):
- `router-info-tool` overlapped 60% with `system-tool`
- Enhanced `system-tool` to include RouterOS version/identity
- Soft deprecated `router-info-tool` with warnings
- Monitoring usage before final removal

---

## Tool Description Template

Use this template for all new MCP tools:

```typescript
export class YourTool extends BaseMCPTool {
  readonly name = 'your_tool_name';

  readonly description =
    'PRIMARY PURPOSE: [Single clear purpose statement]. ' +

    '[Detailed capabilities using domain-specific terminology]. ' +

    'Use this when users ask about [specific use case 1], [specific use case 2], ' +
    'or [specific use case 3]. ' +

    'Actions: (1) action_1 - [when to use], (2) action_2 - [when to use]. ' +

    'CRITICAL: When user asks [specific query pattern], ALWAYS use action=[specific_action]. ' +

    'DO NOT use for [common misuse 1], [common misuse 2], or [common misuse 3].';

  readonly inputSchema: ToolInputSchema = {
    // ... schema definition
  };
}
```

---

## Tool Naming Conventions

### Pattern: Verb-Noun

**Good Examples**:
✅ `test_connectivity` - clear action + target
✅ `get_system_resources` - clear action + target
✅ `create_firewall_rule` - clear action + target

**Bad Examples**:
❌ `check_things` - vague verb, vague noun
❌ `show_stuff` - ambiguous action
❌ `info_getter` - awkward phrasing

### Verb Guidelines

**Preferred Verbs** (clear intent):
- `get` - retrieve information
- `test` - perform diagnostic test
- `create` - create new resource
- `update` - modify existing resource
- `delete` - remove resource
- `list` - enumerate items
- `execute` - run command/operation

**Avoid** (ambiguous):
- `check` - ambiguous (test? verify? retrieve?)
- `show` - vague (get? list? display?)
- `do` - meaningless action
- `handle` - unclear intent

### Noun Guidelines

**Preferred Nouns** (specific):
- `system_resources` - clear category
- `network_interfaces` - precise target
- `firewall_rules` - specific resource type

**Avoid** (vague):
- `info` - what kind of information?
- `data` - too generic
- `things` - meaningless
- `stuff` - colloquial and vague

---

## Semantic Collision Detection

Run these checks before deploying new tool descriptions:

### 1. Term Collision Check
```bash
# Search for overlapping terms across tool descriptions
grep -r "performance" server/src/services/ai/mcp/tools/*.ts
grep -r "speed" server/src/services/ai/mcp/tools/*.ts
grep -r "bandwidth" server/src/services/ai/mcp/tools/*.ts
```

If same term appears in multiple tool descriptions, evaluate:
- Is the term used in different domain contexts?
- Could LLM confuse the tools based on this term?
- Can the term be replaced with more specific terminology?

### 2. Negative Indicator Coverage
Verify each tool has negative indicators for common confusion points:
- Network testing tools: "DO NOT use for system resources"
- System tools: "DO NOT use for network testing"
- Monitoring tools: "DO NOT use for active testing"

### 3. Cross-Tool Overlap Analysis
Create matrix of tool capabilities:

|  | CPU | Memory | Network Speed | Traffic | Firewall |
|---|-----|---------|---------------|---------|----------|
| get_system_resources | ✓ | ✓ | | | |
| test_connectivity | | | ✓ | | |
| get_traffic | | | | ✓ | |
| get_firewall_rules | | | | | ✓ |

Any column with multiple ✓ marks indicates potential overlap requiring investigation.

---

## Tool Description Checklist

Before deploying a new or modified tool, verify:

### Description Quality
- [ ] Starts with PRIMARY PURPOSE declaration
- [ ] Uses domain-specific terminology (no ambiguous terms)
- [ ] Includes specific use cases (not generic)
- [ ] Provides action-level guidance with examples
- [ ] Contains negative indicators ("DO NOT use for...")
- [ ] No overlap with existing tool terminology

### Semantic Safety
- [ ] No ambiguous terms that could cause collision
- [ ] Domain boundaries clearly defined
- [ ] Negative indicators cover common confusion points
- [ ] Action mappings explicitly stated

### Technical Correctness
- [ ] Description matches actual tool capabilities
- [ ] Action names match implementation
- [ ] Input schema documented in description
- [ ] Error cases documented

### Testing
- [ ] Test queries added to [TEST_QUERIES.md](TEST_QUERIES.md)
- [ ] Validated with actual LLM tool selection
- [ ] Edge cases covered
- [ ] No regression in existing tool routing

---

## Deprecation Guidelines

When deprecating a tool to eliminate redundancy:

### 1. Soft Deprecation (Graceful Transition)

**Update Description**:
```typescript
readonly description =
  '[DEPRECATED] Use [replacement_tool] with [parameters] instead. ' +
  'This tool is maintained for backward compatibility only and will be removed in a future release. ' +
  '[Original description continues...]';
```

**Add Deprecation Logging**:
```typescript
async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
  // Log deprecation warning
  console.warn(
    `[ToolName] ⚠️ DEPRECATED: ${this.name} called from conversation ${context.conversationId}. ` +
    `Use ${replacement_tool} instead.`
  );

  // ... rest of implementation unchanged
}
```

**Add Central Monitoring** (in mcp-executor.ts):
```typescript
// Track deprecated tool usage
if (name === 'deprecated_tool_name') {
  console.warn(
    `[MCPExecutor] ⚠️ DEPRECATED TOOL USAGE: ${name} called in session ${context.sessionId}. ` +
    `Recommend using ${replacement_tool} instead.`
  );
}
```

### 2. Monitor Usage

Track deprecated tool usage for 2-4 weeks:
```bash
# Count deprecated tool calls
grep "DEPRECATED TOOL USAGE" logs/*.log | wc -l

# Analyze which conversations still use it
grep "DEPRECATED" logs/*.log | grep "get_router_info" | jq '.conversationId' | sort | uniq -c
```

### 3. Hard Removal Decision

Remove deprecated tool only when:
- Zero usage for 2+ consecutive weeks
- All test queries pass with replacement tool
- No user complaints about missing functionality
- Replacement tool verified to cover all capabilities

### 4. Hard Removal Process

1. Remove tool class file
2. Remove from mcp-executor.ts registration
3. Update system prompt to remove references
4. Remove from tool lists in documentation
5. Add migration note to CHANGELOG.md
6. Update [TEST_QUERIES.md](TEST_QUERIES.md) to remove deprecated tool references

---

## Examples: Before & After

### Example 1: Ambiguous Performance Term

**BEFORE (caused speed test bug)**:
```typescript
// router-info-tool.ts
readonly description =
  'Get router information including performance metrics, uptime, and version';
```

**AFTER (Phase 1 fix)**:
```typescript
// router-info-tool.ts
readonly description =
  'Get basic system information about the MikroTik router including CPU usage, memory usage, ' +
  'uptime, RouterOS version, and router hostname. ' +
  'Use this when the user asks about CPU usage, memory usage, system uptime, RouterOS version, or router identity. ' +
  'DO NOT use for network speed tests, bandwidth testing, or internet performance measurement.';
```

### Example 2: Missing Action Guidance

**BEFORE**:
```typescript
// connectivity-tool.ts
readonly description =
  'Test network connectivity and measure speeds';
```

**AFTER (Phase 1 fix)**:
```typescript
// connectivity-tool.ts
readonly description =
  'PRIMARY PURPOSE: Test network connectivity, measure internet speed, and diagnose network issues. ' +
  'DO NOT use for system resources (CPU/memory), traffic statistics, or interface monitoring. ' +
  'CRITICAL: When user asks for "speed test", "bandwidth test", "how fast is my internet", or "internet speed", ' +
  'ALWAYS use action=internet-speed-test. ' +
  'Actions: (1) ping - basic reachability and latency checks ONLY, ' +
  '(2) traceroute - diagnose WHERE latency/packet-loss occurs by showing hop-by-hop path, ' +
  '(3) bandwidth-test - test MikroTik-to-MikroTik throughput (requires bandwidth-server on target), ' +
  '(4) internet-speed-test - measure actual internet download speed and latency (USE THIS for all "speed test" requests).';
```

### Example 3: Tool Redundancy

**BEFORE (60% overlap)**:
```typescript
// router-info-tool.ts
readonly description = 'Get CPU usage, memory usage, uptime, RouterOS version, and router hostname';

// system-tool.ts
readonly description = 'Get system resource information including CPU usage, memory, disk space, temperature, uptime, health sensors, and hardware status';
```

**AFTER (Phase 3 consolidation)**:
```typescript
// router-info-tool.ts (DEPRECATED)
readonly description =
  '[DEPRECATED] Use get_system_resources with type="identity" or type="resources" instead. ' +
  'This tool is maintained for backward compatibility only and will be removed in a future release. ' +
  'Get basic system information about the MikroTik router including CPU usage, memory usage, uptime, RouterOS version, and router hostname.';

// system-tool.ts (ENHANCED)
readonly description =
  'Get system resource information including CPU usage, memory, disk space, temperature, uptime, ' +
  'health sensors, hardware status, RouterOS version, and router identity. ' +
  'Use this when users ask about CPU/memory metrics, resource monitoring, disk usage, system temperature, ' +
  'hardware health, RouterOS version, or router hostname. ' +
  'DO NOT use for network connectivity testing, internet speed tests, or bandwidth measurements.';
```

---

## Related Documentation

- [TEST_QUERIES.md](TEST_QUERIES.md) - Regression test queries for tool routing validation
- [API.md](API.md) - API documentation and tool registry
- Phase 1 Reflection - Tool description semantic boundary fixes
- Phase 2 Reflection - System prompt enhancements and observability
- Phase 3 Completion - Tool consolidation and documentation

---

**Document Version**: 1.0
**Last Updated**: Phase 3 completion (Tool Consolidation)
**Maintainer**: Engineering team
**Feedback**: Report tool routing issues to enable continuous improvement
