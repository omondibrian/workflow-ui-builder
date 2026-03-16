import React, { useState, useRef, useCallback, useEffect } from 'react';
import { WorkflowNode, Connection, Point, StickyNote as StickyNoteType, WatchItem, ExecutionRun, Breakpoint, DataMapping, LogEntry, NodeStatus, StackFrame, WorkflowSecret } from './types';
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
  SecretsPanel,
} from './components';
import { uid } from './utils';
import {
  SavedWorkflow,
  saveWorkflow,
  getLastOpenedWorkflow,
  ensureDemoWorkflow,
  setLastOpened,
  getExecutionRuns,
  saveExecutionRun,
} from './workflowStorage';
import { WorkflowExecutor } from './workflowExecutor';

const WorkflowDesigner: React.FC = () => {
  // State
  const [nodes, setNodes] = useState<WorkflowNode[]>(DEMO_NODES);
  const [conns, setConns] = useState<Connection[]>(DEMO_CONNECTIONS);
  const [sel, setSel] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [off, setOff] = useState<Point>({ x: 20, y: 20 });
  const [wfName, setWfName] = useState<string>('Invoice Approval');
  const [dbgOpen, setDbgOpen] = useState<boolean>(true);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [breakpts, setBreakpts] = useState<Set<string>>(new Set(['n3']));
  
  // New feature states
  const [stickyNotes, setStickyNotes] = useState<StickyNoteType[]>([]);
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionRun[]>(() => getExecutionRuns());
  const [conditionalBreakpoints, setConditionalBreakpoints] = useState<Map<string, Breakpoint>>(new Map());
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  
  // Persistence and panels state
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [showSecretsPanel, setShowSecretsPanel] = useState(false);
  const [secrets, setSecrets] = useState<WorkflowSecret[]>([]);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRealExecuting, setIsRealExecuting] = useState(false);
  const [isRealPaused, setIsRealPaused] = useState(false);
  const [realExecLog, setRealExecLog] = useState<LogEntry[]>([]);
  
  // Real execution UI sync state
  const [realSimNodes, setRealSimNodes] = useState<Record<string, NodeStatus>>({});
  const [realSimConns, setRealSimConns] = useState<Set<string>>(new Set());
  const [realActiveNid, setRealActiveNid] = useState<string | null>(null);
  const [realCallStack, setRealCallStack] = useState<StackFrame[]>([]);
  const [realExecCtx, setRealExecCtx] = useState<Record<string, unknown>>({});
  const [replayingRun, setReplayingRun] = useState<ExecutionRun | null>(null);
  const [isExecutingSingleNode, setIsExecutingSingleNode] = useState(false);

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
      // Deep copy to ensure mutability
      const copiedNodes = savedWorkflow.data.nodes.map(node => ({
        ...node,
        config: { ...node.config }
      }));
      const copiedConns = savedWorkflow.data.connections.map(conn => ({ ...conn }));
      const copiedNotes = (savedWorkflow.data.stickyNotes || []).map(note => ({ ...note }));
      const copiedSecrets = (savedWorkflow.data.secrets || []).map(secret => ({ ...secret }));
      
      setNodes(copiedNodes);
      setConns(copiedConns);
      setStickyNotes(copiedNotes);
      setSecrets(copiedSecrets);
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
        const saved = saveWorkflow(wfName, nodes, conns, stickyNotes, INITIAL_CONTEXT, workflowId, secrets);
        setWorkflowId(saved.id);
        setLastSaved(new Date().toLocaleTimeString());
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [nodes, conns, stickyNotes, wfName, workflowId, secrets]);

  // Undo/Redo hook
  const { saveState, undo, redo, canUndo, canRedo } = useUndoRedo({ nodes, conns, setNodes, setConns });

  // Zoom hook
  const { zoom, zoomIn, zoomOut, zoomReset, attachWheelListener } = useZoom();
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const executorRef = useRef<WorkflowExecutor | null>(null);

  // Attach wheel listener for zoom (non-passive to allow preventDefault)
  useEffect(() => {
    return attachWheelListener(zoomContainerRef);
  }, [attachWheelListener]);

  // Multi-select hook
  const {
    selectedIds,
    selectionRect,
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

  // Real execution handler (actual HTTP calls)
  const startRealExec = useCallback(async () => {
    // Exit replay mode if active - new execution creates a fresh run
    if (replayingRun) {
      setReplayingRun(null);
      setInspectedNodeId(null);
    }
    
    setIsRealExecuting(true);
    setRealExecLog([]);
    setRealSimNodes({});
    setRealSimConns(new Set());
    setRealActiveNid(null);
    setRealCallStack([]);
    setRealExecCtx({});
    setDbgOpen(true);
    
    const startTime = Date.now();
    const activeConnsSet = new Set<string>();
    const callStackArr: StackFrame[] = [];
    const nodePerfMap: Record<string, number> = {};
    const nodeContextsMap: Record<string, Record<string, unknown>> = {}; // Per-node context snapshots
    const logEntries: LogEntry[] = [];
    let nodesExecutedCount = 0;
    let latestContext: Record<string, unknown> = {}; // Track latest context for snapshots
    
    const addLog = (entry: LogEntry) => {
      logEntries.push(entry);
      setRealExecLog((prev) => [...prev, entry]);
    };

    addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'info', msg: '⚡ Starting real execution...', nodeId: null });

    const executor = new WorkflowExecutor(nodes, conns, {
      mode: 'execute',
      timeout: 30000,
      breakpoints: breakpts, // Pass breakpoints to executor
      stepMode: debugMode, // In debug mode, pause after each node
      onNodeStart: (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        
        nodesExecutedCount++;
        
        // Update UI: set node as running
        setRealActiveNid(nodeId);
        setRealSimNodes((prev) => ({ ...prev, [nodeId]: { status: 'running' } }));
        
        // Update call stack
        const frame: StackFrame = { id: nodeId, label: node.label, type: node.type, start: Date.now() };
        callStackArr.push(frame);
        setRealCallStack([...callStackArr]);
        
        // Find and activate incoming connection
        const incomingConn = conns.find((c) => c.to === nodeId);
        if (incomingConn) {
          activeConnsSet.add(incomingConn.id);
          setRealSimConns(new Set(activeConnsSet));
        }
        
        addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'info', msg: `→ ${node.label}`, nodeId });
      },
      onNodeComplete: (nodeId, result) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        
        // Calculate duration
        const frame = callStackArr.find((f) => f.id === nodeId);
        const duration = frame?.start ? Date.now() - frame.start : 0;
        
        // Track in local map for final report
        nodePerfMap[nodeId] = duration;
        
        // Capture context snapshot for this node
        nodeContextsMap[nodeId] = { ...latestContext };
        
        // Update UI: set node as done
        setRealSimNodes((prev) => ({ ...prev, [nodeId]: { status: 'done', duration } }));
        
        // Remove from call stack
        const idx = callStackArr.findIndex((f) => f.id === nodeId);
        if (idx !== -1) callStackArr.splice(idx, 1);
        setRealCallStack([...callStackArr]);
        
        addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'success', msg: `✓ ${node.label} (${duration}ms)`, nodeId });
        console.log(`Node ${node.label} result:`, result);
      },
      onNodeError: (nodeId, error) => {
        const node = nodes.find((n) => n.id === nodeId);
        setRealSimNodes((prev) => ({ ...prev, [nodeId]: { status: 'error' } }));
        
        // Remove from call stack
        const idx = callStackArr.findIndex((f) => f.id === nodeId);
        if (idx !== -1) callStackArr.splice(idx, 1);
        setRealCallStack([...callStackArr]);
        
        addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'error', msg: `✕ ${node?.label || nodeId}: ${error.message}`, nodeId });
      },
      onBreakpoint: (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        setRealActiveNid(nodeId);
        setRealSimNodes((prev) => ({ ...prev, [nodeId]: { status: 'paused' } }));
        setIsRealPaused(true);
        addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'breakpoint', msg: `⬡ Breakpoint: ${node?.label || nodeId}`, nodeId });
        // Enable debug mode when hitting breakpoint
        setDebugMode(true);
      },
      onLog: (entry) => {
        addLog(entry);
      },
      onContextUpdate: (ctx) => {
        latestContext = { ...ctx }; // Track for per-node snapshots
        setRealExecCtx({ ...ctx });
        console.log('Context updated:', ctx);
      },
    }, secrets);
    
    // Store executor ref for resume/pause controls
    executorRef.current = executor;

    let finalContext: Record<string, unknown> = {};
    let success = true;
    
    try {
      finalContext = await executor.execute(INITIAL_CONTEXT) as Record<string, unknown>;
      addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'success', msg: '⚡ Execution completed!', nodeId: null });
      console.log('Final context:', finalContext);
    } catch (e) {
      success = false;
      addLog({ id: uid(), ts: new Date().toISOString().slice(11, 23), level: 'error', msg: `Execution failed: ${(e as Error).message}`, nodeId: null });
    }

    // Save execution to history using local variables (React state may be stale)
    const run: ExecutionRun = {
      id: uid(),
      timestamp: new Date().toISOString(),
      startedAt: new Date(startTime).toISOString(),
      workflowName: wfName,
      duration: Date.now() - startTime,
      status: success ? 'success' : 'error',
      nodesExecuted: nodesExecutedCount,
      log: logEntries,
      context: finalContext,
      nodePerf: nodePerfMap,
      nodeContexts: nodeContextsMap, // Per-node context snapshots
    };
    setExecutionHistory((prev) => [run, ...prev].slice(0, 50));
    saveExecutionRun(run); // Persist to localStorage
    
    setRealActiveNid(null);
    setIsRealExecuting(false);
    setIsRealPaused(false);
    executorRef.current = null;
  }, [nodes, conns, setDbgOpen, wfName, secrets, breakpts, debugMode, replayingRun]);

  // Resume real execution after breakpoint
  const resumeRealExec = useCallback(() => {
    if (executorRef.current && isRealPaused) {
      setIsRealPaused(false);
      executorRef.current.resume();
    }
  }, [isRealPaused]);

  // Step execution - execute one node then pause again
  const stepRealExec = useCallback(() => {
    if (executorRef.current && isRealPaused) {
      // Don't set isRealPaused to false - it will be set when breakpoint fires again
      executorRef.current.step();
    }
  }, [isRealPaused]);

  // Inspected node for debugging (can be different from active node when paused)
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);

  // Sync inspected node with selection when paused
  useEffect(() => {
    if ((isRealPaused || simState === 'paused') && sel) {
      setInspectedNodeId(sel);
    }
  }, [sel, isRealPaused, simState]);

  // Clear inspected node when execution resumes or ends
  useEffect(() => {
    if (!isRealExecuting && simState === 'idle') {
      setInspectedNodeId(null);
    }
  }, [isRealExecuting, simState]);

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
    const run = executionHistory.find((r) => r.id === runId);
    if (!run) return;
    
    // Reset inspection state when starting/re-starting replay
    setInspectedNodeId(null);
    
    // Set replay mode with the run data (use copies to avoid mutating stored runs)
    setReplayingRun(run);
    setRealExecLog([...run.log]); // Copy array
    setRealExecCtx({ ...run.context }); // Copy object
    setDbgOpen(true);
    setDebugMode(true);
    
    // Reconstruct node statuses from log and performance data
    const nodeStatuses: Record<string, NodeStatus> = {};
    run.log.forEach((entry) => {
      if (entry.nodeId) {
        if (entry.level === 'error') {
          nodeStatuses[entry.nodeId] = { status: 'error', duration: run.nodePerf[entry.nodeId] };
        } else if (entry.msg.includes('✓')) {
          nodeStatuses[entry.nodeId] = { status: 'done', duration: run.nodePerf[entry.nodeId] };
        }
      }
    });
    setRealSimNodes(nodeStatuses);
  }, [executionHistory, setDbgOpen]);

  // Stop replay mode
  const stopReplay = useCallback(() => {
    setReplayingRun(null);
    setRealExecLog([]);
    setRealExecCtx({});
    setRealSimNodes({});
    setInspectedNodeId(null); // Reset node inspection
  }, []);

  // Execute a single node with current context
  const executeSingleNode = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setIsExecutingSingleNode(true);
    setDbgOpen(true);
    
    // Use current context (from execution, replay, or initial)
    const currentCtx = isRealExecuting || realExecLog.length > 0 ? realExecCtx : execCtx;
    
    const addLog = (entry: LogEntry) => {
      setRealExecLog(prev => [...prev, entry]);
    };
    
    try {
      const { context, duration } = await WorkflowExecutor.executeSingleNode(
        node,
        { ...currentCtx },
        secrets,
        {
          onStart: () => {
            setRealSimNodes(prev => ({ ...prev, [nodeId]: { status: 'running' } }));
            setRealActiveNid(nodeId);
          },
          onComplete: (res) => {
            console.log(`Single node ${node.label} result:`, res);
          },
          onError: () => {
            setRealSimNodes(prev => ({ ...prev, [nodeId]: { status: 'error' } }));
          },
          onLog: addLog,
        }
      );
      // Update state after successful execution
      setRealSimNodes(prev => ({ ...prev, [nodeId]: { status: 'done', duration } }));
      setRealExecCtx(context);
    } catch (error) {
      console.error('Single node execution failed:', error);
    } finally {
      setIsExecutingSingleNode(false);
      setRealActiveNid(null);
    }
  }, [nodes, secrets, isRealExecuting, realExecLog.length, realExecCtx, execCtx, setDbgOpen]);

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
    // Deep copy to ensure mutability
    const copiedNodes = workflow.data.nodes.map(node => ({
      ...node,
      config: { ...node.config }
    }));
    const copiedConns = workflow.data.connections.map(conn => ({ ...conn }));
    const copiedNotes = (workflow.data.stickyNotes || []).map(note => ({ ...note }));
    const copiedSecrets = (workflow.data.secrets || []).map(secret => ({ ...secret }));
    
    setNodes(copiedNodes);
    setConns(copiedConns);
    setStickyNotes(copiedNotes);
    setSecrets(copiedSecrets);
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
    setSecrets([]);
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

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keyboard shortcuts when focused on input elements
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        (activeElement as HTMLElement).isContentEditable ||
        activeElement.closest('.monaco-editor') // Monaco editor
      );

      if (e.ctrlKey || e.metaKey) {
        // Allow copy/paste/cut/select-all in input fields
        if (isInputFocused && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) {
          return; // Let browser handle it
        }
        
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
        // Allow delete/backspace in input fields
        if (isInputFocused) {
          return; // Let browser handle it
        }
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelected, paste, deleteSelected, selectedIds]);

  const editingNode = nodes.find((n) => n.id === editingNodeId);
  const simRunning = simState === 'running' || simState === 'paused';

  // Compute context to show - in replay mode with node selected, show that node's context
  const displayExecCtx = (() => {
    if (replayingRun && inspectedNodeId && replayingRun.nodeContexts?.[inspectedNodeId]) {
      return replayingRun.nodeContexts[inspectedNodeId];
    }
    if (isRealExecuting || realExecLog.length > 0) {
      return realExecCtx;
    }
    return execCtx;
  })();

  // Handle node double-click to open properties panel
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);

  // Close properties panel
  const closePropertiesPanel = useCallback(() => {
    setEditingNodeId(null);
  }, []);

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
        startRealExec={startRealExec}
        isRealExecuting={isRealExecuting}
        isRealPaused={isRealPaused}
        resumeRealExec={resumeRealExec}
        stepRealExec={stepRealExec}
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
          execCtx={displayExecCtx}
          activeNid={isRealExecuting ? realActiveNid : activeNid}
          conns={conns}
          isExecuting={isRealExecuting || simState === 'running' || simState === 'paused'}
          isPaused={isRealPaused || simState === 'paused' || !!replayingRun}
          inspectedNodeId={inspectedNodeId}
          onNodeInspect={setInspectedNodeId}
          replayingRun={replayingRun}
        />

        {/* Canvas + Debug Panel column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Canvas with zoom */}
          <div
            ref={zoomContainerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
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
                simNodes={isRealExecuting || realExecLog.length > 0 ? realSimNodes : simNodes}
                simConns={isRealExecuting || realExecLog.length > 0 ? realSimConns : simConns}
                activeNid={isRealExecuting ? realActiveNid : activeNid}
                debugMode={debugMode}
                breakpts={breakpts}
                simRunning={simRunning || isRealExecuting}
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
                onNodeDoubleClick={handleNodeDoubleClick}
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
              simState={isRealExecuting ? 'running' : simState}
              simNodes={isRealExecuting || realExecLog.length > 0 ? realSimNodes : simNodes}
              activeNid={isRealExecuting ? realActiveNid : activeNid}
              execCtx={isRealExecuting || realExecLog.length > 0 ? realExecCtx : execCtx}
              execLog={isRealExecuting || realExecLog.length > 0 ? realExecLog : execLog}
              callStack={isRealExecuting || realExecLog.length > 0 ? realCallStack : callStack}
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
              clearLog={() => { clearLog(); setRealExecLog([]); setRealSimNodes({}); setRealSimConns(new Set()); setRealCallStack([]); stopReplay(); }}
              setSel={setSel}
              replayingRun={replayingRun}
              stopReplay={stopReplay}
            />
          )}
        </div>

        {/* Properties Panel */}
        {editingNode && (
          <PropertiesPanel
            selectedNode={editingNode}
            nodes={nodes}
            conns={conns}
            simNodes={simNodes}
            debugMode={debugMode}
            breakpts={breakpts}
            toggleBP={toggleBP}
            setNodes={setNodes}
            delNode={(id) => { delNode(id); closePropertiesPanel(); }}
            delConn={delConn}
            onClose={closePropertiesPanel}
            secrets={secrets}
            onExecuteNode={executeSingleNode}
            isExecutingNode={isExecutingSingleNode}
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

      {/* Secrets button */}
      <button
        onClick={() => setShowSecretsPanel(true)}
        style={{
          position: 'fixed',
          bottom: 12,
          left: 120,
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
        🔐 Secrets {secrets.length > 0 && `(${secrets.length})`}
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

      {/* Secrets Panel */}
      <SecretsPanel
        secrets={secrets}
        onSecretsChange={setSecrets}
        isOpen={showSecretsPanel}
        onClose={() => setShowSecretsPanel(false)}
      />
    </div>
  );
};

export default WorkflowDesigner;
