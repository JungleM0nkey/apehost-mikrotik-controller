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
import { NetworkInterface, ArpEntry, RouterStatus } from '../../types/api';
import { applyLayout, LayoutType } from '../../utils/networkLayouts';
import { Button } from '../../components/atoms/Button/Button';
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

  // Build network graph
  useEffect(() => {
    if (!topology.router) return;

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

    // Interface nodes
    topology.interfaces.forEach((iface) => {
      const interfaceId = `interface-${iface.id}`;

      newNodes.push({
        id: interfaceId,
        type: 'default',
        position: { x: 0, y: 0 }, // Will be positioned by layout
        data: {
          label: (
            <div className={styles.interfaceNode}>
              <div className={styles.nodeTitle}>{iface.name}</div>
              <div className={styles.nodeInfo}>{iface.type}</div>
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
          width: 140,
          fontSize: '12px'
        }
      });

      // Edge from router to interface
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

      // Add connected hosts for this interface
      const hostsOnInterface = topology.arpTable.filter(
        arp => arp.interface === iface.name && arp.status === 'reachable'
      );

      hostsOnInterface.forEach((host) => {
        const hostId = `host-${host.id}`;

        newNodes.push({
          id: hostId,
          type: 'default',
          position: { x: 0, y: 0 }, // Will be positioned by layout
          data: {
            label: (
              <div className={styles.hostNode}>
                <div className={styles.nodeTitle}>{host.address}</div>
                <div className={styles.nodeSubtitle}>{host.macAddress.substring(0, 17)}</div>
              </div>
            )
          },
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            width: 120,
            fontSize: '10px'
          }
        });

        // Edge from interface to host
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

    setNodes(layoutedNodes);
    setEdges(newEdges);
  }, [topology, layoutType, setNodes, setEdges]);

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
              <span className={styles.statValue}>{topology.interfaces.length}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Connected Hosts:</span>
              <span className={styles.statValue}>
                {topology.arpTable.filter(arp => arp.status === 'reachable').length}
              </span>
            </div>
          </div>

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
