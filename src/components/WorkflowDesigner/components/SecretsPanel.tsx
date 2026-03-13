import React, { useState } from 'react';
import { WorkflowSecret } from '../types';

const PANEL_STYLE: React.CSSProperties = {
  background: '#161b22',
  borderRadius: 8,
  border: '1px solid #30363d',
  padding: 12,
  marginBottom: 10,
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 11,
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 4,
  color: '#c9d1d9',
  outline: 'none',
  boxSizing: 'border-box',
};

const BUTTON_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 10,
  background: '#238636',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

interface SecretsPanelProps {
  secrets: WorkflowSecret[];
  onSecretsChange: (secrets: WorkflowSecret[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SecretsPanel: React.FC<SecretsPanelProps> = ({
  secrets,
  onSecretsChange,
  isOpen,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showValues, setShowValues] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const generateId = () => `secret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAdd = () => {
    if (!newName.trim()) return;
    
    // Validate name format (alphanumeric + underscore)
    if (!/^[A-Z][A-Z0-9_]*$/.test(newName.toUpperCase())) {
      alert('Secret name must be uppercase alphanumeric with underscores (e.g., API_KEY)');
      return;
    }

    // Check if name already exists
    if (secrets.some(s => s.name.toUpperCase() === newName.toUpperCase())) {
      alert('A secret with this name already exists');
      return;
    }

    const newSecret: WorkflowSecret = {
      id: generateId(),
      name: newName.toUpperCase(),
      value: newValue,
      description: newDescription || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSecretsChange([...secrets, newSecret]);
    setNewName('');
    setNewValue('');
    setNewDescription('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this secret?')) {
      onSecretsChange(secrets.filter(s => s.id !== id));
    }
  };

  const handleUpdate = (id: string) => {
    onSecretsChange(secrets.map(s => 
      s.id === id 
        ? { ...s, value: editValue, updatedAt: new Date().toISOString() }
        : s
    ));
    setEditingId(null);
    setEditValue('');
  };

  const toggleShowValue = (id: string) => {
    setShowValues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (secret: WorkflowSecret) => {
    setEditingId(secret.id);
    setEditValue(secret.value);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#0d1117',
          borderRadius: 12,
          border: '1px solid #30363d',
          width: 500,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔐</span>
            <span style={{ fontWeight: 600, color: '#c9d1d9' }}>Workflow Secrets</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 18,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {/* Info box */}
          <div style={{
            background: '#1c2128',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: 11,
            color: '#8b949e',
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, color: '#58a6ff', marginBottom: 4 }}>💡 Using Secrets</div>
            <div>Reference secrets in any property using: <code style={{ 
              background: '#161b22', 
              padding: '2px 6px', 
              borderRadius: 3,
              color: '#f0883e',
            }}>{'{{secrets.SECRET_NAME}}'}</code></div>
            <div style={{ marginTop: 6 }}>Example: <code style={{ 
              background: '#161b22', 
              padding: '2px 6px', 
              borderRadius: 3,
              color: '#7ee787',
            }}>{'{{secrets.API_KEY}}'}</code> will be replaced at runtime.</div>
          </div>

          {/* Add new secret form */}
          <div style={PANEL_STYLE}>
            <div style={{ fontSize: 10, color: '#58a6ff', fontWeight: 600, marginBottom: 10 }}>
              Add New Secret
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4 }}>NAME</div>
                <input
                  placeholder="API_KEY (uppercase)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4 }}>VALUE</div>
                <input
                  type="password"
                  placeholder="Secret value..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#484f58', marginBottom: 4 }}>DESCRIPTION (OPTIONAL)</div>
                <input
                  placeholder="What is this secret for?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={INPUT_STYLE}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newValue.trim()}
                style={{
                  ...BUTTON_STYLE,
                  opacity: (!newName.trim() || !newValue.trim()) ? 0.5 : 1,
                  cursor: (!newName.trim() || !newValue.trim()) ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}
              >
                + Add Secret
              </button>
            </div>
          </div>

          {/* Existing secrets list */}
          {secrets.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 8 }}>
                Existing Secrets ({secrets.length})
              </div>
              {secrets.map((secret) => (
                <div
                  key={secret.id}
                  style={{
                    ...PANEL_STYLE,
                    padding: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{
                        background: '#238636',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {secret.name}
                      </code>
                      <span style={{ fontSize: 9, color: '#484f58' }}>
                        {'{{secrets.' + secret.name + '}}'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(secret.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f85149',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: 2,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {secret.description && (
                    <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 6 }}>
                      {secret.description}
                    </div>
                  )}
                  
                  {editingId === secret.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="password"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ ...INPUT_STYLE, flex: 1 }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(secret.id)}
                        style={{ ...BUTTON_STYLE, padding: '4px 8px' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ ...BUTTON_STYLE, background: '#484f58', padding: '4px 8px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        flex: 1,
                        background: '#0d1117',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#8b949e',
                      }}>
                        {showValues.has(secret.id) ? secret.value : '••••••••••••'}
                      </div>
                      <button
                        onClick={() => toggleShowValue(secret.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#8b949e',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: 2,
                        }}
                        title={showValues.has(secret.id) ? 'Hide' : 'Show'}
                      >
                        {showValues.has(secret.id) ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={() => startEdit(secret)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#58a6ff',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: 2,
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(`{{secrets.${secret.name}}}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#8b949e',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: 2,
                        }}
                        title="Copy reference"
                      >
                        📋
                      </button>
                    </div>
                  )}
                  
                  <div style={{ fontSize: 9, color: '#484f58', marginTop: 6 }}>
                    Updated: {new Date(secret.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {secrets.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: '#484f58',
              fontSize: 11,
              padding: 20,
            }}>
              No secrets defined yet. Add your first secret above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
