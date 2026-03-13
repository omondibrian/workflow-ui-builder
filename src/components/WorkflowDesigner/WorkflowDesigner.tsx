import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WorkflowNode, Connection, Point, StickyNote as StickyNoteType, WatchItem, ExecutionRun, Breakpoint, DataMapping } from './types';
import { DEMO_NODES, DEMO_CONNECTIONS, INITIAL_CONTEXT } from './constants';
import {
  useWorkflowSimulation,
  useCanvasInteractions,
  useUndoRedo,
  useMultiSelect,
  useZoom,
  useWorkflowLinting,
} from './hooks';
import {
  Toolbar,
  NodePalette,
  WorkflowCanvas,
  DebugPanel,
  PropertiesPanel,
  StickyNote,
  Minimap,
  DataMappingPanel,
  WorkflowListPanel,
} from './components';
import { uid } from './utils';
import {
  SavedWorkflow,
  saveWorkflow,
  getLastOpenedWorkflow,
  ensureDemoWorkflow,
  setLastOpened,
} from './workflowStorage';

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
  
  // New feature states
  const [stickyNotes, setStickyNotes] = useState<StickyNoteType[]>([]);
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionRun[]>([]);
  const [conditionalBreakpoints, setConditionalBreakpoints] = useState<Map<string, Breakpoint>>(new Map());
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  
  // Persistence and panels state
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Update viewport size
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setViewportSize({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load workflow from localStorage on mount
  useEffect(() => {
    const savedWorkflow = getLastOpenedWorkflow();
    if (savedWorkflow) {
      setNodes(savedWorkflow.data.nodes);
      setConns(savedWorkflow.data.connections);
      setStickyNotes(savedWorkflow.data.stickyNotes || []);
      setWfName(savedWorkflow.name);
      setWorkflowId(savedWorkflow.id);
    } else {
      // Create demo workflow if none exists
      const demo = ensureDemoWorkflow();
      setWorkflowId(demo.id);
    }
  }, []);

  // Auto-save workflow on changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (nodes.length > 0) {
        const saved = saveWorkflow(wfName, nodes, conns, stickyNotes, INITIAL_CONTEXT, workflowId);
        setWorkflowId(saved.id);
        setLastSaved(new Date().toLocaleTimeString());
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [nodes, conns, stickyNotes, wfName, workflowId]);

  // Undo/Redo hook
  const { saveState, undo, redo, canUndo, canRedo } = useUndoRedo({ nodes, conns, setNodes, setConns });

  // Zoom hook
  const { zoom, setZoom, zoomIn, zoomOut, zoomReset, handleWheel } = useZoom();

  // Multi-select hook
  const {
    selectedIds,
    selectionRect,
    clipboard,
    startSelection,
    updateSelection,
    endSelection,
    toggleSelect,
    copySelected,
    paste,
    deleteSelected,
  } = useMultiSelect({ nodes, conns, setNodes, setConns, zoom, saveState });

  // Workflow linting hook
  const { lintIssues, hasErrors, hasWarnings } = useWorkflowLinting({ nodes, conns });

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

  // Conditional breakpoint functions
  const setConditionalBP = useCallback((nodeId: string, condition: string) => {
    setConditionalBreakpoints((prev) => {
      const next = new Map(prev);
      next.set(nodeId, { nodeId, condition, enabled: true });
      return next;
    });
    setBreakpts((bp) => new Set(Array.from(bp).concat(nodeId)));
  }, []);

  const removeConditionalBP = useCallback((nodeId: string) => {
    setConditionalBreakpoints((prev) => {
      const next = new Map(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  // Watch panel functions
  const addWatch = useCallback((expression: string) => {
    setWatchItems((prev) => [...prev, { id: uid(), expression, pinned: false }]);
  }, []);

  const removeWatch = useCallback((id: string) => {
    setWatchItems((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // Execution history replay
  const replayRun = useCallback((runId: string) => {
    // In a real implementation, this would restore the state from that run
    console.log('Replaying run:', runId);
  }, []);

  // Sticky note functions
  const addStickyNote = useCallback(() => {
    const newNote: StickyNoteType = {
      id: uid(),
      x: 100 + stickyNotes.length * 20,
      y: 100 + stickyNotes.length * 20,
      text: '',
      color: '#fef08a',
      width: 150,
      height: 100,
    };
    setStickyNotes((prev) => [...prev, newNote]);
  }, [stickyNotes.length]);

  const updateStickyNote = useCallback((id: string, updates: Partial<StickyNoteType>) => {
    setStickyNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
  }, []);

  const deleteStickyNote = useCallback((id: string) => {
    setStickyNotes((prev) => prev.filter((note) => note.id !== id));
  }, []);

  // Minimap viewport change
  const handleViewportChange = useCallback((x: number, y: number) => {
    setOff({ x, y });
  }, []);

  // Import workflow JSON
  const importWorkflow = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (data.nodes && Array.isArray(data.nodes)) {
        setNodes(data.nodes);
      }
      if (data.connections && Array.isArray(data.connections)) {
        setConns(data.connections);
      }
      if (data.name) {
        setWfName(data.name);
      }
      saveState();
    } catch (e) {
      console.error('Failed to import workflow:', e);
    }
  }, [saveState]);

  // Load a saved workflow from the list
  const loadWorkflow = useCallback((workflow: SavedWorkflow) => {
    setNodes(workflow.data.nodes);
    setConns(workflow.data.connections);
    setStickyNotes(workflow.data.stickyNotes || []);
    setWfName(workflow.name);
    setWorkflowId(workflow.id);
    setLastOpened(workflow.id);
    setShowWorkflowList(false);
    saveState();
  }, [saveState]);

  // Create a new workflow
  const createNewWorkflow = useCallback(() => {
    setNodes([]);
    setConns([]);
    setStickyNotes([]);
    setWfName('New Workflow');
    setWorkflowId(undefined);
    setShowWorkflowList(false);
    saveState();
  }, [saveState]);

  // Update connection mappings
  const updateConnectionMappings = useCallback((connectionId: string, mappings: DataMapping[]) => {
    setConns((prev) =>
      prev.map((c) => (c.id === connectionId ? { ...c, mappings } : c))
    );
    saveState();
  }, [saveState]);

  // Open data mapping panel for a connection
  const openDataMapping = useCallback((connectionId: string) => {
    const connection = conns.find((c) => c.id === connectionId);
    if (connection) {
      setEditingConnection(connection);
    }
  }, [conns]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key === 'c') {
          e.preventDefault();
          copySelected();
        } else if (e.key === 'v') {
          e.preventDefault();
          paste();
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelected, paste, deleteSelected, selectedIds]);

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
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        zoom={zoom}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        zoomReset={zoomReset}
        hasLintErrors={hasErrors}
        hasLintWarnings={hasWarnings}
        lintIssues={lintIssues}
        addStickyNote={addStickyNote}
        importWorkflow={importWorkflow}
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Canvas with zoom */}
          <div
            style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
            onWheel={(e) => {
              e.preventDefault();
              handleWheel(e.nativeEvent as WheelEvent);
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${100 / zoom}%`,
                height: `${100 / zoom}%`,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
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
              
              {/* Sticky Notes */}
              {stickyNotes.map((note) => (
                <StickyNote
                  key={note.id}
                  note={note}
                  zoom={zoom}
                  onUpdate={updateStickyNote}
                  onDelete={deleteStickyNote}
                />
              ))}
              
              {/* Selection Rectangle */}
              {selectionRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: selectionRect.x,
                    top: selectionRect.y,
                    width: selectionRect.width,
                    height: selectionRect.height,
                    border: '1px dashed #58a6ff',
                    background: 'rgba(88, 166, 255, 0.1)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
            
            {/* Minimap */}
            <Minimap
              nodes={nodes}
              conns={conns}
              zoom={zoom}
              panOffset={off}
              viewportWidth={viewportSize.width}
              viewportHeight={viewportSize.height}
              onViewportChange={handleViewportChange}
            />
          </div>

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
              conditionalBreakpoints={conditionalBreakpoints}
              debugMode={debugMode}
              watchItems={watchItems}
              executionHistory={executionHistory}
              toggleBP={toggleBP}
              setConditionalBP={setConditionalBP}
              removeConditionalBP={removeConditionalBP}
              addWatch={addWatch}
              removeWatch={removeWatch}
              replayRun={replayRun}
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

      {/* Save indicator */}
      {lastSaved && (
        <div
          style={{
            position: 'fixed',
            bottom: 12,
            right: 12,
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            color: '#484f58',
            zIndex: 100,
          }}
        >
          💾 Saved at {lastSaved}
        </div>
      )}

      {/* Workflow list button */}
      <button
        onClick={() => setShowWorkflowList(true)}
        style={{
          position: 'fixed',
          bottom: 12,
          left: 12,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 4,
          padding: '6px 12px',
          fontSize: 11,
          color: '#8b949e',
          cursor: 'pointer',
          zIndex: 100,
          fontFamily: 'monospace',
        }}
      >
        📁 Workflows
      </button>

      {/* Workflow List Panel */}
      {showWorkflowList && (
        <WorkflowListPanel
          currentWorkflowId={workflowId}
          onSelect={loadWorkflow}
          onNew={createNewWorkflow}
          onClose={() => setShowWorkflowList(false)}
        />
      )}

      {/* Data Mapping Panel */}
      {editingConnection && (
        <DataMappingPanel
          connection={editingConnection}
          sourceNode={nodes.find((n) => n.id === editingConnection.from)!}
          targetNode={nodes.find((n) => n.id === editingConnection.to)!}
          onUpdate={(mappings) => {
            updateConnectionMappings(editingConnection.id, mappings);
            setEditingConnection(null);
          }}
          onClose={() => setEditingConnection(null)}
        />
      )}
    </div>
  );
};

export default WorkflowDesigner;
