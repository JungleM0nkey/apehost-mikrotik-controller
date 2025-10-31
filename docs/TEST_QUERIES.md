# MCP Tool Selection Test Queries

Regression test document for validating MCP tool routing after Phase 1-3 improvements.

## Background

This document was created after fixing a critical bug where "run a speed test" incorrectly routed to `get_router_info` (returning CPU/memory) instead of `test_connectivity` (measuring internet speed).

**Root Cause**: Semantic collision - multiple tool descriptions used ambiguous term "performance"
**Fix**: Phase 1 (tool descriptions), Phase 2 (system prompt + logging), Phase 3 (tool consolidation)

---

## Speed Test Routing (CRITICAL)

These queries MUST route to `test_connectivity` with `action="internet-speed-test"`:

| Query | Expected Tool | Expected Action | Priority |
|-------|---------------|-----------------|----------|
| "run a speed test" | test_connectivity | internet-speed-test | CRITICAL |
| "test my internet" | test_connectivity | internet-speed-test | CRITICAL |
| "how fast is my internet" | test_connectivity | internet-speed-test | CRITICAL |
| "bandwidth test" | test_connectivity | internet-speed-test | HIGH |
| "check internet speed" | test_connectivity | internet-speed-test | HIGH |
| "measure download speed" | test_connectivity | internet-speed-test | HIGH |
| "is my internet fast" | test_connectivity | internet-speed-test | MEDIUM |
| "network speed test" | test_connectivity | internet-speed-test | MEDIUM |

**Validation**:
- [ ] All queries route to test_connectivity
- [ ] Action parameter is "internet-speed-test"
- [ ] NO queries route to get_router_info or get_system_resources
- [ ] Tool selection log shows correct reasoning

---

## System Information Routing

These queries should route to `get_system_resources` (PREFERRED) or `get_router_info` (DEPRECATED):

| Query | Expected Tool | Expected Type/Action | Notes |
|-------|---------------|----------------------|-------|
| "check CPU usage" | get_system_resources | type=resources | Preferred over get_router_info |
| "show memory" | get_system_resources | type=resources | Should avoid get_router_info |
| "what's the uptime" | get_system_resources | type=resources | Either tool acceptable |
| "RouterOS version" | get_system_resources | type=identity | Phase 3: now supported |
| "router hostname" | get_system_resources | type=identity | Phase 3: now supported |
| "system temperature" | get_system_resources | type=health | Only get_system_resources supports |
| "disk usage" | get_system_resources | type=resources | Only get_system_resources supports |
| "router info" | get_system_resources | type=identity | Avoid deprecated get_router_info |
| "system info" | get_system_resources | type=resources | Avoid deprecated get_router_info |

**Validation**:
- [ ] Queries prefer get_system_resources over get_router_info
- [ ] Deprecation warnings logged if get_router_info used
- [ ] Type parameter correctly specified
- [ ] RouterOS version and hostname now available via get_system_resources type=identity

---

## Ambiguous Query Routing

These queries could route to multiple tools - verify correct priority:

| Query | Expected Tool | Priority Rationale | Acceptable Alternative |
|-------|---------------|--------------------|-----------------------|
| "is my network slow?" | test_connectivity | User wants speed measurement | get_interfaces (if monitoring) |
| "check performance" | get_system_resources | System performance metrics | None - avoid ambiguity |
| "network status" | get_interfaces | Current interface status | test_connectivity (if testing) |
| "bandwidth usage" | get_interfaces OR get_traffic | Context-dependent | Depends on current vs historical |
| "how's my router" | get_system_resources | General system health | Could chain multiple tools |
| "network problems" | test_connectivity | Troubleshooting focus | Could use troubleshoot tools |

**Validation**:
- [ ] Ambiguous queries handled reasonably
- [ ] Tool selection log shows reasoning
- [ ] No semantic collision between speed testing and system metrics

---

## Deprecated Tool Avoidance

These queries should AVOID `get_router_info` and use `get_system_resources` instead:

| Query | Should AVOID | Should USE | Type Parameter |
|-------|--------------|------------|----------------|
| "router info" | get_router_info | get_system_resources | type=identity |
| "system info" | get_router_info | get_system_resources | type=resources |
| "router version" | get_router_info | get_system_resources | type=identity |
| "router name" | get_router_info | get_system_resources | type=identity |

**Validation**:
- [ ] get_system_resources preferred over get_router_info
- [ ] Deprecation warnings logged if get_router_info used:
  - `[RouterInfoTool] ⚠️ DEPRECATED: get_router_info called`
  - `[MCPExecutor] ⚠️ DEPRECATED TOOL USAGE: get_router_info called`
- [ ] System prompt guidance followed

---

## Negative Test Cases

These queries should NOT route to speed testing or system info tools:

| Query | Should NOT Use | Should Use | Notes |
|-------|----------------|------------|-------|
| "show DHCP leases" | test_connectivity, get_system_resources | get_dhcp_leases | Network config, not testing |
| "list firewall rules" | test_connectivity, get_system_resources | get_firewall_rules | Security config |
| "show interfaces" | test_connectivity, get_system_resources | get_interfaces | Interface status |
| "traffic statistics" | test_connectivity, get_system_resources | get_traffic | Historical bandwidth data |

**Validation**:
- [ ] Domain separation maintained
- [ ] No cross-contamination between tool categories

---

## Multi-Tool Queries

These queries may legitimately require multiple tool calls:

| Query | Expected Tools (in order) | Rationale |
|-------|---------------------------|----------|
| "run speed test and check CPU" | test_connectivity, get_system_resources | Two distinct operations |
| "diagnose slow internet" | test_connectivity, get_interfaces, get_system_resources | Comprehensive troubleshooting |
| "full system status" | get_system_resources (all types), get_interfaces | System-wide snapshot |

**Validation**:
- [ ] Multiple tools called in logical order
- [ ] Each tool selected for correct reason
- [ ] No redundant tool calls

---

## Validation Checklist

### Phase 1-3 Fix Validation
- [ ] Speed test queries route to test_connectivity (95%+ accuracy)
- [ ] System info queries prefer get_system_resources
- [ ] Deprecation warnings logged for get_router_info usage
- [ ] No semantic collision between "performance" contexts

### Tool Consolidation Validation (Phase 3)
- [ ] get_system_resources type=identity includes RouterOS version
- [ ] get_system_resources type=identity includes hostname
- [ ] get_system_resources type=identity includes board_name and architecture
- [ ] get_router_info marked as [DEPRECATED] in description
- [ ] Deprecation logging appears in console for get_router_info usage

### Logging Validation (Phase 2)
- [ ] Tool selection logged: `[Assistant] 🎯 TOOL SELECTION DECISION`
- [ ] Tool calls detailed: `[Assistant] 🔧 Tool Call #N`
- [ ] Execution context logged: `[ConversationManager] 📊 Tool Execution Context`
- [ ] User query captured in metadata for traceability

---

## Testing Procedure

### Manual Testing
1. Send each test query to the AI assistant
2. Check console logs for tool selection decision
3. Verify expected tool was selected
4. Confirm deprecation warnings appear if get_router_info used
5. Validate tool results contain expected data

### Log Analysis
```bash
# Search for speed test routing
grep "speed test" logs/*.log | grep "TOOL SELECTION"

# Check deprecated tool usage
grep "DEPRECATED" logs/*.log | grep "get_router_info"

# Analyze tool selection patterns
grep "TOOL SELECTION DECISION" logs/*.log | jq '.selectedTools'
```

### Success Criteria
- 100% speed test queries → test_connectivity (no failures)
- 90%+ system info queries → get_system_resources (not get_router_info)
- Deprecation warnings appear for ALL get_router_info usage
- No new semantic collisions introduced

---

## Notes

- Test queries should be run after each code change to prevent regression
- Add new test cases when edge cases are discovered
- Update this document when new tools are added
- Monitor production logs for unexpected tool routing patterns
- Periodic review: Check if get_router_info usage dropped to 0% (removal candidate)

---

**Document Version**: 1.0
**Last Updated**: Phase 3 completion (Tool Consolidation)
**Maintainer**: Engineering team
**Related Docs**: [TOOL_DESCRIPTION_GUIDELINES.md](TOOL_DESCRIPTION_GUIDELINES.md)
