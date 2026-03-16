import React, { useState, useMemo } from 'react';
import {
  WorkflowNode,
  SimState,
  NodeStatus,
  LogEntry,
  StackFrame,
  ExecutionContext,
  WatchItem,
  ExecutionRun,
  Breakpoint,
} from '../types';
import { TYPES, ICONS, STATUS_COLORS, LOG_COLORS, LOG_ICONS, BUTTON_STYLE, INPUT_STYLE } from '../constants';

type DebugTab = 'log' | 'context' | 'watch' | 'stack' | 'nodes' | 'history' | 'perf';

interface DebugPanelProps {
  nodes: WorkflowNode[];
  simState: SimState;
  simNodes: Record<string, NodeStatus>;
  activeNid: string | null;
  execCtx: ExecutionContext;
  execLog: LogEntry[];
  callStack: StackFrame[];
  breakpts: Set<string>;
  conditionalBreakpoints: Map<string, Breakpoint>;
  debugMode: boolean;
  watchItems: WatchItem[];
  executionHistory: ExecutionRun[];
  toggleBP: (id: string) => void;
  setConditionalBP: (nodeId: string, condition: string) => void;
  removeConditionalBP: (nodeId: string) => void;
  addWatch: (expression: string) => void;
  removeWatch: (id: string) => void;
  replayRun: (runId: string) => void;
  clearLog: () => void;
  setSel: (id: string | null) => void;
  replayingRun?: ExecutionRun | null;
  stopReplay?: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  nodes,
  simState,
  simNodes,
  activeNid,
  execCtx,
  execLog,
  callStack,
  breakpts,
  conditionalBreakpoints,
  debugMode,
  watchItems,
  executionHistory,
  toggleBP,
  setConditionalBP,
  removeConditionalBP,
  addWatch,
  removeWatch,
  replayRun,
  clearLog,
  setSel,
  replayingRun,
  stopReplay,
}) => {
  const [dbgTab, setDbgTab] = useState<DebugTab>('log');
  const [newWatchExpr, setNewWatchExpr] = useState('');
  const [editingBP, setEditingBP] = useState<string | null>(null);
  const [bpCondition, setBpCondition] = useState('');
  const [expandedWatches, setExpandedWatches] = useState<Set<string>>(new Set());

  const tabs: [DebugTab, string][] = [
    ['log', 'LOG'],
    ['context', 'CTX'],
    ['watch', 'WATCH'],
    ['stack', 'STACK'],
    ['nodes', 'NODES'],
    ['history', 'RUNS'],
    ['perf', 'PERF'],
  ];

  // Calculate flame chart data from node statuses
  const flameChartData = useMemo(() => {
    const data: Array<{ node: WorkflowNode; status: NodeStatus; startPercent: number; widthPercent: number }> = [];
    const executed = Object.entries(simNodes).filter(([_, st]) => st.duration != null);
    if (executed.length === 0) return data;

    const totalDuration = executed.reduce((sum, [_, st]) => sum + (st.duration || 0), 0);
    if (totalDuration === 0) return data;

    let cumulative = 0;
    executed.forEach(([id, status]) => {
      const node = nodes.find((n) => n.id === id);
      if (!node || !status.duration) return;
      data.push({
        node,
        status,
        startPercent: (cumulative / totalDuration) * 100,
        widthPercent: (status.duration / totalDuration) * 100,
      });
      cumulative += status.duration;
    });

    return data;
  }, [simNodes, nodes]);

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

  // Filter out internal/secret keys from context display
  const getFilteredContext = (): Record<string, unknown> => {
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(execCtx)) {
      if (key === '_secrets' || key.startsWith('_internal')) continue;
      filtered[key] = val;
    }
    return filtered;
  };

  // Evaluate watch expressions with nested path and expression support
  const evaluateExpression = (expr: string, ctx: Record<string, unknown>): unknown => {
    // First try as a simple key
    if (expr in ctx) {
      return ctx[expr];
    }
    
    // Try as a nested path (e.g., response.body.length)
    if (expr.includes('.')) {
      const parts = expr.split('.');
      let value: unknown = ctx;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[part];
        } else {
          // Path not found, try as expression
          break;
        }
      }
      if (value !== ctx) {
        return value;
      }
    }
    
    // Try as JavaScript expression
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('ctx', `with(ctx) { return (${expr}); }`);
      return fn(ctx);
    } catch {
      return undefined;
    }
  };

  const formatValuePreview = (value: unknown): { preview: string; type: string; expandable: boolean } => {
    if (value === undefined) return { preview: 'undefined', type: 'undefined', expandable: false };
    if (value === null) return { preview: 'null', type: 'null', expandable: false };
    
    const type = Array.isArray(value) ? 'array' : typeof value;
    
    if (type === 'array') {
      const arr = value as unknown[];
      return { 
        preview: `Array(${arr.length})`, 
        type: 'array', 
        expandable: arr.length > 0 
      };
    }
    
    if (type === 'object') {
      const keys = Object.keys(value as object);
      return { 
        preview: `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`, 
        type: 'object', 
        expandable: keys.length > 0 
      };
    }
    
    if (type === 'string') {
      const str = value as string;
      const truncated = str.length > 50 ? str.substring(0, 50) + '...' : str;
      return { preview: `"${truncated}"`, type: 'string', expandable: str.length > 50 };
    }
    
    if (type === 'number' || type === 'boolean') {
      return { preview: String(value), type, expandable: false };
    }
    
    return { preview: String(value), type, expandable: false };
  };

  const evaluatedWatches = useMemo(() => {
    return watchItems.map((w) => {
      try {
        const rawValue = evaluateExpression(w.expression, execCtx);
        const formatted = formatValuePreview(rawValue);
        return { 
          ...w, 
          rawValue,
          preview: formatted.preview, 
          valueType: formatted.type,
          expandable: formatted.expandable,
          error: false 
        };
      } catch {
        return { 
          ...w, 
          rawValue: undefined,
          preview: 'error', 
          valueType: 'error',
          expandable: false,
          error: true 
        };
      }
    });
  }, [watchItems, execCtx]);

  return (
    <div
      style={{
        height: 248,
        background: '#0d1117',
        borderTop: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Replay Mode Banner */}
      {replayingRun && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1a1a2e',
            borderBottom: '1px solid #3b82f6',
            padding: '6px 12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>🔄</span>
            <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 'bold' }}>REPLAY MODE</span>
            <span style={{ fontSize: 10, color: '#8b949e' }}>
              {replayingRun.workflowName} • {new Date(replayingRun.timestamp).toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                background: replayingRun.status === 'success' ? '#10b98122' : '#f8514922',
                color: replayingRun.status === 'success' ? '#10b981' : '#f85149',
              }}
            >
              {replayingRun.status.toUpperCase()}
            </span>
          </div>
          <button
            onClick={stopReplay}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#f85149',
              fontSize: 10,
              padding: '3px 10px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ✕ Exit Replay
          </button>
        </div>
      )}
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #21262d',
          padding: '0 10px',
          flexShrink: 0,
        }}
      >
        {tabs.map(([tab, lbl]) => (
          <button
            key={tab}
            onClick={() => setDbgTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${dbgTab === tab ? '#3b82f6' : 'transparent'}`,
              color: dbgTab === tab ? '#e6edf3' : '#484f58',
              fontFamily: 'monospace',
              fontSize: 10,
              padding: '6px 10px',
              cursor: 'pointer',
              letterSpacing: 1,
            }}
          >
            {lbl}
            {tab === 'log' && execLog.length > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  background: '#21262d',
                  borderRadius: 8,
                  padding: '1px 5px',
                  fontSize: 9,
                  color: '#8b949e',
                }}
              >
                {execLog.length}
              </span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {simState === 'paused' && (
          <span style={{ fontSize: 9, color: '#f59e0b', marginRight: 8 }}>⏸ PAUSED</span>
        )}
        <button onClick={clearLog} style={{ ...BUTTON_STYLE, fontSize: 9, padding: '2px 8px' }}>
          Clear
        </button>
      </div>

      {/* LOG Tab */}
      {dbgTab === 'log' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {execLog.length === 0 && (
            <span style={{ fontSize: 10, color: '#484f58', marginTop: 8 }}>No log yet. Press RUN.</span>
          )}
          {execLog.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 9, color: '#484f58', flexShrink: 0, minWidth: 82, paddingTop: 1 }}>
                {e.ts}
              </span>
              <span style={{ fontSize: 10, color: LOG_COLORS[e.level] || '#8b949e', flexShrink: 0 }}>
                {LOG_ICONS[e.level]}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: LOG_COLORS[e.level] || '#8b949e',
                  flex: 1,
                  wordBreak: 'break-all',
                }}
              >
                {e.msg}
              </span>
              {e.nodeId && (
                <span
                  style={{
                    fontSize: 8,
                    color: '#484f58',
                    flexShrink: 0,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseDown={(ev) => {
                    ev.stopPropagation();
                    setSel(e.nodeId);
                  }}
                >
                  [{nodes.find((n) => n.id === e.nodeId)?.label || e.nodeId}]
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CONTEXT Tab */}
      {dbgTab === 'context' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 5 }}>
            {Object.entries(getFilteredContext()).map(([k, v]) => {
              const isSecret = isSecretKey(k);
              const displayValue = isSecret ? obfuscateValue(v) : String(v);
              return (
              <div
                key={k}
                style={{
                  background: '#161b22',
                  border: `1px solid ${isSecret ? '#f59e0b33' : '#21262d'}`,
                  borderRadius: 4,
                  padding: '5px 8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: k.startsWith('_') ? '#6e7681' : '#484f58',
                    fontStyle: k.startsWith('_') ? 'italic' : 'normal',
                    flexShrink: 0,
                    minWidth: 90,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {k}
                  {isSecret && <span title="Secret value (obfuscated)">🔒</span>}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: isSecret
                      ? '#f59e0b'
                      : typeof v === 'boolean'
                        ? v
                          ? '#10b981'
                          : '#f85149'
                        : typeof v === 'number'
                        ? '#f59e0b'
                        : k.startsWith('_')
                        ? '#22d3ee'
                        : '#e6edf3',
                    textAlign: 'right',
                    wordBreak: 'break-all',
                    maxWidth: 160,
                  }}
                >
                  {displayValue}
                </span>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CALL STACK Tab */}
      {dbgTab === 'stack' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {callStack.length === 0 && (
            <span style={{ fontSize: 10, color: '#484f58' }}>Call stack is empty.</span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...callStack].reverse().map((f, i) => (
              <div
                key={f.id + f.entered}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#161b22',
                  border: `1px solid ${i === 0 ? '#3b82f644' : '#21262d'}`,
                  borderLeft: `3px solid ${i === 0 ? '#3b82f6' : TYPES[f.type].color}`,
                  borderRadius: 4,
                  padding: '5px 10px',
                }}
              >
                <span style={{ fontSize: 9, color: '#484f58', minWidth: 16 }}>#{callStack.length - i}</span>
                <span style={{ fontSize: 10, color: TYPES[f.type].color }}>{ICONS[f.type]}</span>
                <span style={{ fontSize: 11, color: '#e6edf3', flex: 1 }}>{f.label}</span>
                <span style={{ fontSize: 8, color: '#484f58' }}>{f.type}</span>
                <span style={{ fontSize: 8, color: '#484f58' }}>{f.entered}</span>
                {i === 0 && <span style={{ fontSize: 9, color: '#3b82f6' }}>← active</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NODE STATUS Tab */}
      {dbgTab === 'nodes' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21262d' }}>
                {['Node', 'Type', 'Status', 'Duration', 'BP'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '4px 12px',
                      color: '#484f58',
                      fontWeight: 'normal',
                      textAlign: 'left',
                      fontSize: 9,
                      letterSpacing: 1,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => {
                const ns = simNodes[n.id];
                const status = ns?.status || 'pending';
                const isBP = breakpts.has(n.id);
                return (
                  <tr
                    key={n.id}
                    style={{
                      borderBottom: '1px solid #161b22',
                      background: n.id === activeNid ? '#0a1a0a' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSel(n.id);
                    }}
                  >
                    <td style={{ padding: '4px 12px', color: '#e6edf3' }}>{n.label}</td>
                    <td style={{ padding: '4px 12px', color: TYPES[n.type].color }}>{TYPES[n.type].label}</td>
                    <td style={{ padding: '4px 12px' }}>
                      <span style={{ color: STATUS_COLORS[status] || '#484f58', fontSize: 9 }}>
                        {status === 'running'
                          ? '▶ running'
                          : status === 'done'
                          ? '✓ done'
                          : status === 'paused'
                          ? '⏸ paused'
                          : status === 'error'
                          ? '✕ error'
                          : '· pending'}
                      </span>
                    </td>
                    <td style={{ padding: '4px 12px', color: ns?.duration ? '#10b981' : '#484f58' }}>
                      {ns?.duration ? `${ns.duration}ms` : '—'}
                    </td>
                    <td style={{ padding: '4px 12px' }}>
                      {debugMode ? (
                        <button
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            toggleBP(n.id);
                          }}
                          style={{
                            background: isBP ? '#1a130a' : 'transparent',
                            border: `1px solid ${isBP ? '#f59e0b44' : '#30363d'}`,
                            color: isBP ? '#f59e0b' : '#484f58',
                            fontFamily: 'monospace',
                            fontSize: 9,
                            padding: '2px 6px',
                            borderRadius: 3,
                            cursor: 'pointer',
                          }}
                        >
                          {isBP ? '⬡' : '○'}
                        </button>
                      ) : (
                        <span style={{ color: '#484f58', fontSize: 9 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* WATCH Tab */}
      {dbgTab === 'watch' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {/* Add watch input */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={newWatchExpr}
              onChange={(e) => setNewWatchExpr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newWatchExpr.trim()) {
                  addWatch(newWatchExpr.trim());
                  setNewWatchExpr('');
                }
              }}
              placeholder="e.g., response.body.length, users.length > 0"
              style={{ ...INPUT_STYLE, flex: 1, fontSize: 10 }}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => {
                if (newWatchExpr.trim()) {
                  addWatch(newWatchExpr.trim());
                  setNewWatchExpr('');
                }
              }}
              style={{ ...BUTTON_STYLE, fontSize: 9, padding: '3px 8px' }}
            >
              + Add
            </button>
          </div>

          {/* Watch items */}
          {evaluatedWatches.length === 0 && (
            <span style={{ fontSize: 10, color: '#484f58' }}>No watched expressions. Add one above.</span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {evaluatedWatches.map((w) => {
              const isExpanded = expandedWatches.has(w.id);
              const typeColors: Record<string, string> = {
                string: '#a5d6ff',
                number: '#79c0ff',
                boolean: '#ff7b72',
                array: '#ffa657',
                object: '#d2a8ff',
                undefined: '#484f58',
                null: '#484f58',
                error: '#f85149',
              };
              
              return (
                <div
                  key={w.id}
                  style={{
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 8px',
                    }}
                  >
                    {/* Expand toggle */}
                    {w.expandable ? (
                      <button
                        onClick={() => {
                          setExpandedWatches(prev => {
                            const next = new Set(prev);
                            if (next.has(w.id)) {
                              next.delete(w.id);
                            } else {
                              next.add(w.id);
                            }
                            return next;
                          });
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#8b949e',
                          cursor: 'pointer',
                          fontSize: 8,
                          padding: 0,
                          width: 12,
                        }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    ) : (
                      <span style={{ width: 12 }} />
                    )}
                    
                    {/* Expression */}
                    <span style={{ fontSize: 10, color: '#58a6ff', flex: 1 }}>{w.expression}</span>
                    
                    {/* Type badge */}
                    <span style={{ 
                      fontSize: 8, 
                      color: typeColors[w.valueType] || '#8b949e',
                      background: '#21262d',
                      padding: '1px 4px',
                      borderRadius: 2,
                    }}>
                      {w.valueType}
                    </span>
                    
                    {/* Preview */}
                    <span
                      style={{
                        fontSize: 10,
                        color: w.error ? '#f85149' : typeColors[w.valueType] || '#10b981',
                        fontFamily: 'monospace',
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={w.preview}
                    >
                      {w.preview}
                    </span>
                    
                    {/* Remove button */}
                    <button
                      onClick={() => removeWatch(w.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#484f58',
                        cursor: 'pointer',
                        fontSize: 10,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Expanded content */}
                  {isExpanded && w.rawValue !== undefined && (
                    <div
                      style={{
                        borderTop: '1px solid #21262d',
                        padding: '6px 8px 6px 28px',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: '#e6edf3',
                        maxHeight: 150,
                        overflowY: 'auto',
                        background: '#0d1117',
                      }}
                    >
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(w.rawValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HISTORY Tab */}
      {dbgTab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {executionHistory.length === 0 && (
            <span style={{ fontSize: 10, color: '#484f58' }}>No execution history yet. Run the workflow.</span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {executionHistory.map((run) => (
              <div
                key={run.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: 4,
                  padding: '6px 10px',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: run.status === 'success' ? '#10b981' : run.status === 'error' ? '#f85149' : '#f59e0b',
                  }}
                >
                  {run.status === 'success' ? '✓' : run.status === 'error' ? '✕' : '?'}
                </span>
                <span style={{ fontSize: 9, color: '#484f58', minWidth: 120 }}>{run.startedAt}</span>
                <span style={{ fontSize: 10, color: '#e6edf3', flex: 1 }}>
                  {run.nodesExecuted} nodes
                </span>
                <span style={{ fontSize: 9, color: '#10b981' }}>{run.duration}ms</span>
                <button
                  onClick={() => replayRun(run.id)}
                  style={{ ...BUTTON_STYLE, fontSize: 8, padding: '2px 6px' }}
                >
                  Replay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PERF (Flame Chart) Tab */}
      {dbgTab === 'perf' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {flameChartData.length === 0 && (
            <span style={{ fontSize: 10, color: '#484f58' }}>No execution data. Run the workflow first.</span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Timeline bar */}
            <div
              style={{
                height: 24,
                background: '#0d1117',
                border: '1px solid #21262d',
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {flameChartData.map(({ node, status, startPercent, widthPercent }) => (
                <div
                  key={node.id}
                  title={`${node.label}: ${status.duration}ms`}
                  onClick={() => setSel(node.id)}
                  style={{
                    position: 'absolute',
                    left: `${startPercent}%`,
                    width: `${Math.max(widthPercent, 1)}%`,
                    top: 2,
                    bottom: 2,
                    background: TYPES[node.type]?.color || '#8b949e',
                    borderRadius: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      color: '#000',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      padding: '0 2px',
                    }}
                  >
                    {widthPercent > 10 ? node.label : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Duration breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 }}>
              {flameChartData.map(({ node, status, widthPercent }) => (
                <div
                  key={node.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: 4,
                    padding: '4px 8px',
                  }}
                >
                  <span style={{ color: TYPES[node.type]?.color, fontSize: 10 }}>{ICONS[node.type]}</span>
                  <span style={{ fontSize: 9, color: '#e6edf3', flex: 1 }}>{node.label}</span>
                  <span style={{ fontSize: 9, color: '#10b981' }}>{status.duration}ms</span>
                  <span style={{ fontSize: 8, color: '#484f58' }}>{widthPercent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conditional Breakpoints */}
      {debugMode && editingBP && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#161b22',
            border: '1px solid #f59e0b44',
            borderRadius: 6,
            padding: 12,
            zIndex: 1000,
            width: 280,
          }}
        >
          <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 8 }}>
            Conditional Breakpoint: {nodes.find((n) => n.id === editingBP)?.label}
          </div>
          <input
            value={bpCondition}
            onChange={(e) => setBpCondition(e.target.value)}
            placeholder="e.g., amount > 1000"
            style={{ ...INPUT_STYLE, width: '100%', marginBottom: 8 }}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setEditingBP(null);
                setBpCondition('');
              }}
              style={{ ...BUTTON_STYLE, fontSize: 9 }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (bpCondition.trim()) {
                  setConditionalBP(editingBP, bpCondition.trim());
                } else {
                  removeConditionalBP(editingBP);
                }
                setEditingBP(null);
                setBpCondition('');
              }}
              style={{ ...BUTTON_STYLE, fontSize: 9, background: '#f59e0b22', borderColor: '#f59e0b44' }}
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
