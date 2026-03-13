import React from 'react';
import { SimState, WorkflowNode, Connection, ExecutionContext } from '../types';
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
  stopSim: () => void;
  pauseResume: () => void;
  stepNext: () => void;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setConns: React.Dispatch<React.SetStateAction<Connection[]>>;
  setSel: (sel: string | null) => void;
  nodes: WorkflowNode[];
  conns: Connection[];
  execCtx: ExecutionContext;
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
  stopSim,
  pauseResume,
  stepNext,
  setNodes,
  setConns,
  setSel,
  nodes,
  conns,
  execCtx,
}) => {
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
      <div style={{ flex: 1 }} />
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
      <button style={BUTTON_STYLE} onClick={exportJSON}>
        Export
      </button>
      {!simRunning && (
        <button
          onClick={startSim}
          style={{ ...BUTTON_STYLE, borderColor: '#10b981', color: '#10b981', background: '#0a1f13' }}
        >
          ▶ RUN
        </button>
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
