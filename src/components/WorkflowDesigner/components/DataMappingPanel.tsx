import React, { useState, useCallback } from 'react';
import { Connection, DataMapping, WorkflowNode } from '../types';
import { INPUT_STYLE, BUTTON_STYLE, TYPES, ICONS } from '../constants';

interface DataMappingPanelProps {
  connection: Connection;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  onUpdate: (mappings: DataMapping[]) => void;
  onClose: () => void;
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 8,
  padding: 16,
  minWidth: 450,
  maxWidth: 600,
  maxHeight: '80vh',
  overflow: 'auto',
  zIndex: 1000,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 999,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
  padding: 8,
  background: '#0d1117',
  borderRadius: 4,
  border: '1px solid #21262d',
};

// Common output fields for different node types
const getOutputFields = (node: WorkflowNode): string[] => {
  const common = ['_result', '_status', '_duration'];
  
  switch (node.type) {
    case 'http':
      return ['response.body', 'response.status', 'response.headers', ...common];
    case 'email':
      return ['messageId', 'sent', ...common];
    case 'script':
      return [node.config?.outputVariable || 'result', ...common];
    case 'transform':
      return [node.config?.outputVariable || 'transformed', ...common];
    case 'trigger':
    case 'webhook':
      return ['payload', 'headers', 'query', 'timestamp', ...common];
    case 'schedule':
      return ['scheduledTime', 'executionTime', ...common];
    case 'decision':
      return ['result', 'condition', ...common];
    case 'task':
      return ['output', 'endpoint', ...common];
    default:
      return common;
  }
};

// Common input fields for different node types
const getInputFields = (node: WorkflowNode): string[] => {
  const common = ['_input', '_context'];
  
  switch (node.type) {
    case 'http':
      return ['httpUrl', 'httpBody', 'httpHeaders', ...common];
    case 'email':
      return ['emailTo', 'emailSubject', 'emailBody', ...common];
    case 'script':
      return ['scriptInput', 'ctx', ...common];
    case 'transform':
      return ['input', 'ctx', ...common];
    case 'decision':
      return ['condition', 'ctx', ...common];
    case 'task':
      return ['input', 'ctx', ...common];
    default:
      return common;
  }
};

export const DataMappingPanel: React.FC<DataMappingPanelProps> = ({
  connection,
  sourceNode,
  targetNode,
  onUpdate,
  onClose,
}) => {
  const [mappings, setMappings] = useState<DataMapping[]>(connection.mappings || []);
  const [showTransform, setShowTransform] = useState<Set<number>>(new Set());

  const sourceFields = getOutputFields(sourceNode);
  const targetFields = getInputFields(targetNode);

  const addMapping = useCallback(() => {
    setMappings((prev) => [
      ...prev,
      { sourceField: sourceFields[0] || '', targetField: targetFields[0] || '' },
    ]);
  }, [sourceFields, targetFields]);

  const updateMapping = useCallback((index: number, field: keyof DataMapping, value: string) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const removeMapping = useCallback((index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleTransform = useCallback((index: number) => {
    setShowTransform((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleSave = () => {
    onUpdate(mappings.filter((m) => m.sourceField && m.targetField));
    onClose();
  };

  const sourceColor = TYPES[sourceNode.type].color;
  const targetColor = TYPES[targetNode.type].color;

  return (
    <>
      <div style={OVERLAY_STYLE} onClick={onClose} />
      <div style={PANEL_STYLE} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ marginBottom: 16, borderBottom: '1px solid #30363d', paddingBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3', marginBottom: 8 }}>
            Data Mapping
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>{ICONS[sourceNode.type]}</span>
              <span style={{ color: sourceColor, fontSize: 12 }}>{sourceNode.label}</span>
            </div>
            <span style={{ color: '#484f58' }}>→</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>{ICONS[targetNode.type]}</span>
              <span style={{ color: targetColor, fontSize: 12 }}>{targetNode.label}</span>
            </div>
          </div>
        </div>

        {/* Mappings */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8, letterSpacing: 1 }}>
            FIELD MAPPINGS
          </div>
          
          {mappings.length === 0 && (
            <div style={{ color: '#484f58', fontSize: 11, padding: 12, textAlign: 'center', border: '1px dashed #30363d', borderRadius: 4 }}>
              No mappings defined. Click "Add Mapping" to create one.
            </div>
          )}

          {mappings.map((mapping, index) => (
            <div key={index}>
              <div style={ROW_STYLE}>
                {/* Source field */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#484f58', marginBottom: 3 }}>FROM</div>
                  <select
                    value={mapping.sourceField}
                    onChange={(e) => updateMapping(index, 'sourceField', e.target.value)}
                    style={{ ...INPUT_STYLE, fontSize: 10 }}
                  >
                    <option value="">Select field...</option>
                    {sourceFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    <option value="_custom">Custom expression...</option>
                  </select>
                </div>

                <span style={{ color: '#484f58', fontSize: 16, paddingTop: 18 }}>→</span>

                {/* Target field */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#484f58', marginBottom: 3 }}>TO</div>
                  <select
                    value={mapping.targetField}
                    onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                    style={{ ...INPUT_STYLE, fontSize: 10 }}
                  >
                    <option value="">Select field...</option>
                    {targetFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    <option value="_custom">Custom...</option>
                  </select>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, paddingTop: 18 }}>
                  <button
                    onClick={() => toggleTransform(index)}
                    style={{
                      ...BUTTON_STYLE,
                      padding: '2px 6px',
                      fontSize: 10,
                      color: showTransform.has(index) ? '#3b82f6' : '#8b949e',
                      borderColor: showTransform.has(index) ? '#3b82f6' : '#30363d',
                    }}
                    title="Add transform"
                  >
                    ƒ
                  </button>
                  <button
                    onClick={() => removeMapping(index)}
                    style={{ ...BUTTON_STYLE, padding: '2px 6px', fontSize: 10, color: '#f85149' }}
                    title="Remove mapping"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Transform expression */}
              {showTransform.has(index) && (
                <div style={{ marginLeft: 12, marginBottom: 8, marginTop: -4 }}>
                  <div style={{ fontSize: 9, color: '#484f58', marginBottom: 3 }}>TRANSFORM (JS)</div>
                  <input
                    placeholder="value => value.toUpperCase()"
                    value={mapping.transform || ''}
                    onChange={(e) => updateMapping(index, 'transform', e.target.value)}
                    style={{ ...INPUT_STYLE, fontSize: 10, fontFamily: 'monospace' }}
                  />
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addMapping}
            style={{
              ...BUTTON_STYLE,
              width: '100%',
              marginTop: 8,
              border: '1px dashed #30363d',
            }}
          >
            + Add Mapping
          </button>
        </div>

        {/* Quick templates */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#484f58', marginBottom: 8, letterSpacing: 1 }}>
            QUICK TEMPLATES
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setMappings([{ sourceField: '_result', targetField: '_input' }])}
              style={{ ...BUTTON_STYLE, fontSize: 9 }}
            >
              Pass Result
            </button>
            <button
              onClick={() => setMappings([
                { sourceField: 'response.body', targetField: '_input' },
                { sourceField: 'response.status', targetField: '_status' },
              ])}
              style={{ ...BUTTON_STYLE, fontSize: 9 }}
            >
              HTTP Response
            </button>
            <button
              onClick={() => setMappings([])}
              style={{ ...BUTTON_STYLE, fontSize: 9, color: '#f85149' }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #30363d', paddingTop: 12 }}>
          <button onClick={onClose} style={BUTTON_STYLE}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              ...BUTTON_STYLE,
              background: '#238636',
              borderColor: '#238636',
              color: '#fff',
            }}
          >
            Save Mappings
          </button>
        </div>
      </div>
    </>
  );
};
