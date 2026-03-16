import React, { useRef } from 'react';
import { SimState, WorkflowNode, Connection, ExecutionContext, LintIssue } from '../types';
import { BUTTON_STYLE, DEMO_NODES, DEMO_CONNECTIONS } from '../constants';

interface ToolbarProps {
  wfName: string;
  setWfName: (name: string) => void;
  debugMode: boolean;
  setDebugMode: (mode: boolean) => void;
  dbgOpen: boolean;
  setDbgOpen: (open: boolean) => void;
  simState: SimState;
  simRunning: boolean;
  startSim: () => void;
  startRealExec: () => void;
  isRealExecuting: boolean;
  isRealPaused?: boolean;
  resumeRealExec?: () => void;
  stepRealExec?: () => void;
  stopSim: () => void;
  pauseResume: () => void;
  stepNext: () => void;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setConns: React.Dispatch<React.SetStateAction<Connection[]>>;
  setSel: (sel: string | null) => void;
  nodes: WorkflowNode[];
  conns: Connection[];
  execCtx: ExecutionContext;
  // New props
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  hasLintErrors: boolean;
  hasLintWarnings: boolean;
  lintIssues: LintIssue[];
  addStickyNote: () => void;
  importWorkflow: (json: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  wfName,
  setWfName,
  debugMode,
  setDebugMode,
  dbgOpen,
  setDbgOpen,
  simState,
  simRunning,
  startSim,
  startRealExec,
  isRealExecuting,
  isRealPaused,
  resumeRealExec,
  stepRealExec,
  stopSim,
  pauseResume,
  stepNext,
  setNodes,
  setConns,
  setSel,
  nodes,
  conns,
  execCtx,
  canUndo,
  canRedo,
  undo,
  redo,
  zoom,
  zoomIn,
  zoomOut,
  zoomReset,
  hasLintErrors,
  hasLintWarnings,
  lintIssues,
  addStickyNote,
  importWorkflow,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const data = {
      workflow: wfName,
      version: '1.0',
      nodes,
      connections: conns,
      lastContext: execCtx,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'workflow.json';
    a.click();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        importWorkflow(content);
      };
      reader.readAsText(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setNodes(DEMO_NODES);
    setConns(DEMO_CONNECTIONS);
    setSel(null);
    stopSim();
  };

  const handleClear = () => {
    setNodes([]);
    setConns([]);
    setSel(null);
    stopSim();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <span style={{ color: '#10b981', fontSize: 11, letterSpacing: 3, opacity: 0.8 }}>⬡ WF</span>
      <input
        value={wfName}
        onChange={(e) => setWfName(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #30363d44',
          color: '#e6edf3',
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 'bold',
          width: 180,
          outline: 'none',
          padding: '2px 0',
        }}
      />

      {/* Lint indicator */}
      {(hasLintErrors || hasLintWarnings) && (
        <span
          title={lintIssues.map((i) => `${i.severity}: ${i.message}`).join('\n')}
          style={{
            fontSize: 10,
            color: hasLintErrors ? '#f85149' : '#f59e0b',
            cursor: 'help',
          }}
        >
          {hasLintErrors ? '⚠' : '⚡'} {lintIssues.length}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{
          ...BUTTON_STYLE,
          opacity: canUndo ? 1 : 0.4,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
      >
        ↩
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={{
          ...BUTTON_STYLE,
          opacity: canRedo ? 1 : 0.4,
          cursor: canRedo ? 'pointer' : 'not-allowed',
        }}
      >
        ↪
      </button>

      {/* Zoom controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderLeft: '1px solid #30363d',
          paddingLeft: 8,
          marginLeft: 4,
        }}
      >
        <button onClick={zoomOut} title="Zoom Out" style={BUTTON_STYLE}>
          −
        </button>
        <span
          onClick={zoomReset}
          title="Reset Zoom"
          style={{ fontSize: 10, color: '#8b949e', cursor: 'pointer', minWidth: 40, textAlign: 'center' }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomIn} title="Zoom In" style={BUTTON_STYLE}>
          +
        </button>
      </div>

      {/* Sticky note button */}
      <button onClick={addStickyNote} title="Add Sticky Note" style={BUTTON_STYLE}>
        📝
      </button>

      <button
        onClick={() => setDebugMode(!debugMode)}
        style={{
          ...BUTTON_STYLE,
          borderColor: debugMode ? '#f59e0b' : '#30363d',
          color: debugMode ? '#f59e0b' : '#8b949e',
          background: debugMode ? '#1a130a' : 'transparent',
        }}
      >
        {debugMode ? '⬡ DEBUG' : '○ DEBUG'}
      </button>
      <button style={BUTTON_STYLE} onClick={handleReset}>
        Reset
      </button>
      <button style={BUTTON_STYLE} onClick={handleClear}>
        Clear
      </button>
      <button style={BUTTON_STYLE} onClick={handleImport}>
        Import
      </button>
      <button style={BUTTON_STYLE} onClick={exportJSON}>
        Export
      </button>
      {!simRunning && !isRealExecuting && (
        <>
          <button
            onClick={startSim}
            title="Simulate workflow (mock execution)"
            style={{ ...BUTTON_STYLE, borderColor: '#8b949e', color: '#8b949e', background: '#21262d' }}
          >
            ▶ SIM
          </button>
          <button
            onClick={startRealExec}
            title="Execute workflow (real HTTP calls)"
            style={{ ...BUTTON_STYLE, borderColor: '#10b981', color: '#10b981', background: '#0a1f13' }}
          >
            ⚡ EXEC
          </button>
        </>
      )}
      {isRealExecuting && (
        <>
          {isRealPaused ? (
            <>
              <button
                onClick={resumeRealExec}
                style={{ ...BUTTON_STYLE, borderColor: '#f59e0b', color: '#f59e0b', background: '#1a130a' }}
              >
                ▶ RESUME
              </button>
              <button
                onClick={stepRealExec}
                style={{ ...BUTTON_STYLE, borderColor: '#3b82f6', color: '#3b82f6', background: '#0a1220' }}
                title="Execute one node then pause"
              >
                ⏭ STEP
              </button>
            </>
          ) : (
            <span style={{ fontSize: 10, color: '#22d3ee', animation: 'pulse 1s infinite' }}>⚡ Executing...</span>
          )}
        </>
      )}
      {simRunning && (
        <>
          <button
            onClick={pauseResume}
            style={{ ...BUTTON_STYLE, borderColor: '#f59e0b', color: '#f59e0b', background: '#1a130a' }}
          >
            {simState === 'paused' ? '▶ RESUME' : '⏸ PAUSE'}
          </button>
          {simState === 'paused' && (
            <button
              onClick={stepNext}
              style={{ ...BUTTON_STYLE, borderColor: '#3b82f6', color: '#3b82f6', background: '#0a1220' }}
            >
              → STEP
            </button>
          )}
          <button
            onClick={stopSim}
            style={{ ...BUTTON_STYLE, borderColor: '#f85149', color: '#f85149', background: '#1a0808' }}
          >
            ■ STOP
          </button>
        </>
      )}
      {simState === 'done' && <span style={{ fontSize: 10, color: '#10b981' }}>✓ DONE</span>}
      {simState === 'error' && <span style={{ fontSize: 10, color: '#f85149' }}>✕ ERROR</span>}
      <button
        onClick={() => setDbgOpen(!dbgOpen)}
        style={{
          ...BUTTON_STYLE,
          borderColor: dbgOpen ? '#3b82f6' : '#30363d',
          color: dbgOpen ? '#3b82f6' : '#8b949e',
        }}
      >
        {dbgOpen ? '▼ PANEL' : '▲ PANEL'}
      </button>
    </div>
  );
};
