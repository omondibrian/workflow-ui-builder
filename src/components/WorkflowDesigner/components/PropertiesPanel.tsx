import React from 'react';
import { WorkflowNode, Connection, NodeStatus, HttpHeader } from '../types';
import {
  TYPES,
  ICONS,
  INPUT_STYLE,
  SELECT_STYLE,
  STATUS_COLORS,
  TRIGGER_TYPES,
  ACTION_TYPES,
  HTTP_METHODS,
  SCRIPT_LANGUAGES,
  CRON_PRESETS,
} from '../constants';

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: 'vertical',
  minHeight: 60,
};

interface PropertiesPanelProps {
  selectedNode: WorkflowNode;
  nodes: WorkflowNode[];
  conns: Connection[];
  simNodes: Record<string, NodeStatus>;
  debugMode: boolean;
  breakpts: Set<string>;
  toggleBP: (id: string) => void;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  delNode: (id: string) => void;
  delConn: (id: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  nodes,
  conns,
  simNodes,
  debugMode,
  breakpts,
  toggleBP,
  setNodes,
  delNode,
  delConn,
}) => {
  const nodeType = TYPES[selectedNode.type];
  const nodeConnections = conns.filter((c) => c.from === selectedNode.id || c.to === selectedNode.id);
  const nodeStatus = simNodes[selectedNode.id];
  const isBP = breakpts.has(selectedNode.id);

  const updateConfig = (key: string, value: string | number) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedNode.id ? { ...n, config: { ...n.config, [key]: value } } : n
      )
    );
  };

  const updateLabel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === selectedNode.id ? { ...n, label: e.target.value } : n))
    );
  };

  return (
    <div
      style={{
        width: 210,
        background: '#161b22',
        borderLeft: '1px solid #30363d',
        padding: 12,
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 9, color: '#484f58', marginBottom: 12, letterSpacing: 2 }}>PROPERTIES</div>

      {/* Type */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TYPE</div>
        <span style={{ color: nodeType.color, fontSize: 12 }}>
          {ICONS[selectedNode.type]} {nodeType.label}
        </span>
      </div>

      {/* Label */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>LABEL</div>
        <input
          value={selectedNode.label}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={updateLabel}
          style={INPUT_STYLE}
        />
      </div>

      {/* Decision condition */}
      {selectedNode.type === 'decision' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>CONDITION</div>
          <input
            placeholder="amount > 10000"
            onMouseDown={(e) => e.stopPropagation()}
            value={selectedNode.config?.condition || ''}
            onChange={(e) => updateConfig('condition', e.target.value)}
            style={INPUT_STYLE}
          />
          <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>Evaluates against execution context</div>
        </div>
      )}

      {/* Trigger type */}
      {selectedNode.type === 'trigger' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TRIGGER TYPE</div>
          <select
            value={selectedNode.config?.triggerType || TRIGGER_TYPES[0]}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => updateConfig('triggerType', e.target.value)}
            style={SELECT_STYLE}
          >
            {TRIGGER_TYPES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      )}

      {/* Task properties */}
      {selectedNode.type === 'task' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ACTION TYPE</div>
            <select
              value={selectedNode.config?.actionType || ACTION_TYPES[0]}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('actionType', e.target.value)}
              style={SELECT_STYLE}
            >
              {ACTION_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ENDPOINT</div>
            <input
              placeholder="https://..."
              value={selectedNode.config?.endpoint || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('endpoint', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            ⚠ Port 0: Success | Port 1: Error
          </div>
        </>
      )}

      {/* Loop properties */}
      {selectedNode.type === 'loop' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>LOOP COUNT</div>
            <input
              type="number"
              placeholder="3"
              value={selectedNode.config?.loopCount || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('loopCount', parseInt(e.target.value) || 0)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>EXIT CONDITION</div>
            <input
              placeholder="done === true"
              value={selectedNode.config?.exitCondition || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('exitCondition', e.target.value)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>
              Port 0: Body (loops) | Port 1: Exit
            </div>
          </div>
        </>
      )}

      {/* Delay properties */}
      {selectedNode.type === 'delay' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DELAY (ms)</div>
          <input
            type="number"
            placeholder="1000"
            value={selectedNode.config?.delayMs || ''}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => updateConfig('delayMs', parseInt(e.target.value) || 0)}
            style={INPUT_STYLE}
          />
        </div>
      )}

      {/* HTTP Request properties */}
      {selectedNode.type === 'http' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>METHOD</div>
            <select
              value={selectedNode.config?.httpMethod || 'GET'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpMethod', e.target.value)}
              style={SELECT_STYLE}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>URL</div>
            <input
              placeholder="https://api.example.com/endpoint"
              value={selectedNode.config?.httpUrl || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpUrl', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>HEADERS (JSON)</div>
            <textarea
              placeholder='{"Authorization": "Bearer token"}'
              value={selectedNode.config?.httpHeaders ? JSON.stringify(selectedNode.config.httpHeaders) : ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                try {
                  updateConfig('httpHeaders', JSON.parse(e.target.value || '[]'));
                } catch {
                  // Keep as is if invalid JSON
                }
              }}
              style={TEXTAREA_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BODY</div>
            <textarea
              placeholder='{"key": "value"}'
              value={selectedNode.config?.httpBody || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpBody', e.target.value)}
              style={TEXTAREA_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TIMEOUT (ms)</div>
            <input
              type="number"
              placeholder="30000"
              value={selectedNode.config?.httpTimeout || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpTimeout', parseInt(e.target.value) || 30000)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            ⚠ Port 0: Success | Port 1: Error
          </div>
        </>
      )}

      {/* Email properties */}
      {selectedNode.type === 'email' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TO</div>
            <input
              placeholder="recipient@example.com"
              value={selectedNode.config?.emailTo || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailTo', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>SUBJECT</div>
            <input
              placeholder="Email subject"
              value={selectedNode.config?.emailSubject || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailSubject', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BODY</div>
            <textarea
              placeholder="Email content..."
              value={selectedNode.config?.emailBody || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailBody', e.target.value)}
              style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>
              Use {`{{variable}}`} for dynamic values
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>FROM (optional)</div>
            <input
              placeholder="sender@example.com"
              value={selectedNode.config?.emailFrom || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailFrom', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            ⚠ Port 0: Sent | Port 1: Failed
          </div>
        </>
      )}

      {/* Script properties */}
      {selectedNode.type === 'script' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>LANGUAGE</div>
            <select
              value={selectedNode.config?.scriptLanguage || 'javascript'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scriptLanguage', e.target.value)}
              style={SELECT_STYLE}
            >
              {SCRIPT_LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>CODE</div>
            <textarea
              placeholder={selectedNode.config?.scriptLanguage === 'python' 
                ? '# Access context via ctx\nresult = ctx["amount"] * 1.1'
                : '// Access context via ctx\nreturn ctx.amount * 1.1;'}
              value={selectedNode.config?.scriptCode || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scriptCode', e.target.value)}
              style={{ ...TEXTAREA_STYLE, minHeight: 100, fontFamily: 'monospace', fontSize: 10 }}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>
              Use ctx to access execution context
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>OUTPUT VARIABLE</div>
            <input
              placeholder="result"
              value={selectedNode.config?.outputVariable || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('outputVariable', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            ⚠ Port 0: Success | Port 1: Error
          </div>
        </>
      )}

      {/* Transform properties */}
      {selectedNode.type === 'transform' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>EXPRESSION</div>
            <textarea
              placeholder="{ newField: ctx.oldField * 2 }"
              value={selectedNode.config?.transformExpression || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('transformExpression', e.target.value)}
              style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>
              JS expression. Return object to merge into context.
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>OUTPUT VARIABLE</div>
            <input
              placeholder="transformedData"
              value={selectedNode.config?.outputVariable || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('outputVariable', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
        </>
      )}

      {/* Webhook properties */}
      {selectedNode.type === 'webhook' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>PATH</div>
            <input
              placeholder="/api/webhook/order-created"
              value={selectedNode.config?.webhookPath || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('webhookPath', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>METHOD</div>
            <select
              value={selectedNode.config?.webhookMethod || 'POST'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('webhookMethod', e.target.value)}
              style={SELECT_STYLE}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>SECRET (optional)</div>
            <input
              type="password"
              placeholder="Webhook secret for validation"
              value={selectedNode.config?.webhookSecret || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('webhookSecret', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            Incoming payload available in ctx.webhook
          </div>
        </>
      )}

      {/* Schedule properties */}
      {selectedNode.type === 'schedule' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>PRESET</div>
            <select
              value=""
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (e.target.value) {
                  updateConfig('cronExpression', e.target.value);
                }
              }}
              style={SELECT_STYLE}
            >
              <option value="">Select preset...</option>
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>CRON EXPRESSION</div>
            <input
              placeholder="*/5 * * * *"
              value={selectedNode.config?.cronExpression || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('cronExpression', e.target.value)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>
              Format: minute hour day month weekday
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TIMEZONE</div>
            <select
              value={selectedNode.config?.timezone || 'UTC'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('timezone', e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="Asia/Shanghai">Asia/Shanghai</option>
              <option value="Australia/Sydney">Australia/Sydney</option>
            </select>
          </div>
        </>
      )}

      {/* Runtime status */}
      {nodeStatus && (
        <div
          style={{
            marginBottom: 10,
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: 4,
            padding: 8,
          }}
        >
          <div style={{ fontSize: 9, color: '#484f58', marginBottom: 5, letterSpacing: 1 }}>RUNTIME</div>
          <div
            style={{
              fontSize: 9,
              color: STATUS_COLORS[nodeStatus.status] || '#484f58',
              marginBottom: 3,
            }}
          >
            Status: {nodeStatus.status}
          </div>
          {nodeStatus.duration && (
            <div style={{ fontSize: 9, color: '#10b981' }}>Duration: {nodeStatus.duration}ms</div>
          )}
        </div>
      )}

      {/* Breakpoint toggle */}
      {debugMode && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#484f58', marginBottom: 5, letterSpacing: 1 }}>BREAKPOINT</div>
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              toggleBP(selectedNode.id);
            }}
            style={{
              width: '100%',
              background: isBP ? '#1a130a' : 'transparent',
              border: `1px solid ${isBP ? '#f59e0b44' : '#30363d'}`,
              color: isBP ? '#f59e0b' : '#8b949e',
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '5px 0',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {isBP ? '⬡ Remove Breakpoint' : '○ Set Breakpoint'}
          </button>
        </div>
      )}

      {/* Connections */}
      <div style={{ borderTop: '1px solid #21262d', paddingTop: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: '#484f58', marginBottom: 5, letterSpacing: 1 }}>CONNECTIONS</div>
        {nodeConnections.length === 0 ? (
          <div style={{ fontSize: 9, color: '#484f58' }}>None</div>
        ) : (
          nodeConnections.map((c) => {
            const other = nodes.find((n) => n.id === (c.from === selectedNode.id ? c.to : c.from));
            return (
              <div
                key={c.id}
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
                    color: '#8b949e',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 150,
                  }}
                >
                  {c.from === selectedNode.id ? '→' : '←'} {other?.label || '?'}
                  {c.label ? ` (${c.label})` : ''}
                </span>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    delConn(c.id);
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
            );
          })
        )}
      </div>

      {/* Delete button */}
      <button
        onMouseDown={(e) => {
          e.stopPropagation();
          delNode(selectedNode.id);
        }}
        style={{
          width: '100%',
          background: '#1a0808',
          border: '1px solid #f8514944',
          color: '#f85149',
          padding: '5px 0',
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        Delete Node
      </button>
    </div>
  );
};
