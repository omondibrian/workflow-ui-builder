import React from 'react';
import { WorkflowNode as WorkflowNodeType, NodeStatus } from '../types';
import { TYPES, ICONS, NODE_WIDTH, NODE_HEIGHT, STATUS_COLORS } from '../constants';

interface WorkflowNodeProps {
  node: WorkflowNodeType;
  isSelected: boolean;
  isHovered: boolean;
  isActive: boolean;
  nodeStatus?: NodeStatus;
  debugMode: boolean;
  isBP: boolean;
  simRunning: boolean;
  onMouseDown: (e: React.MouseEvent, n: WorkflowNodeType) => void;
  onMouseUp: (e: React.MouseEvent, n: WorkflowNodeType) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleBP: () => void;
  onDelete: () => void;
  onStartConn: (e: React.MouseEvent, n: WorkflowNodeType, port: number) => void;
  onEndConn: (e: React.MouseEvent, n: WorkflowNodeType) => void;
}

export const WorkflowNodeComponent: React.FC<WorkflowNodeProps> = ({
  node,
  isSelected,
  isHovered,
  isActive,
  nodeStatus,
  debugMode,
  isBP,
  simRunning,
  onMouseDown,
  onMouseUp,
  onMouseEnter,
  onMouseLeave,
  onToggleBP,
  onDelete,
  onStartConn,
  onEndConn,
}) => {
  const t = TYPES[node.type];
  const status = nodeStatus?.status || 'idle';

  const getBackground = () => {
    if (isActive) return '#081a0e';
    if (status === 'paused') return '#1a130a';
    if (status === 'done') return '#0a1a0a';
    return '#161b22';
  };

  const getBorderColor = () => {
    if (isActive) return '#22d3ee';
    if (isSelected) return '#388bfd';
    if (isBP) return '#f59e0b55';
    return `${t.color}38`;
  };

  const getLeftBorderColor = () => {
    if (status === 'running' || isActive) return '#22d3ee';
    if (status === 'paused') return '#f59e0b';
    if (status === 'done') return t.color;
    if (status === 'error') return '#f85149';
    return t.color;
  };

  return (
    <div
      data-node="1"
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: getBackground(),
        border: `1px solid ${getBorderColor()}`,
        borderLeft: `3px solid ${getLeftBorderColor()}`,
        borderRadius: 5,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px 0 10px',
        transition: 'background 0.2s,border 0.2s',
      }}
      onMouseDown={(e) => onMouseDown(e, node)}
      onMouseUp={(e) => onMouseUp(e, node)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span style={{ color: t.color, fontSize: 13, flexShrink: 0 }}>{ICONS[node.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: t.color, letterSpacing: 1, opacity: 0.75 }}>
            {t.label.toUpperCase()}
          </span>
          {nodeStatus?.duration && (
            <span style={{ fontSize: 8, color: '#10b981' }}>{nodeStatus.duration}ms</span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#e6edf3',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.label}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {debugMode && (
          <div
            data-port="1"
            title={isBP ? 'Remove breakpoint' : 'Add breakpoint'}
            onMouseDown={(e) => {
              e.stopPropagation();
              onToggleBP();
            }}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isBP ? '#f59e0b' : '#21262d',
              border: `1px solid ${isBP ? '#f59e0b44' : '#30363d'}`,
              cursor: 'pointer',
            }}
          />
        )}
        {status !== 'idle' && (
          <span style={{ fontSize: 9, color: STATUS_COLORS[status] || '#484f58' }}>
            {status === 'running' ? '▶' : status === 'done' ? '✓' : status === 'paused' ? '⏸' : status === 'error' ? '✕' : ''}
          </span>
        )}
        {isHovered && !simRunning && (
          <button
            data-port="1"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f85149',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {/* Input port */}
      {node.type !== 'trigger' && (
        <div
          data-port="1"
          style={{
            position: 'absolute',
            left: -5,
            top: NODE_HEIGHT / 2 - 5,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#0d1117',
            border: '1.5px solid #484f58',
            cursor: 'crosshair',
            pointerEvents: 'auto',
            zIndex: 10,
          }}
          onMouseUp={(e) => onEndConn(e, node)}
        />
      )}
      {/* Output ports */}
      {Array.from({ length: TYPES[node.type].outs }).map((_, i) => {
        const py = TYPES[node.type].outs > 1 ? (i === 0 ? NODE_HEIGHT * 0.3 : NODE_HEIGHT * 0.7) : NODE_HEIGHT / 2;
        return (
          <div
            key={i}
            data-port="1"
            style={{
              position: 'absolute',
              right: -5,
              top: py - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: t.color,
              border: '1.5px solid #0d1117',
              cursor: 'crosshair',
              pointerEvents: 'auto',
              zIndex: 10,
            }}
            onMouseDown={(e) => onStartConn(e, node, i)}
          />
        );
      })}
    </div>
  );
};
