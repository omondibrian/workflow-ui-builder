import React, { RefObject } from 'react';
import {
  WorkflowNode,
  Connection,
  Point,
  DragState,
  PanState,
  ConnState,
  NodeStatus,
} from '../types';
import { getOutputPort, getInputPort, getBezierPath } from '../utils';
import { WorkflowNodeComponent } from './WorkflowNode';

interface WorkflowCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  nodes: WorkflowNode[];
  conns: Connection[];
  off: Point;
  sel: string | null;
  hover: string | null;
  drag: DragState | null;
  pan: PanState | null;
  conn: ConnState | null;
  mxy: Point;
  simNodes: Record<string, NodeStatus>;
  simConns: Set<string>;
  activeNid: string | null;
  debugMode: boolean;
  breakpts: Set<string>;
  simRunning: boolean;
  onMove: (e: React.MouseEvent) => void;
  onUp: () => void;
  onDown: (e: React.MouseEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  setHover: (id: string | null) => void;
  startDrag: (e: React.MouseEvent, n: WorkflowNode) => void;
  startConn: (e: React.MouseEvent, n: WorkflowNode, port: number) => void;
  endConn: (e: React.MouseEvent, n: WorkflowNode) => void;
  delNode: (id: string) => void;
  toggleBP: (id: string) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  canvasRef,
  nodes,
  conns,
  off,
  sel,
  hover,
  drag,
  pan,
  conn,
  mxy,
  simNodes,
  simConns,
  activeNid,
  debugMode,
  breakpts,
  simRunning,
  onMove,
  onUp,
  onDown,
  onDrop,
  setHover,
  startDrag,
  startConn,
  endConn,
  delNode,
  toggleBP,
}) => {
  const gX = ((off.x % 24) + 24) % 24;
  const gY = ((off.y % 24) + 24) % 24;

  const getCursor = () => {
    if (drag || pan) return 'grabbing';
    if (conn) return 'crosshair';
    return 'default';
  };

  return (
    <div
      ref={canvasRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        cursor: getCursor(),
      }}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onMouseDown={onDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Grid background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${gX},${gY})`}
          >
            <path d="M24 0L0 0 0 24" fill="none" stroke="#1c2128" strokeWidth="0.5" />
          </pattern>
          <marker id="arr" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="#2d333b" />
          </marker>
          <marker id="arrA" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="#22d3ee" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Connections */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
        <g transform={`translate(${off.x},${off.y})`}>
          {conns.map((c) => {
            const fn = nodes.find((n) => n.id === c.from);
            const tn = nodes.find((n) => n.id === c.to);
            if (!fn || !tn) return null;
            const fp = getOutputPort(fn, c.port);
            const tp = getInputPort(tn);
            const act = simConns.has(c.id);
            const mx = (fp.x + tp.x) / 2;
            const my = (fp.y + tp.y) / 2;
            return (
              <g key={c.id}>
                <path
                  d={getBezierPath(fp, tp)}
                  fill="none"
                  stroke={act ? '#22d3ee' : '#2d333b'}
                  strokeWidth={act ? 2.2 : 1.5}
                  strokeDasharray={act ? 'none' : '5,4'}
                  markerEnd={act ? 'url(#arrA)' : 'url(#arr)'}
                />
                {act && (
                  <circle r="4" fill="#22d3ee" opacity="0.85">
                    <animateMotion dur="0.55s" repeatCount="indefinite" path={getBezierPath(fp, tp)} />
                  </circle>
                )}
                {c.label && (
                  <text
                    x={mx}
                    y={my - 7}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fill={act ? '#67e8f9' : '#484f58'}
                  >
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
          {conn && (
            <path
              d={getBezierPath(conn.sp, mxy)}
              fill="none"
              stroke="#60a5fa88"
              strokeWidth="1.5"
              strokeDasharray="5,4"
            />
          )}
        </g>
      </svg>

      {/* Nodes */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', transform: `translate(${off.x}px,${off.y}px)`, pointerEvents: 'none' }}>
          {nodes.map((n) => (
            <WorkflowNodeComponent
              key={n.id}
              node={n}
              isSelected={sel === n.id}
              isHovered={hover === n.id}
              isActive={activeNid === n.id}
              nodeStatus={simNodes[n.id]}
              debugMode={debugMode}
              isBP={breakpts.has(n.id)}
              simRunning={simRunning}
              onMouseDown={startDrag}
              onMouseUp={endConn}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onToggleBP={() => toggleBP(n.id)}
              onDelete={() => delNode(n.id)}
              onStartConn={startConn}
              onEndConn={endConn}
            />
          ))}
        </div>
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.1 }}>⬡</div>
          <div style={{ fontSize: 12, color: '#484f58', marginTop: 8 }}>
            Drop nodes here or click from the palette
          </div>
        </div>
      )}
    </div>
  );
};
