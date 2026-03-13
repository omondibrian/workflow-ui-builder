import { WorkflowNode, Connection, StickyNote, ExecutionContext, WorkflowData } from './types';
import { DEMO_NODES, DEMO_CONNECTIONS, INITIAL_CONTEXT } from './constants';

const STORAGE_KEY = 'workflow-designer-data';
const STORAGE_VERSION = '1.0';

export interface SavedWorkflow {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  data: WorkflowData;
}

export interface StorageData {
  version: string;
  workflows: SavedWorkflow[];
  lastOpenedId?: string;
}

// Generate unique ID
const generateId = (): string => {
  return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get all storage data
const getStorageData = (): StorageData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as StorageData;
      if (data.version === STORAGE_VERSION) {
        return data;
      }
    }
  } catch (e) {
    console.error('Failed to load workflow data:', e);
  }
  return { version: STORAGE_VERSION, workflows: [] };
};

// Save all storage data
const setStorageData = (data: StorageData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save workflow data:', e);
  }
};

// List all saved workflows
export const listWorkflows = (): SavedWorkflow[] => {
  return getStorageData().workflows;
};

// Get a specific workflow
export const getWorkflow = (id: string): SavedWorkflow | undefined => {
  const data = getStorageData();
  return data.workflows.find((w) => w.id === id);
};

// Get the last opened workflow
export const getLastOpenedWorkflow = (): SavedWorkflow | undefined => {
  const data = getStorageData();
  if (data.lastOpenedId) {
    return data.workflows.find((w) => w.id === data.lastOpenedId);
  }
  return data.workflows[0];
};

// Save a workflow (create or update)
export const saveWorkflow = (
  name: string,
  nodes: WorkflowNode[],
  connections: Connection[],
  stickyNotes: StickyNote[] = [],
  context: ExecutionContext = {},
  existingId?: string
): SavedWorkflow => {
  const data = getStorageData();
  const now = new Date().toISOString();
  
  const workflowData: WorkflowData = {
    workflow: name,
    version: STORAGE_VERSION,
    nodes,
    connections,
    stickyNotes,
    lastContext: context,
  };

  let workflow: SavedWorkflow;
  
  if (existingId) {
    const index = data.workflows.findIndex((w) => w.id === existingId);
    if (index >= 0) {
      workflow = {
        ...data.workflows[index],
        name,
        updatedAt: now,
        data: workflowData,
      };
      data.workflows[index] = workflow;
    } else {
      workflow = {
        id: existingId,
        name,
        createdAt: now,
        updatedAt: now,
        data: workflowData,
      };
      data.workflows.push(workflow);
    }
  } else {
    workflow = {
      id: generateId(),
      name,
      createdAt: now,
      updatedAt: now,
      data: workflowData,
    };
    data.workflows.push(workflow);
  }

  data.lastOpenedId = workflow.id;
  setStorageData(data);
  return workflow;
};

// Delete a workflow
export const deleteWorkflow = (id: string): boolean => {
  const data = getStorageData();
  const index = data.workflows.findIndex((w) => w.id === id);
  if (index >= 0) {
    data.workflows.splice(index, 1);
    if (data.lastOpenedId === id) {
      data.lastOpenedId = data.workflows[0]?.id;
    }
    setStorageData(data);
    return true;
  }
  return false;
};

// Duplicate a workflow
export const duplicateWorkflow = (id: string): SavedWorkflow | undefined => {
  const original = getWorkflow(id);
  if (!original) return undefined;
  
  return saveWorkflow(
    `${original.name} (Copy)`,
    original.data.nodes.map((n) => ({ ...n, id: `${n.id}_copy_${Date.now()}` })),
    original.data.connections.map((c) => ({
      ...c,
      id: `${c.id}_copy_${Date.now()}`,
      from: `${c.from}_copy_${Date.now()}`,
      to: `${c.to}_copy_${Date.now()}`,
    })),
    original.data.stickyNotes,
    original.data.lastContext
  );
};

// Export workflow as JSON
export const exportWorkflow = (id: string): string | undefined => {
  const workflow = getWorkflow(id);
  if (!workflow) return undefined;
  return JSON.stringify(workflow.data, null, 2);
};

// Import workflow from JSON
export const importWorkflow = (json: string, name?: string): SavedWorkflow | undefined => {
  try {
    const data = JSON.parse(json) as WorkflowData;
    if (!data.nodes || !data.connections) {
      throw new Error('Invalid workflow format');
    }
    return saveWorkflow(
      name || data.workflow || 'Imported Workflow',
      data.nodes,
      data.connections,
      data.stickyNotes,
      data.lastContext
    );
  } catch (e) {
    console.error('Failed to import workflow:', e);
    return undefined;
  }
};

// Create demo workflow if none exists
export const ensureDemoWorkflow = (): SavedWorkflow => {
  const data = getStorageData();
  if (data.workflows.length === 0) {
    return saveWorkflow(
      'Invoice Approval',
      DEMO_NODES,
      DEMO_CONNECTIONS,
      [],
      INITIAL_CONTEXT
    );
  }
  return data.workflows[0];
};

// Set last opened workflow
export const setLastOpened = (id: string): void => {
  const data = getStorageData();
  data.lastOpenedId = id;
  setStorageData(data);
};

// Auto-save hook helper
export const createAutoSave = (
  workflowId: string | undefined,
  getName: () => string,
  getNodes: () => WorkflowNode[],
  getConns: () => Connection[],
  getStickyNotes: () => StickyNote[],
  getContext: () => ExecutionContext,
  onSaved: (workflow: SavedWorkflow) => void,
  debounceMs: number = 2000
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  const save = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      const workflow = saveWorkflow(
        getName(),
        getNodes(),
        getConns(),
        getStickyNotes(),
        getContext(),
        workflowId
      );
      onSaved(workflow);
    }, debounceMs);
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      const workflow = saveWorkflow(
        getName(),
        getNodes(),
        getConns(),
        getStickyNotes(),
        getContext(),
        workflowId
      );
      onSaved(workflow);
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { save, flush, cancel };
};
