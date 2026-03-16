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
  onDoubleClick?: () => void;
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
  onDoubleClick,
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
        borderTop: `1px solid ${getBorderColor()}`,
        borderRight: `1px solid ${getBorderColor()}`,
        borderBottom: `1px solid ${getBorderColor()}`,
        borderLeft: `3px solid ${getLeftBorderColor()}`,
        borderRadius: 5,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px 0 8px',
        transition: 'background 0.2s',
      }}
      onMouseUp={(e) => onMouseUp(e, node)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
    >
      {/* Drag handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onMouseDown(e, node);
        }}
        style={{
          color: isHovered ? '#8b949e' : '#484f58',
          fontSize: 11,
          cursor: 'grab',
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 0.4,
          padding: '8px 5px',
          marginLeft: 2,
          marginRight: 4,
          borderRadius: 3,
          transition: 'all 0.15s',
          background: isHovered ? '#21262d' : 'transparent',
          minHeight: 28,
        }}
        title="Drag to move"
      >
        <span>⋮⋮</span>
      </div>
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
        {/* Breakpoint toggle - only show in debug mode */}
        {debugMode && (
          <div
            data-port="1"
            title={isBP ? 'Remove breakpoint' : 'Add breakpoint'}
            onMouseDown={(e) => {
              e.stopPropagation();
              onToggleBP();
            }}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isBP ? '#f59e0b' : (isHovered ? '#30363d' : '#21262d'),
              border: `2px solid ${isBP ? '#f59e0b' : (isHovered ? '#484f58' : '#30363d')}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
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
      {node.type !== 'trigger' && node.type !== 'webhook' && node.type !== 'schedule' && (
        <div
          data-port="input"
          style={{
            position: 'absolute',
            left: -12,
            top: NODE_HEIGHT / 2 - 12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'transparent',
            cursor: 'crosshair',
            pointerEvents: 'auto',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onEndConn(e, node);
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#0d1117',
              border: '1.5px solid #484f58',
            }}
          />
        </div>
      )}
      {/* Output ports */}
      {Array.from({ length: TYPES[node.type].outs }).map((_, i) => {
        const py = TYPES[node.type].outs > 1 ? (i === 0 ? NODE_HEIGHT * 0.3 : NODE_HEIGHT * 0.7) : NODE_HEIGHT / 2;
        return (
          <div
            key={i}
            data-port="output"
            style={{
              position: 'absolute',
              right: -12,
              top: py - 12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'transparent',
              cursor: 'crosshair',
              pointerEvents: 'auto',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConn(e, node, i);
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: t.color,
                border: '1.5px solid #0d1117',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
