import { useState, useCallback } from 'react';
import { WorkflowNode, Connection, SelectionRect } from '../types';
import { NODE_WIDTH, NODE_HEIGHT } from '../constants';
import { generateId } from '../utils';

interface UseMultiSelectProps {
  nodes: WorkflowNode[];
  conns: Connection[];
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setConns: React.Dispatch<React.SetStateAction<Connection[]>>;
  zoom: number;
  saveState: () => void;
}

interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  selectionRect: SelectionRect | null;
  clipboard: { nodes: WorkflowNode[]; connections: Connection[] } | null;
  startSelection: (x: number, y: number) => void;
  updateSelection: (x: number, y: number) => void;
  endSelection: () => void;
  toggleSelect: (id: string) => void;
  copySelected: () => void;
  paste: () => void;
  deleteSelected: () => void;
}

export const useMultiSelect = ({
  nodes,
  conns,
  setNodes,
  setConns,
  zoom,
  saveState,
}: UseMultiSelectProps): UseMultiSelectReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [clipboard, setClipboard] = useState<{ nodes: WorkflowNode[]; connections: Connection[] } | null>(null);

  const startSelection = useCallback((x: number, y: number) => {
    setSelectionStart({ x, y });
    setSelectionRect({ x, y, width: 0, height: 0 });
  }, []);

  const updateSelection = useCallback((x: number, y: number) => {
    if (!selectionStart) return;
    
    const rectX = Math.min(selectionStart.x, x);
    const rectY = Math.min(selectionStart.y, y);
    const width = Math.abs(x - selectionStart.x);
    const height = Math.abs(y - selectionStart.y);
    
    setSelectionRect({ x: rectX, y: rectY, width, height });
  }, [selectionStart]);

  const endSelection = useCallback(() => {
    if (selectionRect && selectionRect.width > 5 && selectionRect.height > 5) {
      const selected = new Set<string>();
      nodes.forEach((node) => {
        const nodeRight = node.x + NODE_WIDTH;
        const nodeBottom = node.y + NODE_HEIGHT;
        const rectRight = selectionRect.x + selectionRect.width;
        const rectBottom = selectionRect.y + selectionRect.height;
        
        if (
          node.x < rectRight &&
          nodeRight > selectionRect.x &&
          node.y < rectBottom &&
          nodeBottom > selectionRect.y
        ) {
          selected.add(node.id);
        }
      });
      setSelectedIds(selected);
    }
    setSelectionStart(null);
    setSelectionRect(null);
  }, [selectionRect, nodes]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const copySelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    
    const selectedNodes = nodes.filter((n) => selectedIds.has(n.id));
    const internalConnections = conns.filter(
      (c) => selectedIds.has(c.from) && selectedIds.has(c.to)
    );
    
    setClipboard({
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      connections: JSON.parse(JSON.stringify(internalConnections)),
    });
  }, [selectedIds, nodes, conns]);

  const paste = useCallback(() => {
    if (!clipboard) return;
    
    saveState();
    
    const idMap = new Map<string, string>();
    const newNodes: WorkflowNode[] = clipboard.nodes.map((n) => {
      const newId = generateId();
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        x: n.x + 40,
        y: n.y + 40,
      };
    });
    
    const newConnections: Connection[] = clipboard.connections.map((c) => ({
      ...c,
      id: generateId(),
      from: idMap.get(c.from) || c.from,
      to: idMap.get(c.to) || c.to,
    }));
    
    setNodes((ns) => [...ns, ...newNodes]);
    setConns((cs) => [...cs, ...newConnections]);
    setSelectedIds(new Set(newNodes.map((n) => n.id)));
  }, [clipboard, saveState, setNodes, setConns]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    
    saveState();
    setNodes((ns) => ns.filter((n) => !selectedIds.has(n.id)));
    setConns((cs) =>
      cs.filter((c) => !selectedIds.has(c.from) && !selectedIds.has(c.to))
    );
    setSelectedIds(new Set());
  }, [selectedIds, saveState, setNodes, setConns]);

  return {
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
  };
};
