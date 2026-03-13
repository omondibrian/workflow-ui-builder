import React, { useState } from 'react';
import {
  WorkflowNode,
  SimState,
  NodeStatus,
  LogEntry,
  StackFrame,
  ExecutionContext,
} from '../types';
import { TYPES, ICONS, STATUS_COLORS, LOG_COLORS, LOG_ICONS, BUTTON_STYLE } from '../constants';

type DebugTab = 'log' | 'context' | 'stack' | 'nodes';

interface DebugPanelProps {
  nodes: WorkflowNode[];
  simState: SimState;
  simNodes: Record<string, NodeStatus>;
  activeNid: string | null;
  execCtx: ExecutionContext;
  execLog: LogEntry[];
  callStack: StackFrame[];
  breakpts: Set<string>;
  debugMode: boolean;
  toggleBP: (id: string) => void;
  clearLog: () => void;
  setSel: (id: string | null) => void;
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
  debugMode,
  toggleBP,
  clearLog,
  setSel,
}) => {
  const [dbgTab, setDbgTab] = useState<DebugTab>('log');

  const tabs: [DebugTab, string][] = [
    ['log', 'EXEC LOG'],
    ['context', 'CONTEXT'],
    ['stack', 'CALL STACK'],
    ['nodes', 'NODE STATUS'],
  ];

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
            {Object.entries(execCtx).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: '#161b22',
                  border: '1px solid #21262d',
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
                  }}
                >
                  {k}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color:
                      typeof v === 'boolean'
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
                  {String(v)}
                </span>
              </div>
            ))}
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
    </div>
  );
};
