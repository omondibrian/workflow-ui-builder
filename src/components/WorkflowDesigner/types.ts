export type NodeType = 'trigger' | 'task' | 'decision' | 'parallel' | 'end' | 'loop' | 'delay';

export type SimStatus = 'idle' | 'pending' | 'running' | 'done' | 'paused' | 'error';

export type SimState = 'idle' | 'running' | 'paused' | 'done' | 'error';

export interface NodeConfig {
  triggerType?: string;
  actionType?: string;
  endpoint?: string;
  condition?: string;
  loopCount?: number;
  exitCondition?: string;
  delayMs?: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: NodeConfig;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  port: number;
  label: string;
  isError?: boolean;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

export interface NodeTypeConfig {
  color: string;
  label: string;
  outs: number;
  errorPort?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragState {
  id: string;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

export interface PanState {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

export interface ConnState {
  fromId: string;
  port: number;
  sp: Point;
}

export interface NodeStatus {
  status: SimStatus;
  duration?: number;
}

export interface LogEntry {
  id: string;
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'breakpoint';
  msg: string;
  nodeId: string | null;
}

export interface StackFrame {
  id: string;
  label: string;
  type: NodeType;
  entered: string;
}

export interface ExecutionContext {
  [key: string]: string | number | boolean | undefined;
}

export interface WorkflowData {
  workflow: string;
  version: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  stickyNotes?: StickyNote[];
  lastContext: ExecutionContext;
}

// Undo/Redo
export interface HistoryState {
  nodes: WorkflowNode[];
  connections: Connection[];
  stickyNotes: StickyNote[];
}

// Conditional breakpoints
export interface Breakpoint {
  nodeId: string;
  condition?: string;
  enabled: boolean;
}

// Watch items
export interface WatchItem {
  id: string;
  expression: string;
  pinned: boolean;
}

// Execution history
export interface ExecutionRun {
  id: string;
  timestamp: string;
  startedAt: string;
  workflowName: string;
  status: 'success' | 'error' | 'cancelled';
  duration: number;
  nodesExecuted: number;
  log: LogEntry[];
  context: ExecutionContext;
  nodePerf: Record<string, number>;
}

// Lint issues
export type LintSeverity = 'error' | 'warning';
export interface LintIssue {
  id: string;
  severity: LintSeverity;
  message: string;
  nodeId?: string;
}
