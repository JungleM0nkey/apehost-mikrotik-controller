# Bridge Visualization - Technical Implementation

## Overview

This document provides technical details on how bridge interfaces and their member ports are represented in the network map visualization.

## MikroTik API Endpoints Used

### 1. `/interface/print`
Returns all interfaces including bridge interfaces.

**Example Response:**
```javascript
{
  ".id": "*1",
  "name": "bridge1",
  "type": "bridge",
  "running": "true",
  "disabled": "false",
  "rx-byte": "12345678",
  "tx-byte": "87654321"
}
```

### 2. `/interface/bridge/port/print`
Returns bridge port membership information.

**Example Response:**
```javascript
{
  ".id": "*2",
  "interface": "ether2",
  "bridge": "bridge1",
  "disabled": "false"
}
```

### 3. `/ip/arp/print`
Returns ARP table showing which hosts are connected to which interfaces.

**Example Response:**
```javascript
{
  ".id": "*5",
  "address": "192.168.1.100",
  "mac-address": "AA:BB:CC:DD:EE:FF",
  "interface": "ether2",
  "status": "reachable"
}
```

## Data Processing Flow

### Step 1: Fetch Bridge Relationships

```typescript
// Get all interfaces (including bridges)
const interfaces = await this.executeCommand('/interface/print');

// Get bridge port membership
const bridgePorts = await this.executeCommand('/interface/bridge/port/print');
```

### Step 2: Build Relationship Maps

```typescript
// Map: interface name -> bridge name
const interfaceToBridge = new Map<string, string>();

// Map: bridge name -> array of member port names
const bridgeToPorts = new Map<string, string[]>();

bridgePorts.forEach((port: any) => {
  const interfaceName = port.interface;  // e.g., "ether2"
  const bridgeName = port.bridge;        // e.g., "bridge1"
  
  interfaceToBridge.set(interfaceName, bridgeName);
  
  if (!bridgeToPorts.has(bridgeName)) {
    bridgeToPorts.set(bridgeName, []);
  }
  bridgeToPorts.get(bridgeName)!.push(interfaceName);
});
```

### Step 3: Enrich Interface Data

```typescript
interfaces.map((iface: any) => {
  const ifaceName = iface.name;
  const isBridge = iface.type === 'bridge';
  const bridgeName = interfaceToBridge.get(ifaceName);
  const bridgePorts = isBridge ? bridgeToPorts.get(ifaceName) : undefined;

  return {
    id: iface['.id'],
    name: ifaceName,
    type: iface.type,
    // ... other fields
    bridge: bridgeName,      // Set if this interface is a bridge member
    isBridge: isBridge,      // Set if this interface is a bridge
    bridgePorts: bridgePorts // Set if this interface is a bridge
  };
});
```

## Visualization Logic

### Node Categorization

```typescript
// Separate interfaces into three categories
const bridges = topology.interfaces.filter(iface => iface.isBridge);

const bridgeMemberNames = new Set(
  topology.interfaces
    .filter(iface => iface.bridge)
    .map(iface => iface.name)
);

const standaloneInterfaces = topology.interfaces.filter(
  iface => !iface.isBridge && !iface.bridge
);
```

### Rendering Bridge Hierarchy

```typescript
// For each bridge interface
bridges.forEach((bridge) => {
  // 1. Create bridge node
  const bridgeNode = {
    id: `interface-${bridge.id}`,
    data: { label: `${bridge.name} (${memberCount} ports)` },
    style: {
      border: '3px solid ...',
      width: 180
    }
  };
  
  // 2. Create edge from router to bridge
  const routerToBridgeEdge = {
    source: 'router',
    target: bridgeNode.id,
    style: { strokeWidth: 3 }
  };
  
  // 3. Get member ports
  const memberPorts = topology.interfaces.filter(
    iface => iface.bridge === bridge.name
  );
  
  // 4. For each member port
  memberPorts.forEach((port) => {
    // Create member port node
    const portNode = {
      id: `interface-${port.id}`,
      data: { label: port.name },
      style: {
        border: '2px solid ...',
        width: 140
      }
    };
    
    // Create edge from bridge to member port (dashed)
    const bridgeToPortEdge = {
      source: bridgeNode.id,
      target: portNode.id,
      style: {
        strokeWidth: 2,
        strokeDasharray: '5,5' // Dashed line
      }
    };
    
    // 5. Add hosts connected to this port
    const hostsOnPort = arpTable.filter(
      arp => arp.interface === port.name
    );
    
    hostsOnPort.forEach(host => {
      // Create host node and edge from port to host
    });
  });
  
  // 6. Add hosts directly on bridge (not via member port)
  const hostsOnBridge = arpTable.filter(
    arp => arp.interface === bridge.name && !memberPorts.some(...)
  );
});
```

### Host Association Logic

**Priority:**
1. Connect host to physical member port if ARP shows connection through that port
2. Connect host to bridge if ARP shows bridge but not a member port
3. Connect host to standalone interface if not bridged

**Deduplication:**
```typescript
// Don't add if already added via a member port
const notOnMemberPort = !memberPorts.some(
  port => arp.interface.trim().toLowerCase() === port.name.trim().toLowerCase()
);
```

## React Flow Node Structure

### Bridge Node
```typescript
{
  id: 'interface-*AB',
  type: 'default',
  position: { x: 0, y: 0 },
  data: {
    label: (
      <div className={styles.bridgeNode}>
        <InterfaceTypeIcon type="bridge" />
        <div>{bridge.name}</div>
        <div>Bridge ({portCount} ports)</div>
        <div>IP: {bridge.ipAddress}</div>
        <div className={styles.statusBadge}>{bridge.status}</div>
      </div>
    )
  },
  style: {
    background: 'linear-gradient(...)',
    border: '3px solid green',
    width: 180,
    padding: '14px'
  }
}
```

### Bridge Member Port Node
```typescript
{
  id: 'interface-*CD',
  type: 'default',
  position: { x: 0, y: 0 },
  data: {
    label: (
      <div className={styles.bridgePortNode}>
        <InterfaceTypeIcon type={port.type} />
        <div>{port.name}</div>
        <div>{port.type}</div>
        <div className={styles.statusBadge}>{port.status}</div>
      </div>
    )
  },
  style: {
    background: 'var(--color-bg-tertiary)',
    border: '2px solid green',
    width: 140,
    padding: '10px'
  }
}
```

### Edge Styles

**Router → Bridge:**
```typescript
{
  id: 'router-interface-*AB',
  source: 'router',
  target: 'interface-*AB',
  type: 'smoothstep',
  animated: true,
  style: {
    stroke: 'green',
    strokeWidth: 3  // Thicker
  }
}
```

**Bridge → Member Port:**
```typescript
{
  id: 'interface-*AB-interface-*CD',
  source: 'interface-*AB',
  target: 'interface-*CD',
  type: 'smoothstep',
  animated: true,
  style: {
    stroke: 'green',
    strokeWidth: 2,
    strokeDasharray: '5,5'  // Dashed to indicate membership
  }
}
```

**Port → Host:**
```typescript
{
  id: 'interface-*CD-host-*EF',
  source: 'interface-*CD',
  target: 'host-*EF',
  type: 'smoothstep',
  style: {
    stroke: 'gray',
    strokeWidth: 1  // Thinner
  }
}
```

## Layout Algorithms

All four layout algorithms respect the bridge hierarchy:

### Radial Layout
- Router at center
- Bridges in first ring
- Member ports in second ring (grouped near parent bridge)
- Hosts in outer ring

### Hierarchical Layout
- Router at top
- Bridges in second level
- Member ports in third level
- Hosts at bottom

### Force-Directed Layout
- Natural clustering around parent nodes
- Bridge members stay close to bridge due to edge connections

### Grid Layout
- Row-based organization
- Bridge followed immediately by its member ports

## Performance Considerations

### Caching
- Bridge port data is fetched once per interface refresh
- Cached alongside interface data
- No separate API calls needed for bridge visualization

### Node Count
```
Total Nodes = 1 (router) + 
              bridges + 
              standaloneInterfaces + 
              bridgeMemberPorts + 
              hosts

Example: 1 router + 2 bridges + 2 standalone + 6 bridge members + 20 hosts = 31 nodes
```

### Edge Count
```
Total Edges = routerToInterfaceEdges + 
              bridgeToMemberPortEdges + 
              interfaceToHostEdges

Example: 4 router-to-interface + 6 bridge-to-port + 20 interface-to-host = 30 edges
```

## Debug Output

The implementation includes detailed console logging:

```javascript
console.log('Interfaces:', topology.interfaces.map(i => ({
  name: i.name,
  type: i.type,
  isBridge: i.isBridge,
  bridge: i.bridge,
  bridgePorts: i.bridgePorts
})));

console.log(`Network Map: ${bridgeCount} bridges, ${interfaceCount} interfaces (${bridgeMemberNames.size} bridge members), ${hostCount} hosts displayed`);
```

## Future Enhancements

1. **Bridge Statistics Aggregation**
   - Sum traffic from all member ports
   - Show combined RX/TX rates on bridge node

2. **STP Status**
   - Fetch `/interface/bridge/port/print` with STP fields
   - Show forwarding/blocking state on member ports

3. **VLAN Support**
   - Parse VLAN interfaces (`bridge1-vlan10`)
   - Show VLAN hierarchy under bridges

4. **Interactive Features**
   - Click bridge to expand/collapse member ports
   - Drag member ports to reorder
   - Right-click to manage bridge membership

5. **Performance Optimizations**
   - Virtual scrolling for large networks
   - Level-of-detail rendering (hide details when zoomed out)
   - Web Worker for layout calculations
