import React, { useState, useCallback, useEffect } from 'react';
import { BUTTON_STYLE, INPUT_STYLE } from '../constants';
import {
  SavedWorkflow,
  listWorkflows,
  deleteWorkflow,
  duplicateWorkflow,
  exportWorkflow,
  importWorkflow,
} from '../workflowStorage';

interface WorkflowListPanelProps {
  currentWorkflowId?: string;
  onSelect: (workflow: SavedWorkflow) => void;
  onNew: () => void;
  onClose: () => void;
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 50,
  left: 50,
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 8,
  padding: 16,
  width: 400,
  maxHeight: 'calc(100vh - 100px)',
  overflow: 'auto',
  zIndex: 1000,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const WORKFLOW_ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  borderRadius: 6,
  marginBottom: 8,
  background: '#0d1117',
  border: '1px solid #21262d',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
};

export const WorkflowListPanel: React.FC<WorkflowListPanelProps> = ({
  currentWorkflowId,
  onSelect,
  onNew,
  onClose,
}) => {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);

  const refreshList = useCallback(() => {
    setWorkflows(listWorkflows());
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this workflow?')) {
      deleteWorkflow(id);
      refreshList();
    }
  }, [refreshList]);

  const handleDuplicate = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateWorkflow(id);
    refreshList();
  }, [refreshList]);

  const handleExport = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const json = exportWorkflow(id);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const workflow = workflows.find((w) => w.id === id);
      a.href = url;
      a.download = `${workflow?.name || 'workflow'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [workflows]);

  const handleImport = useCallback(() => {
    if (importJson.trim()) {
      const workflow = importWorkflow(importJson);
      if (workflow) {
        refreshList();
        setImportJson('');
        setShowImport(false);
        onSelect(workflow);
      } else {
        alert('Failed to import workflow. Please check the JSON format.');
      }
    }
  }, [importJson, onSelect, refreshList]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        const workflow = importWorkflow(json);
        if (workflow) {
          refreshList();
          onSelect(workflow);
        } else {
          alert('Failed to import workflow. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  }, [onSelect, refreshList]);

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={PANEL_STYLE} onMouseDown={(e) => e.stopPropagation()}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>
          📁 Workflows
        </div>
        <button
          onClick={onClose}
          style={{ ...BUTTON_STYLE, padding: '2px 8px', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* Search & Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Search workflows..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...INPUT_STYLE, flex: 1 }}
        />
        <button
          onClick={onNew}
          style={{
            ...BUTTON_STYLE,
            background: '#238636',
            borderColor: '#238636',
            color: '#fff',
          }}
        >
          + New
        </button>
      </div>

      {/* Import section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => setShowImport(!showImport)}
            style={{ ...BUTTON_STYLE, fontSize: 10 }}
          >
            📥 Import JSON
          </button>
          <label style={{ ...BUTTON_STYLE, fontSize: 10, cursor: 'pointer' }}>
            📂 Import File
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        
        {showImport && (
          <div style={{ marginTop: 8 }}>
            <textarea
              placeholder="Paste workflow JSON here..."
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              style={{ ...INPUT_STYLE, minHeight: 80, resize: 'vertical', marginBottom: 8 }}
            />
            <button onClick={handleImport} style={BUTTON_STYLE}>
              Import
            </button>
          </div>
        )}
      </div>

      {/* Workflow list */}
      <div>
        {filteredWorkflows.length === 0 ? (
          <div style={{ color: '#484f58', textAlign: 'center', padding: 20 }}>
            {searchTerm ? 'No workflows found' : 'No saved workflows yet'}
          </div>
        ) : (
          filteredWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              style={{
                ...WORKFLOW_ITEM_STYLE,
                borderColor: workflow.id === currentWorkflowId ? '#3b82f6' : '#21262d',
              }}
              onClick={() => onSelect(workflow)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  color: '#e6edf3', 
                  fontSize: 12, 
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {workflow.name}
                </div>
                <div style={{ color: '#484f58', fontSize: 10, marginTop: 2 }}>
                  {workflow.data.nodes.length} nodes · Updated {formatDate(workflow.updatedAt)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={(e) => handleDuplicate(workflow.id, e)}
                  style={{ ...BUTTON_STYLE, padding: '2px 6px', fontSize: 10 }}
                  title="Duplicate"
                >
                  📋
                </button>
                <button
                  onClick={(e) => handleExport(workflow.id, e)}
                  style={{ ...BUTTON_STYLE, padding: '2px 6px', fontSize: 10 }}
                  title="Export"
                >
                  📤
                </button>
                <button
                  onClick={(e) => handleDelete(workflow.id, e)}
                  style={{ ...BUTTON_STYLE, padding: '2px 6px', fontSize: 10, color: '#f85149' }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div style={{ 
        marginTop: 16, 
        paddingTop: 12, 
        borderTop: '1px solid #21262d',
        fontSize: 10,
        color: '#484f58',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{workflows.length} workflow(s)</span>
        <span>Stored in localStorage</span>
      </div>
    </div>
  );
};
