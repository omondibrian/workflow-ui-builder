import React from 'react';
import { WorkflowNode, NodeType, Point } from '../types';
import { TYPES, ICONS, DESCRIPTIONS } from '../constants';

interface NodePaletteProps {
  nodes: WorkflowNode[];
  debugMode: boolean;
  breakpts: Set<string>;
  toggleBP: (id: string) => void;
  addNode: (type: NodeType, x: number, y: number) => void;
  off: Point;
}

export const NodePalette: React.FC<NodePaletteProps> = ({
  nodes,
  debugMode,
  breakpts,
  toggleBP,
  addNode,
  off,
}) => {
  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('type', type);
  };

  const handleClick = (type: NodeType) => {
    addNode(type, 240 - off.x + Math.random() * 60, 200 - off.y + Math.random() * 80);
  };

  return (
    <div
      style={{
        width: 170,
        background: '#161b22',
        borderRight: '1px solid #30363d',
        padding: '10px 8px',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 9, color: '#484f58', marginBottom: 8, letterSpacing: 2 }}>NODES</div>
      {(Object.entries(TYPES) as [NodeType, typeof TYPES[NodeType]][]).map(([type, t]) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => handleDragStart(e, type)}
          onClick={() => handleClick(type)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 9px',
            marginBottom: 4,
            borderRadius: 5,
            cursor: 'grab',
            background: '#0d1117',
            border: `1px solid ${t.color}28`,
          }}
        >
          <span style={{ color: t.color, fontSize: 13 }}>{ICONS[type]}</span>
          <div>
            <div style={{ fontSize: 10, color: t.color, fontWeight: 'bold' }}>{t.label}</div>
            <div style={{ fontSize: 8, color: '#484f58' }}>{DESCRIPTIONS[type]}</div>
          </div>
        </div>
      ))}
      {debugMode && breakpts.size > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, color: '#484f58', marginBottom: 6, letterSpacing: 2 }}>BREAKPOINTS</div>
          {nodes
            .filter((n) => breakpts.has(n.id))
            .map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: '#f59e0b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 112,
                  }}
                >
                  ⬡ {n.label}
                </span>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    toggleBP(n.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f85149',
                    cursor: 'pointer',
                    fontSize: 9,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
