import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Spin, Alert } from 'antd';
import { InterfaceTypeIcon } from '../../components/atoms/InterfaceTypeIcon/InterfaceTypeIcon';
import { NetworkInterface, ArpEntry, RouterStatus } from '../../types/api';
import { applyLayout, LayoutType } from '../../utils/networkLayouts';
import { Button } from '../../components/atoms/Button/Button';
import { Toggle } from '../../components/atoms/Toggle/Toggle';
import styles from './NetworkMapPage.module.css';

interface NetworkTopology {
  router: RouterStatus | null;
  interfaces: NetworkInterface[];
  arpTable: ArpEntry[];
}

export const NetworkMapPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topology, setTopology] = useState<NetworkTopology>({
    router: null,
    interfaces: [],
    arpTable: []
  });
  const [layoutType, setLayoutType] = useState<LayoutType>('radial');
  const [showActiveInterfaces, setShowActiveInterfaces] = useState(true);
  const [showInactiveInterfaces, setShowInactiveInterfaces] = useState(true);
  const [showDetailedInfo, setShowDetailedInfo] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [speedTesting, setSpeedTesting] = useState(false);
  const [speedTestResults, setSpeedTestResults] = useState<{
    latency: number;
    downloadSpeed: number;
    testServer: string;
    timestamp: string;
  } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load network topology data
  const loadTopology = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [routerRes, interfacesRes, arpRes] = await Promise.all([
        fetch('/api/router/status'),
        fetch('/api/router/interfaces'),
        fetch('/api/router/ip/arp')
      ]);

      if (!routerRes.ok || !interfacesRes.ok || !arpRes.ok) {
        throw new Error('Failed to fetch network data');
      }

      const router = await routerRes.json();
      const interfaces = await interfacesRes.json();
      const arpTable = await arpRes.json();

      setTopology({ router, interfaces, arpTable });
    } catch (err) {
      console.error('Failed to load network topology:', err);
      setError('Failed to load network topology. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopology();
    // Refresh every 30 seconds
    const interval = setInterval(loadTopology, 30000);
    return () => clearInterval(interval);
  }, [loadTopology]);

  // Trigger network scan
  const handleNetworkScan = useCallback(async () => {
    setScanning(true);
    try {
      console.log('Starting comprehensive network scan...');
      const response = await fetch('/api/router/scan/full');

      if (!response.ok) {
        throw new Error('Network scan failed');
      }

      const scanResults = await response.json();
      console.log('Network scan complete:', scanResults);

      // Update topology with enhanced data from scan
      setTopology(prev => ({
        ...prev,
        arpTable: scanResults.arpTable || prev.arpTable
      }));

      setLastScanTime(scanResults.scanTime);

      // Show scan results in console for debugging
      console.log(`Scan Results:
        - ARP Entries: ${scanResults.arpTable.length}
        - DHCP Leases: ${scanResults.dhcpLeases.length}
        - Neighbors: ${scanResults.neighbors.length}
        - Enhanced Hosts: ${scanResults.enhancedHosts.length}
      `);

      // Log enhanced hosts with all their data
      console.log('Enhanced Hosts:', scanResults.enhancedHosts);

    } catch (error) {
      console.error('Network scan failed:', error);
      setError('Network scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, []);

  // Trigger speed test
  const handleSpeedTest = useCallback(async () => {
    setSpeedTesting(true);
    try {
      console.log('Starting speed test...');
      const response = await fetch('/api/router/speed-test');

      if (!response.ok) {
        throw new Error('Speed test failed');
      }

      const results = await response.json();
      console.log('Speed test complete:', results);

      setSpeedTestResults(results);

    } catch (error) {
      console.error('Speed test failed:', error);
      setError('Speed test failed. Please try again.');
    } finally {
      setSpeedTesting(false);
    }
  }, []);

  // Build network graph
  useEffect(() => {
    if (!topology.router) return;

    // Debug: Log all ARP entries
    console.log('=== Network Map Debug ===');
    console.log(`Total ARP entries: ${topology.arpTable.length}`);
    console.log('ARP Table:', topology.arpTable.map(arp => ({
      interface: arp.interface,
      ip: arp.address,
      mac: arp.macAddress,
      status: arp.status,
      disabled: arp.disabled,
      invalid: arp.invalid
    })));
    console.log('Interfaces:', topology.interfaces.map(i => ({
      name: i.name,
      type: i.type,
      isBridge: i.isBridge,
      bridge: i.bridge,
      bridgePorts: i.bridgePorts
    })));

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Central router node
    newNodes.push({
      id: 'router',
      type: 'default',
      position: { x: 0, y: 0 }, // Will be positioned by layout
      data: {
        label: (
          <div className={styles.routerNode}>
            <div className={styles.nodeTitle}>{topology.router.name}</div>
            <div className={styles.nodeSubtitle}>{topology.router.model}</div>
            <div className={styles.nodeInfo}>{topology.router.ip}</div>
          </div>
        )
      },
      style: {
        background: 'var(--color-accent-primary)',
        color: 'white',
        border: '2px solid var(--color-accent-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        width: 180,
        fontSize: '14px'
      }
    });

    // Separate interfaces into bridges, bridge members, and standalone interfaces
    const bridges = topology.interfaces.filter(iface => iface.isBridge);
    const bridgeMemberNames = new Set(
      topology.interfaces
        .filter(iface => iface.bridge)
        .map(iface => iface.name)
    );
    const standaloneInterfaces = topology.interfaces.filter(
      iface => !iface.isBridge && !iface.bridge
    );

    // Filter based on settings
    const filteredBridges = bridges.filter(iface => {
      if (iface.status === 'up') return showActiveInterfaces;
      return showInactiveInterfaces;
    });
    
    const filteredStandalone = standaloneInterfaces.filter(iface => {
      if (iface.status === 'up') return showActiveInterfaces;
      return showInactiveInterfaces;
    });

    // Render bridge interfaces with their member ports
    filteredBridges.forEach((bridge) => {
      const bridgeId = `interface-${bridge.id}`;
      const memberPorts = topology.interfaces.filter(
        iface => iface.bridge === bridge.name
      );

      // Filter member ports based on settings
      const visibleMemberPorts = memberPorts.filter(iface => {
        if (iface.status === 'up') return showActiveInterfaces;
        return showInactiveInterfaces;
      });

      // Create bridge node (larger, acts as a group header)
      newNodes.push({
        id: bridgeId,
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
          label: (
            <div className={styles.bridgeNode}>
              <div className={styles.nodeTitleRow}>
                <InterfaceTypeIcon type="bridge" size={20} className={styles.nodeTypeIcon} />
                <div className={styles.nodeTitle}>{bridge.name}</div>
              </div>
              <div className={styles.nodeSubtitle}>Bridge ({visibleMemberPorts.length} ports)</div>
              {showDetailedInfo && bridge.ipAddress && (
                <div className={styles.nodeInfo}>IP: {bridge.ipAddress}</div>
              )}
              <div className={`${styles.statusBadge} ${bridge.status === 'up' ? styles.statusUp : styles.statusDown}`}>
                {bridge.status}
              </div>
            </div>
          )
        },
        style: {
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: `3px solid ${bridge.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          width: showDetailedInfo ? 180 : 160,
          fontSize: '13px'
        }
      });

      // Edge from router to bridge
      newEdges.push({
        id: `router-${bridgeId}`,
        source: 'router',
        target: bridgeId,
        type: 'smoothstep',
        animated: bridge.status === 'up',
        style: {
          stroke: bridge.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)',
          strokeWidth: 3
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: bridge.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)'
        }
      });

      // Render member port nodes
      visibleMemberPorts.forEach((port) => {
        const portId = `interface-${port.id}`;

        newNodes.push({
          id: portId,
          type: 'default',
          position: { x: 0, y: 0 },
          data: {
            label: (
              <div className={styles.bridgePortNode}>
                <div className={styles.nodeTitleRow}>
                  <InterfaceTypeIcon type={port.type} size={16} className={styles.nodeTypeIcon} />
                  <div className={styles.nodeTitle}>{port.name}</div>
                </div>
                <div className={styles.nodeSubtitle}>{port.type}</div>
                {showDetailedInfo && port.ipAddress && (
                  <div className={styles.nodeInfo}>IP: {port.ipAddress}</div>
                )}
                <div className={`${styles.statusBadge} ${port.status === 'up' ? styles.statusUp : styles.statusDown}`}>
                  {port.status}
                </div>
              </div>
            )
          },
          style: {
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
            border: `2px solid ${port.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px',
            width: showDetailedInfo ? 140 : 120,
            fontSize: '11px'
          }
        });

        // Edge from bridge to member port
        newEdges.push({
          id: `${bridgeId}-${portId}`,
          source: bridgeId,
          target: portId,
          type: 'smoothstep',
          animated: port.status === 'up',
          style: {
            stroke: port.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)',
            strokeWidth: 2,
            strokeDasharray: '5,5' // Dashed line to indicate membership
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: port.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)'
          }
        });

        // Add hosts connected to this bridge port
        const hostsOnPort = topology.arpTable.filter(
          arp => {
            const interfaceMatch = arp.interface.trim().toLowerCase() === port.name.trim().toLowerCase();
            const validStatus = ['reachable', 'stale', 'delay'].includes(arp.status);
            const isValid = !arp.disabled && !arp.invalid;
            return interfaceMatch && validStatus && isValid;
          }
        );

        hostsOnPort.forEach((host) => {
          const hostId = `host-${host.id}`;

          const getHostBorderColor = () => {
            if (host.status === 'reachable') return 'var(--color-accent-success)';
            if (host.status === 'stale') return 'var(--color-accent-primary)';
            return 'var(--color-border-primary)';
          };

          newNodes.push({
            id: hostId,
            type: 'default',
            position: { x: 0, y: 0 },
            data: {
              label: (
                <div className={styles.hostNode}>
                  <div className={styles.nodeTitle}>{host.address}</div>
                  <div className={styles.nodeSubtitle}>{host.macAddress.substring(0, 17)}</div>
                  <div className={styles.hostStatus}>{host.status}</div>
                </div>
              )
            },
            style: {
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: `1px solid ${getHostBorderColor()}`,
              borderRadius: 'var(--radius-md)',
              padding: '8px',
              width: 120,
              fontSize: '10px'
            }
          });

          newEdges.push({
            id: `${portId}-${hostId}`,
            source: portId,
            target: hostId,
            type: 'smoothstep',
            style: {
              stroke: 'var(--color-border-secondary)',
              strokeWidth: 1
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'var(--color-border-secondary)'
            }
          });
        });
      });

      // Add hosts connected directly to the bridge interface
      const hostsOnBridge = topology.arpTable.filter(
        arp => {
          const interfaceMatch = arp.interface.trim().toLowerCase() === bridge.name.trim().toLowerCase();
          const validStatus = ['reachable', 'stale', 'delay'].includes(arp.status);
          const isValid = !arp.disabled && !arp.invalid;
          // Don't add if already added via a member port
          const notOnMemberPort = !memberPorts.some(
            port => arp.interface.trim().toLowerCase() === port.name.trim().toLowerCase()
          );
          return interfaceMatch && validStatus && isValid && notOnMemberPort;
        }
      );

      hostsOnBridge.forEach((host) => {
        const hostId = `host-${host.id}`;

        const getHostBorderColor = () => {
          if (host.status === 'reachable') return 'var(--color-accent-success)';
          if (host.status === 'stale') return 'var(--color-accent-primary)';
          return 'var(--color-border-primary)';
        };

        newNodes.push({
          id: hostId,
          type: 'default',
          position: { x: 0, y: 0 },
          data: {
            label: (
              <div className={styles.hostNode}>
                <div className={styles.nodeTitle}>{host.address}</div>
                <div className={styles.nodeSubtitle}>{host.macAddress.substring(0, 17)}</div>
                <div className={styles.hostStatus}>{host.status}</div>
              </div>
            )
          },
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: `1px solid ${getHostBorderColor()}`,
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            width: 120,
            fontSize: '10px'
          }
        });

        newEdges.push({
          id: `${bridgeId}-${hostId}`,
          source: bridgeId,
          target: hostId,
          type: 'smoothstep',
          style: {
            stroke: 'var(--color-border-secondary)',
            strokeWidth: 1
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--color-border-secondary)'
          }
        });
      });
    });

    // Render standalone (non-bridge, non-member) interfaces
    filteredStandalone.forEach((iface) => {
      const interfaceId = `interface-${iface.id}`;

      const interfaceMac = topology.arpTable.find(
        arp => arp.interface.trim().toLowerCase() === iface.name.trim().toLowerCase()
      )?.macAddress;

      const displayMac = interfaceMac || 'N/A';

      newNodes.push({
        id: interfaceId,
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
          label: (
            <div className={styles.interfaceNode}>
              <div className={styles.nodeTitleRow}>
                <InterfaceTypeIcon type={iface.type} size={18} className={styles.nodeTypeIcon} />
                <div className={styles.nodeTitle}>{iface.name}</div>
              </div>
              <div className={styles.nodeSubtitle}>{iface.type}</div>
              {showDetailedInfo && (
                <>
                  {iface.ipAddress && (
                    <div className={styles.nodeInfo}>IP: {iface.ipAddress}</div>
                  )}
                  <div className={styles.nodeInfo}>
                    MAC: {displayMac.substring(0, 17)}
                  </div>
                </>
              )}
              <div className={`${styles.statusBadge} ${iface.status === 'up' ? styles.statusUp : styles.statusDown}`}>
                {iface.status}
              </div>
            </div>
          )
        },
        style: {
          background: 'var(--color-bg-tertiary)',
          color: 'var(--color-text-primary)',
          border: `2px solid ${iface.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          width: showDetailedInfo ? 160 : 140,
          fontSize: '12px'
        }
      });

      newEdges.push({
        id: `router-${interfaceId}`,
        source: 'router',
        target: interfaceId,
        type: 'smoothstep',
        animated: iface.status === 'up',
        style: {
          stroke: iface.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)',
          strokeWidth: 2
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: iface.status === 'up' ? 'var(--color-accent-success)' : 'var(--color-border-primary)'
        }
      });

      // Add connected hosts for this standalone interface
      const hostsOnInterface = topology.arpTable.filter(
        arp => {
          const interfaceMatch = arp.interface.trim().toLowerCase() === iface.name.trim().toLowerCase();
          const validStatus = ['reachable', 'stale', 'delay'].includes(arp.status);
          const isValid = !arp.disabled && !arp.invalid;
          return interfaceMatch && validStatus && isValid;
        }
      );

      if (hostsOnInterface.length > 0) {
        console.log(`Standalone interface ${iface.name}: Found ${hostsOnInterface.length} hosts`,
          hostsOnInterface.map(h => ({ ip: h.address, mac: h.macAddress, status: h.status }))
        );
      }

      hostsOnInterface.forEach((host) => {
        const hostId = `host-${host.id}`;

        const getHostBorderColor = () => {
          if (host.status === 'reachable') return 'var(--color-accent-success)';
          if (host.status === 'stale') return 'var(--color-accent-primary)';
          return 'var(--color-border-primary)';
        };

        newNodes.push({
          id: hostId,
          type: 'default',
          position: { x: 0, y: 0 },
          data: {
            label: (
              <div className={styles.hostNode}>
                <div className={styles.nodeTitle}>{host.address}</div>
                <div className={styles.nodeSubtitle}>{host.macAddress.substring(0, 17)}</div>
                <div className={styles.hostStatus}>{host.status}</div>
              </div>
            )
          },
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: `1px solid ${getHostBorderColor()}`,
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            width: 120,
            fontSize: '10px'
          }
        });

        newEdges.push({
          id: `${interfaceId}-${hostId}`,
          source: interfaceId,
          target: hostId,
          type: 'smoothstep',
          style: {
            stroke: 'var(--color-border-secondary)',
            strokeWidth: 1
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--color-border-secondary)'
          }
        });
      });
    });

    // Apply layout algorithm
    const layoutedNodes = applyLayout(layoutType, newNodes, newEdges);

    // Debug summary
    const hostCount = newNodes.filter(n => n.id.startsWith('host-')).length;
    const interfaceCount = newNodes.filter(n => n.id.startsWith('interface-')).length;
    const bridgeCount = bridges.length;
    console.log(`Network Map: ${bridgeCount} bridges, ${interfaceCount} interfaces (${bridgeMemberNames.size} bridge members), ${hostCount} hosts displayed`);
    console.log('=== End Debug ===\n');

    setNodes(layoutedNodes);
    setEdges(newEdges);
  }, [topology, layoutType, showActiveInterfaces, showInactiveInterfaces, showDetailedInfo, setNodes, setEdges]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="Loading network topology..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Network Map</h1>
        </div>
        <div className={styles.content}>
          <Alert
            message="Error Loading Network Map"
            description={error}
            type="error"
            showIcon
          />
        </div>
      </div>
    );
  }

  // Handle layout change
  const handleLayoutChange = (newLayout: LayoutType) => {
    setLayoutType(newLayout);
  };

  // Handle auto-layout button
  const handleAutoLayout = () => {
    const layoutedNodes = applyLayout(layoutType, nodes, edges);
    setNodes(layoutedNodes);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Network Map</h1>

        <div className={styles.headerControls}>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Interfaces:</span>
              <div className={styles.interfaceTags}>
                <button
                  className={`${styles.interfaceTag} ${styles.tagActive} ${!showActiveInterfaces ? styles.tagHidden : ''}`}
                  onClick={() => setShowActiveInterfaces(!showActiveInterfaces)}
                  title="Click to toggle active interfaces"
                >
                  Active: {topology.interfaces.filter(i => i.status === 'up').length}
                </button>
                <button
                  className={`${styles.interfaceTag} ${styles.tagInactive} ${!showInactiveInterfaces ? styles.tagHidden : ''}`}
                  onClick={() => setShowInactiveInterfaces(!showInactiveInterfaces)}
                  title="Click to toggle inactive interfaces"
                >
                  Inactive: {topology.interfaces.filter(i => i.status !== 'up').length}
                </button>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Devices:</span>
              <span className={styles.statValue}>
                {nodes.filter(n => n.id.startsWith('host-')).length}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total ARP:</span>
              <span className={styles.statValue}>{topology.arpTable.length}</span>
            </div>
            {lastScanTime && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Last Scan:</span>
                <span className={styles.statValue}>
                  {new Date(lastScanTime).toLocaleTimeString()}
                </span>
              </div>
            )}
            {speedTestResults && (
              <>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Latency:</span>
                  <span className={styles.statValue}>{speedTestResults.latency}ms</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Download:</span>
                  <span className={styles.statValue}>{speedTestResults.downloadSpeed} Mbps</span>
                </div>
              </>
            )}
          </div>

          <div className={styles.controlsGroup}>
            <div className={styles.layoutControls}>
              <label className={styles.layoutLabel}>Layout:</label>
              <select
                className={styles.layoutSelect}
                value={layoutType}
                onChange={(e) => handleLayoutChange(e.target.value as LayoutType)}
              >
                <option value="radial">Radial (Concentric)</option>
                <option value="force">Force-Directed</option>
                <option value="hierarchical">Hierarchical (Tree)</option>
                <option value="grid">Grid</option>
              </select>
              <Button
                variant="secondary"
                size="small"
                onClick={handleAutoLayout}
              >
                Re-layout
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={handleNetworkScan}
                disabled={scanning}
              >
                {scanning ? 'Scanning...' : 'Scan Network'}
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={handleSpeedTest}
                disabled={speedTesting}
              >
                {speedTesting ? 'Testing...' : 'Speed Test'}
              </Button>
            </div>

            <div className={styles.filterControls}>
              <div className={styles.toggleGroup}>
                <Toggle
                  checked={showDetailedInfo}
                  onChange={setShowDetailedInfo}
                />
                <label className={styles.toggleLabel}>Show Details</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.mapContainer}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="var(--color-border-primary)" gap={16} />
          <Controls className={styles.controls} />
          <MiniMap
            className={styles.minimap}
            nodeColor={(node) => {
              if (node.id === 'router') return 'var(--color-accent-primary)';
              if (node.id.startsWith('interface-')) return 'var(--color-accent-success)';
              return 'var(--color-border-primary)';
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
};
