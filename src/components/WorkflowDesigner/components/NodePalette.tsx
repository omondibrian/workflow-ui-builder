import React, { useState, useCallback, useEffect } from 'react';
import { WorkflowNode, NodeType, Point, Connection, ExecutionRun } from '../types';
import { TYPES, ICONS, DESCRIPTIONS } from '../constants';

const MIN_WIDTH = 140;
const MAX_WIDTH = 350;
const DEFAULT_WIDTH = 170;
const DEBUG_DEFAULT_WIDTH = 200;

interface NodePaletteProps {
  nodes: WorkflowNode[];
  debugMode: boolean;
  breakpts: Set<string>;
  toggleBP: (id: string) => void;
  addNode: (type: NodeType, x: number, y: number) => void;
  off: Point;
  // Debug context props
  execCtx?: Record<string, unknown>;
  activeNid?: string | null;
  conns?: Connection[];
  selectedNode?: WorkflowNode | null;
  isExecuting?: boolean;
  isPaused?: boolean;
  inspectedNodeId?: string | null;
  onNodeInspect?: (nodeId: string | null) => void;
  replayingRun?: ExecutionRun | null;
}

export const NodePalette: React.FC<NodePaletteProps> = ({
  nodes,
  debugMode,
  breakpts,
  toggleBP,
  addNode,
  off,
  execCtx = {},
  activeNid = null,
  conns = [],
  selectedNode = null,
  isExecuting = false,
  isPaused = false,
  inspectedNodeId = null,
  onNodeInspect,
  replayingRun = null,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    globalCtx: true,
    nodeInputs: true,
    nodeProps: true,
    nodeList: true,
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [viewMode, setViewMode] = useState<'auto' | 'nodes' | 'debug'>('auto');

  // Determine if we should show debug context
  // Auto: show debug when executing, otherwise show nodes
  // Manual: respect user selection
  const autoShowDebug = debugMode && isExecuting;
  const showDebugContext = viewMode === 'auto' ? autoShowDebug : viewMode === 'debug';

  // Use inspected node if set (when paused), otherwise use active node
  const displayNodeId = isPaused && inspectedNodeId ? inspectedNodeId : activeNid;

  // Reset width when switching between debug and normal mode
  useEffect(() => {
    setWidth(showDebugContext ? DEBUG_DEFAULT_WIDTH : DEFAULT_WIDTH);
  }, [showDebugContext]);

  // Reset to auto mode when execution starts
  useEffect(() => {
    if (isExecuting) {
      setViewMode('auto');
    }
  }, [isExecuting]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Check if a key looks like a secret
  const isSecretKey = (key: string): boolean => {
    const secretPatterns = /secret|password|token|api[_-]?key|auth|credential|private/i;
    return secretPatterns.test(key);
  };

  // Obfuscate secret values
  const obfuscateValue = (val: unknown): string => {
    if (typeof val === 'string' && val.length > 0) {
      if (val.length <= 4) return '****';
      return val.slice(0, 2) + '****' + val.slice(-2);
    }
    return '****';
  };

  // Format value preview with type detection
  const formatValue = (val: unknown, key?: string): { text: string; color: string; isSecret?: boolean } => {
    // Check if this is a secret value by key name
    if (key && isSecretKey(key)) {
      return { text: obfuscateValue(val), color: '#f59e0b', isSecret: true };
    }
    if (val === null) return { text: 'null', color: '#f97583' };
    if (val === undefined) return { text: 'undefined', color: '#6e7681' };
    if (typeof val === 'string') return { text: `"${val.length > 20 ? val.slice(0, 20) + '...' : val}"`, color: '#a5d6ff' };
    if (typeof val === 'number') return { text: String(val), color: '#79c0ff' };
    if (typeof val === 'boolean') return { text: String(val), color: '#ff7b72' };
    if (Array.isArray(val)) return { text: `Array(${val.length})`, color: '#d2a8ff' };
    if (typeof val === 'object') return { text: `{...}`, color: '#ffa657' };
    return { text: String(val), color: '#8b949e' };
  };

  // Render expandable object/array
  const renderValue = (val: unknown, path: string, depth: number = 0, key?: string): React.ReactNode => {
    const { text, color, isSecret } = formatValue(val, key);
    const isExpandable = val !== null && typeof val === 'object' && !isSecret;
    const isExpanded = expandedPaths.has(path);
    
    if (!isExpandable || depth > 3) {
      return (
        <span style={{ color, fontSize: 9 }}>
          {text}
          {isSecret && <span style={{ color: '#6e7681', marginLeft: 4 }}>🔒</span>}
        </span>
      );
    }

    const entries = Array.isArray(val) 
      ? val.map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(val as Record<string, unknown>);

    return (
      <div>
        <span
          onClick={(e) => { e.stopPropagation(); togglePath(path); }}
          style={{ color, fontSize: 9, cursor: 'pointer' }}
        >
          {isExpanded ? '▼' : '▶'} {text}
        </span>
        {isExpanded && (
          <div style={{ marginLeft: 10, borderLeft: '1px solid #30363d', paddingLeft: 6 }}>
            {entries.slice(0, 20).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <span style={{ color: '#7ee787', fontSize: 9 }}>{k}:</span>
                {renderValue(v, `${path}.${k}`, depth + 1, k)}
              </div>
            ))}
            {entries.length > 20 && (
              <div style={{ color: '#6e7681', fontSize: 8, fontStyle: 'italic' }}>
                ... {entries.length - 20} more
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Get inputs for specified node from incoming connections
  const getNodeInputs = (nodeId: string | null): Record<string, unknown> => {
    if (!nodeId) return {};
    const incomingConns = conns.filter(c => c.to === nodeId);
    const inputs: Record<string, unknown> = {};
    
    incomingConns.forEach(conn => {
      const sourceNode = nodes.find(n => n.id === conn.from);
      if (sourceNode) {
        // Try different key patterns used in the executor
        const nodeOutput = 
          execCtx[`_node_${sourceNode.id}_result`] || 
          execCtx[`node_${sourceNode.id}`] || 
          execCtx[sourceNode.id] ||
          execCtx[sourceNode.label || ''];
        inputs[sourceNode.label || sourceNode.type] = nodeOutput;
      }
    });
    
    return inputs;
  };

  // Filter out internal/secret keys from context display
  const getFilteredContext = (): Record<string, unknown> => {
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(execCtx)) {
      // Skip internal keys and secrets
      if (key === '_secrets' || key.startsWith('_internal')) continue;
      filtered[key] = val;
    }
    return filtered;
  };

  // Section header component
  const SectionHeader = ({ title, section, icon }: { title: string; section: string; icon: string }) => (
    <div
      onClick={() => toggleSection(section)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        padding: '4px 0',
        borderBottom: '1px solid #21262d',
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 8, color: '#8b949e' }}>{expandedSections[section] ? '▼' : '▶'}</span>
      <span style={{ fontSize: 10, color: '#58a6ff' }}>{icon}</span>
      <span style={{ fontSize: 9, color: '#c9d1d9', letterSpacing: 1 }}>{title}</span>
    </div>
  );
  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('type', type);
  };

  const handleClick = (type: NodeType) => {
    addNode(type, 240 - off.x + Math.random() * 60, 200 - off.y + Math.random() * 80);
  };

  // Use displayNodeId for inspected/active node
  const displayedNode = displayNodeId ? nodes.find(n => n.id === displayNodeId) : null;
  const nodeInputs = getNodeInputs(displayNodeId);

  // Get list of executed nodes for inspection
  // In replay mode, derive from the saved run's data (immutable); otherwise from current execCtx
  const executedNodes = React.useMemo(() => {
    if (replayingRun) {
      // Collect all node IDs that appear in the run's data
      const executedIds = new Set<string>();
      
      // From nodeContexts
      if (replayingRun.nodeContexts) {
        Object.keys(replayingRun.nodeContexts).forEach(id => executedIds.add(id));
      }
      
      // From nodePerf
      if (replayingRun.nodePerf) {
        Object.keys(replayingRun.nodePerf).forEach(id => executedIds.add(id));
      }
      
      // From log entries (for older runs or error nodes)
      if (replayingRun.log) {
        replayingRun.log.forEach(entry => {
          if (entry.nodeId && (entry.level === 'success' || entry.level === 'error')) {
            executedIds.add(entry.nodeId);
          }
        });
      }
      
      return nodes.filter(n => executedIds.has(n.id));
    }
    
    // Live execution: filter from current context
    return nodes.filter(n => execCtx[`_node_${n.id}_result`] !== undefined);
  }, [replayingRun, nodes, execCtx]);

  // Resize handle component
  const ResizeHandle = () => (
    <div
      onMouseDown={startResize}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 5,
        cursor: 'ew-resize',
        background: isResizing ? '#388bfd' : 'transparent',
        transition: 'background 0.15s',
        zIndex: 10,
      }}
      onMouseEnter={(e) => !isResizing && (e.currentTarget.style.background = '#388bfd44')}
      onMouseLeave={(e) => !isResizing && (e.currentTarget.style.background = 'transparent')}
    />
  );

  // View toggle tabs component
  const ViewToggle = () => (
    <div style={{
      display: 'flex',
      gap: 2,
      marginBottom: 8,
      background: '#0d1117',
      borderRadius: 4,
      padding: 2,
    }}>
      <button
        onClick={() => setViewMode(showDebugContext ? 'nodes' : 'auto')}
        style={{
          flex: 1,
          padding: '4px 8px',
          fontSize: 8,
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          background: !showDebugContext ? '#21262d' : 'transparent',
          color: !showDebugContext ? '#e6edf3' : '#6e7681',
          transition: 'all 0.15s',
        }}
      >
        📦 NODES
      </button>
      <button
        onClick={() => setViewMode(showDebugContext ? 'auto' : 'debug')}
        style={{
          flex: 1,
          padding: '4px 8px',
          fontSize: 8,
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          background: showDebugContext ? '#21262d' : 'transparent',
          color: showDebugContext ? '#e6edf3' : '#6e7681',
          transition: 'all 0.15s',
        }}
        disabled={!debugMode && Object.keys(execCtx).length === 0}
        title={!debugMode && Object.keys(execCtx).length === 0 ? 'No debug context available' : ''}
      >
        🔍 DEBUG
      </button>
    </div>
  );

  // Debug Context View
  if (showDebugContext) {
    return (
      <div
        style={{
          width,
          background: '#161b22',
          borderRight: '1px solid #30363d',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
        }}
      >
        <ResizeHandle />
        <div style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        <ViewToggle />
        <div style={{ 
          fontSize: 9, 
          color: '#58a6ff', 
          marginBottom: 10, 
          letterSpacing: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ color: '#f0883e' }}>⚡</span>
          DEBUG CONTEXT
          {replayingRun && (
            <span style={{ 
              fontSize: 8, 
              color: '#3b82f6', 
              background: '#1a1a2e', 
              padding: '2px 6px', 
              borderRadius: 3,
              marginLeft: 4,
            }}>
              REPLAY
            </span>
          )}
        </div>

        {/* Active Node Info - show node context source in replay */}
        {displayedNode && (
          <div style={{
            background: '#21262d',
            borderRadius: 4,
            padding: 6,
            marginBottom: 10,
            border: `1px solid ${replayingRun ? '#3b82f644' : '#f0883e44'}`,
          }}>
            <div style={{ fontSize: 8, color: '#8b949e', marginBottom: 2 }}>
              {replayingRun ? 'NODE CONTEXT SNAPSHOT' : 'INSPECTING NODE'}
            </div>
            <div style={{ fontSize: 10, color: replayingRun ? '#3b82f6' : '#f0883e', fontWeight: 'bold' }}>
              {displayedNode.label || displayedNode.type}
            </div>
            <div style={{ fontSize: 8, color: '#6e7681' }}>{displayedNode.type}</div>
          </div>
        )}

        {/* Executed Nodes List - when paused, allow clicking to inspect */}
        {isPaused && executedNodes.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <SectionHeader title="EXECUTED NODES" section="nodeList" icon="📋" />
            {expandedSections.nodeList && (
              <div style={{ paddingLeft: 4 }}>
                {executedNodes.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => onNodeInspect?.(n.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 6px',
                      marginBottom: 3,
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: n.id === displayNodeId ? '#21262d' : 'transparent',
                      border: n.id === displayNodeId ? '1px solid #f0883e44' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (n.id !== displayNodeId) {
                        e.currentTarget.style.background = '#161b22';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (n.id !== displayNodeId) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span style={{ color: '#10b981', fontSize: 8 }}>✓</span>
                    <span style={{ 
                      fontSize: 9, 
                      color: n.id === displayNodeId ? '#f0883e' : '#8b949e',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {n.label || n.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Node Inputs Section */}
        <div style={{ marginBottom: 10 }}>
          <SectionHeader title="NODE INPUTS" section="nodeInputs" icon="↓" />
          {expandedSections.nodeInputs && (
            <div style={{ paddingLeft: 4 }}>
              {Object.keys(nodeInputs).length > 0 ? (
                Object.entries(nodeInputs).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 9, color: '#7ee787' }}>{key}:</div>
                    <div style={{ paddingLeft: 8 }}>{renderValue(val, `input.${key}`, 0, key)}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 8, color: '#6e7681', fontStyle: 'italic' }}>
                  No inputs (start node)
                </div>
              )}
            </div>
          )}
        </div>

        {/* Node Properties Section */}
        {displayedNode && (
          <div style={{ marginBottom: 10 }}>
            <SectionHeader title="NODE CONFIG" section="nodeProps" icon="⚙" />
            {expandedSections.nodeProps && (
              <div style={{ paddingLeft: 4 }}>
                {Object.entries(displayedNode.config || {}).filter(([_, v]) => v !== undefined && v !== '').map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 9, color: '#d2a8ff' }}>{key}:</div>
                    <div style={{ paddingLeft: 8 }}>{renderValue(val, `config.${key}`, 0, key)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global Context Section */}
        {(() => {
          const filteredCtx = getFilteredContext();
          return (
        <div style={{ marginBottom: 10 }}>
          <SectionHeader title="GLOBAL CONTEXT" section="globalCtx" icon="🌐" />
          {expandedSections.globalCtx && (
            <div style={{ paddingLeft: 4 }}>
              {Object.keys(filteredCtx).length > 0 ? (
                Object.entries(filteredCtx).slice(0, 30).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 9, color: '#79c0ff' }}>{key}:</div>
                    <div style={{ paddingLeft: 8 }}>{renderValue(val, `ctx.${key}`, 0, key)}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 8, color: '#6e7681', fontStyle: 'italic' }}>
                  Context is empty
                </div>
              )}
              {Object.keys(filteredCtx).length > 30 && (
                <div style={{ fontSize: 8, color: '#6e7681', fontStyle: 'italic' }}>
                  ... {Object.keys(filteredCtx).length - 30} more entries
                </div>
              )}
            </div>
          )}
        </div>
          );
        })()}

        {/* Breakpoints Section */}
        {breakpts.size > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid #30363d', paddingTop: 10 }}>
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
                      color: n.id === activeNid ? '#f0883e' : '#f59e0b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 140,
                      fontWeight: n.id === activeNid ? 'bold' : 'normal',
                    }}
                  >
                    {n.id === activeNid ? '●' : '○'} {n.label}
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
      </div>
    );
  }

  // Normal Node Palette View
  return (
    <div
      style={{
        width,
        background: '#161b22',
        borderRight: '1px solid #30363d',
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
      }}
    >
      <ResizeHandle />
      <div style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
      {/* Show toggle only when there's debug context or debug mode is on */}
      {(debugMode || Object.keys(execCtx).length > 0) && <ViewToggle />}
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
            gap: 6,
            padding: '6px 8px',
            marginBottom: 4,
            borderRadius: 5,
            cursor: 'grab',
            background: '#0d1117',
            border: `1px solid ${t.color}28`,
          }}
        >
          {/* Drag handle */}
          <span
            style={{
              color: '#484f58',
              fontSize: 10,
              cursor: 'grab',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 0.5,
              opacity: 0.7,
            }}
            title="Drag to canvas"
          >
            ⋮⋮
          </span>
          <span style={{ color: t.color, fontSize: 13 }}>{ICONS[type]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: t.color, fontWeight: 'bold' }}>{t.label}</div>
            <div style={{ fontSize: 8, color: '#484f58', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{DESCRIPTIONS[type]}</div>
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
    </div>
  );
};
