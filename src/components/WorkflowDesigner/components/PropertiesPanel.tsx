import React, { useState, useCallback, useEffect, useRef } from 'react';
import { WorkflowNode, Connection, NodeStatus, WorkflowSecret } from '../types';
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
  AUTH_TYPES,
  RETRY_STRATEGIES,
  TIME_UNITS,
  ERROR_HANDLING_MODES,
  WEBHOOK_AUTH_TYPES,
  CONTENT_TYPES,
  TIMEZONES,
} from '../constants';
import { CodeEditor } from './CodeEditor';

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: 'vertical',
  minHeight: 60,
};

const MIN_WIDTH = 180;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 210;

// Debounced input component to prevent re-renders on every keystroke
const DebouncedInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}> = ({ value, onChange, type = 'text', placeholder, style }) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onChange(localValue);
  };

  return (
    <input
      type={type}
      value={localValue}
      placeholder={placeholder}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={handleChange}
      onBlur={handleBlur}
      style={style}
    />
  );
};

// Debounced textarea component
const DebouncedTextarea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}> = ({ value, onChange, placeholder, style }) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onChange(localValue);
  };

  return (
    <textarea
      value={localValue}
      placeholder={placeholder}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={handleChange}
      onBlur={handleBlur}
      style={style}
    />
  );
};

// System reserved words and context variables available for interpolation
interface SystemVariable {
  name: string;
  description: string;
  type: string;
  category: 'context' | 'secrets' | 'runtime' | 'node';
}

const SYSTEM_VARIABLES: SystemVariable[] = [
  // Runtime variables
  { name: 'currentIndex', description: 'Current iteration index in loops', type: 'number', category: 'runtime' },
  { name: 'totalItems', description: 'Total items in current collection', type: 'number', category: 'runtime' },
  { name: 'startTime', description: 'Workflow execution start time', type: 'string', category: 'runtime' },
  { name: 'environment', description: 'Current environment (development/production)', type: 'string', category: 'runtime' },
  
  // Node result variables
  { name: 'result', description: 'Result from previous node', type: 'any', category: 'node' },
  { name: 'response', description: 'HTTP response from API calls', type: 'object', category: 'node' },
  { name: 'response.status', description: 'HTTP response status code', type: 'number', category: 'node' },
  { name: 'response.body', description: 'HTTP response body', type: 'object', category: 'node' },
  { name: 'response.headers', description: 'HTTP response headers', type: 'object', category: 'node' },
  { name: 'data', description: 'Data from transform or script node', type: 'any', category: 'node' },
  { name: 'items', description: 'Items array for iteration', type: 'array', category: 'node' },
  { name: 'item', description: 'Current item in iteration', type: 'any', category: 'node' },
  
  // Context variables
  { name: 'workflowName', description: 'Name of the current workflow', type: 'string', category: 'context' },
  { name: 'workflowVersion', description: 'Version of the workflow', type: 'string', category: 'context' },
  { name: 'executionId', description: 'Unique execution identifier', type: 'string', category: 'context' },
];

// Autocomplete input with suggestions for system variables and secrets
const AutocompleteInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  secrets: WorkflowSecret[];
  type?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}> = ({ value, onChange, secrets, type = 'text', placeholder, style, multiline = false }) => {
  const [localValue, setLocalValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ text: string; label: string; description: string; category: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const generateSuggestions = useCallback((text: string, cursor: number) => {
    // Find the pattern before cursor: look for {{ that hasn't been closed
    const beforeCursor = text.substring(0, cursor);
    
    // Check if we're inside a {{ ... pattern (not closed yet)
    const openBraces = beforeCursor.lastIndexOf('{{');
    const closeBraces = beforeCursor.lastIndexOf('}}');
    
    // Only show suggestions if {{ is found and not closed
    if (openBraces === -1 || (closeBraces > openBraces)) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // Extract what's been typed after {{
    const query = beforeCursor.substring(openBraces + 2).toLowerCase().trim();
    const items: { text: string; label: string; description: string; category: string }[] = [];
    
    // Check if typing secrets.
    if (query.startsWith('secrets.')) {
      const secretQuery = query.substring(8);
      secrets.forEach(secret => {
        if (secret.name.toLowerCase().includes(secretQuery)) {
          items.push({
            text: `secrets.${secret.name}`,
            label: secret.name,
            description: secret.description || 'Secret value',
            category: 'secrets'
          });
        }
      });
    } else if (query.startsWith('secret')) {
      // Show secrets prefix hint
      items.push({
        text: 'secrets.',
        label: 'secrets.',
        description: 'Access workflow secrets',
        category: 'secrets'
      });
      secrets.forEach(secret => {
        items.push({
          text: `secrets.${secret.name}`,
          label: `secrets.${secret.name}`,
          description: secret.description || 'Secret value',
          category: 'secrets'
        });
      });
    } else {
      // Show all matching system variables (or all if query is empty)
      SYSTEM_VARIABLES.forEach(v => {
        if (query === '' || v.name.toLowerCase().includes(query) || v.description.toLowerCase().includes(query)) {
          items.push({
            text: v.name,
            label: v.name,
            description: v.description,
            category: v.category
          });
        }
      });
      
      // Also suggest secrets
      if (query === '' || 'secrets'.includes(query)) {
        items.push({
          text: 'secrets.',
          label: 'secrets.',
          description: 'Access workflow secrets',
          category: 'secrets'
        });
      }
      
      // Add secret names if query matches
      secrets.forEach(secret => {
        if (query === '' || secret.name.toLowerCase().includes(query)) {
          items.push({
            text: `secrets.${secret.name}`,
            label: `secrets.${secret.name}`,
            description: secret.description || 'Secret value',
            category: 'secrets'
          });
        }
      });
    }
    
    setSuggestions(items);
    setSelectedIndex(0);
    
    // Calculate dropdown position immediately when showing
    if (items.length > 0 && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    }
    setShowSuggestions(items.length > 0);
  }, [secrets]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setLocalValue(newValue);
    setCursorPos(cursor);
    generateSuggestions(newValue, cursor);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  const handleBlur = () => {
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => {
      setShowSuggestions(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onChange(localValue);
    }, 150);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const cursor = e.target.selectionStart || 0;
    setCursorPos(cursor);
    generateSuggestions(localValue, cursor);
  };

  const insertSuggestion = (suggestion: string) => {
    const beforeCursor = localValue.substring(0, cursorPos);
    const afterCursor = localValue.substring(cursorPos);
    const openBraces = beforeCursor.lastIndexOf('{{');
    
    if (openBraces !== -1) {
      const insertPos = openBraces + 2; // Position right after {{
      const needsClosing = !afterCursor.startsWith('}}');
      const newValue = beforeCursor.substring(0, insertPos) + suggestion + (needsClosing ? '}}' : '') + afterCursor;
      setLocalValue(newValue);
      onChange(newValue);
      
      // Move cursor after inserted text
      const newCursorPos = insertPos + suggestion.length + (needsClosing ? 2 : 0);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      insertSuggestion(suggestions[selectedIndex].text);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      insertSuggestion(suggestions[selectedIndex].text);
    }
  };

  const categoryColors: Record<string, string> = {
    secrets: '#f0883e',
    runtime: '#22d3ee',
    node: '#7ee787',
    context: '#a371f7',
  };

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <InputComponent
        ref={inputRef as any}
        type={multiline ? undefined : type}
        value={localValue}
        placeholder={placeholder}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        style={multiline ? { ...TEXTAREA_STYLE, ...style } : style}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: 200,
            overflowY: 'auto',
            background: '#1c2128',
            border: '1px solid #30363d',
            borderRadius: 4,
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.text}
              onMouseDown={(e) => {
                e.preventDefault();
                insertSuggestion(s.text);
              }}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                background: i === selectedIndex ? '#21262d' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid #21262d' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 8,
                  padding: '1px 4px',
                  borderRadius: 2,
                  background: categoryColors[s.category] + '22',
                  color: categoryColors[s.category],
                  textTransform: 'uppercase',
                }}>
                  {s.category}
                </span>
                <code style={{
                  fontSize: 11,
                  color: '#e6edf3',
                  fontFamily: 'monospace',
                }}>
                  {'{{'}
                  <span style={{ color: categoryColors[s.category] }}>{s.label}</span>
                  {'}}'}
                </code>
              </div>
              <div style={{ fontSize: 9, color: '#8b949e', marginTop: 2 }}>
                {s.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  onClose?: () => void;
  secrets?: WorkflowSecret[];
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
  onClose,
  secrets = [],
}) => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const nodeType = TYPES[selectedNode.type];
  const nodeConnections = conns.filter((c) => c.from === selectedNode.id || c.to === selectedNode.id);
  const nodeStatus = simNodes[selectedNode.id];
  const isBP = breakpts.has(selectedNode.id);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
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

  const updateConfig = useCallback((key: string, value: string | number | boolean) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedNode.id ? { ...n, config: { ...n.config, [key]: value } } : n
      )
    );
  }, [selectedNode.id, setNodes]);

  const updateLabel = useCallback((newLabel: string) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === selectedNode.id ? { ...n, label: newLabel } : n))
    );
  }, [selectedNode.id, setNodes]);

  return (
    <div
      style={{
        width,
        background: '#161b22',
        borderLeft: '1px solid #30363d',
        flexShrink: 0,
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        style={{
          position: 'absolute',
          left: 0,
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
      
      {/* Panel content */}
      <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: '#484f58', letterSpacing: 2 }}>PROPERTIES</div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 6px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Secrets hint */}
      <div style={{ 
        marginBottom: 10, 
        padding: '6px 8px', 
        background: '#1c2128', 
        borderRadius: 4,
        fontSize: 9,
        color: '#8b949e',
        lineHeight: 1.4,
      }}>
        <span style={{ color: '#58a6ff' }}>💡 Tip:</span> Use <code style={{ 
          background: '#161b22', 
          padding: '1px 4px', 
          borderRadius: 2,
          color: '#f0883e',
          fontSize: 9,
        }}>{'{{secrets.NAME}}'}</code> for secrets, <code style={{ 
          background: '#161b22', 
          padding: '1px 4px', 
          borderRadius: 2,
          color: '#7ee787',
          fontSize: 9,
        }}>{'{{ctx.var}}'}</code> for context
      </div>

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
        <DebouncedInput
          value={selectedNode.label}
          onChange={updateLabel}
          style={INPUT_STYLE}
        />
      </div>

      {/* Decision condition */}
      {selectedNode.type === 'decision' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>CONDITION</div>
            <CodeEditor
              value={selectedNode.config?.condition || ''}
              onChange={(val) => updateConfig('condition', val)}
              language="javascript"
              height={80}
              placeholder="amount > 10000"
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>Evaluates against execution context</div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>EVALUATION MODE</div>
            <select
              value={selectedNode.config?.decisionMode || 'expression'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('decisionMode', e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="expression">Expression</option>
              <option value="switch">Switch/Case</option>
              <option value="multiCondition">Multi-Condition</option>
            </select>
          </div>
          {selectedNode.config?.decisionMode === 'switch' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>SWITCH VARIABLE</div>
              <input
                placeholder="ctx.status"
                value={selectedNode.config?.switchVariable || ''}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => updateConfig('switchVariable', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DEFAULT BRANCH</div>
            <select
              value={selectedNode.config?.defaultBranch || 'false'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('defaultBranch', e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="true">Port 0 (Yes/True)</option>
              <option value="false">Port 1 (No/False)</option>
            </select>
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Branch when condition cannot be evaluated
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.caseSensitive === true}
                onChange={(e) => updateConfig('caseSensitive', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Case-sensitive comparison</span>
            </label>
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            ⚠ Port 0: True/Yes | Port 1: False/No
          </div>
        </>
      )}

      {/* Trigger type */}
      {selectedNode.type === 'trigger' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.triggerEnabled !== false}
                onChange={(e) => updateConfig('triggerEnabled', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Enabled</span>
            </label>
          </div>
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
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DESCRIPTION</div>
            <textarea
              placeholder="Describes when this workflow triggers..."
              value={selectedNode.config?.triggerDescription || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('triggerDescription', e.target.value)}
              style={TEXTAREA_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>INPUT SCHEMA (JSON)</div>
            <CodeEditor
              value={selectedNode.config?.inputSchema || ''}
              onChange={(val) => updateConfig('inputSchema', val)}
              language="json"
              height={80}
              secrets={secrets}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Define expected input structure
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>MAX CONCURRENT</div>
            <input
              type="number"
              placeholder="1 (unlimited)"
              value={selectedNode.config?.maxConcurrent || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('maxConcurrent', parseInt(e.target.value) || 0)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Max simultaneous executions (0 = unlimited)
            </div>
          </div>
        </>
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
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DESCRIPTION</div>
            <textarea
              placeholder="What this task does..."
              value={selectedNode.config?.taskDescription || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('taskDescription', e.target.value)}
              style={TEXTAREA_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TIMEOUT (ms)</div>
            <input
              type="number"
              placeholder="30000"
              value={selectedNode.config?.taskTimeout || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('taskTimeout', parseInt(e.target.value) || 30000)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>RETRY ON FAILURE</div>
            <select
              value={selectedNode.config?.taskRetryStrategy || 'none'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('taskRetryStrategy', e.target.value)}
              style={SELECT_STYLE}
            >
              {RETRY_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {selectedNode.config?.taskRetryStrategy && selectedNode.config.taskRetryStrategy !== 'none' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>MAX RETRIES</div>
              <input
                type="number"
                placeholder="3"
                value={selectedNode.config?.taskMaxRetries || 3}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => updateConfig('taskMaxRetries', parseInt(e.target.value) || 3)}
                style={INPUT_STYLE}
              />
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>OUTPUT VARIABLE</div>
            <input
              placeholder="taskResult"
              value={selectedNode.config?.taskOutputVariable || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('taskOutputVariable', e.target.value)}
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
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ITERATOR SOURCE</div>
            <input
              placeholder="ctx.items or ctx.users"
              value={selectedNode.config?.loopIterator || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('loopIterator', e.target.value)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Array to iterate over (leave empty for count-based)
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>LOOP COUNT (if no iterator)</div>
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
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BATCH SIZE</div>
            <input
              type="number"
              placeholder="1"
              value={selectedNode.config?.loopBatchSize || 1}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('loopBatchSize', parseInt(e.target.value) || 1)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Process items in batches (1 = sequential)
            </div>
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
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ITEM VARIABLE</div>
            <input
              placeholder="currentItem"
              value={selectedNode.config?.loopItemVariable || 'currentItem'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('loopItemVariable', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>INDEX VARIABLE</div>
            <input
              placeholder="currentIndex"
              value={selectedNode.config?.loopIndexVariable || 'currentIndex'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('loopIndexVariable', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.loopContinueOnError === true}
                onChange={(e) => updateConfig('loopContinueOnError', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Continue on error</span>
            </label>
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            Port 0: Body (loops) | Port 1: Exit
          </div>
        </>
      )}

      {/* Delay properties */}
      {selectedNode.type === 'delay' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DELAY VALUE</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                placeholder="1000"
                value={selectedNode.config?.delayValue || selectedNode.config?.delayMs || ''}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const unit = selectedNode.config?.delayUnit || 'ms';
                  const multiplier = TIME_UNITS.find(u => u.value === unit)?.multiplier || 1;
                  updateConfig('delayValue', val);
                  updateConfig('delayMs', val * multiplier);
                }}
                style={{ ...INPUT_STYLE, flex: 1 }}
              />
              <select
                value={selectedNode.config?.delayUnit || 'ms'}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const unit = e.target.value;
                  const val = selectedNode.config?.delayValue || 1000;
                  const multiplier = TIME_UNITS.find(u => u.value === unit)?.multiplier || 1;
                  updateConfig('delayUnit', unit);
                  updateConfig('delayMs', val * multiplier);
                }}
                style={{ ...SELECT_STYLE, width: 90 }}
              >
                {TIME_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DESCRIPTION</div>
            <input
              placeholder="Rate limiting pause"
              value={selectedNode.config?.delayDescription || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('delayDescription', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.delayInterruptible === true}
                onChange={(e) => updateConfig('delayInterruptible', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Interruptible (can be cancelled)</span>
            </label>
          </div>
        </>
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
            <AutocompleteInput
              placeholder="https://api.example.com/{{endpoint}}"
              value={selectedNode.config?.httpUrl || ''}
              onChange={(val) => updateConfig('httpUrl', val)}
              secrets={secrets}
              style={INPUT_STYLE}
            />
          </div>
          
          {/* Authentication */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>AUTHENTICATION</div>
            <select
              value={selectedNode.config?.httpAuthType || 'none'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpAuthType', e.target.value)}
              style={SELECT_STYLE}
            >
              {AUTH_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'none' ? 'None' : t === 'basic' ? 'Basic Auth' : t === 'bearer' ? 'Bearer Token' : t === 'api-key' ? 'API Key' : 'OAuth 2.0'}</option>
              ))}
            </select>
          </div>
          {selectedNode.config?.httpAuthType === 'bearer' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BEARER TOKEN</div>
              <AutocompleteInput
                placeholder="{{secrets.API_TOKEN}}"
                value={selectedNode.config?.httpBearerToken || ''}
                onChange={(val) => updateConfig('httpBearerToken', val)}
                secrets={secrets}
                style={INPUT_STYLE}
              />
            </div>
          )}
          {selectedNode.config?.httpAuthType === 'basic' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>USERNAME</div>
                <AutocompleteInput
                  placeholder="{{secrets.USERNAME}}"
                  value={selectedNode.config?.httpUsername || ''}
                  onChange={(val) => updateConfig('httpUsername', val)}
                  secrets={secrets}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>PASSWORD</div>
                <AutocompleteInput
                  placeholder="{{secrets.PASSWORD}}"
                  value={selectedNode.config?.httpPassword || ''}
                  onChange={(val) => updateConfig('httpPassword', val)}
                  secrets={secrets}
                  style={INPUT_STYLE}
                />
              </div>
            </>
          )}
          {selectedNode.config?.httpAuthType === 'api-key' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>API KEY HEADER</div>
                <DebouncedInput
                  placeholder="X-API-Key"
                  value={selectedNode.config?.httpApiKeyHeader || 'X-API-Key'}
                  onChange={(val) => updateConfig('httpApiKeyHeader', val)}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>API KEY VALUE</div>
                <AutocompleteInput
                  placeholder="{{secrets.API_KEY}}"
                  value={selectedNode.config?.httpApiKeyValue || ''}
                  onChange={(val) => updateConfig('httpApiKeyValue', val)}
                  secrets={secrets}
                  style={INPUT_STYLE}
                />
              </div>
            </>
          )}
          
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>HEADERS (JSON)</div>
            <CodeEditor
              value={selectedNode.config?.httpHeaders ? JSON.stringify(selectedNode.config.httpHeaders, null, 2) : '[]'}
              onChange={(val) => {
                try {
                  updateConfig('httpHeaders', JSON.parse(val || '[]'));
                } catch {
                  // Keep as is if invalid JSON
                }
              }}
              language="json"
              height={80}
              secrets={secrets}
            />
          </div>
          
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>CONTENT TYPE</div>
            <select
              value={selectedNode.config?.httpContentType || 'application/json'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpContentType', e.target.value)}
              style={SELECT_STYLE}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BODY</div>
            <CodeEditor
              value={selectedNode.config?.httpBody || ''}
              onChange={(val) => updateConfig('httpBody', val)}
              language="json"
              height={100}
              secrets={secrets}
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
          
          {/* Retry Settings */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>RETRY STRATEGY</div>
            <select
              value={selectedNode.config?.httpRetryStrategy || 'none'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('httpRetryStrategy', e.target.value)}
              style={SELECT_STYLE}
            >
              {RETRY_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {selectedNode.config?.httpRetryStrategy && selectedNode.config.httpRetryStrategy !== 'none' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>MAX RETRIES</div>
                <input
                  type="number"
                  placeholder="3"
                  value={selectedNode.config?.httpMaxRetries || 3}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => updateConfig('httpMaxRetries', parseInt(e.target.value) || 3)}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>RETRY DELAY (ms)</div>
                <input
                  type="number"
                  placeholder="1000"
                  value={selectedNode.config?.httpRetryDelay || 1000}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => updateConfig('httpRetryDelay', parseInt(e.target.value) || 1000)}
                  style={INPUT_STYLE}
                />
              </div>
            </>
          )}
          
          {/* Advanced Options */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.httpFollowRedirects !== false}
                onChange={(e) => updateConfig('httpFollowRedirects', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Follow redirects</span>
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.httpValidateSSL !== false}
                onChange={(e) => updateConfig('httpValidateSSL', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Validate SSL certificate</span>
            </label>
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
            <DebouncedInput
              placeholder="recipient@example.com"
              value={selectedNode.config?.emailTo || ''}
              onChange={(val) => updateConfig('emailTo', val)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Separate multiple with commas
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>CC (optional)</div>
            <DebouncedInput
              placeholder="cc@example.com"
              value={selectedNode.config?.emailCc || ''}
              onChange={(val) => updateConfig('emailCc', val)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BCC (optional)</div>
            <DebouncedInput
              placeholder="bcc@example.com"
              value={selectedNode.config?.emailBcc || ''}
              onChange={(val) => updateConfig('emailBcc', val)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>SUBJECT</div>
            <DebouncedInput
              placeholder="Email subject"
              value={selectedNode.config?.emailSubject || ''}
              onChange={(val) => updateConfig('emailSubject', val)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.emailIsHtml === true}
                onChange={(e) => updateConfig('emailIsHtml', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Send as HTML</span>
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>BODY</div>
            <DebouncedTextarea
              placeholder={selectedNode.config?.emailIsHtml ? "<html><body>...</body></html>" : "Email content..."}
              value={selectedNode.config?.emailBody || ''}
              onChange={(val) => updateConfig('emailBody', val)}
              style={{ ...TEXTAREA_STYLE, minHeight: 80 }}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 3 }}>
              Use {`{{variable}}`} for dynamic values
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>FROM</div>
            <input
              placeholder="sender@example.com"
              value={selectedNode.config?.emailFrom || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailFrom', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>REPLY-TO (optional)</div>
            <input
              placeholder="reply@example.com"
              value={selectedNode.config?.emailReplyTo || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailReplyTo', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>PRIORITY</div>
            <select
              value={selectedNode.config?.emailPriority || 'normal'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('emailPriority', e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ATTACHMENTS (JSON)</div>
            <CodeEditor
              value={selectedNode.config?.emailAttachments || ''}
              onChange={(val) => updateConfig('emailAttachments', val)}
              language="json"
              height={80}
              secrets={secrets}
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
            <CodeEditor
              value={selectedNode.config?.scriptCode || ''}
              onChange={(val) => updateConfig('scriptCode', val)}
              language={selectedNode.config?.scriptLanguage === 'python' ? 'python' : 'javascript'}
              height={150}
              placeholder={selectedNode.config?.scriptLanguage === 'python' 
                ? '# Access context via ctx\nresult = ctx["amount"] * 1.1'
                : '// Access context via ctx\nreturn ctx.amount * 1.1;'}
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
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TIMEOUT (ms)</div>
            <input
              type="number"
              placeholder="30000"
              value={selectedNode.config?.scriptTimeout || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scriptTimeout', parseInt(e.target.value) || 30000)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ERROR HANDLING</div>
            <select
              value={selectedNode.config?.scriptErrorHandling || 'stop'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scriptErrorHandling', e.target.value)}
              style={SELECT_STYLE}
            >
              {ERROR_HANDLING_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.scriptAsync === true}
                onChange={(e) => updateConfig('scriptAsync', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Run asynchronously</span>
            </label>
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
            <CodeEditor
              value={selectedNode.config?.transformExpression || ''}
              onChange={(val) => updateConfig('transformExpression', val)}
              language="javascript"
              height={120}
              placeholder="{ newField: ctx.oldField * 2 }"
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
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>ERROR HANDLING</div>
            <select
              value={selectedNode.config?.transformErrorHandling || 'stop'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('transformErrorHandling', e.target.value)}
              style={SELECT_STYLE}
            >
              {ERROR_HANDLING_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.transformValidateOutput === true}
                onChange={(e) => updateConfig('transformValidateOutput', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Validate output structure</span>
            </label>
          </div>
          {selectedNode.config?.transformValidateOutput && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>OUTPUT SCHEMA (JSON)</div>
              <CodeEditor
                value={selectedNode.config?.transformOutputSchema || ''}
                onChange={(val) => updateConfig('transformOutputSchema', val)}
                language="json"
                height={80}
                secrets={secrets}
              />
            </div>
          )}
        </>
      )}

      {/* Webhook properties */}
      {selectedNode.type === 'webhook' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>PATH</div>
            <DebouncedInput
              placeholder="/api/webhook/order-created"
              value={selectedNode.config?.webhookPath || ''}
              onChange={(val) => updateConfig('webhookPath', val)}
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
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>AUTHENTICATION</div>
            <select
              value={selectedNode.config?.webhookAuthType || 'none'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('webhookAuthType', e.target.value)}
              style={SELECT_STYLE}
            >
              {WEBHOOK_AUTH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {selectedNode.config?.webhookAuthType && selectedNode.config.webhookAuthType !== 'none' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>SECRET</div>
              <AutocompleteInput
                placeholder="{{secrets.WEBHOOK_SECRET}}"
                value={selectedNode.config?.webhookSecret || ''}
                onChange={(val) => updateConfig('webhookSecret', val)}
                secrets={secrets}
                style={INPUT_STYLE}
              />
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>RESPONSE STATUS</div>
            <input
              type="number"
              placeholder="200"
              value={selectedNode.config?.webhookResponseStatus || 200}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('webhookResponseStatus', parseInt(e.target.value) || 200)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>RESPONSE BODY (JSON)</div>
            <CodeEditor
              value={selectedNode.config?.webhookResponseBody || ''}
              onChange={(val) => updateConfig('webhookResponseBody', val)}
              language="json"
              height={80}
              secrets={secrets}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.webhookAsync === true}
                onChange={(e) => updateConfig('webhookAsync', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Process asynchronously</span>
            </label>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.scheduleEnabled !== false}
                onChange={(e) => updateConfig('scheduleEnabled', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Enabled</span>
            </label>
          </div>
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
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>START DATE (optional)</div>
            <input
              type="datetime-local"
              value={selectedNode.config?.scheduleStartDate || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scheduleStartDate', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>END DATE (optional)</div>
            <input
              type="datetime-local"
              value={selectedNode.config?.scheduleEndDate || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scheduleEndDate', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>DESCRIPTION</div>
            <input
              placeholder="Daily sync job"
              value={selectedNode.config?.scheduleDescription || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('scheduleDescription', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
        </>
      )}

      {/* Parallel properties */}
      {selectedNode.type === 'parallel' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>MAX CONCURRENCY</div>
            <input
              type="number"
              placeholder="0 (unlimited)"
              value={selectedNode.config?.parallelMaxConcurrency || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('parallelMaxConcurrency', parseInt(e.target.value) || 0)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Max branches to run simultaneously (0 = all)
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>TIMEOUT (ms)</div>
            <input
              type="number"
              placeholder="60000"
              value={selectedNode.config?.parallelTimeout || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('parallelTimeout', parseInt(e.target.value) || 60000)}
              style={INPUT_STYLE}
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Max time to wait for all branches
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.parallelFailFast === true}
                onChange={(e) => updateConfig('parallelFailFast', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Fail fast (stop on first error)</span>
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.parallelWaitAll !== false}
                onChange={(e) => updateConfig('parallelWaitAll', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Wait for all branches</span>
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>RESULT MERGE STRATEGY</div>
            <select
              value={selectedNode.config?.parallelMergeStrategy || 'object'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('parallelMergeStrategy', e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="object">Merge as object</option>
              <option value="array">Collect as array</option>
              <option value="first">First completed only</option>
            </select>
          </div>
          <div style={{ fontSize: 8, color: '#484f58', marginBottom: 10 }}>
            Connect multiple branches from output ports
          </div>
        </>
      )}

      {/* End properties */}
      {selectedNode.type === 'end' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>EXIT STATUS</div>
            <select
              value={selectedNode.config?.endStatus || 'success'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('endStatus', e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="cancelled">Cancelled</option>
              <option value="dynamic">Dynamic (from context)</option>
            </select>
          </div>
          {selectedNode.config?.endStatus === 'dynamic' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>STATUS VARIABLE</div>
              <input
                placeholder="ctx.finalStatus"
                value={selectedNode.config?.endStatusVariable || ''}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => updateConfig('endStatusVariable', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>OUTPUT MAPPING</div>
            <CodeEditor
              value={selectedNode.config?.endOutputMapping || ''}
              onChange={(val) => updateConfig('endOutputMapping', val)}
              language="javascript"
              height={100}
              placeholder="{ result: ctx.finalResult, summary: ctx.stats }"
            />
            <div style={{ fontSize: 8, color: '#484f58', marginTop: 2 }}>
              Define workflow output structure
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4, letterSpacing: 1 }}>MESSAGE</div>
            <input
              placeholder="Workflow completed successfully"
              value={selectedNode.config?.endMessage || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => updateConfig('endMessage', e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedNode.config?.endNotify === true}
                onChange={(e) => updateConfig('endNotify', e.target.checked)}
              />
              <span style={{ fontSize: 10, color: '#8b949e' }}>Send completion notification</span>
            </label>
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
    </div>
  );
};
