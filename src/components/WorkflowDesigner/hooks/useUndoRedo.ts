import { useState, useCallback, useRef } from 'react';
import { WorkflowNode, Connection, HistoryState } from '../types';

const MAX_HISTORY = 50;

interface UseUndoRedoProps {
  nodes: WorkflowNode[];
  conns: Connection[];
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setConns: React.Dispatch<React.SetStateAction<Connection[]>>;
}

interface UseUndoRedoReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveState: () => void;
}

export const useUndoRedo = ({
  nodes,
  conns,
  setNodes,
  setConns,
}: UseUndoRedoProps): UseUndoRedoReturn => {
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const isUndoRedoing = useRef(false);

  const saveState = useCallback(() => {
    if (isUndoRedoing.current) return;
    
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(conns)),
      stickyNotes: [],
    };
    
    setPast((prev) => {
      const newPast = [...prev, currentState];
      if (newPast.length > MAX_HISTORY) {
        return newPast.slice(-MAX_HISTORY);
      }
      return newPast;
    });
    setFuture([]);
  }, [nodes, conns]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    isUndoRedoing.current = true;
    
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(conns)),
      stickyNotes: [],
    };
    
    const previousState = past[past.length - 1];
    
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [currentState, ...prev]);
    
    setNodes(previousState.nodes);
    setConns(previousState.connections);
    
    setTimeout(() => {
      isUndoRedoing.current = false;
    }, 0);
  }, [past, nodes, conns, setNodes, setConns]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    isUndoRedoing.current = true;
    
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(conns)),
      stickyNotes: [],
    };
    
    const nextState = future[0];
    
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, currentState]);
    
    setNodes(nextState.nodes);
    setConns(nextState.connections);
    
    setTimeout(() => {
      isUndoRedoing.current = false;
    }, 0);
  }, [future, nodes, conns, setNodes, setConns]);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    saveState,
  };
};
