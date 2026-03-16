import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { WorkflowNode, Connection, DragState, PanState, ConnState, Point, NodeType } from '../types';
import { TYPES, NODE_WIDTH, NODE_HEIGHT } from '../constants';
import { generateId, getOutputPort } from '../utils';

interface UseCanvasInteractionsProps {
  nodes: WorkflowNode[];
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  conns: Connection[];
  setConns: React.Dispatch<React.SetStateAction<Connection[]>>;
  sel: string | null;
  setSel: (sel: string | null) => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  off: Point;
  setOff: (off: Point) => void;
}

interface UseCanvasInteractionsReturn {
  drag: DragState | null;
  pan: PanState | null;
  conn: ConnState | null;
  mxy: Point;
  hover: string | null;
  setHover: (id: string | null) => void;
  onMove: (e: React.MouseEvent) => void;
  onUp: () => void;
  onDown: (e: React.MouseEvent) => void;
  startDrag: (e: React.MouseEvent, n: WorkflowNode) => void;
  startConn: (e: React.MouseEvent, n: WorkflowNode, port: number) => void;
  endConn: (e: React.MouseEvent, tn: WorkflowNode) => void;
  delNode: (id: string) => void;
  delConn: (id: string) => void;
  addNode: (type: NodeType, x: number, y: number) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const useCanvasInteractions = ({
  nodes,
  setNodes,
  conns,
  setConns,
  sel,
  setSel,
  canvasRef,
  off,
  setOff,
}: UseCanvasInteractionsProps): UseCanvasInteractionsReturn => {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [conn, setConn] = useState<ConnState | null>(null);
  const [mxy, setMxy] = useState<Point>({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);

  // Refs to track state for global event handlers
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const connRef = useRef<ConnState | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  const clearAllInteractions = useCallback(() => {
    // Clear refs immediately for global handlers
    dragRef.current = null;
    panRef.current = null;
    connRef.current = null;
    // Then update state
    setDrag(null);
    setPan(null);
    setConn(null);
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      if (drag) {
        const dx = e.clientX - drag.sx;
        const dy = e.clientY - drag.sy;
        setNodes((ns) =>
          ns.map((n) =>
            n.id === drag.id
              ? { ...n, x: Math.max(0, drag.ox + dx), y: Math.max(0, drag.oy + dy) }
              : n
          )
        );
      }
      if (pan) {
        setOff({ x: pan.ox + e.clientX - pan.sx, y: pan.oy + e.clientY - pan.sy });
      }
      if (conn && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        setMxy({ x: e.clientX - r.left - off.x, y: e.clientY - r.top - off.y });
      }
    },
    [drag, pan, conn, canvasRef, off, setNodes, setOff]
  );

  const onUp = useCallback(() => {
    clearAllInteractions();
  }, [clearAllInteractions]);

  // Global listeners for mouseup (outside canvas) and Escape key to cancel drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Always clear interactions on any mouse up
      clearAllInteractions();
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Handle mouse move globally when dragging
      const currentDrag = dragRef.current;
      const currentPan = panRef.current;
      
      if (currentDrag) {
        const dx = e.clientX - currentDrag.sx;
        const dy = e.clientY - currentDrag.sy;
        setNodes((ns) =>
          ns.map((n) =>
            n.id === currentDrag.id
              ? { ...n, x: Math.max(0, currentDrag.ox + dx), y: Math.max(0, currentDrag.oy + dy) }
              : n
          )
        );
      }
      if (currentPan) {
        setOff({ x: currentPan.ox + e.clientX - currentPan.sx, y: currentPan.oy + e.clientY - currentPan.sy });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel drag and restore original position
        const currentDrag = dragRef.current;
        if (currentDrag) {
          setNodes((ns) =>
            ns.map((n) =>
              n.id === currentDrag.id ? { ...n, x: currentDrag.ox, y: currentDrag.oy } : n
            )
          );
        }
        clearAllInteractions();
      }
    };

    // Use bubble phase so React events on ports fire first
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearAllInteractions, setNodes, setOff]);

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-node]') && !target.closest('[data-port]')) {
        setSel(null);
        const panState = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
        panRef.current = panState; // Set ref immediately for global handlers
        setPan(panState);
      }
    },
    [off, setSel]
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, n: WorkflowNode) => {
      e.stopPropagation();
      setSel(n.id);
      const dragState = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
      dragRef.current = dragState; // Set ref immediately for global handlers
      setDrag(dragState);
    },
    [setSel]
  );

  const startConn = useCallback(
    (e: React.MouseEvent, n: WorkflowNode, port: number) => {
      e.stopPropagation();
      e.preventDefault();
      const connState = { fromId: n.id, port, sp: getOutputPort(n, port) };
      connRef.current = connState; // Set ref immediately for global handlers
      setConn(connState);
      if (canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        setMxy({ x: e.clientX - r.left - off.x, y: e.clientY - r.top - off.y });
      }
    },
    [canvasRef, off]
  );

  const endConn = useCallback(
    (e: React.MouseEvent, tn: WorkflowNode) => {
      e.stopPropagation();
      // Use ref for immediate access to avoid stale closure issues
      const currentConn = connRef.current;
      if (!currentConn || currentConn.fromId === tn.id) {
        connRef.current = null;
        setConn(null);
        return;
      }
      // Use functional update to get latest connections array
      setConns((currentConns) => {
        // Check for duplicate connection
        if (currentConns.some((c) => c.from === currentConn.fromId && c.to === tn.id && c.port === currentConn.port)) {
          return currentConns; // Already exists, don't add
        }
        const fn = nodes.find((n) => n.id === currentConn.fromId);
        if (fn) {
          const lbl = TYPES[fn.type].outs > 1 ? (currentConn.port === 0 ? 'Yes' : 'No') : '';
          return [...currentConns, { id: generateId(), from: currentConn.fromId, to: tn.id, port: currentConn.port, label: lbl }];
        }
        return currentConns;
      });
      connRef.current = null;
      setConn(null);
    },
    [nodes, setConns]
  );

  const delNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setConns((cs) => cs.filter((c) => c.from !== id && c.to !== id));
      if (sel === id) setSel(null);
    },
    [sel, setSel, setNodes, setConns]
  );

  const delConn = useCallback(
    (id: string) => {
      setConns((cs) => cs.filter((c) => c.id !== id));
    },
    [setConns]
  );

  const addNode = useCallback(
    (type: NodeType, x: number, y: number) => {
      const id = generateId();
      setNodes((ns) => [...ns, { id, type, label: TYPES[type].label, x, y, config: {} }]);
      setSel(id);
    },
    [setNodes, setSel]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData('type') as NodeType;
      if (!type || !canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      addNode(type, e.clientX - r.left - off.x - NODE_WIDTH / 2, e.clientY - r.top - off.y - NODE_HEIGHT / 2);
    },
    [addNode, canvasRef, off]
  );

  return {
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
  };
};
