import React, { useMemo } from 'react';
import { WorkflowNode, Connection } from '../types';
import { TYPES } from '../constants';

interface MinimapProps {
  nodes: WorkflowNode[];
  conns: Connection[];
  zoom: number;
  panOffset: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  onViewportChange: (x: number, y: number) => void;
}

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 10;

export const Minimap: React.FC<MinimapProps> = ({
  nodes,
  conns,
  zoom,
  panOffset,
  viewportWidth,
  viewportHeight,
  onViewportChange,
}) => {
  // Calculate bounds of all nodes
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 600 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach((node) => {
      const width = 120;
      const height = 50;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + width);
      maxY = Math.max(maxY, node.y + height);
    });

    // Add padding
    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  }, [nodes]);

  // Calculate scale to fit all nodes in minimap
  const scale = useMemo(() => {
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const scaleX = (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / contentWidth;
    const scaleY = (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / contentHeight;
    return Math.min(scaleX, scaleY, 0.1);
  }, [bounds]);

  // Transform world coordinates to minimap coordinates
  const toMinimap = (x: number, y: number) => ({
    x: MINIMAP_PADDING + (x - bounds.minX) * scale,
    y: MINIMAP_PADDING + (y - bounds.minY) * scale,
  });

  // Calculate viewport rectangle in minimap coordinates
  const viewportRect = useMemo(() => {
    const left = -panOffset.x / zoom;
    const top = -panOffset.y / zoom;
    const width = viewportWidth / zoom;
    const height = viewportHeight / zoom;
    
    const topLeft = toMinimap(left, top);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: width * scale,
      height: height * scale,
    };
  }, [panOffset, zoom, viewportWidth, viewportHeight, scale, bounds]);

  // Handle minimap click to pan viewport
  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap coordinates to world coordinates
    const worldX = bounds.minX + (clickX - MINIMAP_PADDING) / scale;
    const worldY = bounds.minY + (clickY - MINIMAP_PADDING) / scale;

    // Center the viewport on the clicked point
    const newPanX = -(worldX - viewportWidth / zoom / 2) * zoom;
    const newPanY = -(worldY - viewportHeight / zoom / 2) * zoom;

    onViewportChange(newPanX, newPanY);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 4,
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleMinimapClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Connections */}
        {conns.map((conn) => {
          const fromNode = nodes.find((n) => n.id === conn.from);
          const toNode = nodes.find((n) => n.id === conn.to);
          if (!fromNode || !toNode) return null;

          const from = toMinimap(fromNode.x + 60, fromNode.y + 25);
          const to = toMinimap(toNode.x + 60, toNode.y + 25);

          return (
            <line
              key={conn.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#30363d"
              strokeWidth={1}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = toMinimap(node.x, node.y);
          const nodeType = TYPES[node.type];
          const width = 120 * scale;
          const height = 50 * scale;

          return (
            <rect
              key={node.id}
              x={pos.x}
              y={pos.y}
              width={Math.max(width, 4)}
              height={Math.max(height, 3)}
              fill={nodeType?.color || '#8b949e'}
              rx={1}
            />
          );
        })}

        {/* Viewport rectangle */}
        <rect
          x={Math.max(0, viewportRect.x)}
          y={Math.max(0, viewportRect.y)}
          width={Math.min(viewportRect.width, MINIMAP_WIDTH - viewportRect.x)}
          height={Math.min(viewportRect.height, MINIMAP_HEIGHT - viewportRect.y)}
          fill="rgba(88, 166, 255, 0.1)"
          stroke="#58a6ff"
          strokeWidth={1}
          strokeDasharray="2,1"
        />
      </svg>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          fontSize: 8,
          color: '#484f58',
          letterSpacing: 1,
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};
