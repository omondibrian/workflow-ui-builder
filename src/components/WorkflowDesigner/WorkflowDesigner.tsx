import React, { useState, useRef } from 'react';
import { WorkflowNode, Connection, Point } from './types';
import { DEMO_NODES, DEMO_CONNECTIONS } from './constants';
import { useWorkflowSimulation, useCanvasInteractions } from './hooks';
import {
  Toolbar,
  NodePalette,
  WorkflowCanvas,
  DebugPanel,
  PropertiesPanel,
} from './components';

const WorkflowDesigner: React.FC = () => {
  // State
  const [nodes, setNodes] = useState<WorkflowNode[]>(DEMO_NODES);
  const [conns, setConns] = useState<Connection[]>(DEMO_CONNECTIONS);
  const [sel, setSel] = useState<string | null>(null);
  const [off, setOff] = useState<Point>({ x: 20, y: 20 });
  const [wfName, setWfName] = useState<string>('Invoice Approval');
  const [dbgOpen, setDbgOpen] = useState<boolean>(true);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [breakpts, setBreakpts] = useState<Set<string>>(new Set(['n3']));

  const canvasRef = useRef<HTMLDivElement>(null);

  // Simulation hook
  const {
    simState,
    simNodes,
    simConns,
    activeNid,
    execCtx,
    execLog,
    callStack,
    startSim,
    stopSim,
    stepNext,
    pauseResume,
    clearLog,
  } = useWorkflowSimulation({
    nodes,
    conns,
    wfName,
    debugMode,
    breakpts,
    setDbgOpen,
  });

  // Canvas interactions hook
  const {
    drag,
    pan,
    conn,
    mxy,
    hover,
    setHover,
    onMove,
    onUp,
    onDown,
    startDrag,
    startConn,
    endConn,
    delNode,
    delConn,
    addNode,
    onDrop,
  } = useCanvasInteractions({
    nodes,
    setNodes,
    conns,
    setConns,
    sel,
    setSel,
    canvasRef,
    off,
    setOff,
  });

  const toggleBP = (id: string) => {
    setBreakpts((bp) => {
      const n = new Set(bp);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectedNode = nodes.find((n) => n.id === sel);
  const simRunning = simState === 'running' || simState === 'paused';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'monospace',
        background: '#0d1117',
        color: '#e6edf3',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Toolbar */}
      <Toolbar
        wfName={wfName}
        setWfName={setWfName}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        dbgOpen={dbgOpen}
        setDbgOpen={setDbgOpen}
        simState={simState}
        simRunning={simRunning}
        startSim={startSim}
        stopSim={stopSim}
        pauseResume={pauseResume}
        stepNext={stepNext}
        setNodes={setNodes}
        setConns={setConns}
        setSel={setSel}
        nodes={nodes}
        conns={conns}
        execCtx={execCtx}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Node Palette */}
        <NodePalette
          nodes={nodes}
          debugMode={debugMode}
          breakpts={breakpts}
          toggleBP={toggleBP}
          addNode={addNode}
          off={off}
        />

        {/* Canvas + Debug Panel column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Canvas */}
          <WorkflowCanvas
            canvasRef={canvasRef}
            nodes={nodes}
            conns={conns}
            off={off}
            sel={sel}
            hover={hover}
            drag={drag}
            pan={pan}
            conn={conn}
            mxy={mxy}
            simNodes={simNodes}
            simConns={simConns}
            activeNid={activeNid}
            debugMode={debugMode}
            breakpts={breakpts}
            simRunning={simRunning}
            onMove={onMove}
            onUp={onUp}
            onDown={onDown}
            onDrop={onDrop}
            setHover={setHover}
            startDrag={startDrag}
            startConn={startConn}
            endConn={endConn}
            delNode={delNode}
            toggleBP={toggleBP}
          />

          {/* Debug Panel */}
          {dbgOpen && (
            <DebugPanel
              nodes={nodes}
              simState={simState}
              simNodes={simNodes}
              activeNid={activeNid}
              execCtx={execCtx}
              execLog={execLog}
              callStack={callStack}
              breakpts={breakpts}
              debugMode={debugMode}
              toggleBP={toggleBP}
              clearLog={clearLog}
              setSel={setSel}
            />
          )}
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <PropertiesPanel
            selectedNode={selectedNode}
            nodes={nodes}
            conns={conns}
            simNodes={simNodes}
            debugMode={debugMode}
            breakpts={breakpts}
            toggleBP={toggleBP}
            setNodes={setNodes}
            delNode={delNode}
            delConn={delConn}
          />
        )}
      </div>
    </div>
  );
};

export default WorkflowDesigner;
