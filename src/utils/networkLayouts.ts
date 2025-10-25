import { Node, Edge } from 'reactflow';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import dagre from 'dagre';

export type LayoutType = 'force' | 'hierarchical' | 'radial' | 'grid';

interface LayoutOptions {
  width?: number;
  height?: number;
  spacing?: number;
}

/**
 * Force-Directed Layout using D3-Force
 * Nodes repel each other, edges act like springs
 * Creates natural, organic layouts
 */
export function forceDirectedLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { width = 1200, height = 800, spacing = 150 } = options;

  // Create a deep copy to avoid mutations
  const simulationNodes = nodes.map((node) => ({
    ...node,
    x: node.position.x,
    y: node.position.y,
  }));

  const simulationLinks = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  // Create force simulation
  const simulation = forceSimulation(simulationNodes as any)
    .force(
      'link',
      forceLink(simulationLinks)
        .id((d: any) => d.id)
        .distance(spacing)
        .strength(1)
    )
    .force('charge', forceManyBody().strength(-1000))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collision', forceCollide().radius(80))
    .stop();

  // Run simulation synchronously
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // Update node positions
  return nodes.map((node) => {
    const simNode = simulationNodes.find((n) => n.id === node.id);
    return {
      ...node,
      position: {
        x: simNode?.x || node.position.x,
        y: simNode?.y || node.position.y,
      },
    };
  });
}

/**
 * Hierarchical Tree Layout using Dagre
 * Organized in layers based on network hierarchy
 * Router → Interfaces → Hosts
 */
export function hierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { spacing = 150 } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure layout direction and spacing
  dagreGraph.setGraph({
    rankdir: 'TB', // Top to Bottom
    nodesep: spacing,
    ranksep: spacing,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.style?.width || 180,
      height: 100,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Update node positions
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = typeof node.style?.width === 'number' ? node.style.width : 180;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - 50,
      },
    };
  });
}

/**
 * Improved Radial Layout
 * Concentric circles based on node type/hierarchy
 * Router center → Interfaces ring → Hosts outer ring
 */
export function radialLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { width = 1200, height = 800 } = options;
  const centerX = width / 2;
  const centerY = height / 2;

  // Categorize nodes by type
  const routerNodes = nodes.filter((n) => n.id === 'router');
  const interfaceNodes = nodes.filter((n) => n.id.startsWith('interface-'));
  const hostNodes = nodes.filter((n) => n.id.startsWith('host-'));

  const updatedNodes: Node[] = [];

  // Router at center
  routerNodes.forEach((node) => {
    updatedNodes.push({
      ...node,
      position: { x: centerX - 90, y: centerY - 50 },
    });
  });

  // Interfaces in first ring
  const interfaceRadius = 300;
  const interfaceAngleStep = (2 * Math.PI) / Math.max(interfaceNodes.length, 1);

  interfaceNodes.forEach((node, index) => {
    const angle = index * interfaceAngleStep;
    updatedNodes.push({
      ...node,
      position: {
        x: centerX + interfaceRadius * Math.cos(angle) - 70,
        y: centerY + interfaceRadius * Math.sin(angle) - 50,
      },
    });
  });

  // Hosts in outer ring, grouped by interface
  const hostRadius = 500;
  const hostsPerInterface = new Map<string, Node[]>();

  // Group hosts by their connected interface
  hostNodes.forEach((host) => {
    const connectedEdge = edges.find((e) => e.target === host.id);
    if (connectedEdge) {
      const interfaceId = connectedEdge.source;
      if (!hostsPerInterface.has(interfaceId)) {
        hostsPerInterface.set(interfaceId, []);
      }
      hostsPerInterface.get(interfaceId)!.push(host);
    }
  });

  // Position hosts around their interfaces
  interfaceNodes.forEach((iface, ifaceIndex) => {
    const hosts = hostsPerInterface.get(iface.id) || [];
    const baseAngle = ifaceIndex * interfaceAngleStep;
    const hostAngleRange = Math.PI / 3; // 60 degrees per interface
    const hostAngleStep = hosts.length > 1 ? hostAngleRange / (hosts.length - 1) : 0;

    hosts.forEach((host, hostIndex) => {
      const angle = baseAngle - hostAngleRange / 2 + hostIndex * hostAngleStep;
      updatedNodes.push({
        ...host,
        position: {
          x: centerX + hostRadius * Math.cos(angle) - 60,
          y: centerY + hostRadius * Math.sin(angle) - 40,
        },
      });
    });
  });

  return updatedNodes;
}

/**
 * Grid Layout
 * Organized in rows and columns
 * Good for large networks with many nodes
 */
export function gridLayout(
  nodes: Node[],
  _edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { spacing = 200 } = options;

  // Categorize nodes
  const routerNodes = nodes.filter((n) => n.id === 'router');
  const interfaceNodes = nodes.filter((n) => n.id.startsWith('interface-'));
  const hostNodes = nodes.filter((n) => n.id.startsWith('host-'));

  const updatedNodes: Node[] = [];

  // Router at top center
  routerNodes.forEach((node) => {
    updatedNodes.push({
      ...node,
      position: { x: spacing * 2, y: 50 },
    });
  });

  // Interfaces in row below router
  const interfacesPerRow = Math.ceil(Math.sqrt(interfaceNodes.length));
  interfaceNodes.forEach((node, index) => {
    const row = Math.floor(index / interfacesPerRow);
    const col = index % interfacesPerRow;
    updatedNodes.push({
      ...node,
      position: {
        x: col * spacing + spacing,
        y: row * spacing + spacing * 2,
      },
    });
  });

  // Hosts in grid below interfaces
  const hostsPerRow = Math.ceil(Math.sqrt(hostNodes.length));
  const startY = Math.ceil(interfaceNodes.length / interfacesPerRow) * spacing + spacing * 3;

  hostNodes.forEach((node, index) => {
    const row = Math.floor(index / hostsPerRow);
    const col = index % hostsPerRow;
    updatedNodes.push({
      ...node,
      position: {
        x: col * (spacing * 0.8) + spacing,
        y: row * (spacing * 0.8) + startY,
      },
    });
  });

  return updatedNodes;
}

/**
 * Apply selected layout to nodes
 */
export function applyLayout(
  layoutType: LayoutType,
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  switch (layoutType) {
    case 'force':
      return forceDirectedLayout(nodes, edges, options);
    case 'hierarchical':
      return hierarchicalLayout(nodes, edges, options);
    case 'radial':
      return radialLayout(nodes, edges, options);
    case 'grid':
      return gridLayout(nodes, edges, options);
    default:
      return nodes;
  }
}
